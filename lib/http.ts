import { NextResponse } from "next/server";

export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** The browser sends its own local date so "today" matches where you are. */
export function todayFrom(v: unknown): string {
  return typeof v === "string" && ISO.test(v) ? v : new Date().toISOString().slice(0, 10);
}
/** An IANA time zone name like "Asia/Singapore"; anything else falls back to UTC. */
export function tzFrom(v: unknown): string {
  if (typeof v !== "string" || !/^[A-Za-z0-9_+\-\/]{1,64}$/.test(v)) return "UTC";
  try { new Intl.DateTimeFormat("en", { timeZone: v }); return v; } catch { return "UTC"; }
}
export const isISODate = (v: unknown): v is string => typeof v === "string" && ISO.test(v);

export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      console.error(e);
      return bad(e instanceof Error ? e.message : "Something went wrong", 500);
    }
  };
}
