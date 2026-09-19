CREATE TABLE public.meta_capi_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  event_id text NOT NULL,
  customer_id text,
  customer_name text,
  value numeric,
  currency text NOT NULL DEFAULT 'EGP',
  status text NOT NULL DEFAULT 'sent',
  error text,
  events_received integer,
  sent_by text,
  test_event boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.meta_capi_events TO anon, authenticated;
GRANT ALL ON public.meta_capi_events TO service_role;

ALTER TABLE public.meta_capi_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY meta_capi_events_read ON public.meta_capi_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY meta_capi_events_insert ON public.meta_capi_events FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE INDEX meta_capi_events_created_idx ON public.meta_capi_events (created_at DESC);