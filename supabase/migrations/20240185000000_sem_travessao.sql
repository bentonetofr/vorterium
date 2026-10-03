-- ════════════════════════════════════════════════════════
-- Sem travessão ("—") no site: no catálogo de D&D, a Rede tinha "—" no
-- dano e no tipo de dano (ela não causa dano). Vira "-", igual ao resto do
-- site. Os ataques que já foram copiados do catálogo pra alguma ficha com
-- esse "—" também mudam (só quando o campo é exatamente "—").
-- ════════════════════════════════════════════════════════

update public.dnd_rule_catalog_entries
set metadata = replace(metadata::text, '"—"', '"-"')::jsonb
where metadata::text like '%"—"%';

update public.dnd_character_attacks
set damage      = case when damage = '—' then '-' else damage end,
    damage_type = case when damage_type = '—' then '-' else damage_type end
where damage = '—' or damage_type = '—';
