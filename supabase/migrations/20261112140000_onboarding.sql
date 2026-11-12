-- T10.4 — Onboarding: se muestra una sola vez después del primer login.
alter table public.profiles add column onboarded_at timestamptz;
-- Las cuentas que ya existían no lo necesitan.
update public.profiles set onboarded_at = now() where onboarded_at is null;
