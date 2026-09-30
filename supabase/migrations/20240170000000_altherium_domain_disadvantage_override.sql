-- ============================================================
-- Vorterium — Altherium: tirar a desvantagem automática do domínio
-- Migration: 20240170000000_altherium_domain_disadvantage_override.sql
-- Aplicar após: 20240169000000_altherium_domain_bonus_disadvantage.sql
-- ============================================================
--
-- Atributo em 0 deixa os domínios dele com desvantagem POR PADRÃO. Se o
-- jogador clica num número (0, 1, 2) ou no "+" do domínio, vale o número
-- clicado com os dados normais, sem a desvantagem automática. Essa escolha
-- fica guardada aqui (clicar no −1 marca a desvantagem de novo).

alter table public.altherium_character_domains
  add column if not exists no_auto_disadvantage boolean not null default false;
