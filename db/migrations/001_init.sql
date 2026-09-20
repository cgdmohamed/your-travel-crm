-- Your Travel CRM — initial self-hosted schema
-- Plain PostgreSQL, no Supabase/Lovable dependency.
-- Run against a fresh, dedicated database for a single client installation
-- (this app is single-tenant per deployment: no company_id/tenant column anywhere).

begin;

create extension if not exists pgcrypto; -- for gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Auth
-- ---------------------------------------------------------------------------

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  name text not null,
  role text not null check (role in ('admin', 'sales_manager', 'agent', 'accountant')),
  active boolean not null default true,
  permissions text[], -- null = use role defaults (ROLE_PERMISSIONS), non-null = custom override
  created_at timestamptz not null default now()
);

create table if not exists refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_refresh_tokens_user_id on refresh_tokens(user_id);

-- ---------------------------------------------------------------------------
-- Company branding (single row per installation — Phase 7)
-- ---------------------------------------------------------------------------

create table if not exists company_settings (
  id boolean primary key default true check (id), -- enforces a single row
  company_name text not null default 'Your Travel',
  logo_url text,
  accent_color text not null default '#2563eb',
  contact_phone text,
  contact_email text,
  updated_at timestamptz not null default now()
);

insert into company_settings (id) values (true) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Integrations (SMTP / Meta / WhatsApp / WordPress) — key/value config store
-- ---------------------------------------------------------------------------

create table if not exists integration_config (
  key text primary key check (key in ('meta', 'whatsapp', 'wordpress', 'smtp')),
  config jsonb not null default '{}'::jsonb,
  updated_by uuid references users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Core CRM entities
-- ---------------------------------------------------------------------------

create table if not exists packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  destination text not null,
  nights int not null default 0,
  price numeric(14, 2) not null default 0,
  seats int not null default 0,
  seats_taken int not null default 0,
  status text not null default 'available' check (status in ('available', 'full', 'ended')),
  category text not null check (category in ('flight', 'hotel', 'shared', 'full', 'cruise', 'visa')),
  room_basis text not null check (room_basis in ('single', 'double', 'triple', 'quad')),
  image_url text,
  gallery text[] default '{}',
  includes text[] default '{}',
  excludes text[] default '{}',
  wp_id int,
  wp_slug text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  city text,
  source text not null default 'direct' check (source in ('whatsapp', 'website', 'direct')),
  owner_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customers_owner_id on customers(owner_id);

create table if not exists customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  text text not null,
  author_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_customer_notes_customer_id on customer_notes(customer_id);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  customer_id uuid not null references customers(id) on delete restrict,
  package_id uuid not null references packages(id) on delete restrict,
  travel_date date not null,
  pax int not null default 1,
  amount numeric(14, 2) not null default 0,
  paid numeric(14, 2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'paid', 'cancelled')),
  owner_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  booking_time text -- HH:MM display value, preserved from the original in-memory model
);

create index if not exists idx_bookings_owner_id on bookings(owner_id);
create index if not exists idx_bookings_customer_id on bookings(customer_id);

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  passenger text not null,
  airline text not null,
  flight_no text,
  route text,
  depart_date date,
  return_date date,
  pnr text,
  cabin text not null default 'economy' check (cabin in ('economy', 'business')),
  price numeric(14, 2) not null default 0,
  status text not null default 'pending' check (status in ('issued', 'pending', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists idx_tickets_booking_id on tickets(booking_id);

create table if not exists hotel_stays (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  hotel text not null,
  city text,
  room_basis text not null check (room_basis in ('single', 'double', 'triple', 'quad')),
  board text not null default 'ro' check (board in ('ro', 'bb', 'hb', 'ai')),
  check_in date,
  check_out date,
  rooms int not null default 1,
  guests int not null default 1,
  confirmation_no text,
  price numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_hotel_stays_booking_id on hotel_stays(booking_id);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  paid_on date not null default current_date,
  amount numeric(14, 2) not null,
  method text not null check (method in ('cash', 'bank', 'card', 'instapay', 'wallet')),
  reference text,
  collected_by uuid references users(id) on delete set null,
  payment_time text, -- HH:MM display value
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_booking_id on payments(booking_id);

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  customer_id uuid not null references customers(id) on delete cascade,
  package_id uuid references packages(id) on delete set null,
  value numeric(14, 2) not null default 0,
  stage text not null default 'new'
    check (stage in ('new', 'contacted', 'quote', 'negotiation', 'won', 'lost')),
  owner_id uuid references users(id) on delete set null,
  follow_up_date date,
  source text not null default 'direct' check (source in ('whatsapp', 'website', 'direct')),
  pax int,
  booking_id uuid references bookings(id) on delete set null,
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_opportunities_owner_id on opportunities(owner_id);

create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  kind text not null default 'other' check (kind in ('ticket', 'hotel', 'payment', 'other')),
  ref_id uuid,
  name text not null,
  mime text not null,
  size int not null default 0,
  storage_path text not null, -- relative path under data/uploads/attachments/
  uploaded_by uuid references users(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_attachments_customer_id on attachments(customer_id);

-- ---------------------------------------------------------------------------
-- WhatsApp inbox (Phase 4/5) — flat, phone-keyed, matching the original
-- in-app inbox model (one row per conversation "thread" keyed by phone).
-- ---------------------------------------------------------------------------

-- NOTE: customer_id below is plain `text`, not a uuid FK into `customers`.
-- Until Phase 3 (migrating src/lib/crm-data.tsx off its in-memory store) is
-- complete, the running app's "customer id" is a client-generated short id
-- (e.g. "c1"), not a customers.id uuid — a strict FK would break inserts
-- from the WhatsApp/Meta modules today. Tighten this once Phase 3 lands.
create table if not exists whatsapp_threads (
  phone text primary key,
  customer_id text,
  contact_name text,
  ai_intent text check (ai_intent in ('interested', 'inquiry', 'unknown')),
  ai_reason text,
  ai_confidence numeric(4, 3),
  ai_updated_at timestamptz,
  last_message text,
  last_message_at timestamptz,
  last_direction text check (last_direction in ('in', 'out')),
  unread int not null default 0,
  archived boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  customer_id text, -- see note above whatsapp_threads
  phone text not null,
  direction text not null check (direction in ('in', 'out')),
  body text,
  wa_message_id text unique,
  status text not null default 'accepted',
  error text,
  template_name text,
  sent_by text, -- crm-data.tsx employee id (short string), not users(id) yet — see note above
  status_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_messages_phone on whatsapp_messages(phone);
create index if not exists idx_whatsapp_messages_customer_id on whatsapp_messages(customer_id);

-- Delivery-status callbacks from Meta that arrive before we've stored the
-- outbound message row yet (race between our insert and their webhook).
create table if not exists whatsapp_pending_statuses (
  wa_message_id text not null,
  status text not null,
  error text,
  status_at timestamptz not null default now(),
  primary key (wa_message_id, status)
);

-- Raw Meta webhook deliveries, for idempotency (delivery_id) and retry.
create table if not exists whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id text not null unique,
  event text not null,
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Meta Conversions API event log (ads tracking — direct graph.facebook.com)
-- ---------------------------------------------------------------------------

create table if not exists meta_capi_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  event_id text not null,
  customer_id text, -- see note above whatsapp_threads
  customer_name text,
  value numeric(14, 2),
  currency text not null default 'EGP',
  status text not null,
  error text,
  events_received int,
  sent_by text, -- see note above whatsapp_messages.sent_by
  test_event boolean not null default false,
  created_at timestamptz not null default now()
);

commit;
