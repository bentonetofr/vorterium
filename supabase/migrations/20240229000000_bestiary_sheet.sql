-- ============================================================
-- Altherium — ficha detalhada das criaturas do bestiário
-- Migration: 20240229000000_bestiary_sheet.sql
-- Aplicar após: 20240228000000_altherium_armor_parts.sql
-- ============================================================
--
-- O bestiário passa a guardar a ficha completa de cada criatura (como o
-- livro apresenta os inimigos): classificação, descrição, Ataque, Defesa,
-- DB, Movimento, golpes e habilidades (passivas, ações, reações...).
-- Tudo isso vai numa coluna só, `sheet` (jsonb), nas duas tabelas:
-- altherium_bestiary (do mestre, por campanha) e user_bestiary (Meu
-- bestiário). Vida, dano e a conta de dificuldade seguem nas colunas de
-- sempre; criaturas antigas ficam com `sheet` nulo e continuam iguais.
--
-- Forma do jsonb (o app confere e limpa antes de salvar):
--   {
--     "tier": "Inimigo Extremamente Forte",
--     "lore": "texto de apresentação",
--     "attack": "3d10 + 4 (Luta)",  "defense": "2d10 + 3",
--     "db": "4 no corpo todo",      "movement": "5 metros",
--     "strikes":   [ { "name": "Garras", "dice": "2d8", "type": "C" } ],
--     "abilities": [ { "kind": "passiva|padrao|bonus|reacao|livre|especial",
--                      "name": "…", "uses": "1x por cena", "text": "…" } ]
--   }
--
-- Nada de política nova: as colunas herdam as RLS que as tabelas já têm
-- (só o mestre vê o bestiário da campanha; só o dono vê o dele).


alter table public.altherium_bestiary add column if not exists sheet jsonb;
alter table public.user_bestiary      add column if not exists sheet jsonb;

-- Um teto de tamanho, pra ninguém entupir a tabela com um jsonb gigante.
alter table public.altherium_bestiary
  drop constraint if exists altherium_bestiary_sheet_shape,
  add  constraint altherium_bestiary_sheet_shape
    check (sheet is null or (jsonb_typeof(sheet) = 'object' and pg_column_size(sheet) <= 30000));

alter table public.user_bestiary
  drop constraint if exists user_bestiary_sheet_shape,
  add  constraint user_bestiary_sheet_shape
    check (sheet is null or (jsonb_typeof(sheet) = 'object' and pg_column_size(sheet) <= 30000));
