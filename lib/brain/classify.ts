// Decides which project a task belongs to, which tags it gets and how urgent it is.
// Built-in vocabulary gives a sensible starting point; `learned` (from the database)
// is what makes it fit YOUR way of organizing over time.

import { keywords, normalize, stem } from "./text.ts";

export type ProjectRef = { id: number; name: string };
/** keyword → (projectId → weight) */
export type LearnedKeywords = Record<string, Record<number, number>>;

const VOCAB: Record<string, string[]> = {
  Home: ["clean", "tidy", "laundry", "wash", "dish", "vacuum", "mop", "garden", "lawn", "mow", "plant", "fix", "repair",
    "leak", "plumber", "electrician", "furniture", "declutter", "organize", "kitchen", "bathroom", "bedroom", "garage",
    "rubbish", "trash", "bin", "recycl", "paint", "house", "home", "apartment", "rent", "landlord", "cook", "meal", "bulb", "aircon"],
  Health: ["doctor", "dentist", "gp", "clinic", "hospital", "appointment", "medicine", "medication", "prescription",
    "pharmacy", "gym", "workout", "exercise", "run", "yoga", "walk", "swim", "sleep", "therapy", "therapist", "checkup",
    "vitamin", "diet", "weight", "physio", "blood", "vaccin", "eye", "optometrist", "meditat", "health"],
  Finance: ["pay", "bill", "invoice", "tax", "bank", "budget", "insurance", "loan", "mortgage", "credit", "card", "saving",
    "invest", "transfer", "refund", "receipt", "expense", "subscription", "renew", "salary", "account", "finance", "money", "superannuation", "epf"],
  Work: ["meeting", "client", "report", "presentation", "deck", "slide", "email", "boss", "manager", "colleague", "team",
    "deadline", "review", "proposal", "standup", "office", "project", "sprint", "deploy", "ticket", "jira", "spreadsheet", "work"],
  Errands: ["buy", "grocery", "groceri", "shop", "shopping", "pick", "pickup", "drop", "post", "parcel", "return", "collect",
    "supermarket", "store", "mall", "petrol", "fuel", "car", "wash", "service", "license", "passport", "errand", "milk", "bread"],
  Learning: ["learn", "study", "course", "read", "book", "lesson", "practice", "tutorial", "class", "exam", "homework",
    "language", "lecture", "research", "certificat", "skill", "podcast", "workshop"],
  Social: ["birthday", "party", "friend", "family", "mom", "mum", "dad", "brother", "sister", "wedding", "dinner", "lunch",
    "gift", "present", "visit", "catch", "invite", "anniversary", "date", "kids", "call"],
  Business: ["business", "startup", "customer", "launch", "marketing", "brand", "logo", "website", "domain", "product",
    "pricing", "sales", "revenue", "pitch", "investor", "mvp", "register", "llc", "company", "supplier", "competitor", "ads", "social"],
};

const ACTION_TAGS: [RegExp, string][] = [
  [/\b(call|phone|ring)\b/i, "call"],
  [/\b(email|e-mail|reply|message|text|whatsapp)\b/i, "message"],
  [/\b(buy|order|purchase|pick up|grab|shop)\b/i, "buy"],
  [/\b(pay|transfer|settle)\b/i, "pay"],
  [/\b(book|schedule|reserve|appointment)\b/i, "book"],
  [/\b(clean|tidy|wash|vacuum|declutter)\b/i, "clean"],
  [/\b(fix|repair|replace|install)\b/i, "fix"],
  [/\b(read|study|learn|practice|course)\b/i, "learn"],
  [/\b(write|draft|prepare|create|design)\b/i, "create"],
  [/\b(meet|meeting|catch up|lunch|dinner)\b/i, "meet"],
];

const URGENT = /\b(asap|urgent|urgently|immediately|important|critical|now)\b|!{1,}/i;
const LOW = /\b(someday|eventually|maybe|whenever|low priority|no rush)\b/i;

export type Classification = {
  projectId: number | null;
  projectName: string | null;
  confidence: number; // 0..1
  tags: string[];
  priority: 1 | 2 | 3;
  cleaned: string; // text with #hashtags / !priority markers stripped
};

/** Add project scores for a piece of text. `m` scales how much it counts (a brief counts less than the task itself). */
function scoreInto(scores: Map<number, number>, text: string, hashtags: string[], projects: ProjectRef[], learned: LearnedKeywords, m: number) {
  const byLower = new Map(projects.map((p) => [p.name.toLowerCase(), p]));
  const add = (id: number, w: number) => scores.set(id, (scores.get(id) ?? 0) + w * m);

  // Hashtag naming a project wins outright.
  for (const h of hashtags) {
    const p = byLower.get(h) ?? projects.find((pp) => normalize(pp.name).replace(/\s/g, "-") === h);
    if (p) add(p.id, 100);
  }
  // Project name typed in the text ("THEO: fix login") is a strong hint.
  const lowerText = " " + normalize(text) + " ";
  for (const p of projects) if (lowerText.includes(" " + normalize(p.name) + " ")) add(p.id, 5);

  const words = keywords(text);
  // Built-in vocabulary.
  for (const [name, vocab] of Object.entries(VOCAB)) {
    const p = byLower.get(name.toLowerCase());
    if (!p) continue;
    for (const w of words) if (vocab.some((v) => w === v || w.startsWith(v) || stem(v) === w)) add(p.id, 1);
  }
  // What THEO has learned from you (incl. 👍/👎) weighs more than the defaults. Negative weights push away.
  const ids = new Set(projects.map((p) => p.id));
  for (const w of words) {
    const row = learned[w];
    if (!row) continue;
    for (const [pid, weight] of Object.entries(row)) if (ids.has(Number(pid))) add(Number(pid), weight * 1.5);
  }
}

const FILE_CAP = 0.9;
const hashtagsOf = (t: string) => [...t.matchAll(/(^|\s)#([\w-]+)/g)].map((m) => m[2].toLowerCase());

/**
 * @param brief optional context you give for the whole batch ("all for my candle business,
 *              due before the Christmas market"). It nudges every task, but the task's own words win.
 */
export function classify(text: string, projects: ProjectRef[], learned: LearnedKeywords = {}, brief = "", fileWords = ""): Classification {
  // 1. Explicit hashtags: "#home" or "#side-project" → tags (and project if it matches one).
  const hashtags = hashtagsOf(text);
  let cleaned = text.replace(/(^|\s)#[\w-]+/g, " ");

  const briefTags = hashtagsOf(brief);
  const briefClean = brief.replace(/(^|\s)#[\w-]+/g, " ");
  let priority: 1 | 2 | 3 = URGENT.test(cleaned) ? 1 : LOW.test(cleaned) ? 3 : 2;
  if (priority === 2 && brief) priority = URGENT.test(briefClean) ? 1 : LOW.test(briefClean) ? 3 : 2;
  cleaned = cleaned.replace(/!+/g, " ").replace(/\b(asap|urgent(ly)?|low priority|no rush)\b/gi, " ").replace(/\s+/g, " ").trim();

  const byLower = new Map(projects.map((p) => [p.name.toLowerCase(), p]));
  const scores = new Map<number, number>();
  scoreInto(scores, cleaned, hashtags, projects, learned, 1);
  if (brief.trim()) scoreInto(scores, briefClean, briefTags, projects, learned, 0.6);
  if (fileWords.trim()) {
    // Attached files are a hint, not a verdict: their total pull is capped below a single
    // matching word in the task itself, so "book dentist" stays Health even if the file is an invoice.
    const fileScores = new Map<number, number>();
    scoreInto(fileScores, fileWords, [], projects, learned, 1);
    const peak = Math.max(0, ...fileScores.values());
    const k = peak > FILE_CAP ? FILE_CAP / peak : 1;
    for (const [id, v] of fileScores) if (v > 0) scores.set(id, (scores.get(id) ?? 0) + v * k);
  }

  let best: number | null = null, bestScore = 0, total = 0;
  for (const [id, s] of scores) {
    if (s > 0) total += s;
    if (s > bestScore) { best = id; bestScore = s; }
  }
  const project = best != null ? projects.find((p) => p.id === best)! : null;

  const tags = new Set([...hashtags, ...briefTags].filter((h) => !byLower.has(h)));
  for (const [re, tag] of ACTION_TAGS) if (re.test(cleaned)) tags.add(tag);
  if (priority === 1) tags.add("urgent");

  return {
    projectId: project?.id ?? null,
    projectName: project?.name ?? null,
    confidence: total ? Math.min(1, bestScore / total) * Math.min(1, bestScore / 2) : 0,
    tags: [...tags].slice(0, 5),
    priority,
    cleaned,
  };
}
