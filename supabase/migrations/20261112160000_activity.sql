-- T11.2 — Registro de actividad: qué hizo cada persona (privado; cada una ve lo suyo).
create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  group_id uuid references public.groups (id) on delete set null,
  kind text not null check (char_length(kind) <= 40),
  path text check (char_length(path) <= 300),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_events_user_idx on public.activity_events (user_id, created_at desc);
create index activity_events_kind_idx on public.activity_events (kind, created_at desc);

alter table public.activity_events enable row level security;
create policy "activity_select_own" on public.activity_events for select using (user_id = auth.uid());
create policy "activity_insert_own" on public.activity_events for insert with check (user_id = auth.uid());

-- Se limpia solo: nada de esto se guarda más de 90 días (se llama desde el cron).
create or replace function public.purge_old_activity()
returns void language sql security definer set search_path = public as $$
  delete from public.activity_events where created_at < now() - interval '90 days';
$$;
revoke all on function public.purge_old_activity() from public, anon, authenticated;
grant execute on function public.purge_old_activity() to service_role;
