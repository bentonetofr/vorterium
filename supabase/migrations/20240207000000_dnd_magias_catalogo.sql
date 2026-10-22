-- Magias da ficha de D&D ligadas ao catálogo do SRD 5.1.
-- A linha guarda só a chave da magia do catálogo (catalog_key); o texto completo
-- vem do site. Magias próprias (ou personalizadas a partir do catálogo) ficam com
-- catalog_key nulo e o texto nas notas (description).

alter table public.dnd_character_spells
  add column if not exists catalog_key text;

alter table public.dnd_character_spells
  drop constraint if exists dnd_character_spells_catalog_key_check;
alter table public.dnd_character_spells
  add constraint dnd_character_spells_catalog_key_check
  check (catalog_key is null or char_length(catalog_key) between 1 and 80);

-- A mesma magia do catálogo não entra duas vezes na mesma ficha.
create unique index if not exists dnd_character_spells_sheet_catalog_uidx
  on public.dnd_character_spells(sheet_id, catalog_key)
  where catalog_key is not null;
