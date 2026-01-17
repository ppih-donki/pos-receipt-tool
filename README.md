# pos-receipt-tool (Cloudflare Pages + Functions + D1)

## URLs
- 店員用: `/pos/`
- 購入者用: `/receipt/`

## 1) D1 を作成
Cloudflare Dashboard または wrangler で D1 DB を作成してください。

例（wrangler）:
- `wrangler d1 create pos_receipts_db`

## 2) マイグレーション適用
- `npm i`
- `npm run d1:migrate:remote`

## 3) マスタ投入（CSV → SQL → D1）
### 従業員（cashiers.csv）
- `node scripts/seed_cashiers.js ./cashiers.csv ./seed_cashiers.sql`
- `wrangler d1 execute pos_receipts_db --remote --file=./seed_cashiers.sql`

### 商品（products.csv）
- `node scripts/seed_products.js ./products.csv ./seed_products.sql`
- `wrangler d1 execute pos_receipts_db --remote --file=./seed_products.sql`

※ products.csv は CP932 / cashiers.csv は Shift-JIS を想定（添付FMTのままでOK）

## 4) Pages にデプロイ
おすすめは GitHub 連携（Functions と D1 を使うなら管理が楽です）。
- Output directory: `public`
- Functions: repo 直下の `functions/`
- D1 binding: `DB`

## 5) 動作確認
- `GET /api/health`
- `GET /api/cashiers`
- `GET /api/products?code=...`
- `POST /api/transactions`
- `GET /api/receipt?date=YYYY-MM-DD&receipt_no=...`
