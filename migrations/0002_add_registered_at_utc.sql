PRAGMA foreign_keys=ON;

-- 既存DBに registered_at_utc を追加（UTC機械時刻を正として保存）
-- ※D1(SQLite)では既存行があると NOT NULL 追加が難しいため、NULL許容で追加→既存行を埋める

ALTER TABLE transactions ADD COLUMN registered_at_utc TEXT;

-- 既存データがある場合は created_at_utc を代入しておく
UPDATE transactions
SET registered_at_utc = COALESCE(registered_at_utc, created_at_utc)
WHERE registered_at_utc IS NULL;

-- インデックス（任意：管理用）
CREATE INDEX IF NOT EXISTS idx_transactions_registered_at_utc
  ON transactions(registered_at_utc);
