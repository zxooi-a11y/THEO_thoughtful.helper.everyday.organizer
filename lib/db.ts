import { neon } from "@neondatabase/serverless";

// Neon's HTTP driver: one-shot queries over fetch — ideal for serverless (Vercel) and
// keeps the free-tier compute able to scale to zero when you're not using THEO.
let _sql: ReturnType<typeof neon> | null = null;

export function sql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and paste your Neon connection string.");
    _sql = neon(url);
  }
  return _sql;
}

/** Run a parameterised query and get typed rows back. */
export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await sql().query(text, params)) as T[];
}
