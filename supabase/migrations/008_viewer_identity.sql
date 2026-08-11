-- 008_viewer_identity.sql
-- Viewer accounts move from name-derived identity to NIS-derived identity
-- (see supabase/functions/admin-users provision-viewer + supabase/functions/viewer-auth).
-- This migration adds the "must change password on first login" flag and a
-- persistent rate-limit table so limits survive edge function cold starts
-- (the previous in-memory Map reset on every cold start, i.e. almost always).

-- 1. Force a password change after the first login for accounts provisioned
--    with a derivable initial code (Viewer, via provision-viewer). Staff
--    accounts (admin-users 'create') pick their own password and are never
--    flagged, so the column defaults to false.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- 2. Persistent rate limit for supabase/functions/viewer-auth actions
--    (suggest, recover). Touched only by the edge function's service-role
--    client — RLS is enabled with zero policies so it is unreachable via the
--    anon/authenticated REST API.
CREATE TABLE IF NOT EXISTS viewer_auth_rate_limit (
  key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE viewer_auth_rate_limit ENABLE ROW LEVEL SECURITY;

-- 3. Atomic check-and-increment, callable via supabase.rpc('check_rate_limit', ...).
--    Row lock via FOR UPDATE makes concurrent requests for the same key safe.
CREATE OR REPLACE FUNCTION check_rate_limit(p_key TEXT, p_max INT, p_window_seconds INT)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_window_start TIMESTAMPTZ;
BEGIN
  SELECT count, window_start INTO v_count, v_window_start
  FROM viewer_auth_rate_limit WHERE key = p_key FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO viewer_auth_rate_limit (key, count, window_start) VALUES (p_key, 1, now());
    RETURN true;
  END IF;

  IF now() > v_window_start + (p_window_seconds || ' seconds')::interval THEN
    UPDATE viewer_auth_rate_limit SET count = 1, window_start = now() WHERE key = p_key;
    RETURN true;
  END IF;

  IF v_count >= p_max THEN
    RETURN false;
  END IF;

  UPDATE viewer_auth_rate_limit SET count = count + 1 WHERE key = p_key;
  RETURN true;
END;
$$;
