// OPTIONAL: smarter goal plans using Google's Gemini free tier (no credit card needed).
// If GEMINI_API_KEY isn't set — or the call fails / hits the free quota — THEO silently
// falls back to its built-in planner, so this can never cost you money or break the app.

import type { PlanStep } from "./brain";

export const aiEnabled = () => !!process.env.GEMINI_API_KEY;

export async function aiGoalSteps(goal: string, projectNames: string[]): Promise<{ project: string; steps: PlanStep[] } | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const prompt = `You are a practical life & project coach. Break this goal into 6-10 sequential, concrete tasks a busy person can act on.
Goal: "${goal}"
Pick the best project for the goal from: ${projectNames.join(", ")} (or propose a short new name).
Return ONLY JSON: {"project": string, "tasks": [{"text": string (imperative, <70 chars), "offsetDays": integer days from today to due date (increasing), "estimate": string like "2 days", "steps": [3-4 short imperative sub-steps]}]}`;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed?.tasks) || !parsed.tasks.length) return null;
    const steps: PlanStep[] = parsed.tasks.slice(0, 12).map((t: Record<string, unknown>) => ({
      text: String(t.text ?? "").slice(0, 120),
      offsetDays: Math.max(0, Math.round(Number(t.offsetDays) || 0)),
      estimate: String(t.estimate ?? ""),
      steps: Array.isArray(t.steps) ? t.steps.slice(0, 6).map(String) : [],
    })).filter((s: PlanStep) => s.text);
    return { project: String(parsed.project || "").slice(0, 40), steps };
  } catch {
    return null;
  }
}
