-- ============================================================
-- Vorterium — Ficha Altherium: PV/PE com máximo editável
-- Migration: 20240140000000_altherium_vitality_equilibrio_max.sql
-- Aplicar após: 20240139000000_altherium_character_sheets.sql
-- ============================================================
--
-- Vitalidade e Equilíbrio deixam de ter o máximo calculado (raiz + d10
-- rolado na criação + atributo) e passam a ser dois campos diretos —
-- atual e máximo — editáveis pelo jogador/mestre. `vitality_roll` e
-- `equilibrio_roll` ficam na tabela (não usados mais pela interface) em
-- vez de apagados, pra não perder o dado de quem já rolou.

alter table public.altherium_character_sheets
  add column vitality_max   integer not null default 10 check (vitality_max   >= 1),
  add column equilibrio_max integer not null default 10 check (equilibrio_max >= 1);

-- Backfill: reconstitui o máximo de quem já tem ficha usando a fórmula
-- antiga (base da raiz + d10 rolado + atributo), pra ninguém perder
-- vida/equilíbrio máximo já em uso. Sem raiz ou sem d10 rolado ainda,
-- assume o padrão de 10 (mesmo valor do default da coluna).
update public.altherium_character_sheets
set
  vitality_max = case
    when raiz is not null and vitality_roll is not null then
      (case raiz
        when 'berserker' then 20
        when 'runaskin'  then 10
        when 'pilar'     then 15
      end) + vitality_roll + attr_espirito
    else 10
  end,
  equilibrio_max = case
    when raiz is not null and equilibrio_roll is not null then
      (case raiz
        when 'berserker' then 10
        when 'runaskin'  then 20
        when 'pilar'     then 15
      end) + equilibrio_roll + attr_destino
    else 10
  end;
