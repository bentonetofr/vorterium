-- ============================================================
-- Vorterium — Ficha Altherium: movimento editável
-- Migration: 20240195000000_altherium_movimento.sql
-- Aplicar após: 20240194000000_vortable_mundos.sql
-- ============================================================
--
-- O movimento por turno era sempre calculado pelo Impulso (5 m com 0–8,
-- 10 m com 9–10). Agora o jogador pode mudá-lo na ficha (itens, magias,
-- condições...). `movement_override` guarda o valor em metros que ele
-- escolheu; null = automático (continua seguindo o Impulso).

alter table public.altherium_character_sheets
  add column if not exists movement_override integer
  check (movement_override is null or (movement_override >= 0 and movement_override <= 100));
