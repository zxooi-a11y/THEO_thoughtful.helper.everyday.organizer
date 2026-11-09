"use client";
import type { Project } from "@/lib/types";
import { api } from "./client";

const NEW = "__new__";

type Props = {
  projects: Project[];
  value: number | null;
  onChange: (id: number | null) => void;
  onCreated?: (p: Project) => void;
  emptyLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
};

/** Project dropdown with a "+ New project…" option so you can create one on the spot. */
export default function ProjectSelect({ projects, value, onChange, onCreated, emptyLabel = "Inbox", className = "select", style, title }: Props) {
  async function create() {
    const name = window.prompt("Name your new project (e.g. Wedding, Side hustle, Kids):")?.trim();
    if (!name) return;
    try {
      const p = await api<Project>("/api/projects", { body: { name } });
      onCreated?.(p);
      onChange(p.id);
    } catch (e) {
      alert((e as Error).message);
    }
  }
  return (
    <select className={className} style={style} title={title} value={value ?? ""}
      onChange={(e) => (e.target.value === NEW ? create() : onChange(e.target.value ? Number(e.target.value) : null))}>
      <option value="">{emptyLabel}</option>
      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      <option value={NEW}>+ New project…</option>
    </select>
  );
}
