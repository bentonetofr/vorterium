-- ============================================================
-- Vorterium — Ficha Altherium: FV/PR com máximo editável
-- Migration: 20240146000000_altherium_fv_pr_max.sql
-- Aplicar após: 20240145000000_altherium_runaskin_runes.sql
-- ============================================================
--
-- Mesmo caminho que PV/PE fizeram em 20240140000000: Força de Vontade e
-- Pontos Rúnicos deixam de ter o máximo calculado (base da raiz + d10
-- rolado na criação + atributo) e passam a ter o máximo como campo
-- direto, editável na barra. `fv_roll` e `pr_roll` ficam na tabela (não
-- usados mais pela interface) em vez de apagados.

alter table public.altherium_character_sheets
  add column if not exists fv_max integer not null default 10 check (fv_max >= 1),
  add column if not exists pr_max integer not null default 10 check (pr_max >= 1);

-- Backfill: reconstitui o máximo de quem já tem ficha pela fórmula antiga,
-- pra ninguém perder FV/PR máximo já em uso. Sem d10 rolado ainda, conta
-- o dado como 0 (base + atributo). Raiz que não usa o recurso fica com 10.
update public.altherium_character_sheets
set
  fv_max = case
    when raiz = 'berserker' then greatest(1, 14 + coalesce(fv_roll, 0) + attr_impulso)
    else 10
  end,
  pr_max = case
    when raiz = 'runaskin' then greatest(1, 20 + coalesce(pr_roll, 0) + attr_runico)
    else 10
  end;
