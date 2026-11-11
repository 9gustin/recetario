-- Extensiones usadas por la búsqueda de recetas e ingredientes (sin acentos, tolerante a errores).
-- Viven en el esquema `extensions` (convención de Supabase): usar `extensions.unaccent(...)`.
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
