-- ============================================================
-- Vorterium — Ficha de criatura no Bestiário (Altherium)
-- Migration: 20240229000000_bestiary_sheet.sql
-- Aplicar após: 20240228000000_altherium_armor_parts.sql
-- ============================================================
--
-- Campos de texto da ficha (título, descrição, Ataque, Defesa, DB,
-- Movimento, golpes, habilidades, táticas e fraquezas) num jsonb só.
-- Vida e dano continuam nas colunas hp e damage_dice, que alimentam as
-- contas. Nulo = criatura sem ficha (as que já existem ficam como estão).

alter table public.altherium_bestiary
  add column if not exists sheet jsonb;

alter table public.user_bestiary
  add column if not exists sheet jsonb;

alter table public.altherium_bestiary
  drop constraint if exists altherium_bestiary_sheet_shape;
alter table public.altherium_bestiary
  add constraint altherium_bestiary_sheet_shape
  check (sheet is null or (jsonb_typeof(sheet) = 'object' and pg_column_size(sheet) <= 40000));

alter table public.user_bestiary
  drop constraint if exists user_bestiary_sheet_shape;
alter table public.user_bestiary
  add constraint user_bestiary_sheet_shape
  check (sheet is null or (jsonb_typeof(sheet) = 'object' and pg_column_size(sheet) <= 40000));
