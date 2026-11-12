-- T10.1 — Web Push: suscripciones, preferencias, avisos programados y recordatorios de preparaciones.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  endpoint text not null unique,
  keys jsonb not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table public.notification_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade default auth.uid(),
  prep boolean not null default true,
  thaw boolean not null default true,
  timers boolean not null default true,
  inbox boolean not null default true,
  -- Horario silencioso en hora de Argentina (0–23); null = sin horario silencioso.
  quiet_start smallint check (quiet_start between 0 and 23),
  quiet_end smallint check (quiet_end between 0 and 23),
  updated_at timestamptz not null default now()
);

-- Avisos que se envían a una hora dada (timers de cocina en segundo plano, etc.).
create table public.scheduled_pushes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  key text not null,
  kind text not null check (kind in ('timer', 'prep', 'thaw', 'inbox')),
  fire_at timestamptz not null,
  title text not null,
  body text,
  url text,
  sent_at timestamptz,
  unique (user_id, key)
);
create index scheduled_pushes_due_idx on public.scheduled_pushes (fire_at) where sent_at is null;

alter table public.prep_tasks add column reminded_at timestamptz;

alter table public.push_subscriptions enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.scheduled_pushes enable row level security;

create policy "push_subscriptions_own" on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notification_prefs_own" on public.notification_prefs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "scheduled_pushes_own" on public.scheduled_pushes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
