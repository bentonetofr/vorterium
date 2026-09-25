-- ============================================================
-- Vorterium — Triunfos iniciais da trilha editáveis (Runaskin)
-- Migration: 20240156000000_altherium_runaskin_trail_overrides.sql
-- Aplicar após: 20240155000000_altherium_pilar_cards.sql
-- ============================================================
--
-- Os 3 triunfos iniciais de cada trilha vêm do livro (catálogo no
-- código). Cada ficha pode ajustar os seus: aqui fica só o que foi
-- editado, por id do triunfo —
--   { "raiz-vital": { "name": ..., "description": ..., "cost": 1,
--                     "test": ..., "action": "bonus", "range": "Curto" } }
-- Triunfo sem entrada = versão do livro. "Restaurar original" apaga a
-- entrada.

alter table public.altherium_character_sheets
  add column if not exists runaskin_trail_overrides jsonb not null default '{}'::jsonb;

alter table public.altherium_character_sheets
  add constraint altherium_sheets_trail_overrides_object
    check (jsonb_typeof(runaskin_trail_overrides) = 'object'),
  add constraint altherium_sheets_trail_overrides_size
    check (pg_column_size(runaskin_trail_overrides) <= 32000);
