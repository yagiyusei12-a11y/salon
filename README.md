# Salon MVP

美容室向け管理システムのMVPです。現在は以下を実装しています。

- 認証（NextAuth Credentials）
- テナント分離を前提にしたユーザー/顧客データモデル
- 顧客の新規登録と一覧表示
- 予約管理（スタッフ重複予約チェック付き）
- 予約編集・キャンセル
- スタッフ別 日/週カレンダー表示
- メニュー管理（CRUD）
- 会計登録と日次売上集計
- ダッシュボードKPI（7日売上推移・支払方法比率・スタッフ別売上）
- 顧客詳細ページ（来店履歴・会計履歴・次回予約導線）
- 予約と会計の連動（未会計表示・予約から会計作成）
- 権限管理（OWNERのみメニュー管理）
- スタッフ管理（OWNERがスタッフ追加・権限/有効状態変更）
- 監査ログ（誰が・いつ・何を変更したか）
- 予約完了フロー（来店完了 -> 未会計アラート -> 会計誘導）
- 今日の予約ボード（当日オペレーション高速化）
- 予約検索・フィルター（顧客/スタッフ/ステータス/期間）
- 会計検索・集計フィルター（日付範囲/スタッフ/支払方法/顧客）
- 顧客検索・タグ管理（VIP/要注意/新規）
- CSVエクスポート（顧客/予約/会計）
- ダッシュボード導線（VIP顧客ショートカット）
- 通知センター（未会計/本日予約/要注意顧客リマインド）
- JSONバックアップ/復元（OWNER専用・全置換）
- 主要フォームの送信中表示・成功/失敗メッセージ表示の統一
- 処理後のフィルター状態維持（一覧オペレーションの再検索削減）
- 通知センターの優先度表示・重要のみ表示・簡易既読（非表示）
- マスタ画面の検索/並び替え/表示件数/空状態メッセージ統一
- CSV出力へのフィルター反映（表示中条件でエクスポート）
- 一覧画面の運用補助（最終更新時刻、条件サマリー、クイックリセット）
- 予約/会計の日付プリセット（今日・今週・今月）

## Tech Stack

- Next.js (App Router)
- Prisma + SQLite
- NextAuth

## Setup

1. 依存関係をインストール

```bash
npm install
```

2. 環境変数を設定

```bash
copy .env.example .env
```

3. DBスキーマを反映

```bash
npm run prisma:generate
npm run prisma:push
```

4. デモユーザー作成

```bash
npm run prisma:seed
```

5. 開発サーバー起動

```bash
npm run dev
```

または、初期化と起動を一括で実行:

```bash
npm run dev:auto
```

初期化だけ実行したい場合:

```bash
npm run setup
```

## Windows Auto Start

- ワンクリック起動: `start-dev.bat` をダブルクリック
- PowerShellから実行: `npm run dev:ps1`
- ログイン時に自動起動（管理者不要・推奨）:

```bash
npm run startup:enable
```

- 自動起動を無効化:

```bash
npm run startup:disable
```

- タスクスケジューラ登録（環境によっては管理者権限が必要）:

```bash
npm run startup:register
```

- 自動起動タスク削除:

```bash
npm run startup:unregister
```

## Deploy (Vercel + PostgreSQL)

このプロジェクトをVercelで運用する場合は、`DATABASE_URL` に PostgreSQL を設定してください（SQLiteは本番運用に不向きです）。

### 1) GitHub に push

```bash
git add .
git commit -m "prepare vercel deployment"
git push
```

### 2) PostgreSQL を用意

Neon / Supabase / PlanetScale(Postgres) などでDBを作成し、接続文字列を取得します。

`DATABASE_URL` 例:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require"
```

### 3) Vercel に環境変数を設定

- `DATABASE_URL` (PostgreSQL)
- `NEXTAUTH_SECRET` (十分長いランダム文字列)
- `NEXTAUTH_URL` (`https://<your-app>.vercel.app`)

### 4) マイグレーションを本番DBへ反映

```bash
npm run prisma:migrate:deploy
npm run prisma:seed
```

`http://localhost:3000` にアクセスし、以下でログインできます。

- Email: `owner@example.com`
- Password: `password123`

## Implemented Routes

- `/login`: ログイン画面
- `/`: ダッシュボード
- `/customers`: 顧客管理
- `/customers/[id]`: 顧客詳細
- `/appointments`: 予約管理
- `/menus`: メニュー管理
- `/payments`: 会計管理
- `/staff`: スタッフ管理（OWNER専用）
- `/audit-logs`: 監査ログ（OWNER専用）
- `/api/exports?kind=customers|appointments|payments`: CSV出力
- `/api/health`: ヘルスチェック（稼働確認/バージョン）
- `/notifications`: 通知センター
- `/backup`: JSONバックアップ/復元（OWNER専用）
- `/api/backup`: JSONバックアップAPI（GET:出力 / POST:復元）

## Daily Operation Guide

### 1) 開店時（当日オペレーション確認）

1. ダッシュボードで通知件数と未会計アラートを確認
2. `予約管理` の「今日の予約ボード」で当日予約を確認
3. 必要に応じて `通知センター` で重要通知のみ表示して対応

### 2) 来店〜会計

1. `予約管理` で対象予約を `来店完了`
2. そのまま `会計登録` へ遷移（予約から会計導線あり）
3. 会計登録後、成功メッセージと一覧反映を確認

### 3) 閉店時（点検）

1. ダッシュボードの未会計件数が0か確認
2. `会計管理` で当日絞り込みし件数/金額を確認
3. 必要に応じて CSV を現在フィルター条件で出力

### 4) 週次バックアップ（OWNER）

1. `バックアップ` 画面で JSON エクスポート
2. 安全な保管先へ保存（外部共有は避ける）
3. 同画面の「バックアップ実行履歴」に記録を確認

## Current Filter-aware CSV Export

以下の画面では、表示中の主な検索条件を CSV 出力に反映します。

- `customers`: `q`, `tag`, `sort`
- `appointments`: `q`, `staffId`, `status`, `from`, `to`, `sort`
- `payments`: `q`, `staffId`, `method`, `from`, `to`, `sort`

## Notes

- 危険操作（予約キャンセル・メニュー削除）は確認ステップ付きです。
- 予約所要時間は `5〜600分`、会計金額は `1〜9,999,999円` を目安に入力制約を設定しています。
- 復元（全置換）は取り消し不可です。実行前に必ず最新バックアップを取得してください。

## Release Checklist (v1)

### Application

- [ ] `npm run lint` が成功する
- [ ] `npm run build` が成功する
- [ ] `/api/health` が `ok: true` を返す
- [ ] OWNER / STAFF のログイン確認
- [ ] 主要フロー確認（顧客登録 -> 予約 -> 来店完了 -> 会計）
- [ ] 通知センター（重要のみ表示、既読非表示）の確認

### Data & Export

- [ ] CSV出力（顧客/予約/会計）が現在フィルターで出力される
- [ ] JSONバックアップのエクスポートが成功する
- [ ] テスト環境でバックアップ復元（全置換）を実施し整合性確認
- [ ] 監査ログに主要操作（create/update/delete/import/export）が残る

### Ops & Security

- [ ] `.env` に本番値を設定（`NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `DATABASE_URL`）
- [ ] デモアカウントのパスワードを変更
- [ ] 不要アカウントの無効化を確認
- [ ] バックアップ保管先・運用担当を決定
- [ ] ログイン画面の運用注意に沿って初期認証情報を更新

## Changelog

### 2026-04 (MVP hardening)

- 認証・権限管理（OWNER/STAFF）を実装
- 顧客/予約/会計/メニュー/スタッフ/監査ログの主要画面を実装
- 予約と会計を連動し、未会計検知と会計導線を追加
- 通知センター（優先度・重要のみ表示・簡易既読）を追加
- JSONバックアップ/復元（OWNER専用・全置換）を追加
- 一覧UIを改善（検索/並び替え/件数表示/空状態/フィルター維持）
- 危険操作の確認ステップ（予約キャンセル・メニュー削除）を追加
- CSV出力に表示中フィルター条件を反映
