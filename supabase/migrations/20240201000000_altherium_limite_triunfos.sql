-- ============================================================
-- Vorterium — Ficha Altherium: limite de triunfos editável
-- Migration: 20240201000000_altherium_limite_triunfos.sql
-- Aplicar após: 20240200000000_terra_devastada_adaptada_retrato.sql
-- ============================================================
--
-- O limite de triunfos do Berserker era sempre ⌊(2 + domínios com ponto) ÷ 2⌋.
-- Agora o jogador pode mudá-lo na ficha (builds, homebrew...).
-- `triumph_limit_override` guarda o limite escolhido; null = automático
-- (continua seguindo os domínios).

alter table public.altherium_character_sheets
  add column if not exists triumph_limit_override integer
  check (triumph_limit_override is null or (triumph_limit_override >= 0 and triumph_limit_override <= 99));
