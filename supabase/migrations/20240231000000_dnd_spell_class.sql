-- ────────────────────────────────────────────────────────
-- D&D: de qual classe é cada magia (conjurador multiclasse). Coluna opcional: magias sem classe continuam como estão.
-- ────────────────────────────────────────────────────────

alter table public.dnd_character_spells
  add column if not exists class_key text;
