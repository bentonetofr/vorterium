-- ============================================================
-- Vorterium — Dano/ferimento por zona do corpo (ficha Altherium)
-- Migration: 20240143000000_altherium_wound_tracking.sql
-- Aplicar após: 20240142000000_altherium_inventory.sql
-- ============================================================
--
-- Mesmo padrão das colunas de DB (dano bloqueado por armadura) já
-- existentes — número livre editado à mão, sem limite ou fórmula.
-- Alimenta o segundo manequim (vermelho) do card Anatomia & Armadura.

alter table public.altherium_character_sheets
  add column if not exists dano_pernas integer not null default 0 check (dano_pernas >= 0);

alter table public.altherium_character_sheets
  add column if not exists dano_bracos integer not null default 0 check (dano_bracos >= 0);

alter table public.altherium_character_sheets
  add column if not exists dano_tronco integer not null default 0 check (dano_tronco >= 0);

alter table public.altherium_character_sheets
  add column if not exists dano_cabeca integer not null default 0 check (dano_cabeca >= 0);
