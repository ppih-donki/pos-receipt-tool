PRAGMA foreign_keys=ON;

-- 商品マスタ（必要列のみ）
CREATE TABLE IF NOT EXISTS products (
  product_code TEXT PRIMARY KEY,
  product_category TEXT,
  product_name TEXT NOT NULL,
  pos_cost INTEGER,
  price_excl INTEGER NOT NULL,
  tax_rate INTEGER NOT NULL CHECK (tax_rate IN (8, 10)),
  updated_at_utc TEXT NOT NULL
);

-- 従業員（レジ担当者）マスタ：cashier_nameのみ
CREATE TABLE IF NOT EXISTS cashiers (
  cashier_name TEXT PRIMARY KEY,
  updated_at_utc TEXT NOT NULL
);

-- 取引ヘッダ（transaction_id = yyyymmdd_receiptNo）
CREATE TABLE IF NOT EXISTS transactions (
  transaction_id TEXT PRIMARY KEY,
  yyyymmdd TEXT NOT NULL,
  receipt_no TEXT NOT NULL,
  registered_at_jst TEXT NOT NULL,
  cashier_name TEXT NOT NULL,

  total_incl INTEGER NOT NULL,

  subtotal_excl_8 INTEGER NOT NULL,
  tax_8 INTEGER NOT NULL,
  subtotal_incl_8 INTEGER NOT NULL,

  subtotal_excl_10 INTEGER NOT NULL,
  tax_10 INTEGER NOT NULL,
  subtotal_incl_10 INTEGER NOT NULL,

  created_at_utc TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_yyyymmdd_receipt
  ON transactions(yyyymmdd, receipt_no);

-- 取引明細（同一商品はqtyでまとめた結果を保存）
CREATE TABLE IF NOT EXISTS transaction_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id TEXT NOT NULL,

  product_code TEXT NOT NULL,
  product_category TEXT,
  product_name TEXT NOT NULL,

  pos_cost INTEGER,
  price_excl INTEGER NOT NULL,
  qty INTEGER NOT NULL CHECK (qty >= 1),
  line_amount_excl INTEGER NOT NULL,
  tax_rate INTEGER NOT NULL CHECK (tax_rate IN (8, 10)),

  created_at_utc TEXT NOT NULL,

  FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_items_transaction
  ON transaction_items(transaction_id);
