import fs from "node:fs";
import { parse } from "csv-parse/sync";
import iconv from "iconv-lite";

function sqlEscape(s){
  return String(s).replace(/'/g, "''");
}

function nowUtcIso(){
  return new Date().toISOString();
}

function toIntOrNull(v){
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function toTaxRate(v){
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (s === "8" || s === "8%" || s === "0.08" || s === "0.080" || s === "8.0") return 8;
  if (s === "10" || s === "10%" || s === "0.1" || s === "0.10" || s === "0.100" || s === "10.0") return 10;
  const n = Number(s);
  if (n === 8) return 8;
  if (n === 10) return 10;
  if (Math.abs(n - 0.08) < 1e-9) return 8;
  if (Math.abs(n - 0.10) < 1e-9) return 10;
  return null;
}

function usage(){
  console.log("Usage:");
  console.log("  node scripts/seed_products.js <path-to-products.csv> <output-sql-file>");
  console.log("Example:");
  console.log("  node scripts/seed_products.js ./products.csv ./seed_products.sql");
}

const inPath = process.argv[2];
const outPath = process.argv[3];

if (!inPath || !outPath){
  usage();
  process.exit(1);
}

const buf = fs.readFileSync(inPath);
const text = iconv.decode(buf, "cp932");

const records = parse(text, {
  columns: true,
  skip_empty_lines: true,
  relax_column_count: true,
  trim: true
});

const now = nowUtcIso();
const lines = [];
lines.push("BEGIN;");

let count = 0;
for (const r of records){
  const code = String(r["商品コード"] ?? "").trim();
  if (!code) continue;
  if (!/^\d{1,13}$/.test(code)) continue;

  const cat = String(r["商品分類"] ?? "").trim();
  const name = String(r["商品名"] ?? "").trim();
  if (!name) continue;

  const cost = toIntOrNull(r["POS原価"]);
  const priceExcl = toIntOrNull(r["売価（抜）"]);
  if (priceExcl == null) continue;

  const rate = toTaxRate(r["税率"]);
  if (rate !== 8 && rate !== 10) continue;

  const costSql = (cost == null) ? "NULL" : String(cost);

  lines.push(
    `INSERT OR REPLACE INTO products (product_code, product_category, product_name, pos_cost, price_excl, tax_rate, updated_at_utc) VALUES (` +
    `'${sqlEscape(code)}', '${sqlEscape(cat)}', '${sqlEscape(name)}', ${costSql}, ${priceExcl}, ${rate}, '${now}');`
  );
  count += 1;
}

lines.push("COMMIT;");

fs.writeFileSync(outPath, lines.join("\n"), "utf-8");
console.log(`Wrote: ${outPath}`);
console.log(`Rows: ${count}`);
console.log("Next:");
console.log("  wrangler d1 execute pos_receipts_db --remote --file=" + outPath);
