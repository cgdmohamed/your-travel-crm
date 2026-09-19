CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id text,
  phone text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('out','in')),
  body text,
  wa_message_id text UNIQUE,
  status text NOT NULL DEFAULT 'accepted',
  error text,
  template_name text,
  sent_by text,
  status_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX whatsapp_messages_customer_idx ON public.whatsapp_messages (customer_id, created_at);
CREATE INDEX whatsapp_messages_phone_idx ON public.whatsapp_messages (phone, created_at);

GRANT SELECT, INSERT, UPDATE ON public.whatsapp_messages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "whatsapp_messages_read" ON public.whatsapp_messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "whatsapp_messages_insert" ON public.whatsapp_messages FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "whatsapp_messages_update" ON public.whatsapp_messages FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.whatsapp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id text NOT NULL UNIQUE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX whatsapp_webhook_events_pending_idx ON public.whatsapp_webhook_events (processed_at, next_attempt_at);

GRANT ALL ON public.whatsapp_webhook_events TO service_role;
ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.whatsapp_pending_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_message_id text NOT NULL,
  status text NOT NULL,
  error text,
  status_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wa_message_id, status)
);
CREATE INDEX whatsapp_pending_statuses_msg_idx ON public.whatsapp_pending_statuses (wa_message_id);

GRANT ALL ON public.whatsapp_pending_statuses TO service_role;
ALTER TABLE public.whatsapp_pending_statuses ENABLE ROW LEVEL SECURITY;