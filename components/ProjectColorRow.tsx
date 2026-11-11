"use client";
import { useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/types";
import { api } from "./client";
import Swatches from "./Swatches";

/** "Tag colour" chooser for the selected project; shows the change at once and saves it (after a short pause while dragging). */
export default function ProjectColorRow({ project, onChanged }: { project: Project | undefined | null; onChanged: (p: Project) => void }) {
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saved = useRef<string | null>(null);
  useEffect(() => { saved.current = project?.color ?? null; }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  if (!project) return null;

  function pick(color: string) {
    if (!project || color === project.color) return;
    setError("");
    onChanged({ ...project, color });                       // show it immediately
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try { await api(`/api/projects/${project.id}`, { method: "PATCH", body: { color } }); saved.current = color; }
      catch (e) { if (saved.current) onChanged({ ...project, color: saved.current }); setError((e as Error).message); }
    }, 350);
  }

  return (
    <div className="stack" style={{ gap: 6 }}>
      <span className="small" style={{ fontWeight: 700 }}>Tag colour <span className="muted">· used for “{project.name}” on cards and the calendar</span></span>
      <Swatches value={project.color} onPick={pick} />
      {error && <div className="err">{error}</div>}
    </div>
  );
}
