-- ============================================================
-- Vorterium — Dados de arma nos itens personalizados (ficha Altherium)
-- Migration: 20240151000000_altherium_custom_weapon_stats.sql
-- Aplicar após: 20240150000000_altherium_custom_inventory_items.sql
-- ============================================================
--
-- Arma personalizada ganha os mesmos dados das armas do catálogo:
--   custom_damage_dice → dado de dano (1d8, 2d6+1...)
--   custom_damage_type → corte | impacto | perfurante
--   custom_attribute   → atributo do teste de acerto: furia | impulso | furia_impulso
--   custom_range       → toque | toque_curto | curto | curto_medio | medio | longo
-- Os valores seguem os tipos de altheriumItems.ts. Nulos nos outros tipos de item.

alter table public.altherium_character_inventory
  add column if not exists custom_damage_dice text,
  add column if not exists custom_damage_type text,
  add column if not exists custom_attribute   text,
  add column if not exists custom_range       text;

alter table public.altherium_character_inventory
  add constraint altherium_inventory_custom_damage_dice_format
    check (custom_damage_dice is null or custom_damage_dice ~ '^[0-9]{0,2}d[0-9]{1,3}([+-][0-9]{1,3})?$'),
  add constraint altherium_inventory_custom_damage_type_valid
    check (custom_damage_type is null or custom_damage_type in ('corte', 'impacto', 'perfurante')),
  add constraint altherium_inventory_custom_attribute_valid
    check (custom_attribute is null or custom_attribute in ('furia', 'impulso', 'furia_impulso')),
  add constraint altherium_inventory_custom_range_valid
    check (custom_range is null or custom_range in ('toque', 'toque_curto', 'curto', 'curto_medio', 'medio', 'longo'));
