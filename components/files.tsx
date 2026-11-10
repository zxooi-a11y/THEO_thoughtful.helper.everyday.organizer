"use client";
// Shared file UI: upload helper, drop zone and file chips (used by Add tasks and the task panel).
import { useRef, useState } from "react";
import type { FileMeta, Task } from "@/lib/types";
import { XIcon } from "./Icons";

export const MAX_FILE_MB = 4;

export type Insights = {
  deadline: { date: string; file: string; cue: string } | null;
  checklist: string[];
  checklistFile: string;
};

export function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function fileEmoji(f: Pick<FileMeta, "mime" | "name">): string {
  const n = f.name.toLowerCase();
  if (f.mime.startsWith("image/")) return "🖼️";
  if (n.endsWith(".pdf")) return "📕";
  if (/\.(xlsx?|csv|tsv)$/.test(n)) return "📊";
  if (/\.(docx?|rtf|odt)$/.test(n)) return "📘";
  if (/\.(zip|rar|7z|tar|gz)$/.test(n)) return "🗜️";
  return "📄";
}

/** Upload one file. With `taskId` it's attached to that task; without, it's staged for the Add tasks window. */
export async function uploadFile(file: File, opts: { taskId?: number; today?: string } = {}): Promise<{ file: FileMeta; task?: Task; insights?: Insights }> {
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`“${file.name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_FILE_MB} MB per file.`);
  if (file.size === 0) throw new Error(`“${file.name}” is empty.`);
  const fd = new FormData();
  fd.append("file", file);
  if (opts.taskId) fd.append("taskId", String(opts.taskId));
  if (opts.today) fd.append("today", opts.today);
  let res: Response;
  try { res = await fetch("/api/files", { method: "POST", body: fd }); }
  catch { throw new Error(`Couldn't upload “${file.name}”. Check your connection and try again.`); }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { window.location.href = "/login"; throw new Error("Locked"); }
  if (res.status === 413 && !data?.error) throw new Error(`“${file.name}” is too big. The limit is ${MAX_FILE_MB} MB per file.`);
  if (!res.ok) throw new Error(data?.error ?? `Upload failed (${res.status})`);
  return data;
}

type DropProps = {
  onPick: (files: File[]) => void;
  busy?: boolean;
  disabled?: boolean;
  label?: string;
  compact?: boolean;
};

/** Click-to-choose or drag-and-drop area. Works with the phone's file / photo picker too. */
export function FileDrop({ onPick, busy, disabled, label = "Attach files", compact }: DropProps) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const pick = (list: FileList | null) => { if (list?.length) onPick([...list]); if (input.current) input.current.value = ""; };
  return (
    <div
      className={`filedrop${over ? " over" : ""}${compact ? " compact" : ""}`}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) pick(e.dataTransfer.files); }}
    >
      <input ref={input} type="file" multiple hidden disabled={disabled} onChange={(e) => pick(e.target.files)} />
      <button type="button" className="btn small" disabled={disabled || busy} onClick={() => input.current?.click()}>
        {busy ? "Uploading…" : `📎 ${label}`}
      </button>
      {!compact && <span className="muted small">or drop them here · up to {MAX_FILE_MB} MB each</span>}
    </div>
  );
}

type ListProps = {
  files: FileMeta[];
  onRemove?: (f: FileMeta) => void;
  /** Show a "THEO read this" marker. */
  showReadable?: boolean;
};

export function FileList({ files, onRemove, showReadable = true }: ListProps) {
  if (!files.length) return null;
  return (
    <ul className="filelist">
      {files.map((f) => (
        <li key={f.id}>
          <span aria-hidden>{fileEmoji(f)}</span>
          <a href={`/api/files/${f.id}`} target="_blank" rel="noopener noreferrer" className="fname" title={f.name}>{f.name}</a>
          <span className="muted small fsize">{fmtSize(f.size)}</span>
          {showReadable && (
            <span className={`fread ${f.readable ? "yes" : ""}`} title={f.readable ? "THEO can read this file" : "Stored, but THEO can't read this kind of file"}>
              {f.readable ? "read ✓" : "stored"}
            </span>
          )}
          {onRemove && <button type="button" className="icon-btn" style={{ padding: 2 }} onClick={() => onRemove(f)} aria-label={`Remove ${f.name}`}><XIcon size={14} /></button>}
        </li>
      ))}
    </ul>
  );
}
