/**
 * ポータル各社(エステ魂・メンズエステランキング・エステラブ)がVercelサーバーのIPを
 * 403でブロックする問題への対処。
 *
 * 【背景】
 * 2026年8月、3ポータルとも本番サーバー(Vercel/AWS東京)のIPからのアクセスを
 * 403で拒否するようになった。実測でIPアドレス由来の問題と判明しており、
 * コードやヘッダーの調整では解決しない。一方、契約中のさくらのレンタルサーバーの
 * IPからは3サイトとも到達できることを実測で確認済み。
 *
 * 【方式】
 * さくらのレンタルサーバーにSSH接続し(この用途専用の鍵を使う)、ローカルに
 * 立てたSOCKS5サーバー経由でSSHトンネルへ転送する。Playwrightのchromiumに
 * この SOCKS5 サーバーを proxy として渡すことで、ブラウザの通信が
 * さくらのIPから出て行くようにする。さくら側には何もインストール・常駐させる
 * 必要がない(SSH接続を受け付けるだけでよい)。
 *
 * 【SOCKS接続1件ごとに新しいSSH接続を張る理由】
 * 当初は1本のSSH接続を使い回し、CONNECT要求のたびにその上でチャンネルを
 * forwardOut()で開閉する設計にしていたが、実測でさくらのsshdは「1本のSSH接続の
 * 中で2つ目以降のチャンネルを開こうとすると応答を返さなくなる」ことが分かった
 * (1つ目のチャンネルをどれだけ丁寧に閉じてから2つ目を開いても再現する)。
 * 原因の切り分けに时間をかけたが解消できなかったため、SOCKS接続1本ごとに
 * 独立したSSH接続を新規に張る設計に変更した。ハンドシェイクの分だけ遅くなるが
 * (実測で数百ms程度)、確実に動作し、かつ複数接続を並行して処理できる。
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
}

function readEnv(): RelayConfig | null {
  const host = process.env.SSH_RELAY_HOST;
  const port = parseInt(process.env.SSH_RELAY_PORT || '22', 10);
  const username = process.env.SSH_RELAY_USER;
  const rawKey = process.env.SSH_RELAY_PRIVATE_KEY;
  if (!host || !username || !rawKey) return null;
  // Vercelの環境変数はエスケープされた \n で改行が入ってくることがあるため復元する
  const privateKey = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;
  return { host, port, username, privateKey };
}

/**
 * さくらへのSSHトンネルを使うローカルSOCKS5サーバーを起動する。
 * 環境変数が未設定なら null を返す(呼び出し側はプロキシなしで直接接続すればよい)。
 */
export async function startSshSocksRelay(): Promise<SshSocksRelay | null> {
  const cfg = readEnv();
  if (!cfg) return null;

  const DEBUG = !!process.env.SSH_RELAY_DEBUG;
  let connSeq = 0;
  const activeSockets = new Set<net.Socket>();

  const socksServer = net.createServer((socket) => {
    const id = ++connSeq;
    activeSockets.add(socket);
    socket.once('close', () => activeSockets.delete(socket));
    if (DEBUG) console.error(`[socks#${id}] new connection`);
    handleSocksConnection(cfg, socket, DEBUG ? id : undefined).catch((e) => {
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

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    socksServer.close();
    for (const s of activeSockets) s.destroy();
  };

  return { server: `socks5://127.0.0.1:${port}`, close };
}

/**
 * 1接続分のSOCKS5ハンドシェイク(認証なし・CONNECTのみ対応)を処理し、
 * 成立したら「その接続専用」の新しいSSH接続を張ってそこへ流し込む。
 * Chromiumが使う分にはCONNECT以外のコマンドは来ない。
 */
async function handleSocksConnection(cfg: RelayConfig, socket: net.Socket, dbgId?: number): Promise<void> {
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

  const ssh = new Client();
  const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
    Promise.race([
      p,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label}がタイムアウトしました(${ms}ms)`)), ms)),
    ]);

  try {
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        ssh.on('ready', () => resolve());
        ssh.on('error', reject);
        ssh.connect({
          host: cfg.host,
          port: cfg.port,
          username: cfg.username,
          privateKey: cfg.privateKey,
          readyTimeout: 10000,
        });
      }),
      10000,
      'SSH接続'
    );
    log('SSH ready');

    // forwardOut()は、さくらのsshd(またはその手前のファイアウォール)が要求を黙って
    // 無視した場合にコールバックが永久に呼ばれないことがある(ssh2ライブラリ自体には
    // タイムアウト機構がない)。そのため必ず自前でタイムアウトを掛ける。
    const channel = await withTimeout(
      new Promise<NodeJS.ReadWriteStream>((resolve, reject) => {
        ssh.forwardOut('127.0.0.1', 0, dstHost, dstPort, (err: any, ch: any) => {
          if (err) reject(err);
          else resolve(ch);
        });
      }),
      10000,
      'SSHチャンネルの確立'
    );
    log('channel open');

    reader.detach();

    // VER=5, REP=0(成功), RSV=0, ATYP=1(IPv4), BND.ADDR=0.0.0.0, BND.PORT=0
    socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));

    socket.pipe(channel).pipe(socket);
    const cleanup = () => { socket.destroy(); (channel as any).destroy(); ssh.end(); };
    socket.on('close', cleanup);
    socket.on('error', cleanup);
    channel.on('close', cleanup);
    channel.on('error', cleanup);
  } catch (e) {
    log('failed', (e as Error).message);
    ssh.end();
    throw e;
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
