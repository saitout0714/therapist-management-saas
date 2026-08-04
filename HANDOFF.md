# 作業引き継ぎメモ

最終更新: 2026-08-04

別のPCで作業を再開するときは、このファイルを読んでから続きに入ってください。

---

## いま取り組んでいること

サイドバーと設定画面の再設計。機能追加のたびにメニューと設定項目が散らばってしまったため、
「どこに何があるか」を整理し直している。

---

## 完了したこと

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

1. **テンプレート設定の統合** — `/system` のテンプレート4タブと `/rooms` のルーム別
   テンプレート4種に分かれている
2. **設定の入口を一本化** — 現在は `/system`（5カテゴリ×14タブ）、`/rooms`、`/sync` に分散。
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

---

## 掃除の候補

- テストアカウント4件（`test_user_*` / `test_flow_*`）がアカウント管理に残っている
- 辻堂茅ヶ崎の予約コードが `test-code-1783674298846` のまま
- SpecialGrade以外の27店舗は、キャッチコピー・営業時間等が未入力
  （これまで保存できなかったため）
