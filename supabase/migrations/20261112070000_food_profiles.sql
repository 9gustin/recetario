-- T6.1 — Perfil alimentario: perfil, fuentes crudas y borradores. Todo privado por usuario.
-- Los miembros de un grupo solo ven `restrictions` y `goals` de los demás, vía `get_group_diet`.

create table public.food_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  summary text,
  data jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  valid_until date,
  updated_at timestamptz not null default now()
);
create trigger food_profiles_updated_at before update on public.food_profiles
  for each row execute function public.set_updated_at();

create table public.food_profile_inputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('voice', 'text', 'file', 'answer')),
  storage_path text,
  transcript text,
  processed_at timestamptz,
  ai_run_id uuid references public.ai_runs (id) on delete set null,
  created_at timestamptz not null default now()
);
create index food_profile_inputs_user_idx on public.food_profile_inputs (user_id, created_at desc);

create table public.food_profile_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  proposed jsonb not null,
  summary text,
  changes jsonb not null default '[]'::jsonb,
  open_questions jsonb not null default '[]'::jsonb,
  input_ids uuid[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'applied', 'discarded')),
  created_at timestamptz not null default now()
);
create index food_profile_drafts_user_idx on public.food_profile_drafts (user_id, status);

alter table public.food_profiles enable row level security;
alter table public.food_profile_inputs enable row level security;
alter table public.food_profile_drafts enable row level security;

create policy "food_profiles_own_all" on public.food_profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "food_profile_inputs_own_all" on public.food_profile_inputs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "food_profile_drafts_own_all" on public.food_profile_drafts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Bucket privado para PDFs y fotos del plan: cada persona solo accede a su carpeta.
insert into storage.buckets (id, name, public, file_size_limit)
values ('profile-inputs', 'profile-inputs', false, 15728640)
on conflict (id) do nothing;

create policy "profile_inputs_owner_select" on storage.objects
  for select using (bucket_id = 'profile-inputs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "profile_inputs_owner_insert" on storage.objects
  for insert with check (bucket_id = 'profile-inputs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "profile_inputs_owner_delete" on storage.objects
  for delete using (bucket_id = 'profile-inputs' and (storage.foldername(name))[1] = auth.uid()::text);

-- Restricciones y objetivos de los miembros del grupo (nunca el resumen, las fuentes ni los archivos:
-- pueden contener información médica). Quien llama tiene que ser miembro.
create or replace function public.get_group_diet(p_group_id uuid)
returns table (user_id uuid, display_name text, restrictions jsonb, goals jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id,
         p.display_name,
         coalesce(fp.data -> 'restrictions', '[]'::jsonb),
         coalesce(fp.data -> 'goals', '[]'::jsonb)
  from public.group_members m
  join public.food_profiles fp on fp.user_id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.group_id = p_group_id
    and public.is_group_member(p_group_id)
    and (fp.valid_until is null or fp.valid_until >= current_date);
$$;

revoke execute on function public.get_group_diet(uuid) from public, anon;
grant execute on function public.get_group_diet(uuid) to authenticated;
