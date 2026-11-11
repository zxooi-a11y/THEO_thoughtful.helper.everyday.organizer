import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeTask, planGoal, splitBulk, type BrainContext } from "../lib/brain/index.ts";
import { parseDue } from "../lib/brain/dates.ts";

// Monday 9 Nov 2026
const TODAY = "2026-11-09";
const projects = ["Home", "Health", "Finance", "Work", "Errands", "Learning", "Social", "Business"].map((name, i) => ({ id: i + 1, name }));
const ctx: BrainContext = { projects, learnedKeywords: {}, learnedPlans: [], leadTimes: {} };

test("relative dates", () => {
  assert.equal(parseDue("call mum tomorrow", TODAY).date, "2026-11-10");
  assert.equal(parseDue("pay rent by friday", TODAY).date, "2026-11-13");
  assert.equal(parseDue("dentist next tuesday", TODAY).date, "2026-11-17");
  assert.equal(parseDue("finish report in 2 weeks", TODAY).date, "2026-11-23");
  assert.equal(parseDue("clean garage this weekend", TODAY).date, "2026-11-14");
  assert.equal(parseDue("tax return end of month", TODAY).date, "2026-11-30");
  assert.equal(parseDue("buy gift by 3 Dec", TODAY).date, "2026-12-03");
  assert.equal(parseDue("party on 20/11", TODAY).date, "2026-11-20");
  assert.equal(parseDue("renew passport jan 5", TODAY).date, "2027-01-05");
  assert.equal(parseDue("make money", TODAY).date, null); // "mon" inside "money" isn't Monday
});

test("date phrase is removed from the title", () => {
  const d = analyzeTask("pay electricity bill by friday", TODAY, ctx);
  assert.equal(d.title, "Pay electricity bill");
  assert.equal(d.projectName, "Finance");
  assert.ok(d.tags.includes("pay"));
  assert.ok(d.steps.length >= 3);
});

test("projects, tags, urgency", () => {
  assert.equal(analyzeTask("book dentist appointment", TODAY, ctx).projectName, "Health");
  assert.equal(analyzeTask("buy groceries", TODAY, ctx).projectName, "Errands");
  const u = analyzeTask("fix the kitchen leak ASAP", TODAY, ctx);
  assert.equal(u.projectName, "Home");
  assert.equal(u.priority, 1);
  assert.equal(u.dueDate, TODAY);
  assert.equal(analyzeTask("sketch logo #business", TODAY, ctx).projectName, "Business");
});

test("learned keywords override defaults", () => {
  const learned: BrainContext = { ...ctx, learnedKeywords: { gift: { 8: 3 } } }; // you filed gifts under Business
  assert.equal(analyzeTask("buy gift for client", TODAY, learned).projectName, "Business");
});

test("learned lead time drives due date", () => {
  const learned: BrainContext = { ...ctx, leadTimes: { 5: 1 } }; // Errands done in ~1 day
  assert.equal(analyzeTask("buy milk", TODAY, learned).dueDate, "2026-11-10");
});

test("bulk split handles bullets and numbers", () => {
  assert.deepEqual(splitBulk("- a b\n2) c d\n• e f\n\n[ ] g h"), ["a b", "c d", "e f", "g h"]);
});

test("goal playbooks", () => {
  const p = planGoal("build a business", TODAY);
  assert.equal(p.source, "playbook");
  assert.equal(p.projectName, "Business");
  assert.ok(p.tasks.length >= 8);
  assert.equal(p.tasks[0].dueDate, TODAY);
  const mine = planGoal("start a bakery business", TODAY, [
    { kind: "goal", key_words: ["start", "bakery", "business"], title: "Start a bakery business", uses: 1, steps: [{ text: "Bake test batch", offsetDays: 1 }] },
  ]);
  assert.equal(mine.source, "learned");
  assert.equal(mine.tasks[0].title, "Bake test batch");
});

test("a brief steers project, due date and priority", () => {
  const withBrief = (line: string, brief: string) => analyzeTask(line, TODAY, ctx, brief);
  // Vague line + brief naming a project → that project.
  assert.equal(withBrief("sort out the logo", "all for my Business, launching at the Christmas market").projectName, "Business");
  // Brief date fills in when the line has none; the line's own date still wins.
  const a = withBrief("email the supplier", "everything needs to be done by 3 Dec");
  assert.equal(a.dueDate, "2026-12-03");
  assert.match(a.dueReason, /brief/i);
  assert.equal(withBrief("email the supplier tomorrow", "everything by 3 Dec").dueDate, "2026-11-10");
  // Urgent brief → high priority.
  assert.equal(withBrief("call the bank", "these are urgent").priority, 1);
  // The task's own clear words beat a weak brief.
  assert.equal(withBrief("book dentist appointment", "random stuff for this week").projectName, "Health");
});

test("negative learned weights push a project away", () => {
  const learned: BrainContext = { ...ctx, learnedKeywords: { groceri: { 5: -3 }, grocery: { 5: -3 } } };
  assert.notEqual(analyzeTask("buy groceries", TODAY, learned).projectName, "Errands");
});

test("event types are detected from the title", async () => {
  const { detectKind } = await import("../lib/events.ts");
  assert.equal(detectKind("Sarah & Tom's wedding"), "wedding");
  assert.equal(detectKind("Bali holiday"), "holiday");
  assert.equal(detectKind("Google interview"), "interview");
  assert.equal(detectKind("Mum's 60th birthday party"), "birthday");
  assert.equal(detectKind("AWS Summit New York"), "conference");
  assert.equal(detectKind("Weekend road trip to Penang"), "trip");
  assert.equal(detectKind("Coffee with Jo"), "other");
});

test("attached files steer project, deadline, priority and steps", async () => {
  const { buildFileContext } = await import("../lib/brain/files.ts");
  const invoice = buildFileContext([{
    name: "electricity-invoice.pdf",
    text: "FINAL NOTICE. Your invoice for account 4471 is overdue.\nPlease pay by 3 December 2026 or the bank will charge a fee.\nPayment due: 2026-12-03",
  }], TODAY)!;
  assert.equal(invoice.deadline?.date, "2026-12-03");
  assert.equal(invoice.deadline?.file, "electricity-invoice.pdf");
  assert.ok(invoice.urgent);
  assert.ok(invoice.keywords.includes("invoice"));

  // A vague task + the invoice → Finance, the file's deadline, high priority
  const d = analyzeTask("sort this out", TODAY, ctx, "", { files: invoice });
  assert.equal(d.projectName, "Finance");
  assert.equal(d.dueDate, "2026-12-03");
  assert.match(d.dueReason, /electricity-invoice\.pdf/);
  assert.equal(d.priority, 1);

  // The task's own date and words still win over the file
  assert.equal(analyzeTask("sort this out tomorrow", TODAY, ctx, "", { files: invoice }).dueDate, "2026-11-10");
  assert.equal(analyzeTask("book dentist", TODAY, ctx, "", { files: invoice }).projectName, "Health");

  // Dates in the past or without a deadline cue are ignored
  const old = buildFileContext([{ name: "notes.txt", text: "Meeting happened on 3 Nov 2026. Lunch on 20 Dec 2026." }], TODAY)!;
  assert.equal(old.deadline, null);

  // Checklists become steps only when asked (single-task mode)
  const plan = buildFileContext([{ name: "launch.md", text: "Launch plan\n- Write the announcement post\n- Email the customer list\n2) Update the website banner\n- ok" }], TODAY)!;
  assert.equal(plan.checklist.length, 3);
  assert.notEqual(analyzeTask("launch the shop", TODAY, ctx, "", { files: plan }).stepsSource, "file");
  const withList = analyzeTask("launch the shop", TODAY, ctx, "", { files: plan, useChecklist: true });
  assert.equal(withList.stepsSource, "file");
  assert.equal(withList.steps[0], "Write the announcement post");
});

test("event files suggest type, date, time and link", async () => {
  const { buildEventHints } = await import("../lib/brain/files.ts");
  const invite = buildEventHints([{
    name: "sarah-tom-wedding-invitation.pdf",
    text: "Sarah & Tom are getting married!\nJoin us on Saturday 12 December 2026 at 4:30 PM\nPlease RSVP by 1 December 2026\nDetails: https://example.com/sarah-tom.",
  }], TODAY)!;
  assert.equal(invite.kind, "wedding");
  assert.equal(invite.date?.value, "2026-12-12");   // the event, not the RSVP deadline
  assert.equal(invite.time, "16:30");
  assert.equal(invite.url, "https://example.com/sarah-tom");

  // Type from the text when the file name says nothing; past dates ignored
  const flight = buildEventHints([{ name: "booking.txt", text: "Your flight to Melbourne departs 20 Nov 2026 at 07:15. Booked on 2 Oct 2026." }], TODAY)!;
  assert.equal(flight.kind, "trip");
  assert.equal(flight.date?.value, "2026-11-20");
  assert.equal(flight.time, "07:15");

  // Nothing useful → null
  assert.equal(buildEventHints([{ name: "scan.png", text: "" }], TODAY), null);
});

test("final-work links: only safe web links are accepted", async () => {
  const { normalizeWebUrl, hostOf, isSafeLink } = await import("../lib/links.ts");
  assert.equal(normalizeWebUrl("  https://figma.com/file/abc?x=1 "), "https://figma.com/file/abc?x=1");
  assert.equal(normalizeWebUrl("figma.com/file/abc"), "https://figma.com/file/abc");
  assert.equal(normalizeWebUrl("docs.google.com/document/d/1"), "https://docs.google.com/document/d/1");
  assert.equal(normalizeWebUrl("http://example.org"), "http://example.org/");
  assert.equal(normalizeWebUrl(""), "");
  for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<b>x</b>", "ftp://example.com", "file:///etc/passwd",
    "not a link", "//evil.com", "localhost", "https://nodot", "mailto:a@b.com"]) {
    assert.equal(normalizeWebUrl(bad), null, bad);
  }
  assert.equal(hostOf("https://www.figma.com/file/abc"), "figma.com");
  assert.equal(isSafeLink("https://example.com"), true);
  assert.equal(isSafeLink("javascript:alert(1)"), false);
});

test("event end times: ranges are read, formatted and validated", async () => {
  const { buildEventHints } = await import("../lib/brain/files.ts");
  const { timeRange, endTimeProblem } = await import("../lib/events.ts");
  const hint = (t: string) => buildEventHints([{ name: "invite.txt", text: `Join us on 12 December 2026 ${t}` }], TODAY)!;
  const cases: [string, string, string | null][] = [
    ["from 4 – 6 PM", "16:00", "18:00"],
    ["4:30pm to 6:15pm", "16:30", "18:15"],
    ["11 - 1 PM", "11:00", "13:00"],
    ["10am until 2pm", "10:00", "14:00"],
    ["16:00 - 18:30", "16:00", "18:30"],
    ["at 7:30 PM", "19:30", null],
    ["from 09:00", "09:00", null],
  ];
  for (const [text, start, end] of cases) {
    const h = hint(text);
    assert.equal(h.time, start, text);
    assert.equal(h.endTime, end, text);
  }
  assert.equal(timeRange({ start_time: "16:00", end_time: "18:30" }), "4:00 PM – 6:30 PM");
  assert.equal(timeRange({ start_time: "16:00", end_time: "" }), "4:00 PM");
  assert.equal(timeRange({ start_time: "", end_time: "18:30" }), "until 6:30 PM");
  assert.equal(timeRange({ start_time: "", end_time: "" }), "");
  assert.equal(endTimeProblem("16:00", "18:30", null), "");
  assert.notEqual(endTimeProblem("16:00", "15:00", null), "");
  assert.notEqual(endTimeProblem("16:00", "16:00", ""), "");
  assert.equal(endTimeProblem("22:00", "02:00", "2026-12-13"), "");   // overnight with an end date is fine
  assert.equal(endTimeProblem("", "02:00", null), "");               // only one time given
});

test("batch events: lines become full event drafts", async () => {
  const { analyzeEvent, analyzeEvents } = await import("../lib/brain/index.ts");
  const e = (line: string) => analyzeEvent(line, TODAY);   // TODAY = Mon 2026-11-09

  const wed = e("Sarah & Tom's wedding 12 Dec 2026 4pm at Kuala Lumpur");
  assert.deepEqual([wed.title, wed.kind, wed.start_date, wed.start_time, wed.location], ["Sarah & Tom's wedding", "wedding", "2026-12-12", "16:00", "Kuala Lumpur"]);

  const bali = e("Bali holiday 20-27 Dec");
  assert.deepEqual([bali.title, bali.kind, bali.start_date, bali.end_date], ["Bali holiday", "holiday", "2026-12-20", "2026-12-27"]);

  const iv = e("Google interview tomorrow 10am");
  assert.deepEqual([iv.title, iv.kind, iv.start_date, iv.start_time, iv.end_time], ["Google interview", "interview", "2026-11-10", "10:00", ""]);

  const bday = e("Mum's 60th birthday party next Saturday 6-9pm");
  assert.deepEqual([bday.kind, bday.start_date, bday.start_time, bday.end_time], ["birthday", "2026-11-21", "18:00", "21:00"]);

  assert.equal(e("Conference Dec 28 - Jan 3").end_date, "2027-01-03");
  assert.equal(e("Dec 20-27 Bali holiday").start_date, "2026-12-20");
  assert.equal(e("Team offsite 2026-12-03 to 2026-12-05").end_date, "2026-12-05");
  assert.equal(e("Trip 20 Dec - 27 Dec 2026").end_date, "2026-12-27");

  const night = e("New Year party 31 Dec 10pm - 2am");
  assert.deepEqual([night.start_time, night.end_time, night.end_date], ["22:00", "02:00", "2027-01-01"]); // past midnight → next day

  const aws = e("AWS Summit https://aws.amazon.com/summit 24/11");
  assert.deepEqual([aws.title, aws.kind, aws.start_date, aws.url], ["AWS Summit", "conference", "2026-11-24", "https://aws.amazon.com/summit"]);

  // Keeps a meaningful title when the place is all there is
  const g = e("Interview at Google 3 Dec 10:30");
  assert.deepEqual([g.title, g.location, g.start_time], ["Interview at Google", "Google", "10:30"]);

  // No date → a flagged default (or the day that was clicked)
  const none = e("Dentist");
  assert.equal(none.dateFound, false);
  assert.equal(none.start_date, TODAY);
  assert.equal(analyzeEvent("Dentist", TODAY, "2026-11-20").start_date, "2026-11-20");

  // Bulk: bullets, numbers and blank lines
  const many = analyzeEvents("- Bali holiday 20-27 Dec\n2) Mum's birthday 18 Nov\n\n[ ] Google interview 10 Nov 9am", TODAY);
  assert.equal(many.length, 3);
  assert.deepEqual(many.map((d) => d.kind), ["holiday", "birthday", "interview"]);
});

test("batch events: long schedule lines split into title, place and description", async () => {
  const { analyzeEvent } = await import("../lib/brain/index.ts");
  const e = (line: string) => analyzeEvent(line, "2026-11-11");

  const a = e("Bukit Jalil (Thursday, 26 November 2026): Megastrength Foundations runs with a capacity of 8, aimed at high-earning corporate professionals, 7:15 PM – 8:05 PM");
  assert.equal(a.title, "Megastrength Foundations");
  assert.equal(a.location, "Bukit Jalil");
  assert.equal(a.start_date, "2026-11-26");
  assert.deepEqual([a.start_time, a.end_time], ["19:15", "20:05"]);
  assert.equal(a.kind, "class");
  assert.equal(a.notes, "Runs with a capacity of 8, aimed at high-earning corporate professionals");

  const b = e("Bandar Utama, One Square (Sunday, 29 November 2026): Hot Flow Slow (Yoga) runs with a capacity of 18, aimed at affluent urban professionals 11:00 AM – 12:00 PM");
  assert.deepEqual([b.title, b.location, b.kind, b.start_time, b.end_time], ["Hot Flow Slow (Yoga)", "Bandar Utama, One Square", "class", "11:00", "12:00"]);

  const c = e("Damansara Heights, The Five @ KPD (Friday, 11 December 2026): Reformer Foundations runs with a capacity of 14, aimed at high-end clients 8:30 AM – 9:20 AM");
  assert.deepEqual([c.title, c.location, c.start_date, c.start_time], ["Reformer Foundations", "Damansara Heights, The Five @ KPD", "2026-12-11", "08:30"]);

  // The explicit date beats the weekday label (no year given)
  assert.equal(e("Petaling Jaya, Factory 19 (Monday, 30 November): Reformer Sculpt runs with a capacity of 12, aimed at career-driven professionals 6:00 PM – 6:50 PM").start_date, "2026-11-30");

  // Ordinary short lines are untouched; a heading that isn't a place stays the title
  const d = e("Dinner with Jo: bring wine 20 Nov 7pm");
  assert.deepEqual([d.title, d.notes, d.location, d.start_date], ["Dinner with Jo", "Bring wine", "", "2026-11-20"]);
  assert.equal(e("Sarah & Tom's wedding 12 Dec 2026 4pm at Kuala Lumpur").notes, "");
  assert.equal(e("Kuala Lumpur: Sarah's wedding 12 Dec").location, "Kuala Lumpur");
});

test("entries are guessed as task or event", async () => {
  const { guessEntryType } = await import("../lib/brain/index.ts");
  const g = guessEntryType;
  // Things you DO
  for (const l of ["Finance Lang Backdrop design", "Pay electricity bill by Friday", "Book dentist appointment", "Plan Sarah's birthday party next week",
    "Email the supplier", "Buy a gift for Mum", "Prepare the Invest Fair booth", "Dentist"]) assert.equal(g(l), "task", l);
  // Things that HAPPEN
  for (const l of ["Finance Lang Invest Fair 12 Dec", "Sarah & Tom's wedding", "Bali holiday 20-27 Dec", "Google interview", "AWS Summit 24/11",
    "Mum's 60th birthday party", "Hot Flow Yoga class", "Coffee with Jo 3pm"]) assert.equal(g(l), "event", l);
});

test("events wear their project's colour, otherwise their type colour", async () => {
  const { eventTheme } = await import("../lib/events.ts");
  const { PALETTE, colorOf } = await import("../lib/colors.ts");
  const plain = eventTheme("wedding", null);
  const tagged = eventTheme("wedding", { color: "green" });
  assert.notDeepEqual(plain, tagged);
  assert.equal(tagged.accent, colorOf("green").fg);
  assert.ok(tagged.panel.startsWith(colorOf("green").dot));          // soft tint of the project's colour
  assert.equal(tagged.label, "Wedding");                              // type label unchanged
  assert.deepEqual(eventTheme("wedding", undefined), plain);
  assert.ok(PALETTE.length >= 12 && !PALETTE.includes("gray"));
  assert.notDeepEqual(eventTheme("party", { color: "red" }), eventTheme("party", { color: "cyan" }));
});

test("custom project colours: validated, and always readable", async () => {
  const { normalizeColor, colorOf, projectTheme, isHexColor } = await import("../lib/colors.ts");
  // What may be stored
  assert.equal(normalizeColor("green"), "green");
  assert.equal(normalizeColor(" #3B82F6 "), "#3b82f6");
  for (const bad of ["gray", "javascript:alert(1)", "#fff", "#12345g", "red; background:url(x)", "", null, 42, "rgb(1,2,3)", "#3b82f6aa"]) assert.equal(normalizeColor(bad), null, String(bad));
  assert.equal(isHexColor("#3b82f6"), true);

  // A custom colour produces a full set: itself, a soft tint and a darker text colour
  const c = colorOf("#3b82f6");
  assert.equal(c.dot, "#3b82f6");
  assert.notEqual(c.bg, c.dot);
  const lum = (hex: string) => { const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(parseInt(hex.slice(1, 3), 16)) + 0.7152 * f(parseInt(hex.slice(3, 5), 16)) + 0.0722 * f(parseInt(hex.slice(5, 7), 16)); };
  const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  // Text on the tint must stay readable for any colour, including very light and very dark ones
  for (const hex of ["#3b82f6", "#ffeb3b", "#ffffff", "#000000", "#ff00ff", "#84cc16", "#f0a04b", "#111827"]) {
    const t = colorOf(hex);
    assert.ok(ratio(t.fg, t.bg) >= 4.5, `${hex}: text ${t.fg} on ${t.bg} = ${ratio(t.fg, t.bg).toFixed(1)}`);
  }
  assert.ok(projectTheme("#3b82f6").panel.startsWith("#3b82f6"));    // event card side panel follows it
  assert.equal(colorOf("nonsense").dot, colorOf("gray").dot);         // unknown values still fall back safely
});

test("times: shown as 12-hour, typed in any common way", async () => {
  const { fmtTime, parseTimeInput, splitTime, joinTime } = await import("../lib/time.ts");
  assert.equal(fmtTime("16:30"), "4:30 PM");
  assert.equal(fmtTime("00:05"), "12:05 AM");
  assert.equal(fmtTime("12:00"), "12:00 PM");
  assert.equal(fmtTime("09:00"), "9:00 AM");
  assert.equal(fmtTime(""), "");
  assert.deepEqual(splitTime("23:59"), { h24: 23, h12: 11, m: 59, ap: "PM" });
  assert.equal(joinTime(12, 0, "AM"), "00:00");
  assert.equal(joinTime(12, 0, "PM"), "12:00");
  assert.equal(joinTime(4, 5, "PM"), "16:05");
  const ok: [string, string | undefined, string][] = [
    ["4pm", undefined, "16:00"], ["4:30 pm", undefined, "16:30"], ["4.30p.m.", undefined, "16:30"], ["16:30", undefined, "16:30"], ["1630", undefined, "16:30"],
    ["430", "PM", "16:30"], ["430", "AM", "04:30"], ["12am", undefined, "00:00"], ["12pm", undefined, "12:00"], ["12:15am", undefined, "00:15"],
    ["noon", undefined, "12:00"], ["midnight", undefined, "00:00"], ["7", undefined, "07:00"], ["7", "PM", "19:00"], ["19", "AM", "19:00"], ["08:05", "PM", "08:05"],
  ];
  for (const [input, fb, want] of ok) assert.equal(parseTimeInput(input, fb as "AM" | "PM" | undefined), want, `${input} (${fb})`);
  for (const bad of ["", "25:00", "4:75", "13pm", "0pm", "abc", "4:3", "99"]) assert.equal(parseTimeInput(bad), null, bad);
});
