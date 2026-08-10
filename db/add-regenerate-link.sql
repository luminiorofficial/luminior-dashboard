-- ---------------------------------------------------------------------------
-- Adds sp_regenerate_referral_link — run this once against a database that
-- already has the rest of the schema (i.e. already ran fresh-start.sql /
-- table.sql + function.sql). Safe to re-run.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS sp_regenerate_referral_link(uuid) CASCADE;

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
