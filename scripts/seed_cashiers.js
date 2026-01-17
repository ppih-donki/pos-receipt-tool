import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import iconv from "iconv-lite";

function sqlEscape(s){
  return String(s).replace(/'/g, "''");
}

function nowUtcIso(){
  return new Date().toISOString();
}

function usage(){
  console.log("Usage:");
  console.log("  node scripts/seed_cashiers.js <path-to-cashiers.csv> <output-sql-file>");
  console.log("Example:");
  console.log("  node scripts/seed_cashiers.js ./cashiers.csv ./seed_cashiers.sql");
}

const inPath = process.argv[2];
const outPath = process.argv[3];

if (!inPath || !outPath){
  usage();
  process.exit(1);
}

const buf = fs.readFileSync(inPath);
const text = iconv.decode(buf, "shift_jis");

const records = parse(text, {
  columns: true,
  skip_empty_lines: true,
  relax_column_count: true,
  trim: true
});

const now = nowUtcIso();
const lines = [];
lines.push("BEGIN;");
for (const r of records){
  const name = (r.cashier_name || "").trim();
  if (!name) continue;
  lines.push(`INSERT OR IGNORE INTO cashiers (cashier_name, updated_at_utc) VALUES ('${sqlEscape(name)}', '${now}');`);
}
lines.push("COMMIT;");

fs.writeFileSync(outPath, lines.join("\n"), "utf-8");
console.log(`Wrote: ${outPath}`);
console.log("Next:");
console.log("  wrangler d1 execute pos_receipts_db --remote --file=" + outPath);
