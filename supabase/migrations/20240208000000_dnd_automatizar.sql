-- Botão "Automatizar" da ficha de D&D: mais campos calculados podem ficar em modo manual
-- (modificadores de atributo, salvaguardas, perícias, percepções passivas e capacidade de
-- carga, além dos 7 que já existiam). Só amplia a lista aceita em field_key.

alter table public.dnd_character_overrides
  drop constraint if exists dnd_character_overrides_field_key_check;

alter table public.dnd_character_overrides
  add constraint dnd_character_overrides_field_key_check check (field_key in (
    'proficiency_bonus', 'initiative_bonus', 'armor_class',
    'speed', 'hp_max', 'spell_save_dc',
    'spell_attack_bonus', 'carry_capacity', 'passive_perception',
    'passive_insight', 'passive_investigation', 'mod_strength',
    'mod_dexterity', 'mod_constitution', 'mod_intelligence',
    'mod_wisdom', 'mod_charisma', 'save_strength',
    'save_dexterity', 'save_constitution', 'save_intelligence',
    'save_wisdom', 'save_charisma', 'skill_acrobatics',
    'skill_animal_handling', 'skill_arcana', 'skill_athletics',
    'skill_deception', 'skill_history', 'skill_insight',
    'skill_intimidation', 'skill_investigation', 'skill_medicine',
    'skill_nature', 'skill_perception', 'skill_performance',
    'skill_persuasion', 'skill_religion', 'skill_sleight_of_hand',
    'skill_stealth', 'skill_survival'
  ));
