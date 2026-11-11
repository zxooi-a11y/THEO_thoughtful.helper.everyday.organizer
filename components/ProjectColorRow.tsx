"use client";
import { useState } from "react";
import type { Project } from "@/lib/types";
import { api } from "./client";
import Swatches from "./Swatches";

/** "Tag colour" chooser for the selected project; saves straight away and tells the parent. */
export default function ProjectColorRow({ project, onChanged }: { project: Project | undefined | null; onChanged: (p: Project) => void }) {
  const [error, setError] = useState("");
  if (!project) return null;
  async function pick(color: string) {
    if (!project || color === project.color) return;
    setError("");
    onChanged({ ...project, color }); // show it immediately
    try { await api(`/api/projects/${project.id}`, { method: "PATCH", body: { color } }); }
    catch (e) { onChanged(project); setError((e as Error).message); }
  }
  return (
    <div className="stack" style={{ gap: 6 }}>
      <span className="small" style={{ fontWeight: 700 }}>Tag colour <span className="muted">· used for “{project.name}” on cards and the calendar</span></span>
      <Swatches value={project.color} onPick={pick} />
      {error && <div className="err">{error}</div>}
    </div>
  );
}
