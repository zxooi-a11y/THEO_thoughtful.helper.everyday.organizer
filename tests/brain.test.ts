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
