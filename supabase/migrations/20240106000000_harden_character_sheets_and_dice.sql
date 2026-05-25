-- ============================================================
-- Campaign Lab — Incremento 7: Hardening de fichas e rolagens
-- Migration: 20240106000000_harden_character_sheets_and_dice.sql
-- Aplicar após: 20240105000000_dice_rolls.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
-- ============================================================


-- ── 1. Trigger: impede alteração de campaign_id e user_id ────
--
-- Campos estruturais da ficha são imutáveis após criação.
-- Um cliente malicioso não deve conseguir mover uma ficha
-- para outra campanha ou trocar o dono via UPDATE direto.
-- A RLS de update já exige user_id = auth.uid() OR is_campaign_master,
-- mas esta trigger garante a imutabilidade no nível do banco.

create or replace function public.prevent_sheet_structural_change()
returns trigger as $$
begin
  if new.campaign_id <> old.campaign_id then
    raise exception
      'Não é permitido alterar campaign_id de uma ficha após criação.';
  end if;

  if new.user_id <> old.user_id then
    raise exception
      'Não é permitido alterar user_id de uma ficha após criação.';
  end if;

  return new;
end;
$$ language plpgsql set search_path = public;

create trigger enforce_sheet_immutable_fields
  before update on public.character_sheets
  for each row execute function public.prevent_sheet_structural_change();


-- ── 2. Constraint: result deve estar dentro do intervalo do dado ──
--
-- O valor calculado no cliente é persistido; esta constraint
-- impede que um cliente envie resultados impossíveis
-- (ex: rolar 25 num d20).

-- Remove constraint anterior simples (result >= 1), se existir
alter table public.dice_rolls
  drop constraint if exists dice_rolls_result_check;

-- Adiciona constraint que valida intervalo por tipo de dado
alter table public.dice_rolls
  add constraint dice_rolls_result_valid_range check (
    (die_type = 'd4'   and result between 1 and 4)   or
    (die_type = 'd6'   and result between 1 and 6)   or
    (die_type = 'd8'   and result between 1 and 8)   or
    (die_type = 'd10'  and result between 1 and 10)  or
    (die_type = 'd12'  and result between 1 and 12)  or
    (die_type = 'd20'  and result between 1 and 20)  or
    (die_type = 'd100' and result between 1 and 100)
  );


-- ── 3. Remove dice_rolls da publicação Realtime (se presente) ────
--
-- O MVP não usa Supabase Realtime para rolagens.
-- Este bloco remove a tabela da publicação de forma segura,
-- ignorando erro caso ela nunca tenha sido adicionada.

do $$
begin
  alter publication supabase_realtime drop table public.dice_rolls;
exception when others then
  null; -- Ignora se a publication não existir ou a tabela não estiver incluída
end;
$$;
