-- ============================================================
-- Vorterium — Coleção de dados: segunda leva (14 conjuntos novos)
-- Migration: 20240232000000_dice_collection_wave2.sql
-- Aplicar após: 20240231000000_dnd_spell_class.sql
-- ============================================================
--
-- A coleção ganhou 14 conjuntos (ids abaixo, os mesmos de skins.ts): do comum
-- ao mítico, a raridade nova acima da lendária. Só muda a lista de conjuntos
-- que a coleção reconhece; a tabela, a função unlock_dice_skin e as travas da
-- migration 20240229 continuam as mesmas e passam a valer para os novos.
-- Sem esta migration o site continua funcionando: as conquistas novas só não
-- são concedidas (unlock_dice_skin recusa um conjunto que não conhece).
-- ============================================================

create or replace function public.dice_collection_skins()
returns text[] as $$
  select array[
    -- primeira leva (20240229)
    'osso', 'ferro', 'argila', 'giz', 'cobre',
    'marfim', 'onix', 'ametista', 'granada', 'jade', 'fume',
    'gelo', 'magma', 'meteorito', 'fungo', 'ambar',
    'morte', 'vagalumes', 'runico',
    'vortice',
    -- segunda leva
    'cortica', 'vela',
    'vitral', 'pergaminho',
    'sino', 'relogio', 'perola',
    'tempestade', 'olho', 'galaxia',
    'dragao', 'espelho',
    'vazio', 'prisma'
  ]::text[];
$$ language sql immutable;
