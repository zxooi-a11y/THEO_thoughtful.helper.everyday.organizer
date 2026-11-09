// Small text utilities shared by the brain. Pure functions, no I/O.

const STOP = new Set(
  ("a an the and or but to for of on in at by with from up out into over my our your his her their its " +
    "this that these those it is be am are was were do does did done get got go make need needs should must " +
    "will would can could i me we you he she they them some any all more most just also very really " +
    "today tomorrow tonight next week weekend month day days asap urgent soon later before due then")
    .split(/\s+/),
);

export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9#\s'-]/g, " ").replace(/\s+/g, " ").trim();
}

/** Very light stemmer — enough to treat "groceries"/"grocery", "cleaning"/"clean" as the same. */
export function stem(w: string): string {
  if (w.length <= 4) return w;
  return w
    .replace(/'s$/, "")
    .replace(/ies$/, "y")
    .replace(/(ing|ed)$/, "")
    .replace(/(?<!s)s$/, "");
}

/** Meaningful, stemmed, de-duplicated keywords of a phrase. */
export function keywords(s: string): string[] {
  const out = new Set<string>();
  for (const raw of normalize(s).split(" ")) {
    const w = raw.replace(/^#/, "");
    if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w)) continue;
    out.add(stem(w));
  }
  return [...out];
}

/** Jaccard similarity of two keyword sets (0..1). */
export function similarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const A = new Set(a);
  let inter = 0;
  for (const w of new Set(b)) if (A.has(w)) inter++;
  return inter / (A.size + new Set(b).size - inter);
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function tidyTitle(s: string): string {
  return capitalize(
    s
      .replace(/\s+/g, " ")
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/^[\s,.;:\-–—]+|[\s,.;:\-–—]+$/g, "")
      .trim(),
  );
}
