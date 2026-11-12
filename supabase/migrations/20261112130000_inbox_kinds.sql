-- T10.2 — Nuevos tipos de ítem en la bandeja.
alter table public.inbox_items drop constraint inbox_items_kind_check;
alter table public.inbox_items
  add constraint inbox_items_kind_check
  check (kind in ('recipe_shared', 'group_invite', 'plan_approved', 'member_joined', 'list_done'));
