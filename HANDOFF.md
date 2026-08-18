# 作業引き継ぎメモ

最終更新: 2026-08-18

別のPCで作業を再開するときは、このファイルを読んでから続きに入ってください。

---

## いま取り組んでいること

**おニャンこスパ（onyankospa.com）の本番公開は完了（2026-08-18）。** DNS切替・デプロイ・
本番HTML検証まで完了し、実際にブラウザで画像込みで表示できることを確認済み。
残っているのは Search Console へのサイトマップ登録（ユーザー側の手動操作が必要）と、
優先度中の SEO 残作業（OG画像・他店舗のslug・userScalable）。
詳細は下の「2026-08-18 の作業」を読んでから始めること。

---

## 2026-08-18 の作業: おニャンこスパ SEO対応

### 最初の状態（何が問題だったか）

公開HPを実測したところ、SEOがほぼ機能しない状態だった。

- 全店舗の全ページで `<title>YOYAKL`、description が「セラピストシフト・予約管理システム」。
  `generateMetadata` がコードベースに1つも無かった
- 全ページが `'use client'` + `useEffect` 取得だったため、**クローラに届くHTMLの本文が空**。
  `豊島区` `南大塚` の出現回数が 0、セラピスト名も営業時間も空タグだった
- `[shopSlug]` が任意のパスを拾い、`/wp-admin` `/.env` `/robots.txt` まで
  **HTTP 200 で Special Grade の内容**を返していた（ソフト404・重複コンテンツ）
- robots.txt / sitemap.xml / canonical / OGP / 構造化データ すべて無し

### 入れたもの

| ファイル | 役割 |
|---|---|
| `lib/shopDomains.ts` | 独自ドメイン⇄slug、canonicalオリジン。**依存ゼロを保つこと**（middlewareのEdgeバンドルと共用のため、Supabase等をimportしてはいけない） |
| `lib/seo.ts` | `fetchShopSeo`（厳格取得）/ `buildShopMetadata` / JSON-LD生成 |
| `app/[shopSlug]/layout.tsx` | DBに実在しないslugを `notFound()` に |
| `app/[shopSlug]/(public)/layout.tsx` | TOPのmetadata + LocalBusiness JSON-LD |
| 各ページの `layout.tsx` ×8 | ページ別 title/description/canonical |
| `app/robots.ts` / `app/sitemap.ts` | ホスト別に出力 |
| `components/store/TherapistFilterableGrid.tsx` | 一覧のタグ絞り込み（クライアント島） |
| `components/store/TherapistDetailView.tsx` | セラピスト詳細の表示部（クライアント島） |

**`fetchStoreConfig()` と `fetchShopSeo()` の違いに注意。** 前者は見つからないとモック店舗
（Special Grade）にフォールバックする。だから存在しないURLが200を返していた。
ルート検証とメタデータには**必ず後者**を使うこと（見つからなければ null を返す）。

### SSR化

公開ページ7つの取得をサーバー側に移した。見た目は変えていない。

- TOP / アクセス / 料金 / 求人 / スケジュール → ページ全体をサーバーコンポーネント化
- セラピスト一覧・詳細 → 表示部をクライアント島に切り出し、データはpropsで渡す

**要点: 問題は「クライアントコンポーネントであること」ではなく「useEffectで取得していたこと」。**
クライアントコンポーネントもSSRはされるので、propsでサーバー取得データを渡せば本文はHTMLに載る。

結果: TOPのHTMLが 40KB → 149KB、`南大塚` が 0回 → 21回。全ページでセラピスト名・料金・
住所・営業時間がHTMLに出るようになった。

### ついでに直した不具合

- **middlewareが `/robots.txt` を `/onyankospa/robots.txt` にリライトして404にしていた。**
  独自ドメインでのみ露出するバグ。ルート直下に必要なファイル（robots/sitemap/favicon/
  `.well-known/`/Search Console確認用HTML）を `isRootAsset()` で除外した
- `WeeklySchedule` の setState-in-effect。営業日が非同期で届く前提の後追い修正だったが、
  サーバーから初回描画時に渡るようになったので effect ごと削除した

### DNSの状態（2026-08-17 時点の実測）

お名前.comで設定中。ネームサーバー変更のため反映に27時間程度かかるとのこと。

```
NS : ns-rs1.gmoserver.jp / ns-rs2.gmoserver.jp（お名前.comレンタルサーバー側のDNS）
A  : 157.120.209.57 → GMOのサーバー。Vercelではない
http  → 403 Forbidden（GMOのApache）
https → 503
```

**⚠️ ネームサーバーを変更すると MX と SPF が引き継がれない。** 切替後のDNS設定画面で
以下を手動で再登録しないと `@onyankospa.com` 宛のメールが届かなくなる。

| 種別 | ホスト名 | 値 | 優先度 |
|---|---|---|---|
| A | （空） | Vercelの IP（Vercelのドメイン画面に表示される値） | — |
| CNAME | www | `cname.vercel-dns.com` | — |
| MX | （空） | `mail1042.onamae.ne.jp` | 10 |
| TXT | （空） | `v=spf1 include:_spf.onamae.ne.jp ~all` | — |

---

## 2026-08-18 の続き: DNS切替・デプロイ・本番公開完了

### DNS切替

お名前.comの「ネームサーバー設定」画面で、実際には**ネームサーバー変更が一度も申請されて
いなかった**（DNSレコード設定＝01〜04.dnsv.jp側にA/CNAMEを用意しただけの状態で止まっていた）。
「DNSレコード設定用ネームサーバー変更確認」にチェックを入れてMX/TXTと同時に確定申請したところ、
数分〜十数分でNS/A/CNAME/MX/TXTすべて反映された（お名前.com側の案内は最大72時間だが、
実際はかなり早かった）。

### SSL証明書は発行に時間差がある

Vercel側はドメイン接続済みでも、証明書は **apex（onyankospa.com）とwww（www.onyankospa.com）
で別々に発行される。** apexが先に発行され、その状態でapex→wwwへ308リダイレクトする設定に
なっていたため、**wwwの証明書が追いつくまでの数分〜数十分、サイト全体が閲覧不可**になった
（`SEC_E_WRONG_PRINCIPAL`＝証明書とホスト名の不一致）。Vercelの「SSL Certificates」欄で
CN一覧を見れば発行状況が分かる。エラー表示は出ない・ただ「まだ無い」だけなので、
気づきにくい。

**ブラウザキャッシュの罠:** 証明書が揃った後も、途中の失敗状態を先に読み込んでいた
タブ・プロファイルでは「保護されていない通信」の表示が残り続けた。シークレットウィンドウでは
正常に見えたため、サーバー側ではなくブラウザ側のキャッシュと判明。ブラウザの再起動で解消。
実際に見えているのに「まだ直っていない」と誤認しやすいので注意。

### 【重大】独自ドメインで画像が全滅していたバグ

デプロイ後、本番で**画像が1枚も表示されない**不具合を発見。原因は以前直した
「middlewareがrobots.txt等を`/[shopSlug]/...`に誤ってリライトして404にする」バグの
再発・未網羅だった。`isRootAsset()` はrobots/sitemap/faviconなど個別ファイル名しか
除外しておらず、`/images/*.jpg` のような `public/` 配下の静的ファイル全般が対象外だった。
そのため `onyankospa.com/images/xxx.jpg` が存在しない `onyankospa.com/onyankospa/images/xxx.jpg`
に書き換えられ、ローカル画像もSupabase画像のフォールバックSVGも含めて全部404になっていた。

`middleware.ts` の `isRootAsset()` に「拡張子を持つパスは常にそのまま配信する」という
一般ルールを追加して解消（`fix: 独自ドメインで/images配下の静的ファイルが全て404になる
不具合を修正し、店舗公開ページをnext/image化` コミットで対応）。**独自ドメインを使う店舗が
増えるほど踏みやすいバグなので、他店舗を独自ドメイン化する際も画像表示は必ず確認すること。**

### next/image化（SEO残り5番、完了）

店舗公開ページ8ファイル（TherapistCard / HeroBanner / HeroBannerSlider /
ImageLightboxModal / DiarySection / TherapistDetailView / TOPページ / 日記詳細ページ）の
生`<img>`を`next/image`に置き換え。管理画面・セラピスト専用画面（ログイン必須でクローラに
見えない）は対象外とした。ビルド・lint（no-img-element警告0件）・本番での実画像読み込みまで確認済み。

### 本番検証結果

title / meta description / meta robots(`index, follow`) / canonical(`https://onyankospa.com`) /
OGP一式 / JSON-LD(`HealthAndBeautyBusiness`) / robots.txt / sitemap.xml、すべて意図通り出力
されていることを確認済み。

### Search Console登録（未実施・ユーザー操作待ち）

手順は案内済み。URLプレフィックスで `https://onyankospa.com` を登録し、サイトマップに
`https://onyankospa.com/sitemap.xml` を登録する。所有権確認はHTMLタグ方式が簡単
（発行されたmetaタグを`app/[shopSlug]/(public)/layout.tsx`あたりに埋め込んで再デプロイが必要）。

---

## 完了したこと（2026-08-04 まで）

### 1. 本番DBのスキーマ不足を解消

`supabase/fix-shop-settings-schema.sql`（適用済み）

`shops` テーブルに列が存在せず、**店舗設定の保存が毎回失敗していた**。PostgREST は未知の列が
1つでもあると UPDATE 全体を拒否するため、店舗名や電話番号まで巻き添えで保存されていなかった。
公開HPは `lib/storeApi.ts` のフォールバックで、全店舗が `mock/specialgrade.ts` のサンプル文
（「赤羽・川口 メンズエステ〜」等）を表示していた。

- 追加した列: `catchphrase` `access_info` `business_hours` `address` `google_map_url`
  `line_url` `x_url` `litlink_url` `notice_banner` `slug` `plan` `has_hp` `has_reserve` `has_agency`
- 追加したテーブル: `campaigns`（HPバナー）、`news_items`（トピックス）— どちらも存在しなかった
- `shops` は 28 → 42 列に

**`phone_number` と `twitter_url` は意図的に作っていない。** 実DBに無く、読み取り側も
`phone` / `x_url` を優先しているため。コード側の二重書き込みは削除済み。

### 2. 各店舗の契約プランを設定

`supabase/set-shop-plans.sql`（適用済み）

- SpecialGrade → `hp_web_reserve_plan`（HP＋Web予約、代行なし）
- こころリンス2店舗 → `web_agency_plan`（代行＋Web予約）
- 残り26店舗 → `agency_only_plan`（代行単体）

### 3. Web予約コードの保存先を修正

管理画面が存在しない `reservation_codes` に書き込んでいた。公開予約フローが読むのは
`shop_reservation_codes`。5か所を修正済み（`updated_at` 列は無いので送らないこと）。

### 4. オーナーアカウント編集を「アカウント管理」に集約

店舗編集画面のオーナー編集は、`users` に無い `shop_id` 列で検索し、実在しない `client_owner`
ロールを探していたため**一度も動いていなかった**。UIを削除し `/users` へ誘導。
契約プラン設定は店舗編集画面に残してある。

### 5. サイドバー再設計

`app/components/Sidebar.tsx`

- 7グループに再編（業務／報酬／分析／ホームページ／設定／運営者メニュー／セラピスト画面）
- 全項目にアイコン、折りたたみ時はアイコンだけの帯（旧実装は幅ゼロで消えていた）
- 現在地の判定を最長一致に変更（`/shifts` と `/shifts/register` が同時に光るバグを修正）
- **表示条件は `NAV_GROUPS` の `requires` に集約。** メニューを増やすときはここに1行足す
- スクロール位置を sessionStorage に保存（他アプリ往復でリロードが起きる運用のため）

### 6. プラン情報の一本化

`ShopContext` / `AuthContext` が `plan` `has_hp` 等を**取得しながら捨てていた**ため、
画面まで届いていなかった。両方で受け渡すよう修正。

店舗切替バーの「Web予約プラン」判定も、オーナーアカウントの役割からの推測をやめ、
`has_agency`（契約プラン）を見るよう統一。判定結果は全28店舗で従来と一致することを確認済み。

代行プラン集計は、マスターは全店舗、管理者・受付スタッフは代行プランの店舗のみを表示する。

### 7. 店舗基本情報の重複を解消

- `/system` の StoreInfoTab を**唯一の編集場所**にした。項目を追加（店舗略称・住所・
  GoogleマップURL・リットリンク）
- `/admin/store-setting` はHP専用（バナー・トピックス）に。重複フォームと未使用のロゴ
  アップロード処理を削除（739行 → 524行）

**このとき見つけた危険な不具合も修正済み:** StoreInfoTab は `selectedShop`（切替バー用の
軽量データ）から読んでいたが、そこに電話番号や営業時間は含まれていない。常に空欄が表示され、
保存すると既存データを空で上書きする状態だった。DBから直接読み直す形に変更した。

---

## 残っている作業

### おニャンこスパ 公開 — 完了（2026-08-18）

DNS反映・MX/SPF維持・デプロイ・本番HTML検証まで完了。残るは以下のみ。

1. **Search Console に `https://onyankospa.com/sitemap.xml` を登録**（ユーザーがGoogleに
   ログインして行う必要がある。手順は上の「Search Console登録」参照）

### SEOの残り（優先度中）

2. ~~`next/image` 化~~ — **完了（2026-08-18）**。店舗公開ページ8ファイルを変換済み
3. **OG画像** — 現在 `/images/onyanko_mainvisual.jpg`（1264×843）を流用。1.91:1 でないため
   SNSで上下が切れる。専用の1200×630を作る
4. **他28店舗の `slug` が未設定** — `fetchStoreConfig` の `ilike(name)` フォールバックで
   店名URL（`/SpecialGrade`）として解決されている。slugを入れると `/specialgrade` に正規化できる
5. **`app/layout.tsx` の `userScalable: false`** — Lighthouseのアクセシビリティ減点

### 以前からの継続

6. **テンプレート設定の統合** — `/system` のテンプレート4タブと `/rooms` のルーム別
   テンプレート4種に分かれている
7. **設定の入口を一本化** — 現在は `/system`（5カテゴリ×14タブ）、`/rooms`、`/sync` に分散。
   1つにまとめ、「店舗を立ち上げる順番」に並べ直す方針

---

## 作業上の注意

- **DBの接続先**: アプリの実DBは `.env.local` の `PRODUCTION_DATABASE_URL`
  （`NEXT_PUBLIC_SUPABASE_URL` と同じプロジェクト）。DEVELOPMENT 側は14列しかない別物で、
  ここにマイグレーションしても反映されない
- **本番データの変更は必ず内容を確認してから実行する**
- **保存処理をDBで検証するとき**は、アプリと同じ権限で試すこと。`shops` のRLSは
  `check_shop_access(id)` で、`auth.uid()` が NULL だと必ず FALSE を返す。psqlで
  `set local role anon` すると、エラーは出ないのに0行更新になり「保存できた」と誤認する

  ```sql
  select set_config('request.jwt.claims', '{"sub":"<public.usersと同じUUID>","role":"authenticated"}', true);
  set local role authenticated;
  ```

- **boolean のプランフラグに NOT NULL / DEFAULT false を付けないこと。** 全店舗が一斉に
  false になると、プラン名から推測するフォールバックが効かなくなる
- **予約フォームの時セレクトは 9〜29時。** 0時台を出すと営業日の誤入力事故につながる
  （過去に2回リグレッションあり）
- **canonical に到達できないドメインを載せないこと。** `lib/shopDomains.ts` の
  `SHOP_CANONICAL_ORIGIN` に追加した店舗は、canonical と sitemap がそのドメイン側に固定される。
  DNS未設定のドメインを指定するとインデックスされなくなる。`specialgrade.jp` は
  現在NXDOMAINなので、あえて載せていない（有効化したら追記する）
- **独自ドメインを新しく設定するときは画像表示を必ず確認する。** `middleware.ts` の
  `isRootAsset()` で拡張子付きパスを除外しているが、新しい種類の除外例外が必要になった場合は
  同じ場所に足すこと（詳細は上の「独自ドメインで画像が全滅していたバグ」参照）
- **既知のノイズ（追いかけなくてよい）**
  - `app/[shopSlug]/(public)/therapist/login/page.tsx:91` の `no-explicit-any` は以前からのlintエラー
  - `.next/types/validator.ts` が削除済みの `app/(admin)/register-therapist/page.js` を参照する
    型エラーは、古いビルド成果物由来。`npm run build` すれば再生成されて消える

---

## 掃除の候補

- テストアカウント4件（`test_user_*` / `test_flow_*`）がアカウント管理に残っている
- 辻堂茅ヶ崎の予約コードが `test-code-1783674298846` のまま
- SpecialGrade以外の27店舗は、キャッチコピー・営業時間等が未入力
  （これまで保存できなかったため）
