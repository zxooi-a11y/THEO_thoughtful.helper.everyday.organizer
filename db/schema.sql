-- THEO schema. Idempotent: safe to run more than once (`npm run db:migrate`).

CREATE TABLE IF NOT EXISTS projects (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  color       TEXT NOT NULL DEFAULT 'blue',      -- one of the palette keys in lib/colors.ts
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A goal is a big outcome ("Build a business") broken into a plan of tasks.
CREATE TABLE IF NOT EXISTS goals (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  project_id  INT REFERENCES projects(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id            SERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  notes         TEXT NOT NULL DEFAULT '',
  project_id    INT REFERENCES projects(id) ON DELETE SET NULL,
  goal_id       INT REFERENCES goals(id) ON DELETE CASCADE,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  due_date      DATE,
  due_reason    TEXT NOT NULL DEFAULT '',          -- why THEO picked that date
  estimate      TEXT NOT NULL DEFAULT '',          -- e.g. "1 hour", "3 days"
  priority      SMALLINT NOT NULL DEFAULT 2,       -- 1 high, 2 normal, 3 low
  status        TEXT NOT NULL DEFAULT 'todo'       -- todo | doing | later | done
                CHECK (status IN ('todo','doing','later','done')),
  archived      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS tasks_due_idx     ON tasks (due_date);
CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks (project_id);
CREATE INDEX IF NOT EXISTS tasks_goal_idx    ON tasks (goal_id);

CREATE TABLE IF NOT EXISTS task_steps (
  id        SERIAL PRIMARY KEY,
  task_id   INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  position  INT NOT NULL,
  text      TEXT NOT NULL,
  done      BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS task_steps_task_idx ON task_steps (task_id, position);

-- ── Learning memory ─────────────────────────────────────────────
-- Word → project associations. Bumped every time you file or re-file a task,
-- so THEO's auto-tagging drifts toward how YOU organize things.
CREATE TABLE IF NOT EXISTS learned_keywords (
  keyword     TEXT NOT NULL,
  project_id  INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  weight      REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (keyword, project_id)
);

-- Step lists you edited & accepted. Next time a similar task or goal comes in,
-- THEO reuses your version instead of its built-in template.
CREATE TABLE IF NOT EXISTS learned_plans (
  id          SERIAL PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('task','goal')),
  key_words   TEXT[] NOT NULL,                     -- normalized keywords of the title
  title       TEXT NOT NULL,
  steps       JSONB NOT NULL,                      -- [{text, offsetDays?, estimate?}]
  uses        INT NOT NULL DEFAULT 1,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Your 👍 / 👎 on THEO's suggestions, plus where you moved the due date.
-- Used to tune project guesses, step templates and typical lead times.
CREATE TABLE IF NOT EXISTS task_feedback (
  id                    SERIAL PRIMARY KEY,
  task_id               INT REFERENCES tasks(id) ON DELETE SET NULL,
  vote                  TEXT CHECK (vote IN ('up','down')),
  aspects               TEXT[] NOT NULL DEFAULT '{}',   -- what was off: project | due | steps | title
  brief                 TEXT NOT NULL DEFAULT '',
  suggested_project_id  INT REFERENCES projects(id) ON DELETE SET NULL,
  chosen_project_id     INT REFERENCES projects(id) ON DELETE SET NULL,
  suggested_due         DATE,
  chosen_due            DATE,
  lead_days             INT,                           -- chosen_due − day it was added
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_feedback_project_idx ON task_feedback (chosen_project_id);

-- Life events: weddings, trips, interviews, birthdays… shown on the Events page and the calendar.
CREATE TABLE IF NOT EXISTS events (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'other',   -- see lib/events.ts
  start_date  DATE NOT NULL,
  end_date    DATE,                            -- NULL = single day
  start_time  TEXT NOT NULL DEFAULT '',        -- optional "14:30"
  location    TEXT NOT NULL DEFAULT '',
  url         TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  favorite    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_start_idx ON events (start_date);

-- Files attached to tasks. Stored in the database itself (no extra service / cost).
-- extracted_text is what THEO reads to help the Auto choices (empty for images etc.).
CREATE TABLE IF NOT EXISTS files (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  mime            TEXT NOT NULL DEFAULT '',
  size            INT NOT NULL,
  data            BYTEA NOT NULL,
  extracted_text  TEXT NOT NULL DEFAULT '',
  chars           INT NOT NULL DEFAULT 0,        -- length of extracted_text (cheap "can THEO read it?" check)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS task_files (
  task_id  INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_id  INT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, file_id)
);
CREATE INDEX IF NOT EXISTS task_files_file_idx ON task_files (file_id);

-- Seed a few starter projects (ignored if they already exist).
INSERT INTO projects (name, color) VALUES
  ('Home', 'orange'), ('Health', 'green'), ('Finance', 'yellow'),
  ('Work', 'blue'), ('Errands', 'pink'), ('Learning', 'purple'),
  ('Social', 'teal'), ('Business', 'indigo')
ON CONFLICT (name) DO NOTHING;
