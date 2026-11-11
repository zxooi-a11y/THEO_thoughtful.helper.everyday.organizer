# THEO: Thoughtful Helper for Everyday Organizing

A calendar and life-task tracker in one app. Paste a list of tasks and THEO decides which project each belongs to, tags it, picks a due date, and writes the steps to get it done. Give it a big goal like "build a business" and it builds a dated, step-by-step plan. It learns from every correction you make, and everything is stored in your Neon Postgres database.

**Running costs: $0.** Next.js on the Vercel Hobby plan, Neon free tier, and a built-in "brain" that needs no paid AI.

## What it does

| Feature | How |
|---|---|
| **Bulk add** | Click **Add tasks**, paste one task per line (bullets and numbers are fine), then review and save. |
| **Smart due dates** | Reads phrases like "tomorrow", "by Friday", "next week", "in 2 weeks", "this weekend", "end of month", "20/12" and "Dec 3". If you don't give a date, it uses how fast *you* usually finish tasks in that project, or a sensible default. Every date comes with a short reason. |
| **Auto project and tags** | Matches built-in vocabulary to projects, plus `#hashtags`, and adds action tags (call, pay, buy, book…). Words like "urgent", "ASAP" or `!` set high priority. |
| **Steps for every task** | Templates for calls, payments, bookings, purchases, cleaning, repairs, learning, events, writing and more. |
| **Goal planner** | Playbooks for business, fitness, learning, moving house, saving money, launches and job hunting, plus a general framework for anything else. Each step is a dated task with its own sub-steps. |
| **Learning** | Moving a task to another project trains the word→project weights (`learned_keywords`). Rewriting a task's steps or editing a goal plan saves your version (`learned_plans`), and similar tasks or goals reuse it. Finished tasks teach THEO your typical lead time per project. |
| **Files on tasks** | Attach files when adding tasks (batch or single) or later from a task's panel. THEO reads text, markdown, CSV, JSON, PDF and Word files and uses them for Auto: what the task is about (project and tags), a deadline it finds ("pay by 3 December"), urgency ("final notice"), and, in Single task mode, a checklist as the steps. On an existing task it offers the deadline and checklist as one-tap suggestions. Images and scanned PDFs are stored but not read. |
| **Final work** | Every task has a "Final work" field: a link to the finished result (design, document, site, repo…) and a one-line description. Add it from the task panel or the Edit window; finished tasks show it as a "view final work" card in the Archive. Only normal web links are accepted. |
| **Event descriptions** | Every event has a Description (optional). In Batch dump, a long line such as "Bukit Jalil (Thursday, 26 November 2026): Hot Flow Yoga runs with a capacity of 18, aimed at professionals, 7:15 PM – 8:05 PM" is split into a short title, the place, the date and times, and a description. Descriptions show on the event cards. (Stored in the existing notes field, so earlier notes appear as descriptions.) |
| **Batch events** | On the Events page, **Add event** offers **Single event** or **Batch dump**. Paste one event per line ("Sarah's wedding 12 Dec 2026 4pm at Kuala Lumpur", "Bali holiday 20-27 Dec", "New Year party 31 Dec 10pm - 2am"); THEO works out the type, dates (including ranges and past-midnight times), times, place and link, you review them, and all are saved in one go. |
| **Project tags, tasks & events** | A project is a tag that both tasks and events sit under (e.g. "Finance Lang": the task "Backdrop design" and the event "Invest Fair"). When you add entries, THEO guesses whether each line is a task (something to do) or an event (something you attend) and which project it belongs to; flip either in the review. Existing entries can be converted between task and event from their edit window (project tag and files carry over). The Projects page shows each tag's tasks and events together, and the Events page and calendar can filter by project. |
| **Project colours** | Every project tag has a colour you choose: 12 ready-made colours or any custom colour (colour wheel or exact hex). Choose it when you create the project, change it under the project field in the event or task window, or on the Projects page. Event cards (side panel, dates, label) and calendar event chips take the colour of their project; events with no project keep their type colour. |
| **Time picker** | Start and end times use scroll wheels like an iPhone alarm: hour, minute (every minute) and AM/PM snap to a highlighted centre row. Scroll or swipe, click a row, drag with the mouse, use the arrow keys, or type a time ("430pm", "16:30", "noon"). Times show as 12-hour ("4:30 PM") everywhere; end time is optional and Clear / All day empty it. |
| **Date picker** | Every date field uses the app's own calendar picker (rounded, soft, orange selection) instead of the browser's: month and year jump, Today and Clear buttons, an end date can't be before the start, and it works with the keyboard (arrows, PageUp/PageDown, Enter, Esc). |
| **Project picker** | Every project dropdown is searchable: type to narrow the list, use the arrow keys and Enter, and "New project…" is always available (type a name first and it creates that one). |
| **Calendar** | Month, week and day views. Drag a task to another day to reschedule it. Hover a day and press **+** to add tasks for that date. |
| **Analytics** | Activity level, tasks completed per month, goal progress, a 30-day trend, and where your time goes by project. |

## Setup (about 10 minutes, free)

The database schema is already applied to the Neon project **"THEO - Thoughful.Helper.Everyday.Organizer"**. On a fresh database, run `npm run db:migrate`.

### 1. Get your Neon connection string
Go to the Neon console, open the project, click **Connect**, and copy the **pooled** connection string. Use the `production` / default branch, not `claude-test`.

### 2. Deploy on Vercel (free Hobby plan)
1. Sign in at https://vercel.com with GitHub, choose **Add New → Project**, and import this repo.
2. Under **Environment Variables**, add:
   - `DATABASE_URL`: the Neon connection string.
   - `APP_PASSCODE`: any passcode you like. This locks the app so only you can open it.
3. Click **Deploy**. Every push to GitHub redeploys automatically.

> Alternative: Vercel → Storage → **Connect Neon** links the database and sets `DATABASE_URL` for you.

### 3. (Optional) Smarter plans with free AI
Create a free key at https://aistudio.google.com/apikey (no card needed) and add it as `GEMINI_API_KEY`. THEO will then use AI for goals that don't match a built-in playbook. If the key is missing, or the free quota runs out, THEO falls back to its built-in planner, so you can't be charged.

## Run locally
```bash
cp .env.example .env.local   # paste DATABASE_URL
npm install
npm run dev                  # http://localhost:3000
npm test                     # brain unit tests
```

## Project layout
```
app/              pages (calendar, plan, projects, archive, analytics) + API routes
components/       UI pieces (BulkAdd, TaskDetail, KpiCards, Sparkline, Sidebar)
lib/brain/        the free "AI": dates.ts, classify.ts, steps.ts, goals.ts
lib/repo.ts       all SQL + the learning updates
lib/ai.ts         optional Gemini integration
db/schema.sql     database schema (idempotent)
```

## Files
- **Event times:** events have a start time and an end time (or leave both empty for all day). A same-day event must end after it starts; for something that runs past midnight, set an end date as well. THEO reads ranges such as "4 – 6 PM" from invites too.
- **Events too:** attach tickets, invites and bookings to an event. THEO reads the file and offers to fill in the event's type, date (it prefers the event date over an RSVP deadline), time and link with one tap, and event cards show a 📎 count.
- Stored in your Neon database (no extra service or cost). Limit: **4 MB per file** (Vercel's free request size) and 10 files per task. Uploads stop at 350 MB total to stay inside Neon's free 0.5 GB.
- Reading happens inside your own app; file contents are never sent to any outside service (including the optional Gemini key).
- With `APP_PASSCODE` set, downloads need the passcode too.
- Files nothing points to (abandoned uploads, deleted tasks) are cleaned up automatically after 24 hours.

## Free-tier limits to know
- **Neon free:** 0.5 GB storage per project, about 190 compute hours a month, and the database sleeps when idle. That's plenty for one person; the first request after a pause takes about a second longer.
- **Vercel Hobby:** for personal, non-commercial use. That fits a personal organizer.
