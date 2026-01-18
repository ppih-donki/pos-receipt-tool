# UTC保存・表示はJST変換（更新パッチ）

この更新は **DB保存はUTC(ISO)を正** にし、表示は必ず **JST変換** します。

## 1) D1にマイグレーション適用（既にDBがある場合）

wranglerで実行（例）:

```bash
npx wrangler d1 execute pos_receipts_db --remote --file=migrations/0002_add_registered_at_utc.sql
```

Cloudflare DashboardのD1コンソールで実行する場合は、`migrations/0002_add_registered_at_utc.sql` の中身を貼り付けて実行してください。

## 2) GitHubへ上書きしてデプロイ

このzipの中身をそのままリポジトリに上書きコミット → Pagesが自動デプロイされます。

## 3) 動作確認ポイント
- POSで登録 → DBの `transactions.registered_at_utc` がISOで入っている
- レシートサイトは `registered_at_utc` をJST表示している（端末のタイムゾーンに依存しない）

