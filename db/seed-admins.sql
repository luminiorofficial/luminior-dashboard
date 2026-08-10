-- ---------------------------------------------------------------------------
-- Seed one Super Admin and one Admin account, each with their own company.
-- Run AFTER table.sql and function.sql. Safe to re-run (upserts by email;
-- password/role are re-applied each time; each admin's company is upserted
-- by owner_id, so re-running never creates a duplicate).
--
--   psql "$DATABASE_URL" -f db/seed-admins.sql
--
-- Uses pgcrypto's crypt()/gen_salt('bf') to bcrypt-hash the passwords
-- directly in SQL — the resulting hash is byte-for-byte compatible with the
-- bcryptjs compare() the app uses at sign-in, so no separate script is
-- needed. pgcrypto is already enabled by table.sql.
--
-- Change the passwords below before running in production, and change them
-- again after first sign-in — there is no self-service password reset yet.
-- ---------------------------------------------------------------------------

INSERT INTO tbl_users (email, password_hash, full_name, role, is_active)
VALUES
  ('admin@gmail.com', crypt('Admin@123', gen_salt('bf', 12)), 'Super Admin', 'superadmin', true),
  ('luminiorofficial@gmail.com', crypt('Luminior@123', gen_salt('bf', 12)), 'Admin', 'admin', true)
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_active = true;

-- One company per seeded manager — upserted by owner_id, so this is a no-op
-- once each already has one (e.g. from fn_ensure_company_for_manager having
-- already run via sp_register_user/sp_update_user_role).
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
