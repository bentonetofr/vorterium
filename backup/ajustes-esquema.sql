-- Diferencas entre o banco antigo e o que as migrations da pasta supabase/migrations criam.
-- Achadas ao comparar o dump completo (vorterium-AAAA-MM-DD.sql) com um projeto novo recem-migrado (14/11/2026).
-- Rode ANTES de carregar os dados. Pode rodar mais de uma vez.

-- 1) Ficha completa guardada no bestiario (existia no banco antigo, sem migration no repositorio)
alter table public.altherium_bestiary add column if not exists sheet jsonb;
alter table public.user_bestiary      add column if not exists sheet jsonb;

alter table public.altherium_bestiary drop constraint if exists altherium_bestiary_sheet_shape;
alter table public.altherium_bestiary add constraint altherium_bestiary_sheet_shape
  check (sheet is null or (jsonb_typeof(sheet) = 'object' and pg_column_size(sheet) <= 30000));

alter table public.user_bestiary drop constraint if exists user_bestiary_sheet_shape;
alter table public.user_bestiary add constraint user_bestiary_sheet_shape
  check (sheet is null or (jsonb_typeof(sheet) = 'object' and pg_column_size(sheet) <= 30000));

-- 2) Leitura do dono do site (dev) nas tabelas do Caatedrum (existia no banco antigo)
drop policy if exists "dev: le tudo" on public.caat_rooms;
create policy "dev: le tudo" on public.caat_rooms as permissive for select to authenticated using (public.is_developer());
drop policy if exists "dev: le tudo" on public.caat_state;
create policy "dev: le tudo" on public.caat_state as permissive for select to authenticated using (public.is_developer());
