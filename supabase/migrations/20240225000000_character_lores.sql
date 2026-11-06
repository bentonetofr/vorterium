-- ============================================================
-- Vorterium — Lore dos personagens (abas Lore das fichas + aba Lores do mestre)
-- Migration: 20240225000000_character_lores.sql
-- Aplicar após: 20240224000000_altherium_custom_item_details.sql
-- ============================================================
--
-- Cada ficha (Altherium ou D&D) tem uma lore: um texto escrito no site e/ou
-- arquivos (PDF, DOCX, TXT...). O jogador mexe só na própria; o mestre da
-- campanha lê todas, na aba "Lores" da Sessão. A conta dev lê tudo (observadora).
--
--   character_lores       → o texto (uma linha por ficha: unique sheet_id)
--   character_lore_files  → os arquivos enviados (a linha aponta o arquivo no Storage)
--   bucket character-lores (privado), arquivos em "<campanha>/<autor>/<arquivo>"

-- ── 1. Texto ────────────────────────────────────────────

create table if not exists public.character_lores (
  id          uuid        primary key default gen_random_uuid(),
  campaign_id uuid        not null references public.campaigns(id) on delete cascade,
  sheet_id    uuid        not null,
  system      text        not null check (system in ('altherium', 'dnd5e')),
  user_id     uuid        not null default auth.uid() references public.profiles(id) on delete cascade,
  body        text        not null default '' check (char_length(body) <= 60000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (sheet_id)
);

create index if not exists character_lores_campaign_idx on public.character_lores (campaign_id);

create or replace function public.touch_character_lore()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists character_lores_touch on public.character_lores;
create trigger character_lores_touch
  before update on public.character_lores
  for each row execute function public.touch_character_lore();

alter table public.character_lores enable row level security;

drop policy if exists "lores: dono e mestre leem" on public.character_lores;
create policy "lores: dono e mestre leem"
  on public.character_lores for select
  to authenticated
  using (user_id = auth.uid() or public.is_campaign_master(campaign_id, auth.uid()));

drop policy if exists "lores: dono cria" on public.character_lores;
create policy "lores: dono cria"
  on public.character_lores for insert
  to authenticated
  with check (user_id = auth.uid() and public.is_campaign_member(campaign_id, auth.uid()));

drop policy if exists "lores: dono edita" on public.character_lores;
create policy "lores: dono edita"
  on public.character_lores for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "lores: dono apaga" on public.character_lores;
create policy "lores: dono apaga"
  on public.character_lores for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "dev: le tudo" on public.character_lores;
create policy "dev: le tudo"
  on public.character_lores for select
  to authenticated
  using (public.is_developer());

-- ── 2. Arquivos ─────────────────────────────────────────

create table if not exists public.character_lore_files (
  id          uuid        primary key default gen_random_uuid(),
  campaign_id uuid        not null references public.campaigns(id) on delete cascade,
  sheet_id    uuid        not null,
  user_id     uuid        not null default auth.uid() references public.profiles(id) on delete cascade,
  name        text        not null check (char_length(name) between 1 and 200),
  path        text        not null unique,
  mime        text,
  size_bytes  bigint      not null default 0 check (size_bytes >= 0),
  created_at  timestamptz not null default now()
);

create index if not exists character_lore_files_sheet_idx    on public.character_lore_files (sheet_id);
create index if not exists character_lore_files_campaign_idx on public.character_lore_files (campaign_id);

alter table public.character_lore_files enable row level security;

drop policy if exists "lore files: dono e mestre leem" on public.character_lore_files;
create policy "lore files: dono e mestre leem"
  on public.character_lore_files for select
  to authenticated
  using (user_id = auth.uid() or public.is_campaign_master(campaign_id, auth.uid()));

-- No máximo 25 arquivos por ficha.
drop policy if exists "lore files: dono envia" on public.character_lore_files;
create policy "lore files: dono envia"
  on public.character_lore_files for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_campaign_member(campaign_id, auth.uid())
    and (select count(*) from public.character_lore_files f where f.sheet_id = character_lore_files.sheet_id) < 25
  );

drop policy if exists "lore files: dono apaga" on public.character_lore_files;
create policy "lore files: dono apaga"
  on public.character_lore_files for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "dev: le tudo" on public.character_lore_files;
create policy "dev: le tudo"
  on public.character_lore_files for select
  to authenticated
  using (public.is_developer());

-- ── 3. Bucket privado ───────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit)
values ('character-lores', 'character-lores', false, 20971520)
on conflict (id) do update
  set public          = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- "<campanha>/<autor>/<arquivo>" → quem pode ler / enviar / apagar.
create or replace function public.lore_file_access(object_name text, mode text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  campaign uuid;
  author   uuid;
begin
  begin
    campaign := split_part(object_name, '/', 1)::uuid;
    author   := split_part(object_name, '/', 2)::uuid;
  exception when others then
    return false;
  end;
  if mode = 'read' then
    return author = auth.uid() or public.is_campaign_master(campaign, auth.uid());
  elsif mode = 'write' then
    return author = auth.uid() and public.is_campaign_member(campaign, auth.uid());
  elsif mode = 'delete' then
    return author = auth.uid();
  end if;
  return false;
end;
$$;

revoke all on function public.lore_file_access(text, text) from public;
grant execute on function public.lore_file_access(text, text) to authenticated;

drop policy if exists "character-lores: dono e mestre leem" on storage.objects;
create policy "character-lores: dono e mestre leem"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'character-lores' and public.lore_file_access(name, 'read'));

drop policy if exists "character-lores: dono envia" on storage.objects;
create policy "character-lores: dono envia"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'character-lores' and public.lore_file_access(name, 'write'));

drop policy if exists "character-lores: dono apaga" on storage.objects;
create policy "character-lores: dono apaga"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'character-lores' and public.lore_file_access(name, 'delete'));

-- ── 4. Tempo real: a lore que o jogador escreve aparece na hora pro mestre ──

do $$
declare
  t text;
begin
  foreach t in array array['character_lores', 'character_lore_files'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
