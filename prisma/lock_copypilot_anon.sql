-- =============================================================================
-- Lock CopyPilot tables from anon / authenticated (PostgREST public API)
-- Does NOT delete or modify row data.
-- Prisma / postgres / service_role still bypass RLS and keep working.
-- =============================================================================

ALTER TABLE IF EXISTS public.copypilot_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.copypilot_history ENABLE ROW LEVEL SECURITY;

-- Remove permissive public policies
DROP POLICY IF EXISTS "copypilot_shops_public_access" ON public.copypilot_shops;
DROP POLICY IF EXISTS "copypilot_history_public_access" ON public.copypilot_history;

-- Explicit deny-by-default: no policies for anon/authenticated
-- (optional named deny policies are unnecessary; absence = deny)

-- Revoke table privileges from public API roles
REVOKE ALL ON TABLE public.copypilot_shops FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.copypilot_history FROM anon, authenticated, PUBLIC;

-- Keep grants for privileged roles used by server / Prisma
GRANT ALL ON TABLE public.copypilot_shops TO postgres, service_role;
GRANT ALL ON TABLE public.copypilot_history TO postgres, service_role;
