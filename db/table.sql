-- ---------------------------------------------------------------------------
-- Luminior Dashboard — PostgreSQL schema
--
-- Run this once against a fresh database, then run function.sql. Both files
-- are idempotent (safe to re-run): tables use IF NOT EXISTS, functions use
-- DROP FUNCTION IF EXISTS + CREATE FUNCTION (see function.sql).
--
--   psql "$DATABASE_URL" -f db/table.sql
--   psql "$DATABASE_URL" -f db/function.sql
--
-- Model: every Admin and Super Admin owns exactly one company (tbl_companies,
-- one row per manager, enforced by a UNIQUE owner_id). Everything CRM-shaped
-- — team members, projects, tasks, attendance, leave — is scoped to a single
-- company_id. A member belongs to exactly one company: whichever manager's
-- invite link they registered through. There is no switching between
-- companies and no many-to-many membership.
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── updated_at trigger helper ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ── Users ────────────────────────────────────────────────────────────────────
-- company_id is set automatically (never edited directly by the app):
--   * admin / superadmin — stamped the moment they're promoted/created, by
--     sp_update_user_role / sp_register_user, which also creates their
--     tbl_companies row.
--   * user (member) — stamped at registration to the referring manager's
--     company_id (sp_register_user).
CREATE TABLE IF NOT EXISTS tbl_users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               varchar(255) NOT NULL UNIQUE,
  -- NULL for OAuth-only accounts (Google) — they carry no password.
  password_hash       varchar(255) NULL,
  full_name           varchar(200) NULL,
  role                varchar(20) NOT NULL DEFAULT 'user'
                        CONSTRAINT ck_users_role CHECK (role IN ('user', 'admin', 'superadmin')),
  is_active           boolean NOT NULL DEFAULT true,
  company_id          integer NULL,
  -- Who shared the invite link this user registered through. NULL for the
  -- bootstrap superadmin and for members created manually by an admin.
  referred_by         uuid NULL REFERENCES tbl_users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_users_touch ON tbl_users;
CREATE TRIGGER trg_users_touch
  BEFORE UPDATE ON tbl_users
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

-- ── Companies ─────────────────────────────────────────────────────────────
-- One row per Admin/Super Admin — their own separate company. Created
-- automatically (see function.sql), edited from Settings by its owner only.
CREATE TABLE IF NOT EXISTS tbl_companies (
  id              serial PRIMARY KEY,
  owner_id        uuid NOT NULL UNIQUE REFERENCES tbl_users(id) ON DELETE CASCADE,
  name            varchar(200) NOT NULL,
  avatar          varchar(500) NOT NULL DEFAULT '',
  gmail           varchar(255) NULL,
  phone           varchar(50) NULL,
  address         varchar(500) NULL,
  website         varchar(255) NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_companies_touch ON tbl_companies;
CREATE TRIGGER trg_companies_touch
  BEFORE UPDATE ON tbl_companies
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_company') THEN
    ALTER TABLE tbl_users
      ADD CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES tbl_companies(id);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS ix_users_company ON tbl_users (company_id);

-- ── Referral / invite links ─────────────────────────────────────────────────
-- One stable link per manager who shares it — anyone who signs up through it
-- joins that manager's company automatically, as an active CRM member.
CREATE TABLE IF NOT EXISTS tbl_referral_links (
  code       varchar(24) PRIMARY KEY,
  created_by uuid NOT NULL UNIQUE REFERENCES tbl_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── CRM: member profiles ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tbl_crm_member_profiles (
  user_id     uuid PRIMARY KEY REFERENCES tbl_users(id) ON DELETE CASCADE,
  company_id  integer NOT NULL REFERENCES tbl_companies(id) ON DELETE CASCADE,
  job_title   varchar(120) NULL,
  department  varchar(120) NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_crm_member_profiles_touch ON tbl_crm_member_profiles;
CREATE TRIGGER trg_crm_member_profiles_touch
  BEFORE UPDATE ON tbl_crm_member_profiles
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

CREATE INDEX IF NOT EXISTS ix_crm_member_profiles_company ON tbl_crm_member_profiles (company_id);

-- ── CRM: projects ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tbl_crm_projects (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   integer NOT NULL REFERENCES tbl_companies(id) ON DELETE CASCADE,
  name         varchar(200) NOT NULL,
  client_name  varchar(200) NULL,
  description  varchar(1000) NULL,
  status       varchar(20) NOT NULL DEFAULT 'planning'
                 CONSTRAINT ck_crm_project_status CHECK (status IN ('planning', 'active', 'on_hold', 'completed')),
  priority     varchar(20) NOT NULL DEFAULT 'p2'
                 CONSTRAINT ck_crm_project_priority CHECK (priority IN ('p0', 'p1', 'p2', 'p3')),
  start_date   date NULL,
  due_date     date NULL,
  poc_user_id  uuid NULL REFERENCES tbl_users(id),
  created_by   uuid NOT NULL REFERENCES tbl_users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_crm_projects_touch ON tbl_crm_projects;
CREATE TRIGGER trg_crm_projects_touch
  BEFORE UPDATE ON tbl_crm_projects
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

CREATE INDEX IF NOT EXISTS ix_crm_projects_company ON tbl_crm_projects (company_id);
CREATE INDEX IF NOT EXISTS ix_crm_project_poc
  ON tbl_crm_projects (poc_user_id)
  WHERE poc_user_id IS NOT NULL;

-- ── CRM: project members ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tbl_crm_project_members (
  company_id  integer NOT NULL REFERENCES tbl_companies(id) ON DELETE CASCADE,
  project_id  uuid NOT NULL REFERENCES tbl_crm_projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES tbl_users(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_crm_project_members_company ON tbl_crm_project_members (company_id);

-- ── CRM: tasks ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tbl_crm_tasks (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         integer NOT NULL REFERENCES tbl_companies(id) ON DELETE CASCADE,
  project_id         uuid NOT NULL REFERENCES tbl_crm_projects(id) ON DELETE CASCADE,
  assignee_id        uuid NULL REFERENCES tbl_users(id),
  title              varchar(240) NOT NULL,
  description        varchar(1200) NULL,
  status             varchar(20) NOT NULL DEFAULT 'todo'
                       CONSTRAINT ck_crm_task_status CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
  priority           varchar(20) NOT NULL DEFAULT 'p2'
                       CONSTRAINT ck_crm_task_priority CHECK (priority IN ('p0', 'p1', 'p2', 'p3')),
  progress           smallint NOT NULL DEFAULT 0
                       CONSTRAINT ck_crm_task_progress CHECK (progress BETWEEN 0 AND 100),
  estimated_minutes  integer NULL
                       CONSTRAINT ck_crm_task_estimate CHECK (estimated_minutes IS NULL OR estimated_minutes > 0),
  is_blocked         boolean NOT NULL DEFAULT false,
  blocker_reason     varchar(600) NULL,
  due_date           date NULL,
  created_by         uuid NOT NULL REFERENCES tbl_users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_crm_tasks_touch ON tbl_crm_tasks;
CREATE TRIGGER trg_crm_tasks_touch
  BEFORE UPDATE ON tbl_crm_tasks
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

CREATE INDEX IF NOT EXISTS ix_crm_tasks_company ON tbl_crm_tasks (company_id);
CREATE INDEX IF NOT EXISTS ix_crm_tasks_project ON tbl_crm_tasks (project_id);
CREATE INDEX IF NOT EXISTS ix_crm_tasks_assignee ON tbl_crm_tasks (assignee_id);

-- ── CRM: task update audit trail ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tbl_crm_task_updates (
  id                 bigserial PRIMARY KEY,
  company_id         integer NOT NULL REFERENCES tbl_companies(id) ON DELETE CASCADE,
  task_id            uuid NOT NULL REFERENCES tbl_crm_tasks(id) ON DELETE CASCADE,
  actor_id           uuid NOT NULL REFERENCES tbl_users(id),
  previous_status    varchar(20) NULL
                       CONSTRAINT ck_crm_task_update_prev_status
                       CHECK (previous_status IS NULL OR previous_status IN ('todo', 'in_progress', 'review', 'done')),
  status             varchar(20) NOT NULL
                       CONSTRAINT ck_crm_task_update_status CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
  previous_progress  smallint NULL
                       CONSTRAINT ck_crm_task_update_prev_progress
                       CHECK (previous_progress IS NULL OR previous_progress BETWEEN 0 AND 100),
  progress           smallint NOT NULL CONSTRAINT ck_crm_task_update_progress CHECK (progress BETWEEN 0 AND 100),
  note               varchar(600) NULL,
  is_blocked         boolean NOT NULL DEFAULT false,
  blocker_reason     varchar(600) NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_crm_task_updates_task
  ON tbl_crm_task_updates (task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_crm_task_updates_company ON tbl_crm_task_updates (company_id);

-- ── CRM: attendance / time entries ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tbl_crm_time_entries (
  id               bigserial PRIMARY KEY,
  company_id       integer NOT NULL REFERENCES tbl_companies(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES tbl_users(id) ON DELETE CASCADE,
  work_date        date NOT NULL DEFAULT ((now() AT TIME ZONE 'utc')::date),
  clock_in         timestamptz NOT NULL DEFAULT now(),
  clock_out        timestamptz NULL,
  break_started_at timestamptz NULL,
  break_label      varchar(120) NULL,
  break_minutes    integer NOT NULL DEFAULT 0,
  status           varchar(20) NOT NULL DEFAULT 'working'
                     CONSTRAINT ck_crm_time_status CHECK (status IN ('working', 'on_break', 'stopped'))
);

CREATE INDEX IF NOT EXISTS ix_crm_time_entries_active
  ON tbl_crm_time_entries (user_id, clock_in DESC)
  WHERE status IN ('working', 'on_break');

CREATE INDEX IF NOT EXISTS ix_crm_time_entries_day
  ON tbl_crm_time_entries (user_id, work_date);
CREATE INDEX IF NOT EXISTS ix_crm_time_entries_company ON tbl_crm_time_entries (company_id);

-- ── CRM: per-project work (focus timer) entries ─────────────────────────────
CREATE TABLE IF NOT EXISTS tbl_crm_project_work_entries (
  id          bigserial PRIMARY KEY,
  company_id  integer NOT NULL REFERENCES tbl_companies(id) ON DELETE CASCADE,
  project_id  uuid NOT NULL REFERENCES tbl_crm_projects(id) ON DELETE CASCADE,
  task_id     uuid NULL REFERENCES tbl_crm_tasks(id),
  user_id     uuid NOT NULL REFERENCES tbl_users(id) ON DELETE CASCADE,
  work_date   date NOT NULL DEFAULT ((now() AT TIME ZONE 'utc')::date),
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz NULL,
  note        varchar(300) NULL,
  CONSTRAINT ck_crm_project_work_range CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_crm_project_work_active
  ON tbl_crm_project_work_entries (user_id)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_crm_project_work_history
  ON tbl_crm_project_work_entries (work_date, user_id)
  INCLUDE (project_id, started_at, ended_at);
CREATE INDEX IF NOT EXISTS ix_crm_project_work_company ON tbl_crm_project_work_entries (company_id);

-- ── CRM: leave requests ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tbl_crm_leave_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    integer NOT NULL REFERENCES tbl_companies(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES tbl_users(id) ON DELETE CASCADE,
  leave_type    varchar(20) NOT NULL
                  CONSTRAINT ck_crm_leave_type CHECK (leave_type IN ('casual', 'sick', 'earned', 'unpaid')),
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  reason        varchar(800) NULL,
  status        varchar(20) NOT NULL DEFAULT 'pending'
                  CONSTRAINT ck_crm_leave_status CHECK (status IN ('pending', 'approved', 'rejected')),
  manager_note  varchar(800) NULL,
  reviewed_by   uuid NULL REFERENCES tbl_users(id),
  reviewed_at   timestamptz NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_crm_leave_requests_status
  ON tbl_crm_leave_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_crm_leave_requests_company ON tbl_crm_leave_requests (company_id);
