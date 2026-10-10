-- ============================================================
-- Vorterium — Terra Devastada Adaptada: suprimentos
-- Migration: 20240198000000_terra_devastada_adaptada_suprimentos.sql
-- Aplicar após: 20240197000000_terra_devastada_adaptada_vida.sql
-- ============================================================
--
-- Suprimentos do personagem:
--   • supplies: contadores dos materiais e dos kits médicos, num jsonb
--     { "trapos", "alcool", "sucata", "laminas", "explosivos", "pecas",
--       "suplementos", "kits" } (inteiros, ausente = 0);
--   • backpack: nível da Mochila (0 a 3), que aumenta o quanto cabe de cada
--     coisa.
-- A munição, o desgaste e as melhorias de cada arma moram dentro do item do
-- inventário (campos do jsonb inventory), então não pedem coluna nova.

alter table public.tda_character_sheets
  add column if not exists supplies jsonb   not null default '{}'::jsonb,
  add column if not exists backpack integer not null default 0;

alter table public.tda_character_sheets
  drop constraint if exists tda_sheets_supplies_object;
alter table public.tda_character_sheets
  add constraint tda_sheets_supplies_object
    check (jsonb_typeof(supplies) = 'object' and pg_column_size(supplies) <= 2000);

alter table public.tda_character_sheets
  drop constraint if exists tda_sheets_backpack_range;
alter table public.tda_character_sheets
  add constraint tda_sheets_backpack_range check (backpack between 0 and 3);
