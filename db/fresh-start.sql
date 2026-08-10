-- ---------------------------------------------------------------------------
-- ONE-TIME RESET — drops every app table (CASCADE) and rebuilds the whole
-- schema fresh for the one-company-per-admin model. Run this directly
-- against the database (psql, pgAdmin, DBeaver, the DigitalOcean console —
-- anything that runs a plain .sql file/script).
--
-- This is destructive: it deletes all existing rows in every app table.
-- Confirmed before writing this that there's no real data to lose (0
-- projects/tasks/time entries/leave requests; only a couple of dummy/test
-- rows). Do not run this against a database with real data you want to keep.
--
-- After this runs once, db/table.sql, db/function.sql and db/seed-admins.sql
-- are the ones to use going forward (each independently idempotent).
-- ---------------------------------------------------------------------------

BEGIN;

-- ── 1. Drop every app table ──────────────────────────────────────────────
DROP TABLE IF EXISTS
  tbl_crm_leave_requests,
  tbl_crm_project_work_entries,
  tbl_crm_time_entries,
  tbl_crm_task_updates,
  tbl_crm_tasks,
  tbl_crm_project_members,
  tbl_crm_projects,
  tbl_crm_member_profiles,
  tbl_referral_links,
  tbl_companies,
  tbl_accounts,
  tbl_user_accounts,
  tbl_users
CASCADE;

-- ── 2. db/table.sql ──────────────────────────────────────────────────────

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

-- ── 3. db/function.sql ───────────────────────────────────────────────────

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'fn_ensure_company_for_manager',
        'sp_get_user_by_email', 'sp_get_user_by_id', 'sp_list_users', 'sp_create_user',
        'sp_update_user_profile', 'sp_upsert_oauth_user', 'sp_update_user_role',
        'sp_set_user_active', 'sp_get_or_create_referral_link', 'sp_regenerate_referral_link',
        'sp_register_user',
        -- Orphaned from the old multi-brand/account-switching model — gone for good.
        'sp_link_user_account', 'sp_list_user_account_ids'
      ])
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.sig);
  END LOOP;
END;
$$;

-- ── Company auto-provisioning ────────────────────────────────────────────────
-- Every Admin/Super Admin owns exactly one company. This creates it the
-- moment they need one (first-ever bootstrap, or promotion to admin/
-- superadmin) and is a no-op if they already own one. Called from
-- sp_register_user and sp_update_user_role — never from the app layer.
CREATE FUNCTION fn_ensure_company_for_manager(
  p_user_id uuid,
  p_full_name varchar,
  p_email varchar
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id integer;
  v_default_name varchar;
BEGIN
  SELECT company_id INTO v_company_id FROM tbl_users WHERE id = p_user_id;
  IF v_company_id IS NOT NULL THEN
    RETURN v_company_id;
  END IF;

  -- Defensive: a company row already owned by them but the user row's
  -- company_id somehow wasn't stamped. Shouldn't happen in practice, but
  -- cheap to guard rather than violate the UNIQUE owner_id constraint below.
  SELECT id INTO v_company_id FROM tbl_companies WHERE owner_id = p_user_id;
  IF v_company_id IS NULL THEN
    v_default_name := COALESCE(NULLIF(btrim(p_full_name), ''), split_part(p_email, '@', 1)) || '''s Company';
    INSERT INTO tbl_companies (owner_id, name) VALUES (p_user_id, v_default_name)
    RETURNING id INTO v_company_id;
  END IF;

  UPDATE tbl_users SET company_id = v_company_id WHERE id = p_user_id;
  RETURN v_company_id;
END;
$$;

-- ── Lookups ──────────────────────────────────────────────────────────────────

CREATE FUNCTION sp_get_user_by_email(p_email varchar)
RETURNS SETOF tbl_users
LANGUAGE sql
STABLE
AS $$
  SELECT * FROM tbl_users WHERE email = lower(btrim(p_email));
$$;

CREATE FUNCTION sp_get_user_by_id(p_id uuid)
RETURNS SETOF tbl_users
LANGUAGE sql
STABLE
AS $$
  SELECT * FROM tbl_users WHERE id = p_id;
$$;

-- Non-sensitive column set for the Super Admin's platform-wide Users page
-- (no password_hash) — includes which company each account belongs to.
CREATE FUNCTION sp_list_users()
RETURNS TABLE (
  id uuid, email varchar, full_name varchar, role varchar, is_active boolean,
  company_id integer, company_name varchar,
  referred_by uuid, created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.company_id, c.name,
    u.referred_by, u.created_at, u.updated_at
  FROM tbl_users u
  LEFT JOIN tbl_companies c ON c.id = u.company_id
  ORDER BY u.created_at ASC;
$$;

-- ── Writes ───────────────────────────────────────────────────────────────────

-- Admin-created member (CRM "add team member" dialog) — tied directly to the
-- creating admin's company_id. Unrelated to referral self-registration below.
CREATE FUNCTION sp_create_user(
  p_email varchar,
  p_password_hash varchar,
  p_full_name varchar,
  p_role varchar DEFAULT 'user',
  p_company_id integer DEFAULT NULL
)
RETURNS TABLE (id uuid)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO tbl_users (email, password_hash, full_name, role, company_id)
  VALUES (lower(btrim(p_email)), p_password_hash, p_full_name, COALESCE(p_role, 'user'), p_company_id)
  RETURNING tbl_users.id;
END;
$$;

-- Self-service profile edit. Returns no row when the email is already taken
-- by a different user (guards the UNIQUE constraint) so the caller can turn
-- that into a 409.
CREATE FUNCTION sp_update_user_profile(
  p_user_id uuid,
  p_email varchar,
  p_full_name varchar
)
RETURNS SETOF tbl_users
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE tbl_users
  SET email = lower(btrim(p_email)),
      full_name = p_full_name
  WHERE id = p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM tbl_users other
      WHERE other.email = lower(btrim(p_email)) AND other.id <> p_user_id
    )
  RETURNING tbl_users.*;
END;
$$;

-- Google OAuth sign-in: create-or-fetch by email. First login inserts a row
-- with a NULL password_hash and no company (they're not a manager and
-- didn't come through an invite link, so they stay unassigned — a manager
-- picks them up manually). Later logins just return the existing row.
CREATE FUNCTION sp_upsert_oauth_user(
  p_email varchar,
  p_full_name varchar
)
RETURNS SETOF tbl_users
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO tbl_users (email, full_name)
  VALUES (lower(btrim(p_email)), p_full_name)
  ON CONFLICT (email) DO UPDATE SET email = tbl_users.email
  RETURNING tbl_users.*;
END;
$$;

-- Promotes/demotes a user. Promoting to admin/superadmin auto-provisions
-- their company (fn_ensure_company_for_manager) if they don't already own
-- one. Demoting back to 'user' intentionally leaves company_id and the
-- company itself untouched — they keep working inside the same company,
-- just lose manager privileges over it.
CREATE FUNCTION sp_update_user_role(p_user_id uuid, p_role varchar)
RETURNS TABLE (
  id uuid, email varchar, full_name varchar, role varchar, is_active boolean,
  company_id integer, company_name varchar,
  referred_by uuid, created_at timestamptz, updated_at timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_full_name varchar;
  v_email varchar;
BEGIN
  UPDATE tbl_users SET role = p_role WHERE tbl_users.id = p_user_id;

  IF p_role IN ('admin', 'superadmin') THEN
    SELECT tbl_users.full_name, tbl_users.email INTO v_full_name, v_email FROM tbl_users WHERE tbl_users.id = p_user_id;
    PERFORM fn_ensure_company_for_manager(p_user_id, v_full_name, v_email);
  END IF;

  RETURN QUERY
  SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.company_id, c.name,
    u.referred_by, u.created_at, u.updated_at
  FROM tbl_users u
  LEFT JOIN tbl_companies c ON c.id = u.company_id
  WHERE u.id = p_user_id;
END;
$$;

CREATE FUNCTION sp_set_user_active(p_user_id uuid, p_is_active boolean)
RETURNS TABLE (
  id uuid, email varchar, full_name varchar, role varchar, is_active boolean,
  company_id integer, company_name varchar,
  referred_by uuid, created_at timestamptz, updated_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE tbl_users SET is_active = p_is_active WHERE tbl_users.id = p_user_id;

  RETURN QUERY
  SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.company_id, c.name,
    u.referred_by, u.created_at, u.updated_at
  FROM tbl_users u
  LEFT JOIN tbl_companies c ON c.id = u.company_id
  WHERE u.id = p_user_id;
END;
$$;

-- ── Referral / invite links ─────────────────────────────────────────────────

-- Idempotent: the same manager asking for their link always gets the same
-- code back. Generates an 18-char hex code on first call.
CREATE FUNCTION sp_get_or_create_referral_link(p_created_by uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_code text;
BEGIN
  SELECT code INTO v_code FROM tbl_referral_links WHERE created_by = p_created_by;
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  LOOP
    v_code := encode(gen_random_bytes(9), 'hex');
    BEGIN
      INSERT INTO tbl_referral_links (code, created_by) VALUES (v_code, p_created_by);
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      -- Either a concurrent call already created this manager's row (re-select
      -- and return it) or the random code collided with someone else's
      -- (loop and mint a new one).
      SELECT code INTO v_code FROM tbl_referral_links WHERE created_by = p_created_by;
      IF v_code IS NOT NULL THEN
        RETURN v_code;
      END IF;
    END;
  END LOOP;
END;
$$;

-- Invalidates a manager's current invite link and mints a fresh one — the
-- old code stops working immediately (anyone still holding it gets
-- INVALID_REFERRAL on the next registration attempt). Creates a row if the
-- manager somehow doesn't have one yet, same as sp_get_or_create_referral_link.
CREATE FUNCTION sp_regenerate_referral_link(p_created_by uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_code text;
BEGIN
  LOOP
    v_code := encode(gen_random_bytes(9), 'hex');
    BEGIN
      UPDATE tbl_referral_links SET code = v_code, created_at = now() WHERE created_by = p_created_by;
      IF FOUND THEN
        RETURN v_code;
      END IF;
      INSERT INTO tbl_referral_links (code, created_by) VALUES (v_code, p_created_by);
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      -- Random code collided with someone else's — loop and mint a new one.
    END;
  END LOOP;
END;
$$;

-- Registration entry point used by /api/auth/register. One atomic call:
--   * empty tbl_users → bootstrap: first-ever account becomes superadmin and
--     gets its own company (fn_ensure_company_for_manager), no referral
--     link required.
--   * otherwise       → a valid p_ref_code is required; the new user is
--     created as 'user', tagged with who referred them, joins that
--     referrer's company_id, and is immediately made an active CRM member
--     of that company.
-- Raises 'REFERRAL_REQUIRED' / 'INVALID_REFERRAL' (caught by name in the app
-- layer) or lets a duplicate-email unique_violation bubble up naturally.
CREATE FUNCTION sp_register_user(
  p_email varchar,
  p_password_hash varchar,
  p_full_name varchar,
  p_ref_code varchar
)
RETURNS TABLE (id uuid, role varchar)
LANGUAGE plpgsql
AS $$
DECLARE
  v_referrer uuid;
  v_referrer_company_id integer;
  v_role varchar;
  v_user_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM tbl_users) THEN
    IF p_ref_code IS NULL OR btrim(p_ref_code) = '' THEN
      RAISE EXCEPTION 'REFERRAL_REQUIRED';
    END IF;

    SELECT created_by INTO v_referrer FROM tbl_referral_links WHERE code = p_ref_code;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVALID_REFERRAL';
    END IF;

    SELECT company_id INTO v_referrer_company_id FROM tbl_users WHERE tbl_users.id = v_referrer;
    IF v_referrer_company_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_REFERRAL';
    END IF;

    v_role := 'user';
  ELSE
    v_role := 'superadmin';
  END IF;

  INSERT INTO tbl_users (email, password_hash, full_name, role, referred_by, company_id)
  VALUES (lower(btrim(p_email)), p_password_hash, p_full_name, v_role, v_referrer, v_referrer_company_id)
  RETURNING tbl_users.id INTO v_user_id;

  IF v_referrer IS NOT NULL THEN
    INSERT INTO tbl_crm_member_profiles (user_id, company_id, is_active)
    VALUES (v_user_id, v_referrer_company_id, true)
    ON CONFLICT (user_id) DO UPDATE SET is_active = true, updated_at = now();
  ELSE
    PERFORM fn_ensure_company_for_manager(v_user_id, p_full_name, p_email);
  END IF;

  RETURN QUERY SELECT v_user_id, v_role;
END;
$$;

-- ── 4. db/seed-admins.sql ────────────────────────────────────────────────
-- Change these two passwords before/after running in production — there is
-- no self-service password reset yet.

INSERT INTO tbl_users (email, password_hash, full_name, role, is_active)
VALUES
  ('admin@gmail.com', crypt('Admin@123', gen_salt('bf', 12)), 'Super Admin', 'superadmin', true),
  ('luminiorofficial@gmail.com', crypt('Luminior@123', gen_salt('bf', 12)), 'Admin', 'admin', true)
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_active = true;

INSERT INTO tbl_companies (owner_id, name)
SELECT u.id, 'Luminior'
FROM tbl_users u
WHERE u.email = 'admin@gmail.com'
ON CONFLICT (owner_id) DO NOTHING;

INSERT INTO tbl_companies (owner_id, name)
SELECT u.id, 'Luminior'
FROM tbl_users u
WHERE u.email = 'luminiorofficial@gmail.com'
ON CONFLICT (owner_id) DO NOTHING;

UPDATE tbl_users u
SET company_id = c.id
FROM tbl_companies c
WHERE c.owner_id = u.id AND u.company_id IS NULL;

COMMIT;

-- ── 5. Verify ────────────────────────────────────────────────────────────
SELECT email, role, is_active, company_id FROM tbl_users ORDER BY created_at;
SELECT id, owner_id, name FROM tbl_companies ORDER BY id;
