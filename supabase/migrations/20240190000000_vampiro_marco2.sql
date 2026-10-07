-- ============================================================
-- Vorterium — Vampiro: A Máscara, Marco 2 (o resto da ficha)
-- Migration: 20240190000000_vampiro_marco2.sql
-- Aplicar após: 20240189000000_fichas_de_npc.sql
-- ============================================================
--
-- Tudo em jsonb, como as perícias (o catálogo de regras fica no site):
--   • disciplines:  { "animalismo": 2, ... } (0 a 5);
--   • powers:       ["animalismo.sentir_a_besta", ...] os poderes escolhidos;
--   • rituals:      ["ritual.andanca_de_sangue", "cerimonia.…", "formula.…"]
--                   rituais de Feitiçaria, cerimônias de Oblívio e fórmulas
--                   de Alquimia;
--   • advantages:   [{ id, key, kind, name, dots, note, source }] Antecedentes,
--                   Méritos e Defeitos (source: criação, predador ou XP);
--   • convictions:  [{ id, conviction, touchstone, note, status }] Convicções
--                   e Pilares de Toque;
--   • xp_log:       [{ id, at, kind, amount, label, … }] XP ganha e gasta;
--   • predator_grants: o que o tipo de predador pôs na ficha (pra desfazer
--                   se trocar de predador);
--   • creation_tier: 'neonato' ou 'ancilla' (muda o limite de vantagens).
-- ============================================================

alter table public.vtm_character_sheets
  add column if not exists disciplines     jsonb not null default '{}'::jsonb,
  add column if not exists powers          jsonb not null default '[]'::jsonb,
  add column if not exists rituals         jsonb not null default '[]'::jsonb,
  add column if not exists advantages      jsonb not null default '[]'::jsonb,
  add column if not exists convictions     jsonb not null default '[]'::jsonb,
  add column if not exists xp_log          jsonb not null default '[]'::jsonb,
  add column if not exists predator_grants jsonb,
  add column if not exists creation_tier   text  not null default 'neonato';

alter table public.vtm_character_sheets drop constraint if exists vtm_marco2_shapes;
alter table public.vtm_character_sheets add constraint vtm_marco2_shapes check (
      jsonb_typeof(disciplines) = 'object'
  and jsonb_typeof(powers)      = 'array' and jsonb_array_length(powers)      <= 120
  and jsonb_typeof(rituals)     = 'array' and jsonb_array_length(rituals)     <= 150
  and jsonb_typeof(advantages)  = 'array' and jsonb_array_length(advantages)  <= 120
  and jsonb_typeof(convictions) = 'array' and jsonb_array_length(convictions) <= 12
  and jsonb_typeof(xp_log)      = 'array' and jsonb_array_length(xp_log)      <= 1000
  and (predator_grants is null or jsonb_typeof(predator_grants) = 'object')
);

alter table public.vtm_character_sheets drop constraint if exists vtm_marco2_size;
alter table public.vtm_character_sheets add constraint vtm_marco2_size check (
  pg_column_size(disciplines) + pg_column_size(powers) + pg_column_size(rituals)
  + pg_column_size(advantages) + pg_column_size(convictions) + pg_column_size(xp_log)
  + coalesce(pg_column_size(predator_grants), 0) <= 300000
);

alter table public.vtm_character_sheets drop constraint if exists vtm_creation_tier_valid;
alter table public.vtm_character_sheets add constraint vtm_creation_tier_valid
  check (creation_tier in ('neonato', 'ancilla'));
