begin;
select plan(2);

select has_extension('extensions', 'pg_trgm', 'pg_trgm está instalada');
select has_extension('extensions', 'unaccent', 'unaccent está instalada');

select * from finish();
rollback;
