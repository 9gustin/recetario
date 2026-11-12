-- T1.2 — Tests de RLS y RPCs de grupos.

\set QUIET 1

begin;
select plan(11);

-- ── Fixtures ───────────────────────────────────────────────────────────────
-- Usuarios (el trigger on_auth_user_created genera profile + grupo personal).
do $$ begin
  perform tests.create_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test.com', 'A');
  perform tests.create_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@test.com', 'B');
  perform tests.create_user('cccccccc-cccc-cccc-cccc-cccccccccccc', 'c@test.com', 'C');
end $$;

-- Grupo "Casa": A owner + C admin (para probar la transferencia de ownership).
insert into public.groups (id, name, emoji, created_by) values
  ('11111111-1111-1111-1111-111111111111', 'Casa', '🏠', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into public.group_members (group_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner'),
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'admin');

-- Grupo "Invites": A owner (para probar invitaciones).
insert into public.groups (id, name, emoji, created_by) values
  ('22222222-2222-2222-2222-222222222222', 'Invites', '🔗', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into public.group_members (group_id, user_id, role) values
  ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner');

-- Invitaciones (vencida, revocada y válida).
insert into public.group_invites (group_id, token, created_by, expires_at) values
  ('22222222-2222-2222-2222-222222222222', 'expired-token', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now() - interval '1 day'),
  ('22222222-2222-2222-2222-222222222222', 'valid-token',   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now() + interval '7 days');
insert into public.group_invites (group_id, token, created_by, revoked_at) values
  ('22222222-2222-2222-2222-222222222222', 'revoked-token', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now());

-- ── Simular sesión como A ──────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

-- 1) A no ve los grupos de B (solo su grupo personal).
select ok(
  not exists (
    select 1 from public.groups where created_by = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  ),
  'A no ve los grupos de B'
);

-- 2) A no puede insertar en group_members directo (no hay policy de insert).
select throws_ok(
  $$insert into public.group_members (group_id, user_id, role)
    values ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'member')$$,
  '42501', null,
  'A no puede insertar en group_members directo'
);

-- ── Simular sesión como B ──────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);

-- 3) accept_invite con token vencido/revocado falla.
select throws_ok(
  $$select public.accept_invite('expired-token')$$,
  'P0001', 'Invite expired',
  'accept_invite con token vencido falla'
);
select throws_ok(
  $$select public.accept_invite('revoked-token')$$,
  'P0001', 'Invite revoked',
  'accept_invite con token revocado falla'
);

-- 4) Con token válido une a B.
select lives_ok(
  $$select public.accept_invite('valid-token')$$,
  'accept_invite con token válido une a B'
);
select ok(
  exists (
    select 1 from public.group_members
    where group_id = '22222222-2222-2222-2222-222222222222'
      and user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      and role = 'member'
  ),
  'B quedó como member del grupo Invites'
);

-- 5) B ve el perfil de A después de unirse.
select ok(
  exists (select 1 from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'B ve el perfil de A después de unirse'
);

-- 6) Un member no puede crear invitaciones.
select throws_ok(
  $$insert into public.group_invites (group_id, token, created_by, expires_at)
    values ('22222222-2222-2222-2222-222222222222', 'nope-token', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', now() + interval '1 day')$$,
  '42501', null,
  'un member no puede crear invitaciones'
);

-- ── 7) leave_group transfiere ownership (A sale de Casa, C admin → owner) ──
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select lives_ok(
  $$select public.leave_group('11111111-1111-1111-1111-111111111111')$$,
  'A sale de Casa'
);
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);
select ok(
  exists (
    select 1 from public.group_members
    where group_id = '11111111-1111-1111-1111-111111111111'
      and user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
      and role = 'owner'
  ),
  'C pasó a owner de Casa'
);

-- ── 8) No se puede salir del grupo personal ────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select throws_ok(
  $$select public.leave_group((select personal_group_id from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'))$$,
  'P0001', 'Cannot leave personal group',
  'no se puede salir del grupo personal'
);

select * from finish();
rollback;
