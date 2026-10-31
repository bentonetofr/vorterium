-- ============================================================
-- Vorterium — Altherium: domínio Ofício (só do Pilar)
-- Migration: 20240221000000_altherium_dominio_oficio.sql
-- Aplicar após: 20240220000000_mesa_arts_hidden.sql
-- ============================================================
--
-- Novo domínio "oficio" na lista aceita pela tabela. Só a ficha de Pilar
-- mostra e usa; a regra é do app (as outras raízes nem veem o domínio).

alter table public.altherium_character_domains
  drop constraint if exists altherium_character_domains_domain_check;

alter table public.altherium_character_domains
  add constraint altherium_character_domains_domain_check check (domain in (
    'brutalidade', 'crime', 'determinacao', 'direcao',
    'furtividade', 'iniciativa', 'intimidacao', 'investigacao',
    'leveza', 'luta', 'medicina', 'oficio', 'percepcao', 'persuasao',
    'precisao', 'pressentimento', 'reflexo', 'religiao',
    'resiliencia', 'runologia', 'saberes', 'sobrevivencia',
    'tatica', 'vontade'
  ));
