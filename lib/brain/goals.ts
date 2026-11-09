// Turns a big goal ("build a business") into a dated, step-by-step plan.
// Order of preference: a plan YOU previously edited & accepted → built-in playbook → generic.

import { addDays } from "./dates.ts";
import { findLearned, type LearnedPlan, type PlanStep } from "./steps.ts";
import { capitalize } from "./text.ts";

export type PlannedTask = { title: string; dueDate: string; offsetDays: number; estimate: string; steps: string[] };
export type GoalPlan = { goal: string; projectName: string; source: "learned" | "playbook" | "generic" | "ai"; tasks: PlannedTask[] };

type Playbook = { re: RegExp; project: string; tasks: PlanStep[] };

const PLAYBOOKS: Playbook[] = [
  {
    re: /\b(business|startup|start-up|company|side hustle|side-hustle|freelanc|shop|store|brand|agency|consultancy)\b/i,
    project: "Business",
    tasks: [
      { text: "Write down the idea and who it's for", offsetDays: 0, estimate: "1 day", steps: [
        "Describe the idea in one sentence", "Name your ideal customer as specifically as possible", "List the top 3 problems you solve for them", "Write why YOU are the right person to do this"] },
      { text: "Research the market and competitors", offsetDays: 2, estimate: "1 week", steps: [
        "Find 5 competitors (direct and indirect)", "Note their prices, strengths and weaknesses", "Check search demand / community chatter for the problem", "Write what you'll do differently"] },
      { text: "Talk to 10 potential customers", offsetDays: 9, estimate: "2 weeks", steps: [
        "Write 5 open questions about their problem (not your idea)", "Reach out via friends, LinkedIn, forums", "Run the conversations and take notes", "Summarise patterns — is the problem real and painful?"] },
      { text: "Define your offer and pricing", offsetDays: 23, estimate: "3 days", steps: [
        "Describe the smallest version people would pay for", "Pick a pricing model (one-off, subscription, hourly)", "Set a starting price based on competitors and value", "Write a one-paragraph offer"] },
      { text: "Make it official: name, registration, bank account", offsetDays: 26, estimate: "1 week", steps: [
        "Check the name is free (registry, domain, social handles)", "Look up the business structure and registration rules where you live", "Register the business", "Open a separate business bank account"] },
      { text: "Set up simple finances", offsetDays: 30, estimate: "2 days", steps: [
        "Choose a free bookkeeping method (spreadsheet or free tool)", "Create an invoice / receipt template", "Decide how much to set aside for tax each month", "Track every expense from day one"] },
      { text: "Build the first version (MVP)", offsetDays: 33, estimate: "3 weeks", steps: [
        "List the must-have features only", "Build or source the first version", "Test it with 2–3 friendly customers", "Fix the biggest issues"] },
      { text: "Create a simple online presence", offsetDays: 40, estimate: "1 week", steps: [
        "Set up a one-page website or landing page", "Create the 1–2 social profiles your customers actually use", "Add a clear way to buy or contact you", "Ask early users for testimonials"] },
      { text: "Get your first 3 paying customers", offsetDays: 54, estimate: "3 weeks", steps: [
        "Go back to the people you interviewed", "Post where your customers hang out", "Offer an early-bird deal for feedback", "Deliver brilliantly and ask for referrals"] },
      { text: "Review what's working and plan the next 90 days", offsetDays: 75, estimate: "1 day", steps: [
        "Look at revenue, costs and time spent", "List what customers loved and complained about", "Choose ONE growth channel to double down on", "Set 3 goals for the next 90 days"] },
    ],
  },
  {
    re: /\b(fit|fitness|lose weight|weight loss|get in shape|marathon|5k|10k|half marathon|stronger|muscle|healthier)\b/i,
    project: "Health",
    tasks: [
      { text: "Set a clear, measurable fitness target", offsetDays: 0, estimate: "1 hour", steps: ["Pick one number to improve (weight, distance, reps)", "Record today's starting point", "Choose a realistic deadline", "Tell someone for accountability"] },
      { text: "Get a health check-up", offsetDays: 3, estimate: "1 day", steps: ["Book a GP / doctor visit", "Ask about any limits or risks", "Note blood pressure / baseline numbers"] },
      { text: "Plan a weekly training schedule", offsetDays: 4, estimate: "1 hour", steps: ["Pick 3 fixed training slots per week", "Choose a beginner programme", "Add the sessions to the calendar"] },
      { text: "Sort out food basics", offsetDays: 6, estimate: "2 days", steps: ["Track what you eat for 3 days", "Pick 2 easy swaps", "Plan and shop for a week of meals"] },
      { text: "Complete weeks 1–2 of training", offsetDays: 7, estimate: "2 weeks", steps: ["Do every scheduled session", "Log each workout", "Sleep 7+ hours"] },
      { text: "Check progress and adjust", offsetDays: 21, estimate: "1 hour", steps: ["Re-measure your target number", "Increase difficulty slightly", "Fix whatever made you skip sessions"] },
      { text: "Complete weeks 3–6 of training", offsetDays: 22, estimate: "4 weeks", steps: ["Stick to the schedule", "Add one new challenge per week", "Celebrate small wins"] },
      { text: "Final review and next goal", offsetDays: 50, estimate: "1 hour", steps: ["Compare with your starting point", "Decide the next target", "Update the plan"] },
    ],
  },
  {
    re: /\b(learn|master|get good at|study)\b/i,
    project: "Learning",
    tasks: [
      { text: "Define why and what “good enough” means", offsetDays: 0, estimate: "1 hour", steps: ["Write why you want this skill", "Describe a concrete thing you'll be able to do", "Set a deadline"] },
      { text: "Pick one main resource and a practice routine", offsetDays: 1, estimate: "1 day", steps: ["Compare 3 courses / books / apps", "Pick ONE to follow", "Block 30–60 min daily practice slots"] },
      { text: "Fundamentals: first 2 weeks", offsetDays: 2, estimate: "2 weeks", steps: ["Follow the resource in order", "Practise every day, even 15 min", "Keep a list of questions"] },
      { text: "Build a small project using the skill", offsetDays: 16, estimate: "2 weeks", steps: ["Choose a tiny real project", "Do it, getting stuck is part of it", "Share it with someone for feedback"] },
      { text: "Find a community or mentor", offsetDays: 20, estimate: "1 week", steps: ["Join one forum / group / class", "Ask one good question", "Help someone else who's newer"] },
      { text: "Review progress and set the next level", offsetDays: 35, estimate: "1 hour", steps: ["Test yourself against your “good enough” definition", "Pick the next resource or project", "Update the practice routine"] },
    ],
  },
  {
    re: /\b(move|moving|relocat|new (house|home|apartment|flat))\b/i,
    project: "Home",
    tasks: [
      { text: "Set the moving date and budget", offsetDays: 0, estimate: "1 day", steps: ["Confirm the move-out / move-in dates", "Set a budget", "Decide: movers or DIY"] },
      { text: "Book movers or a van", offsetDays: 2, estimate: "2 days", steps: ["Get 3 quotes", "Check reviews and insurance", "Book and save the confirmation"] },
      { text: "Declutter before packing", offsetDays: 4, estimate: "1 week", steps: ["Go room by room: keep / sell / donate / bin", "List items for sale", "Book a donation pick-up"] },
      { text: "Update your address everywhere", offsetDays: 10, estimate: "2 hours", steps: ["Bank, employer, insurance", "Government / ID / licence", "Subscriptions and deliveries", "Set up mail forwarding"] },
      { text: "Set up utilities and internet at the new place", offsetDays: 12, estimate: "1 day", steps: ["Electricity, water, gas", "Internet (book early!)", "Cancel or transfer old services"] },
      { text: "Pack everything", offsetDays: 14, estimate: "1 week", steps: ["Get boxes and tape", "Pack non-essentials first", "Label boxes by room", "Pack an essentials box for night one"] },
      { text: "Moving day", offsetDays: 21, estimate: "1 day", steps: ["Final walkthrough of the old place", "Take meter readings and photos", "Hand over keys"] },
      { text: "Unpack and settle in", offsetDays: 22, estimate: "1 week", steps: ["Kitchen and bedroom first", "Check everything arrived undamaged", "Meet the neighbours"] },
    ],
  },
  {
    re: /\b(save|saving|budget|debt|emergency fund|financial|invest)\b/i,
    project: "Finance",
    tasks: [
      { text: "See where your money goes", offsetDays: 0, estimate: "2 hours", steps: ["Export the last 3 months of transactions", "Group into categories", "Find the 3 biggest surprises"] },
      { text: "Set a savings / payoff target", offsetDays: 2, estimate: "1 hour", steps: ["Pick the amount and deadline", "Work out the monthly number needed"] },
      { text: "Build a simple monthly budget", offsetDays: 3, estimate: "2 hours", steps: ["Fixed costs first", "Set limits for variable spending", "Pay yourself first: automate the savings transfer"] },
      { text: "Cut or renegotiate 3 costs", offsetDays: 7, estimate: "1 week", steps: ["Cancel unused subscriptions", "Call to renegotiate phone / internet / insurance", "Move savings to a high-interest account"] },
      { text: "Monthly money check-in", offsetDays: 30, estimate: "1 hour", steps: ["Compare spending vs budget", "Adjust categories", "Celebrate progress"] },
    ],
  },
  {
    re: /\b(website|app|launch|product)\b/i,
    project: "Work",
    tasks: [
      { text: "Define the goal and audience", offsetDays: 0, estimate: "1 day", steps: ["Who is it for?", "What's the one action they should take?", "How will you measure success?"] },
      { text: "Sketch the structure", offsetDays: 2, estimate: "2 days", steps: ["List the pages / screens", "Sketch the main flow on paper", "Get feedback from 2 people"] },
      { text: "Write the content", offsetDays: 5, estimate: "3 days", steps: ["Headline and value proposition", "Key sections", "Call-to-action"] },
      { text: "Build it", offsetDays: 8, estimate: "2 weeks", steps: ["Pick tools (free tiers first)", "Build the core flow", "Make it work on mobile"] },
      { text: "Test and launch", offsetDays: 22, estimate: "3 days", steps: ["Test on several devices", "Fix the top issues", "Launch and tell your network"] },
      { text: "Review results after launch", offsetDays: 36, estimate: "1 hour", steps: ["Check the success metric", "Collect feedback", "Plan the next improvement"] },
    ],
  },
  {
    re: /\b(job|career|promotion|interview|resume|cv)\b/i,
    project: "Work",
    tasks: [
      { text: "Decide the role you're aiming for", offsetDays: 0, estimate: "1 day", steps: ["List what you want more / less of", "Pick 1–2 target roles", "Find 5 example job ads"] },
      { text: "Update your CV and LinkedIn", offsetDays: 2, estimate: "3 days", steps: ["Tailor to the target role", "Add measurable achievements", "Ask a friend to review"] },
      { text: "Reach out to 10 people in the field", offsetDays: 6, estimate: "2 weeks", steps: ["Make a list of contacts", "Send short, specific messages", "Book coffee chats"] },
      { text: "Apply to 5 roles per week", offsetDays: 10, estimate: "4 weeks", steps: ["Track applications in one list", "Tailor each cover letter", "Follow up after a week"] },
      { text: "Prepare for interviews", offsetDays: 14, estimate: "1 week", steps: ["Write 6 STAR stories", "Practise common questions out loud", "Research each company"] },
    ],
  },
];

const GENERIC: PlanStep[] = [
  { text: "Define what success looks like", offsetDays: 0, estimate: "1 hour", steps: ["Write the goal as a specific outcome", "Write why it matters to you", "Pick a target date"] },
  { text: "Break it into 3–5 milestones", offsetDays: 1, estimate: "1 hour", steps: ["List the big chunks of work", "Order them", "Give each a rough date"] },
  { text: "Do the first small step", offsetDays: 2, estimate: "1 day", steps: ["Pick the smallest action that moves things forward", "Do it today or tomorrow"] },
  { text: "Work on milestone 1", offsetDays: 3, estimate: "2 weeks", steps: ["Schedule focused time blocks", "Remove one obstacle", "Track progress"] },
  { text: "Weekly review", offsetDays: 7, estimate: "30 min", steps: ["What got done?", "What's blocking you?", "Plan next week's steps"] },
  { text: "Work on the remaining milestones", offsetDays: 17, estimate: "4 weeks", steps: ["One milestone at a time", "Ask for help where stuck"] },
  { text: "Wrap up and reflect", offsetDays: 45, estimate: "1 hour", steps: ["Did you hit the outcome?", "What would you do differently?", "Celebrate"] },
];

function materialize(goal: string, projectName: string, source: GoalPlan["source"], steps: PlanStep[], today: string): GoalPlan {
  return {
    goal: capitalize(goal.trim()),
    projectName,
    source,
    tasks: steps.map((s) => ({
      title: s.text,
      offsetDays: s.offsetDays ?? 0,
      dueDate: addDays(today, s.offsetDays ?? 0),
      estimate: s.estimate ?? "",
      steps: s.steps ?? [],
    })),
  };
}

export function planGoal(goal: string, today: string, learned: LearnedPlan[] = [], fallbackProject = "Inbox"): GoalPlan {
  const mine = findLearned(goal, "goal", learned, 0.34);
  if (mine) {
    const playbook = PLAYBOOKS.find((p) => p.re.test(goal));
    return materialize(goal, playbook?.project ?? fallbackProject, "learned", mine.steps, today);
  }
  const playbook = PLAYBOOKS.find((p) => p.re.test(goal));
  if (playbook) return materialize(goal, playbook.project, "playbook", playbook.tasks, today);
  return materialize(goal, fallbackProject, "generic", GENERIC, today);
}
