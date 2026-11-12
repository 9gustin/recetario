-- T5.1 — Trazabilidad de IA: ai_runs, conversaciones, mensajes y cuotas por usuario/día.
-- Las escrituras las hace el servidor con service role; los usuarios solo leen lo suyo.

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  purpose text not null check (purpose in ('plan_chat', 'diet_plan', 'assistant')),
  plan_id uuid,
  context jsonb not null default '{}'::jsonb,
  title text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index ai_conversations_user_idx on public.ai_conversations (user_id, last_message_at desc);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content jsonb not null,
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid references public.groups (id) on delete set null,
  feature text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  cache_read_tokens integer,
  latency_ms integer,
  status text not null check (status in ('ok', 'error')),
  error text,
  created_at timestamptz not null default now()
);
create index ai_runs_user_idx on public.ai_runs (user_id, created_at desc);

create table public.ai_quota (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  feature text not null,
  count integer not null default 0,
  primary key (user_id, day, feature)
);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_runs enable row level security;
alter table public.ai_quota enable row level security;

create policy "ai_conversations_select_own" on public.ai_conversations
  for select using (user_id = auth.uid());
create policy "ai_messages_select_own" on public.ai_messages
  for select using (
    exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid())
  );
create policy "ai_runs_select_own" on public.ai_runs
  for select using (user_id = auth.uid());
-- ai_quota: sin policies (solo service role / RPC).

-- Consume una unidad de cuota de forma atómica. Devuelve false si el usuario ya llegó al límite del día.
create or replace function public.consume_ai_quota(p_user_id uuid, p_feature text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_limit <= 0 then return false; end if;
  insert into public.ai_quota (user_id, day, feature, count)
  values (p_user_id, (now() at time zone 'America/Argentina/Buenos_Aires')::date, p_feature, 1)
  on conflict (user_id, day, feature)
  do update set count = public.ai_quota.count + 1
  where public.ai_quota.count < p_limit
  returning count into v_count;
  return v_count is not null;
end;
$$;

revoke execute on function public.consume_ai_quota(uuid, text, integer) from public, anon, authenticated;
