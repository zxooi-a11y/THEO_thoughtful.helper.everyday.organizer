"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArchiveIcon, CalendarIcon, ChartIcon, FolderIcon, TargetIcon } from "./Icons";

const NAV = [
  { href: "/", label: "Task calendar", Icon: CalendarIcon },
  { href: "/plan", label: "Goal planner", Icon: TargetIcon },
  { href: "/projects", label: "Projects", Icon: FolderIcon },
  { href: "/archive", label: "Archive", Icon: ArchiveIcon },
  { href: "/analytics", label: "Analytics", Icon: ChartIcon },
];

export default function Sidebar() {
  const path = usePathname();
  if (path === "/login") return null;
  return (
    <aside className="sidebar">
      <div className="logo">theo<span>.organizer</span></div>
      <nav className="nav">
        {NAV.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className={path === href ? "active" : ""} title={label}>
            <Icon /> <span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className="account">
        <div className="avatar">T</div>
        <div>
          <div className="label">Thoughtful helper</div>
          <div className="name">My life, organized</div>
        </div>
      </div>
    </aside>
  );
}
