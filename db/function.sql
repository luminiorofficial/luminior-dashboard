-- ---------------------------------------------------------------------------
-- Luminior Dashboard — PostgreSQL functions
--
-- Run this AFTER db/table.sql. Safe to re-run: the DO block below drops
-- EVERY existing overload of every function this file defines (looked up by
-- name from the catalog, not by guessing argument types) before recreating
-- them with plain CREATE FUNCTION. Postgres' CREATE OR REPLACE FUNCTION
-- refuses to change a function's return type/columns — drop-then-create
-- avoids that class of error for good, no matter how a signature changes in
-- the future.
--   psql "$DATABASE_URL" -f db/function.sql
-- ---------------------------------------------------------------------------

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
