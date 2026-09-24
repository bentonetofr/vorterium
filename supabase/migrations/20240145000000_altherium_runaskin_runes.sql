-- ============================================================
-- Vorterium — Trilha, usos por cena e runas descobertas do Runaskin
-- Migration: 20240145000000_altherium_runaskin_runes.sql
-- Aplicar após: 20240144000000_altherium_berserker_triumphs.sql
-- ============================================================
--
-- Os 3 triunfos iniciais de cada trilha são dado fixo do livro
-- (constants/altheriumTriumphs.ts). Aqui ficam: a trilha escolhida, o
-- contador de usos na cena (limitado pelo NR, regra de UI) e os
-- triunfos que o Runaskin descobre pelas runas — criados pelo jogador
-- ou pelo mestre, com foto opcional.

-- ── 1. Colunas na ficha ─────────────────────────────────

alter table public.altherium_character_sheets
  add column if not exists runaskin_trail text
    check (runaskin_trail in ('regente', 'sentinela', 'carniceiro'));

alter table public.altherium_character_sheets
  add column if not exists runaskin_scene_uses integer not null default 0
    check (runaskin_scene_uses >= 0);

-- ── 2. Runas descobertas ────────────────────────────────

create table public.altherium_runaskin_runes (
  id           uuid        primary key default gen_random_uuid(),
  sheet_id     uuid        not null references public.altherium_character_sheets(id) on delete cascade,
  name         text        not null check (char_length(name) between 1 and 80),
  description  text        not null default '' check (char_length(description) <= 1000),
  pr_cost      integer     not null default 1 check (pr_cost between 0 and 99),
  test         text        check (test is null or char_length(test) <= 80),
  image_url    text        check (image_url is null or char_length(image_url) <= 2048),
  created_at   timestamptz not null default now()
);

create index idx_altherium_runaskin_runes_sheet_id on public.altherium_runaskin_runes(sheet_id);

alter table public.altherium_runaskin_runes enable row level security;

-- Mesmo critério de acesso da própria ficha: dono ou mestre da campanha.

create policy "altherium_runes: dono ou mestre pode ver"
  on public.altherium_runaskin_runes for select
  to authenticated
  using (
    exists (
      select 1 from public.altherium_character_sheets s
      where s.id = sheet_id
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );

create policy "altherium_runes: dono ou mestre pode inserir"
  on public.altherium_runaskin_runes for insert
  to authenticated
  with check (
    exists (
      select 1 from public.altherium_character_sheets s
      where s.id = sheet_id
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );

create policy "altherium_runes: dono ou mestre pode atualizar"
  on public.altherium_runaskin_runes for update
  to authenticated
  using (
    exists (
      select 1 from public.altherium_character_sheets s
      where s.id = sheet_id
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.altherium_character_sheets s
      where s.id = sheet_id
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );

create policy "altherium_runes: dono ou mestre pode remover"
  on public.altherium_runaskin_runes for delete
  to authenticated
  using (
    exists (
      select 1 from public.altherium_character_sheets s
      where s.id = sheet_id
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );

-- ── 3. Bucket das fotos das runas ───────────────────────
--
-- Caminho <sheet_id>/<rune_id>. Mesmo critério do bucket de retratos.

insert into storage.buckets (id, name, public)
values ('altherium-runes', 'altherium-runes', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "altherium-runes: dono ou mestre pode visualizar" on storage.objects;
create policy "altherium-runes: dono ou mestre pode visualizar"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'altherium-runes'
    and exists (
      select 1 from public.altherium_character_sheets s
      where s.id::text = split_part(name, '/', 1)
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );

drop policy if exists "altherium-runes: dono ou mestre pode enviar" on storage.objects;
create policy "altherium-runes: dono ou mestre pode enviar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'altherium-runes'
    and exists (
      select 1 from public.altherium_character_sheets s
      where s.id::text = split_part(name, '/', 1)
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );

drop policy if exists "altherium-runes: dono ou mestre pode atualizar" on storage.objects;
create policy "altherium-runes: dono ou mestre pode atualizar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'altherium-runes'
    and exists (
      select 1 from public.altherium_character_sheets s
      where s.id::text = split_part(name, '/', 1)
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  )
  with check (
    bucket_id = 'altherium-runes'
    and exists (
      select 1 from public.altherium_character_sheets s
      where s.id::text = split_part(name, '/', 1)
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );

drop policy if exists "altherium-runes: dono ou mestre pode remover" on storage.objects;
create policy "altherium-runes: dono ou mestre pode remover"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'altherium-runes'
    and exists (
      select 1 from public.altherium_character_sheets s
      where s.id::text = split_part(name, '/', 1)
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );
