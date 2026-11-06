-- ============================================================
-- Vorterium — Mais dados nos itens personalizados (ficha Altherium)
-- Migration: 20240224000000_altherium_custom_item_details.sql
-- Aplicar após: 20240223000000_board_files_index.sql
-- ============================================================
--
-- Arma, armadura e escudo personalizados ganham o que o catálogo já tinha:
--   custom_price      → preço em ¤ (qualquer tipo de item; só informativo)
--   custom_category   → arma: pesada | leve | arremesso | alcance (define os espaços de Reforço)
--   custom_repair     → material de reparo: ferro_velho | couro | madeira | osso
--   custom_properties → arma: lista de propriedades, ex. [{"id":"perfurante","value":1},{"id":"serrilhada"}]
-- Os valores seguem os tipos de altheriumItems.ts. Nulos nos itens do catálogo.

alter table public.altherium_character_inventory
  add column if not exists custom_price      integer,
  add column if not exists custom_category   text,
  add column if not exists custom_repair     text,
  add column if not exists custom_properties jsonb;

alter table public.altherium_character_inventory
  add constraint altherium_inventory_custom_price_valid
    check (custom_price is null or (custom_price >= 0 and custom_price <= 99999999)),
  add constraint altherium_inventory_custom_category_valid
    check (custom_category is null or custom_category in ('pesada', 'leve', 'arremesso', 'alcance')),
  add constraint altherium_inventory_custom_repair_valid
    check (custom_repair is null or custom_repair in ('ferro_velho', 'couro', 'madeira', 'osso')),
  add constraint altherium_inventory_custom_properties_valid
    check (custom_properties is null or jsonb_typeof(custom_properties) = 'array');
