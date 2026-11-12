-- T12.5 — Ingredientes de recetas públicas (para chequear restricciones y cobertura antes de guardarlas).
create or replace function public.public_recipe_ingredients(p_ids uuid[])
returns table (recipe_id uuid, raw_text text, ingredient_id uuid, optional boolean, pos integer)
language sql stable security definer set search_path = public as $$
  select i.recipe_id, i.raw_text, i.ingredient_id, i.optional, i.position as pos
  from public.recipe_ingredients i
  join public.recipes r on r.id = i.recipe_id
  where i.recipe_id = any (p_ids) and r.visibility = 'public' and r.status = 'active' and r.deleted_at is null
$$;
grant execute on function public.public_recipe_ingredients(uuid[]) to authenticated;
revoke execute on function public.public_recipe_ingredients(uuid[]) from anon, public;
