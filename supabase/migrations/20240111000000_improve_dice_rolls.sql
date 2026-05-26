-- ============================================================
-- Campaign Lab — Melhoria da rolagem de dados
-- Migration: 20240111000000_improve_dice_rolls.sql
-- Aplicar após: 20240106000000_harden_character_sheets_and_dice.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
-- ============================================================


-- ── 1. Remove constraint antiga que limita result ao intervalo do dado ──
--
-- A constraint dice_rolls_result_valid_range impede resultados maiores
-- que o dado (ex: 1d20 + 5 = 25). O novo sistema usa individual_results
-- para validar cada dado individualmente; result = total_result pode
-- ultrapassar o valor máximo do dado por causa de modificadores.

alter table public.dice_rolls
  drop constraint if exists dice_rolls_result_valid_range;


-- ── 2. Novos campos ──────────────────────────────────────

alter table public.dice_rolls
  add column if not exists quantity           integer  not null default 1,
  add column if not exists modifier           integer  not null default 0,
  add column if not exists individual_results integer[]         ,
  add column if not exists total_result       integer           ,
  add column if not exists roll_mode          text     not null default 'sum',
  add column if not exists kept_result        integer           ,
  add column if not exists formula            text              ;


-- ── 3. Constraints simples nos novos campos ──────────────

alter table public.dice_rolls
  add constraint dice_rolls_quantity_range
    check (quantity between 1 and 10),
  add constraint dice_rolls_modifier_range
    check (modifier between -99 and 99),
  add constraint dice_rolls_roll_mode_valid
    check (roll_mode in ('sum', 'keep_highest'));


-- ── 4. Trigger de validação profunda ─────────────────────
--
-- Valida:
-- - keep_highest exige quantity >= 2
-- - individual_results: tamanho = quantity, cada valor dentro do dado
-- - result >= 1
-- - result = total_result quando total_result está presente

create or replace function public.validate_dice_roll_fields()
returns trigger as $$
declare
  v_die_max integer;
  v_arr_len integer;
  i         integer;
begin
  -- Máximo do dado para validar individual_results
  v_die_max := case new.die_type
    when 'd4'   then 4
    when 'd6'   then 6
    when 'd8'   then 8
    when 'd10'  then 10
    when 'd12'  then 12
    when 'd20'  then 20
    when 'd100' then 100
    else null
  end;

  -- keep_highest exige pelo menos 2 dados
  if new.roll_mode = 'keep_highest' and new.quantity < 2 then
    raise exception 'Para manter o maior resultado, use pelo menos 2 dados.';
  end if;

  -- Valida individual_results se fornecido
  if new.individual_results is not null then
    v_arr_len := array_length(new.individual_results, 1);

    if v_arr_len is null or v_arr_len <> new.quantity then
      raise exception 'Número de resultados individuais deve ser igual à quantidade de dados.';
    end if;

    for i in 1..v_arr_len loop
      if new.individual_results[i] < 1 or new.individual_results[i] > v_die_max then
        raise exception 'Resultado individual fora do intervalo do dado (1-%).',
          v_die_max;
      end if;
    end loop;
  end if;

  -- result deve ser coerente com total_result
  if new.total_result is not null and new.result <> new.total_result then
    raise exception 'result deve ser igual a total_result.';
  end if;

  -- resultado final deve ser pelo menos 1
  if new.result < 1 then
    raise exception 'Resultado final deve ser pelo menos 1.';
  end if;

  return new;
end;
$$ language plpgsql set search_path = public;

create trigger validate_dice_roll_before_insert
  before insert on public.dice_rolls
  for each row execute function public.validate_dice_roll_fields();
