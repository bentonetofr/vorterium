-- ============================================================
-- Vorterium — Habilidades de gênesis, Inspirações Skald e triunfos
-- recentes (Altherium)
-- Migration: 20240162000000_altherium_genesis_skald_recent.sql
-- Aplicar após: 20240161000000_developer_access.sql
-- ============================================================
--
--  • genesis_abilities — habilidades de gênesis que o mestre dá (ex.:
--    "Sem passado: o mestre define sua habilidade"). Lista livre:
--      [{ "id": "...", "name": "...", "description": "..." }]
--  • skald_inspirations — Inspirações Skald ganhas na história (não há
--    nenhuma no livro; o jogador cria). Lista livre:
--      [{ "id", "name", "description", "cost", "action", "range", "test" }]
--  • recent_triumphs — ids dos últimos triunfos usados (mais recente
--    primeiro), pra seção "Recentes" das três raízes (Berserker, Runaskin
--    — trilha e runas — e Pilar). Não entra na Atividade: muda a cada uso
--    e o uso já é anunciado.
--
-- Pode rodar de novo: se uma versão anterior desta migration criou a
-- coluna com o nome antigo (pilar_recent_triumphs), ela é renomeada.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'altherium_character_sheets' and column_name = 'pilar_recent_triumphs'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'altherium_character_sheets' and column_name = 'recent_triumphs'
  ) then
    alter table public.altherium_character_sheets rename column pilar_recent_triumphs to recent_triumphs;
  end if;
end;
$$;

alter table public.altherium_character_sheets
  add column if not exists genesis_abilities  jsonb  not null default '[]'::jsonb,
  add column if not exists skald_inspirations jsonb  not null default '[]'::jsonb,
  add column if not exists recent_triumphs    text[] not null default '{}';

alter table public.altherium_character_sheets
  drop constraint if exists altherium_sheets_genesis_abilities_array,
  drop constraint if exists altherium_sheets_genesis_abilities_size,
  drop constraint if exists altherium_sheets_skald_inspirations_array,
  drop constraint if exists altherium_sheets_skald_inspirations_size,
  drop constraint if exists altherium_sheets_pilar_recent_size,
  drop constraint if exists altherium_sheets_recent_triumphs_size;

alter table public.altherium_character_sheets
  add constraint altherium_sheets_genesis_abilities_array
    check (jsonb_typeof(genesis_abilities) = 'array'),
  add constraint altherium_sheets_genesis_abilities_size
    check (pg_column_size(genesis_abilities) <= 16000),
  add constraint altherium_sheets_skald_inspirations_array
    check (jsonb_typeof(skald_inspirations) = 'array'),
  add constraint altherium_sheets_skald_inspirations_size
    check (pg_column_size(skald_inspirations) <= 32000),
  add constraint altherium_sheets_recent_triumphs_size
    check (cardinality(recent_triumphs) <= 8);

-- Atividade detalhada: igual à da 20240158, só que também ignora os
-- recentes (mudam a cada uso de triunfo).
create or replace function public.alth_sheet_activity_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old     jsonb := to_jsonb(old);
  v_new     jsonb := to_jsonb(new);
  v_key     text;
  v_changes jsonb := '[]'::jsonb;
begin
  for v_key in select jsonb_object_keys(v_new)
  loop
    continue when v_key in ('id', 'campaign_id', 'user_id', 'created_at', 'updated_at', 'pilar_deck', 'recent_triumphs');
    if (v_old->v_key) is distinct from (v_new->v_key) then
      v_changes := v_changes || jsonb_build_array(jsonb_build_object(
        'k', 'f:' || v_key, 'f', v_key, 'from', v_old->v_key, 'to', v_new->v_key
      ));
    end if;
  end loop;

  perform public.alth_log_sheet_changes(new.id, v_changes);
  return null;
exception when others then
  return null;
end;
$$;
