-- ============================================================
-- Vorterium — Triunfos escolhidos do Berserker (ficha Altherium)
-- Migration: 20240144000000_altherium_berserker_triumphs.sql
-- Aplicar após: 20240143000000_altherium_wound_tracking.sql
-- ============================================================
--
-- Lista de ids do catálogo fixo (constants/altheriumTriumphs.ts no
-- front) — sem FK, já que o catálogo não é tabela. O limite
-- ⌊(2 + domínios com ponto) ÷ 2⌋ é regra de UI, não constraint.
-- O Pilar tem todos os triunfos e não usa esta coluna.

alter table public.altherium_character_sheets
  add column if not exists berserker_triumphs text[] not null default '{}';
