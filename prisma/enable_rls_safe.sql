-- =============================================================================
-- SAFE RLS hardening for shared Supabase project
-- Fixiby / CopyPilot AI + Size Wizard
--
-- WHAT THIS DOES:
--   • Turns ON Row Level Security for every public table
--   • Does NOT delete, truncate, or rewrite any rows
--   • Does NOT use FORCE ROW LEVEL SECURITY (Prisma / postgres role still works)
--   • Locks copypilot_* from anon/authenticated (Admin metafields = source of truth)
-- =============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- CopyPilot: no public API access
ALTER TABLE IF EXISTS public.copypilot_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.copypilot_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "copypilot_shops_public_access" ON public.copypilot_shops;
DROP POLICY IF EXISTS "copypilot_history_public_access" ON public.copypilot_history;

REVOKE ALL ON TABLE public.copypilot_shops FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.copypilot_history FROM anon, authenticated, PUBLIC;

GRANT ALL ON TABLE public.copypilot_shops TO postgres, service_role;
GRANT ALL ON TABLE public.copypilot_history TO postgres, service_role;
