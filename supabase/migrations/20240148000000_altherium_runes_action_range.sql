-- ============================================================
-- Vorterium — Tipo de ação e distância nas runas do Runaskin
-- Migration: 20240148000000_altherium_runes_action_range.sql
-- Aplicar após: 20240147000000_altherium_sheets_realtime.sql
-- ============================================================
--
-- As runas descobertas passam a ter os mesmos dados dos triunfos
-- iniciais da trilha: tipo de ação (mesmos ids de TriumphAction no
-- front) e distância (Toque, Curto, ...). Os dois são opcionais — runas
-- já criadas ficam sem, e o card só mostra o que estiver preenchido.

alter table public.altherium_runaskin_runes
  add column if not exists action text
    check (action in ('padrao', 'bonus', 'livre', 'reacao'));

alter table public.altherium_runaskin_runes
  add column if not exists range text
    check (range is null or char_length(range) <= 40);
