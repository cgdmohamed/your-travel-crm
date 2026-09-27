-- Phase 10 (notification bell) + Phase 12a (self-service password reset).

begin;

-- ---------------------------------------------------------------------------
-- Notifications (Phase 10) — one row per recipient, written at creation time.
-- ---------------------------------------------------------------------------

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_unread
  on notifications(user_id, read_at, created_at desc);

-- ---------------------------------------------------------------------------
-- Password reset tokens (Phase 12a) — mirrors refresh_tokens' shape.
-- ---------------------------------------------------------------------------

create table if not exists password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_reset_tokens_user_id on password_reset_tokens(user_id);

commit;
