-- ============================================================
-- Vorterium — Terra Devastada Adaptada: retrato do personagem
-- Migration: 20240200000000_terra_devastada_adaptada_retrato.sql
-- Aplicar após: 20240199000000_terra_devastada_adaptada_furtividade.sql
-- ============================================================
--
-- O retrato é uma imagem por ficha, no bucket público tda-portraits, no
-- caminho "<id da ficha>/portrait". A URL fica em portrait_url. Quem pode
-- enviar, trocar e remover é o dono da ficha ou o mestre da campanha (igual
-- ao de Altherium, 20240141000000, e ao de Vampiro, 20240187000000).

alter table public.tda_character_sheets
  add column if not exists portrait_url text;

alter table public.tda_character_sheets
  drop constraint if exists tda_sheets_portrait_url_length;
alter table public.tda_character_sheets
  add constraint tda_sheets_portrait_url_length
    check (portrait_url is null or char_length(portrait_url) <= 2048);


-- ── Bucket e permissões ───────────────────────────────────

insert into storage.buckets (id, name, public)
values ('tda-portraits', 'tda-portraits', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "tda-portraits: dono ou mestre pode visualizar" on storage.objects;
create policy "tda-portraits: dono ou mestre pode visualizar"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'tda-portraits'
    and exists (
      select 1 from public.tda_character_sheets s
      where s.id::text = split_part(name, '/', 1)
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );

drop policy if exists "tda-portraits: dono ou mestre pode enviar" on storage.objects;
create policy "tda-portraits: dono ou mestre pode enviar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'tda-portraits'
    and exists (
      select 1 from public.tda_character_sheets s
      where s.id::text = split_part(name, '/', 1)
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );

drop policy if exists "tda-portraits: dono ou mestre pode atualizar" on storage.objects;
create policy "tda-portraits: dono ou mestre pode atualizar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'tda-portraits'
    and exists (
      select 1 from public.tda_character_sheets s
      where s.id::text = split_part(name, '/', 1)
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  )
  with check (
    bucket_id = 'tda-portraits'
    and exists (
      select 1 from public.tda_character_sheets s
      where s.id::text = split_part(name, '/', 1)
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );

drop policy if exists "tda-portraits: dono ou mestre pode remover" on storage.objects;
create policy "tda-portraits: dono ou mestre pode remover"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'tda-portraits'
    and exists (
      select 1 from public.tda_character_sheets s
      where s.id::text = split_part(name, '/', 1)
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );
