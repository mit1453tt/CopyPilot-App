-- CopyPilot AI — isolated tables on shared Supabase project
-- Project: wgqujfddrpzawvdwcxvm (eu-central-1)
-- Does NOT modify Size Wizard or other existing tables.
-- SECURITY: anon/authenticated have NO access. Server/Prisma only.

CREATE TABLE IF NOT EXISTS public.copypilot_shops (
  shop_domain text PRIMARY KEY,
  shopify_charge_id text NULL,
  plan_name text NOT NULL DEFAULT 'Free',
  monthly_credits integer NOT NULL DEFAULT 30,
  used_credits integer NOT NULL DEFAULT 0,
  reset_date timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.copypilot_history (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  shop_domain text NOT NULL,
  product_id text NOT NULL,
  original_title text NULL,
  generated_description text NULL,
  seo_score integer NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS copypilot_history_shop_created_idx
  ON public.copypilot_history (shop_domain, created_at DESC);

ALTER TABLE public.copypilot_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copypilot_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "copypilot_shops_public_access" ON public.copypilot_shops;
DROP POLICY IF EXISTS "copypilot_history_public_access" ON public.copypilot_history;

REVOKE ALL ON TABLE public.copypilot_shops FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.copypilot_history FROM anon, authenticated, PUBLIC;

GRANT ALL ON TABLE public.copypilot_shops TO postgres, service_role;
GRANT ALL ON TABLE public.copypilot_history TO postgres, service_role;
