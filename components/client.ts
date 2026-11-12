"use client";
// Tiny client helpers shared by pages.
import { daysBetween } from "@/lib/brain/dates";

export async function api<T = unknown>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let body = init?.body;
  // Finishing a task files it under the day it was done, in the person's own time zone, so say what day that is
  if (init?.method === "PATCH" && /^\/api\/tasks\/\d+$/.test(url) && body && typeof body === "object" && !("today" in body)) {
    body = { ...(body as Record<string, unknown>), today: localToday() };
  }
  const res = await fetch(url, {
    method: init?.method ?? (body ? "POST" : "GET"),
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== "undefined") window.location.href = "/login";
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

/** Today's date in the user's own time zone, as YYYY-MM-DD. */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The browser's time zone (e.g. "Asia/Singapore"), so "the day it was finished" matches where you are. */
export function localTz(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
}

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function fmtDate(iso: string | null | undefined, withYear = false): string {
  if (!iso) return "No date";
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTH[m - 1]} ${String(d).padStart(2, "0")}${withYear ? ", " + y : ""}`;
}

export function timeAgo(ts: string): string {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 90) return "Just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? "Yesterday" : `${d} days ago`;
}

export function relDue(iso: string | null, today: string): string {
  if (!iso) return "No due date";
  const diff = daysBetween(today, iso);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${-diff} days overdue`;
  if (diff < 7) return `In ${diff} days`;
  if (diff < 30) return `In ${Math.round(diff / 7)} week${diff >= 11 ? "s" : ""}`;
  return `In ${Math.round(diff / 30)} month${diff >= 45 ? "s" : ""}`;
}
