/**
 * ポータル各社(エステ魂・メンズエステランキング・エステラブ)がVercelサーバーのIPを
 * 403でブロックする問題への対処。
 *
 * 【背景】
 * 2026年8月、3ポータルとも本番サーバー(Vercel/AWS東京)のIPからのアクセスを
 * 403で拒否するようになった。実測でIPアドレス由来の問題と判明しており、
 * コードやヘッダーの調整では解決しない。
 *
 * ただし、どのレンタルサーバーのIPなら通るかはポータルごとに異なる(2026-08-22実測)。
 *   - エステラブ: さくらのIPなら通る。ConoHa WINGのIPは403
 *   - メンズエステランキング: さくらのIPは(TCP接続自体が応答なしになる形で)不通。
 *     ConoHa WINGのIPなら通る
 * そのため中継先を1つに固定せず、呼び出し元ごとに「どの中継設定を使うか」を
 * 選べるようにしている(startSshSocksRelay の envPrefix 引数)。
 *
 * 【方式】
 * 契約中のレンタルサーバーにSSH接続し(この用途専用の鍵を使う)、ローカルに
 * 立てたSOCKS5サーバー経由でSSHトンネルへ転送する。Playwrightのchromiumに
 * この SOCKS5 サーバーを proxy として渡すことで、ブラウザの通信がそのサーバーの
 * IPから出て行くようにする。相手サーバー側には何もインストール・常駐させる
 * 必要がない(SSH接続を受け付けるだけでよい)。
 *
 * 【1本のSSH接続を使い回す】
 * SOCKS接続1件につき新しいSSH接続を張る設計にしていた時期があるが、これは誤り
 * だった。chromiumはページ1枚を開くだけでも10本以上のTCP接続を同時に張るため、
 * その数だけSSHハンドシェイクが殺到し、さくらのsshd側で弾かれて
 * ERR_SOCKS_CONNECTION_FAILED が散発する(2026-08-22 実測)。
 *
 * 当時「さくらのsshdは1本の接続で2つ目以降のチャンネルを開けない」と結論づけて
 * いたが、実際に検証すると逐次5本・同時8本とも問題なく開けた。原因はsshdではなく、
 * 後片付け処理がチャンネルを閉じるついでに共有中のSSH接続ごと ssh.end() で
 * 落としていたこと。そのため2本目以降が無応答に見えていた。
 * → 後片付けでは絶対に ssh.end() を呼ばないこと。閉じてよいのはチャンネルと
 *   SOCKSソケットだけで、SSH接続を閉じるのは relay.close() のときだけ。
 *
 * 環境変数が未設定の場合は何もせず null を返す。ローカル実行(店舗PCなど)は
 * そもそも403の対象外なので、プロキシは常にVercel本番でのみ使う想定。
 */
import { Client } from 'ssh2';
import net from 'net';

export interface SshSocksRelay {
  /** Playwrightのlaunch({ proxy: { server } })にそのまま渡せるSOCKS5サーバーURL */
  server: string;
  /** SOCKS5サーバーを閉じる(進行中の接続があればそれも閉じる) */
  close: () => void;
}

interface RelayConfig {
  host: string;
  port: number;
  username: string;
  privateKey: string;
  passphrase?: string;
}

/** 環境変数名の接頭辞。'SSH_RELAY'(さくら・エステラブ用)か 'RANKING_RELAY'(ConoHa・ランキング用)。 */
type EnvPrefix = string;

const DEFAULT_PREFIX: EnvPrefix = 'SSH_RELAY';

function envNames(prefix: EnvPrefix) {
  return {
    host: `${prefix}_HOST`,
    port: `${prefix}_PORT`,
    user: `${prefix}_USER`,
    privateKey: `${prefix}_PRIVATE_KEY`,
    passphrase: `${prefix}_PASSPHRASE`,
  };
}

function readEnv(prefix: EnvPrefix): RelayConfig | null {
  const names = envNames(prefix);
  const host = process.env[names.host];
  const port = parseInt(process.env[names.port] || '22', 10);
  const username = process.env[names.user];
  const rawKey = process.env[names.privateKey];
  if (!host || !username || !rawKey) return null;
  // Vercelの環境変数はエスケープされた \n で改行が入ってくることがあるため復元する。
  // 末尾の改行が無い秘密鍵はssh2が「解析できない鍵」として弾くため補っておく。
  let privateKey = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;
  if (!privateKey.endsWith('\n')) privateKey += '\n';
  // パスフレーズ付きの鍵はこれが無いと ssh2 が
  // 「Encrypted private OpenSSH key detected, but no passphrase given」で失敗する
  const passphrase = process.env[names.passphrase] || undefined;
  return { host, port, username, privateKey, passphrase };
}

/**
 * 直近に起動した中継の稼働実績(中継設定の接頭辞ごと)。
 *
 * 【なぜ必要か】
 * 中継は環境変数が未設定なら黙って null を返し、呼び出し側は何事もなく直接接続に
 * フォールバックする。そのため本番でポータルに403で弾かれたとき、「中継を通った上で
 * 中継先のIPが弾かれた」のか「そもそも中継が働かず本番サーバーのIPで出て行った」のかを
 * 区別できず、切り分けが進まなかった。失敗時のエラーにこの実績を添えることで区別する。
 *
 * 同期は店舗ごとに直列で走らせている前提でモジュール変数に持っている。
 * 同じ接頭辞を並列実行した場合は最後に起動した中継の値で上書きされる。
 */
const relayStatsByPrefix = new Map<EnvPrefix, { started: boolean; opened: number; failed: number; lastError: string }>();

function getStats(prefix: EnvPrefix) {
  let s = relayStatsByPrefix.get(prefix);
  if (!s) {
    s = { started: false, opened: 0, failed: 0, lastError: '' };
    relayStatsByPrefix.set(prefix, s);
  }
  return s;
}

/** ポータル同期の失敗時にエラーへ添える、中継の設定状況と稼働実績の説明文 */
export function describeRelayState(prefix: EnvPrefix = DEFAULT_PREFIX): string {
  const names = envNames(prefix);
  const required = [names.host, names.user, names.privateKey];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    return `SSH中継(${prefix})は未設定のため、本番サーバーのIPから直接アクセスしました（未設定の環境変数: ${missing.join(', ')}）`;
  }
  const via = `${process.env[names.user]}@${process.env[names.host]}:${process.env[names.port] || '22'}`;
  const stats = getStats(prefix);
  if (!stats.started) {
    return `SSH中継(${prefix})は設定済み（${via}）だが、今回の処理では起動されませんでした`;
  }
  const err = stats.lastError ? `、最後のエラー: ${stats.lastError}` : '';
  return `SSH中継(${prefix})あり（${via} 経由）／中継の接続実績: 成功${stats.opened}件・失敗${stats.failed}件${err}`;
}

/**
 * 契約中のレンタルサーバーへのSSHトンネルを使うローカルSOCKS5サーバーを起動する。
 * 環境変数が未設定なら null を返す(呼び出し側はプロキシなしで直接接続すればよい)。
 *
 * @param prefix どの中継設定を使うか。省略時は 'SSH_RELAY'(さくら)。
 *   メンズエステランキング向けには 'RANKING_RELAY'(ConoHa WING) を渡す。
 */
export async function startSshSocksRelay(prefix: EnvPrefix = DEFAULT_PREFIX): Promise<SshSocksRelay | null> {
  const cfg = readEnv(prefix);
  if (!cfg) return null;

  const relayStats = getStats(prefix);
  relayStats.started = true;
  relayStats.opened = 0;
  relayStats.failed = 0;
  relayStats.lastError = '';

  const DEBUG = !!process.env.SSH_RELAY_DEBUG;
  let connSeq = 0;
  const activeSockets = new Set<net.Socket>();

  let sharedSsh: Client | null = null;
  let connecting: Promise<Client> | null = null;
  let closed = false;

  const connectSsh = async (): Promise<Client> => {
    const ssh = new Client();
    // 接続確立後にもerrorは飛んでくる。ハンドラが無いとNodeのプロセスごと落ちるため
    // 常設のハンドラを付け、落ちた接続は使い回しの対象から外す。
    ssh.on('error', (e: Error) => {
      relayStats.lastError = e.message;
      if (sharedSsh === ssh) sharedSsh = null;
    });
    ssh.on('close', () => {
      if (sharedSsh === ssh) sharedSsh = null;
    });
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        ssh.once('ready', () => resolve());
        ssh.once('error', reject);
        ssh.connect({
          host: cfg.host,
          port: cfg.port,
          username: cfg.username,
          privateKey: cfg.privateKey,
          passphrase: cfg.passphrase,
          readyTimeout: 15000,
          keepaliveInterval: 10000,
        });
      }),
      15000,
      'SSH接続'
    );
    return ssh;
  };

  /**
   * 共有のSSH接続を返す。まだ無ければ張る。同時に呼ばれても1本しか張らない。
   * forceNew を渡すと、生きているように見える接続を捨てて張り直す
   * (チャンネルの確立だけが無応答になり、接続自体は閉じていない場合の復旧用)。
   */
  const getSsh = (forceNew = false): Promise<Client> => {
    if (closed) return Promise.reject(new Error('中継は既に閉じられています'));
    if (forceNew && sharedSsh) {
      sharedSsh.end();
      sharedSsh = null;
    }
    if (sharedSsh) return Promise.resolve(sharedSsh);
    if (!connecting) {
      connecting = connectSsh()
        .then((ssh) => { sharedSsh = ssh; connecting = null; return ssh; })
        .catch((e) => { connecting = null; throw e; });
    }
    return connecting;
  };

  const socksServer = net.createServer((socket) => {
    const id = ++connSeq;
    activeSockets.add(socket);
    socket.once('close', () => activeSockets.delete(socket));
    if (DEBUG) console.error(`[socks#${id}] new connection`);
    handleSocksConnection(getSsh, socket, DEBUG ? id : undefined)
      .then(() => { relayStats.opened++; })
      .catch((e) => {
        relayStats.failed++;
        relayStats.lastError = (e as Error).message;
        if (DEBUG) console.error(`[socks#${id}] error`, e);
        socket.destroy();
      });
  });

  const port = await new Promise<number>((resolve, reject) => {
    socksServer.once('error', reject);
    socksServer.listen(0, '127.0.0.1', () => {
      const addr = socksServer.address();
      if (addr && typeof addr === 'object') resolve(addr.port);
      else reject(new Error('SOCKSサーバーのポート取得に失敗しました'));
    });
  });

  const close = () => {
    if (closed) return;
    closed = true;
    socksServer.close();
    for (const s of activeSockets) s.destroy();
    // SSH接続を閉じてよいのはここだけ。個々のチャンネルの後片付けでは閉じない。
    if (sharedSsh) {
      sharedSsh.end();
      sharedSsh = null;
    }
  };

  return { server: `socks5://127.0.0.1:${port}`, close };
}

const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label}がタイムアウトしました(${ms}ms)`)), ms)),
  ]);

/**
 * 1接続分のSOCKS5ハンドシェイク(認証なし・CONNECTのみ対応)を処理し、
 * 成立したら共有のSSH接続上にチャンネルを1本開いてそこへ流し込む。
 * Chromiumが使う分にはCONNECT以外のコマンドは来ない。
 */
async function handleSocksConnection(
  getSsh: (forceNew?: boolean) => Promise<Client>,
  socket: net.Socket,
  dbgId?: number
): Promise<void> {
  const log = dbgId ? (...args: any[]) => console.error(`[socks#${dbgId}]`, ...args) : () => {};
  const reader = createByteReader(socket);

  const greeting = await reader.readBytes(2);
  const nMethods = greeting[1];
  await reader.readBytes(nMethods); // メソッド一覧は読み捨てる(認証なし固定で応答する)
  socket.write(Buffer.from([0x05, 0x00])); // VER=5, METHOD=0x00(no auth)

  const reqHead = await reader.readBytes(4);
  const [, cmd, , atyp] = reqHead;
  if (cmd !== 0x01) throw new Error(`未対応のSOCKSコマンド: ${cmd}`); // CONNECT以外は非対応

  let dstHost: string;
  if (atyp === 0x01) {
    const addr = await reader.readBytes(4);
    dstHost = Array.from(addr).join('.');
  } else if (atyp === 0x03) {
    const lenBuf = await reader.readBytes(1);
    const addr = await reader.readBytes(lenBuf[0]);
    dstHost = addr.toString('utf8');
  } else if (atyp === 0x04) {
    const addr = await reader.readBytes(16);
    dstHost = Array.from({ length: 8 }, (_, i) => addr.readUInt16BE(i * 2).toString(16)).join(':');
  } else {
    throw new Error(`未対応のATYP: ${atyp}`);
  }
  const portBuf = await reader.readBytes(2);
  const dstPort = portBuf.readUInt16BE(0);
  log('CONNECT', dstHost, dstPort);

  // forwardOut()は、さくらのsshd(またはその手前のファイアウォール)が要求を黙って
  // 無視した場合にコールバックが永久に呼ばれないことがある(ssh2ライブラリ自体には
  // タイムアウト機構がない)。そのため必ず自前でタイムアウトを掛ける。
  const openChannel = (ssh: Client) =>
    withTimeout(
      new Promise<NodeJS.ReadWriteStream>((resolve, reject) => {
        ssh.forwardOut('127.0.0.1', 0, dstHost, dstPort, (err: any, ch: any) => {
          if (err) reject(err);
          else resolve(ch);
        });
      }),
      10000,
      'SSHチャンネルの確立'
    );

  try {
    let channel: NodeJS.ReadWriteStream;
    try {
      channel = await openChannel(await getSsh());
    } catch (e) {
      // 一度だけやり直す。接続が死んでいれば getSsh() が新しい接続を張り直してくれる。
      //
      // ここで強制的に張り直してはいけない。応答しない相手(メンズエステランキング等)への
      // チャンネルがタイムアウトしただけで共有接続を落とすと、同時に進行している
      // 他サイトへの通信まで道連れになる。実際それで直後のリクエストが軒並み
      // ERR_SOCKS_CONNECTION_FAILED になっていた。
      log('チャンネル確立に失敗、やり直します:', (e as Error).message);
      channel = await openChannel(await getSsh());
    }
    log('channel open');

    reader.detach();

    // VER=5, REP=0(成功), RSV=0, ATYP=1(IPv4), BND.ADDR=0.0.0.0, BND.PORT=0
    socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));

    socket.pipe(channel).pipe(socket);
    // 閉じるのはこのチャンネルとSOCKSソケットだけ。共有のSSH接続は他のチャンネルが
    // 使っているので、ここで ssh.end() を呼んではいけない(呼ぶと2本目以降が全滅する)。
    const cleanup = () => { socket.destroy(); (channel as any).destroy(); };
    socket.on('close', cleanup);
    socket.on('error', cleanup);
    channel.on('close', cleanup);
    channel.on('error', cleanup);
  } catch (e) {
    log('failed', (e as Error).message);
    throw e; // 共有のSSH接続は閉じない。この1接続を諦めるだけ。
  }
}

/**
 * ソケットに'data'リスナーを1つだけ張り続け、内部バッファから必要バイト数を切り出す形の
 * 読み取りヘルパー。socket.unshift()は'data'イベント経由の消費と相性が悪く、
 * ハンドシェイクが特定のタイミングでハングする不具合の原因になったため、この方式にした。
 */
function createByteReader(socket: net.Socket) {
  let buffer = Buffer.alloc(0);
  let waiter: (() => void) | null = null;

  const wake = () => {
    if (waiter) {
      const w = waiter;
      waiter = null;
      w();
    }
  };
  const onData = (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    wake();
  };
  socket.on('data', onData);
  socket.on('error', wake);
  socket.on('close', wake);

  async function readBytes(n: number): Promise<Buffer> {
    if (n === 0) return Buffer.alloc(0);
    while (buffer.length < n) {
      if (socket.destroyed) throw new Error('SOCKSクライアントが接続を閉じました');
      await new Promise<void>((resolve) => { waiter = resolve; });
    }
    const result = buffer.subarray(0, n);
    buffer = buffer.subarray(n);
    return result;
  }

  function detach() {
    socket.off('data', onData);
    socket.off('error', wake);
    socket.off('close', wake);
  }

  return { readBytes, detach };
}
