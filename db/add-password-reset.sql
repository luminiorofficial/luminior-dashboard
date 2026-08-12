-- Adds the persistent, single-use OTP lifecycle and shared rate-limit log used
-- by the self-service password reset flow. Safe to run more than once.

BEGIN;

-- Existing app writes normalize emails already; this closes the remaining gap
-- for direct/imported writes that differ only by case or surrounding spaces.
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email_normalized
  ON tbl_users (lower(btrim(email)));

CREATE TABLE IF NOT EXISTS tbl_password_reset_otps (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES tbl_users(id) ON DELETE CASCADE,
  otp_hash                 char(64) NOT NULL,
  expires_at               timestamptz NOT NULL,
  otp_used_at              timestamptz NULL,
  reset_token_hash         char(64) NULL,
  reset_token_expires_at   timestamptz NULL,
  password_reset_at        timestamptz NULL,
  requested_ip_hash        char(64) NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_password_reset_expiry CHECK (expires_at > created_at),
  CONSTRAINT ck_password_reset_token_pair CHECK (
    (reset_token_hash IS NULL AND reset_token_expires_at IS NULL)
    OR
    (reset_token_hash IS NOT NULL AND reset_token_expires_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS ix_password_reset_otps_user_created
  ON tbl_password_reset_otps (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_password_reset_token_hash
  ON tbl_password_reset_otps (reset_token_hash)
  WHERE reset_token_hash IS NOT NULL;

-- Email addresses and IPs are HMACed before insertion. This table therefore
-- supports rate limits for both existing and non-existing emails without
-- retaining another copy of account identifiers.
CREATE TABLE IF NOT EXISTS tbl_password_reset_rate_limits (
  id                bigserial PRIMARY KEY,
  action            varchar(12) NOT NULL
                      CONSTRAINT ck_password_reset_rate_action
                      CHECK (action IN ('request', 'verify', 'reset')),
  identifier_hash   char(64) NOT NULL,
  ip_hash           char(64) NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_password_reset_rate_identifier
  ON tbl_password_reset_rate_limits (action, identifier_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_password_reset_rate_ip
  ON tbl_password_reset_rate_limits (action, ip_hash, created_at DESC);

COMMIT;
