-- ============================================================
-- Vorterium — Retrato do personagem (ficha Altherium)
-- Migration: 20240141000000_altherium_portrait.sql
-- Aplicar após: 20240140000000_altherium_vitality_equilibrio_max.sql
-- ============================================================

-- ── 1. Coluna portrait_url ───────────────────────────────

alter table public.altherium_character_sheets
  add column if not exists portrait_url text;

alter table public.altherium_character_sheets
  drop constraint if exists altherium_sheets_portrait_url_length;

alter table public.altherium_character_sheets
  add constraint altherium_sheets_portrait_url_length
    check (portrait_url is null or char_length(portrait_url) <= 2048);

-- ── 2. Bucket público com escrita protegida por RLS ──────
--
-- Caminho <sheet_id>/portrait. Mesmo critério de acesso da própria
-- ficha (ver policies de altherium_character_sheets): dono ou mestre
-- da campanha podem ver e escrever.

insert into storage.buckets (id, name, public)
values ('altherium-portraits', 'altherium-portraits', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "altherium-portraits: dono ou mestre pode visualizar" on storage.objects;
create policy "altherium-portraits: dono ou mestre pode visualizar"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'altherium-portraits'
    and exists (
      select 1 from public.altherium_character_sheets s
      where s.id::text = split_part(name, '/', 1)
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );

drop policy if exists "altherium-portraits: dono ou mestre pode enviar" on storage.objects;
create policy "altherium-portraits: dono ou mestre pode enviar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'altherium-portraits'
    and exists (
      select 1 from public.altherium_character_sheets s
      where s.id::text = split_part(name, '/', 1)
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );

drop policy if exists "altherium-portraits: dono ou mestre pode atualizar" on storage.objects;
create policy "altherium-portraits: dono ou mestre pode atualizar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'altherium-portraits'
    and exists (
      select 1 from public.altherium_character_sheets s
      where s.id::text = split_part(name, '/', 1)
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  )
  with check (
    bucket_id = 'altherium-portraits'
    and exists (
      select 1 from public.altherium_character_sheets s
      where s.id::text = split_part(name, '/', 1)
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );

drop policy if exists "altherium-portraits: dono ou mestre pode remover" on storage.objects;
create policy "altherium-portraits: dono ou mestre pode remover"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'altherium-portraits'
    and exists (
      select 1 from public.altherium_character_sheets s
      where s.id::text = split_part(name, '/', 1)
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );
