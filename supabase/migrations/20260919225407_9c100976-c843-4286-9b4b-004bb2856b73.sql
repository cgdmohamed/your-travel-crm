CREATE TABLE public.integration_config (
  key TEXT PRIMARY KEY,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.integration_config TO service_role;
ALTER TABLE public.integration_config ENABLE ROW LEVEL SECURITY;