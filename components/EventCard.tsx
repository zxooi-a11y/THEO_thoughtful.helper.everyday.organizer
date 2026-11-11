"use client";
import { eventTheme, timeRange, type LifeEvent } from "@/lib/events";
import { daysBetween } from "@/lib/brain/dates";
import { fmtTime } from "@/lib/time";

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const md = (iso: string) => { const [, m, d] = iso.split("-").map(Number); return `${SHORT[m - 1]} ${d}`; };
const MONTH = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const Heart = ({ filled, color }: { filled: boolean; color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={filled ? color : "none"} stroke={filled ? color : "currentColor"} strokeWidth="1.8" strokeLinejoin="round">
    <path d="M12 20s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />
  </svg>
);
const Pin = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" />
  </svg>
);
const External = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 4.5h5.5V10M19.5 4.5L11 13" /><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
  </svg>
);

/** "Jun 24 – 25, 2025", "Jun 30 – Jul 2, 2025", or "Jun 24, 2025". Times are shown on their own lines. */
function rangeLabel(e: LifeEvent) {
  const [y1, m1] = e.start_date.split("-").map(Number);
  if (!e.end_date) return `${md(e.start_date)}, ${y1}`;
  const [y2, m2, d2] = e.end_date.split("-").map(Number);
  const s = md(e.start_date);
  if (y1 !== y2) return `${s}, ${y1} – ${md(e.end_date)}, ${y2}`;
  return m1 === m2 ? `${s} – ${d2}, ${y1}` : `${s} – ${md(e.end_date)}, ${y1}`;
}

function countdown(e: LifeEvent, today: string) {
  const until = daysBetween(today, e.start_date);
  const end = e.end_date ?? e.start_date;
  if (until > 1) return until < 60 ? `In ${until} days` : `In ${Math.round(until / 30)} months`;
  if (until === 1) return "Tomorrow";
  if (today <= end) return "Happening now";
  return null;
}

type Props = { event: LifeEvent; project?: { name: string; color: string } | null; today: string; onFavorite: () => void; onOpen: () => void };

export default function EventCard({ event: e, project, today, onFavorite, onOpen }: Props) {
  const k = eventTheme(e.kind, project);
  const [, m, d] = e.start_date.split("-").map(Number);
  const past = (e.end_date ?? e.start_date) < today;
  const soon = countdown(e, today);
  // Single day: "16:00 – 18:30". Several days: the start time belongs to the first day, the end time to the last.
  const times = (e.end_date ? [e.start_time && `Starts ${fmtTime(e.start_time)}`, e.end_time && `Ends ${fmtTime(e.end_time)}`] : [timeRange(e)]).filter(Boolean) as string[];

  return (
    <article className={`event-card${past ? " past" : ""}`} onClick={onOpen} style={{ ["--ev" as string]: k.accent }}>
      <div className="ev-date" style={{ background: k.panel }}>
        <div className="ev-month">{MONTH[m - 1]}</div>
        <div className="ev-day">{String(d).padStart(2, "0")}</div>
        <div className="ev-rule" />
        <div className="ev-range">{rangeLabel(e)}</div>
        {times.map((t) => <div key={t} className="ev-range ev-time">{t}</div>)}
      </div>
      <div className="ev-body">
        <button className="ev-heart" onClick={(x) => { x.stopPropagation(); onFavorite(); }} aria-pressed={e.favorite} aria-label={e.favorite ? "Unfavourite" : "Favourite"}>
          <Heart filled={e.favorite} color={k.accent} />
        </button>
        <h3 className="ev-title">{e.title}</h3>
        <div className="row wrap" style={{ gap: 8 }}>
          {/* Under a project tag the project name is the label (the card already wears its colour); otherwise the event's type */}
          <span className="ev-pill" style={{ background: k.pill, color: k.accent }} title={project ? "Project tag" : undefined}>{project ? project.name : k.label}</span>
          {soon && <span className="ev-soon">{soon}</span>}
        </div>
        {e.notes && <p className="ev-desc">{e.notes}</p>}
        <div className="ev-foot">
          <span className="ev-loc">{e.location && <><Pin /> <span>{e.location}</span></>}</span>
          {e.files?.length > 0 && <span className="ev-files" title={e.files.map((f) => f.name).join(", ")}>📎 {e.files.length}</span>}
          {e.url && (
            <a className="ev-link" href={e.url} target="_blank" rel="noopener noreferrer" onClick={(x) => x.stopPropagation()} aria-label="Open event link" title={e.url}>
              <External />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
