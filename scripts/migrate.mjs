// Applies db/schema.sql to the database in DATABASE_URL (safe to re-run).
// Usage: DATABASE_URL=... npm run db:migrate   (or put it in .env.local)
import { readFileSync, existsSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?/);
    if (m) process.env.DATABASE_URL = m[1].trim();
  }
}
if (!process.env.DATABASE_URL) { console.error("Set DATABASE_URL first (see .env.example)"); process.exit(1); }

const sql = neon(process.env.DATABASE_URL);
const statements = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8")
  .replace(/--.*$/gm, "")
  .split(/;\s*$/m)
  .map((s) => s.trim())
  .filter(Boolean);
for (const s of statements) await sql.query(s);
console.log(`✓ Applied ${statements.length} statements`);
