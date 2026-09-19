CREATE TABLE public.whatsapp_threads (
  phone text PRIMARY KEY,
  customer_id text,
  contact_name text,
  ai_intent text NOT NULL DEFAULT 'unknown' CHECK (ai_intent IN ('interested','inquiry','unknown')),
  ai_reason text,
  ai_confidence numeric,
  ai_updated_at timestamptz,
  last_message text,
  last_message_at timestamptz,
  last_direction text,
  unread integer NOT NULL DEFAULT 0,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX whatsapp_threads_recent_idx ON public.whatsapp_threads (last_message_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.whatsapp_threads TO anon;
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_threads TO authenticated;
GRANT ALL ON public.whatsapp_threads TO service_role;
ALTER TABLE public.whatsapp_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "whatsapp_threads_read" ON public.whatsapp_threads FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "whatsapp_threads_insert" ON public.whatsapp_threads FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "whatsapp_threads_update" ON public.whatsapp_threads FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);