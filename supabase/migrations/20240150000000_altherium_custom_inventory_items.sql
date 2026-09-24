-- ============================================================
-- Vorterium — Itens personalizados no inventário (ficha Altherium)
-- Migration: 20240150000000_altherium_custom_inventory_items.sql
-- Aplicar após: 20240149000000_triumph_used_activity.sql
-- ============================================================
--
-- Além dos itens do catálogo (que vivem em código e são referenciados
-- por item_id), o jogador ou o mestre pode criar um item próprio. Ele
-- mora na mesma tabela — quantidade, remover e equipar funcionam igual —
-- com item_id "custom:<uuid>" e os dados guardados aqui:
--   custom_name   → nome do item (obrigatório nos personalizados)
--   custom_detail → descrição/efeito livre (dano, alcance, efeito...)
--   custom_db     → DB da peça, só pra armadura/escudo (usado ao equipar)
-- As policies da tabela (dono ou mestre) já cobrem as colunas novas.

alter table public.altherium_character_inventory
  add column if not exists custom_name   text,
  add column if not exists custom_detail text,
  add column if not exists custom_db     integer;

alter table public.altherium_character_inventory
  add constraint altherium_inventory_custom_name_length
    check (custom_name is null or char_length(btrim(custom_name)) between 1 and 80),
  add constraint altherium_inventory_custom_detail_length
    check (custom_detail is null or char_length(custom_detail) <= 300),
  add constraint altherium_inventory_custom_db_range
    check (custom_db is null or custom_db between 0 and 99),
  -- Item personalizado ⇔ item_id "custom:..." ⇔ tem nome próprio.
  add constraint altherium_inventory_custom_consistent
    check ((item_id like 'custom:%') = (custom_name is not null));
