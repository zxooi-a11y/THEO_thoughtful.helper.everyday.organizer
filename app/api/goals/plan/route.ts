import { planGoal, type GoalPlan } from "@/lib/brain";
import { findLearned } from "@/lib/brain/steps";
import { addDays } from "@/lib/brain/dates";
import { aiEnabled, aiGoalSteps } from "@/lib/ai";
import { loadBrainContext } from "@/lib/repo";
import { bad, handle, ok, todayFrom } from "@/lib/http";

// Draft a step-by-step plan for a big goal. Nothing is saved until you accept it.
export const POST = handle(async (req: Request) => {
  const { goal, today } = await req.json();
  if (typeof goal !== "string" || goal.trim().length < 3) return bad("Describe your goal in a few words");
  const t = todayFrom(today);
  const ctx = await loadBrainContext();
  let plan: GoalPlan = planGoal(goal, t, ctx.learnedPlans);

  // Your own edited plans always win; otherwise try free AI for goals with no playbook.
  if (aiEnabled() && plan.source !== "learned" && !findLearned(goal, "goal", ctx.learnedPlans, 0.34)) {
    const ai = await aiGoalSteps(goal, ctx.projects.map((p) => p.name));
    if (ai?.steps.length) {
      plan = {
        goal: plan.goal,
        projectName: ai.project || plan.projectName,
        source: "ai",
        tasks: ai.steps.map((s) => ({ title: s.text, offsetDays: s.offsetDays ?? 0, dueDate: addDays(t, s.offsetDays ?? 0), estimate: s.estimate ?? "", steps: s.steps ?? [] })),
      };
    }
  }
  return ok({ plan, aiEnabled: aiEnabled() });
});
