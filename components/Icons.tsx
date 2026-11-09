// Line icons in the style of the reference (1.6 stroke, rounded).
type P = { size?: number };
const base = (size = 20) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

export const CalendarIcon = ({ size }: P) => (<svg {...base(size)}><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /></svg>);
export const TargetIcon = ({ size }: P) => (<svg {...base(size)}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></svg>);
export const FolderIcon = ({ size }: P) => (<svg {...base(size)}><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /></svg>);
export const ArchiveIcon = ({ size }: P) => (<svg {...base(size)}><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17M12 12.5v4M10 14.5l2 2 2-2" /></svg>);
export const ChartIcon = ({ size }: P) => (<svg {...base(size)}><path d="M4 4v16h16" /><path d="M7.5 14.5l3.5-4 3 2.5 4.5-6" /></svg>);
export const BellIcon = ({ size }: P) => (<svg {...base(size)}><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /><circle cx="18" cy="5" r="2.2" fill="#F2A541" stroke="none" /></svg>);
export const SearchIcon = ({ size }: P) => (<svg {...base(size)}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>);
export const ClockIcon = ({ size }: P) => (<svg {...base(size)}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>);
export const TagIcon = ({ size }: P) => (<svg {...base(size)}><path d="M3.5 12V4.5h7.5l9 9-7.5 7.5z" /><circle cx="8" cy="9" r="1.3" /></svg>);
export const PlusIcon = ({ size }: P) => (<svg {...base(size)}><path d="M12 5v14M5 12h14" /></svg>);
export const XIcon = ({ size }: P) => (<svg {...base(size)}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const SparkIcon = ({ size }: P) => (<svg {...base(size)}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></svg>);
export const ChevronL = ({ size }: P) => (<svg {...base(size ?? 14)}><path d="M15 6l-6 6 6 6" /></svg>);
export const ChevronR = ({ size }: P) => (<svg {...base(size ?? 14)}><path d="M9 6l6 6-6 6" /></svg>);
export const PartyIcon = ({ size }: P) => (<svg {...base(size)}><path d="M4 20l4.5-12.5L16.5 15.5z" /><path d="M8.5 7.5c2.5 2.5 5.5 5.5 8 8" /><path d="M14 4.5c.5 1 .2 2-.8 2.6M19.5 10c-1-.5-2-.2-2.6.8M17 3.5v1.5M20.5 7h-1.5M12 3l.5.5" /></svg>);
