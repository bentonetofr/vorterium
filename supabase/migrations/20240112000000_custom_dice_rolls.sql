-- ============================================================
-- Campaign Lab — Rolagem de dados personalizada
-- Migration: 20240112000000_custom_dice_rolls.sql
-- Aplicar após: 20240111000000_improve_dice_rolls.sql
-- ============================================================


-- ── 1. Adicionar coluna roll_breakdown ───────────────────────

alter table public.dice_rolls
  add column if not exists roll_breakdown jsonb;


-- ── 2. Ajustar limites dos campos existentes ─────────────────

-- Aumentar limite de quantity (antes 10, agora 100)
alter table public.dice_rolls
  drop constraint if exists dice_rolls_quantity_range;

alter table public.dice_rolls
  add constraint dice_rolls_quantity_range
    check (quantity between 1 and 100);

-- Aumentar limite do modifier (antes -99..99, agora -999..999)
alter table public.dice_rolls
  drop constraint if exists dice_rolls_modifier_range;

alter table public.dice_rolls
  add constraint dice_rolls_modifier_range
    check (modifier between -999 and 999);

-- Garantir que formula não ultrapasse 80 caracteres
-- (DROP + ADD porque Postgres não aceita ADD CONSTRAINT IF NOT EXISTS)
alter table public.dice_rolls
  drop constraint if exists dice_rolls_formula_length;

alter table public.dice_rolls
  add constraint dice_rolls_formula_length
    check (formula is null or length(formula) <= 80);


-- ── 3. Substituir trigger de validação ───────────────────────

drop trigger if exists validate_dice_roll_before_insert on public.dice_rolls;
drop function if exists public.validate_dice_roll_fields();

create or replace function public.validate_dice_roll_fields()
returns trigger as $$
declare
  v_item       jsonb;
  v_type       text;
  v_qty        integer;
  v_sides      integer;
  v_results    jsonb;
  v_kept       integer;
  v_subtotal   integer;
  v_mod_val    integer;
  v_calc_total    integer;
  v_sum           integer;
  v_max           integer;
  v_die_max       integer;
  v_arr_len       integer;
  i               integer;
  v_val           integer;
  v_has_dice_term boolean;
begin

  -- result deve ser >= 1
  if new.result < 1 then
    raise exception 'Resultado final deve ser pelo menos 1.';
  end if;

  -- total_result deve existir e ser igual a result
  if new.total_result is null then
    raise exception 'total_result não pode ser nulo.';
  end if;

  if new.result <> new.total_result then
    raise exception 'result deve ser igual a total_result.';
  end if;

  -- formula não pode ultrapassar 80 caracteres
  if new.formula is not null and length(new.formula) > 80 then
    raise exception 'A fórmula é muito longa (máximo 80 caracteres).';
  end if;

  -- ── Validar roll_breakdown quando presente ──────────────────
  if new.roll_breakdown is not null then

    if jsonb_typeof(new.roll_breakdown) <> 'array' then
      raise exception 'roll_breakdown deve ser um array JSON.';
    end if;

    if jsonb_array_length(new.roll_breakdown) = 0 then
      raise exception 'roll_breakdown não pode ser vazio.';
    end if;

    v_calc_total    := 0;
    v_has_dice_term := false;

    for v_item in select * from jsonb_array_elements(new.roll_breakdown)
    loop
      v_type := v_item->>'type';

      if v_type is null or v_type not in ('sum', 'keep_highest', 'modifier') then
        raise exception 'Tipo inválido em roll_breakdown: %.', coalesce(v_type, 'null');
      end if;

      if v_type in ('sum', 'keep_highest') then
        v_has_dice_term := true;
        v_qty     := (v_item->>'quantity')::integer;
        v_sides   := (v_item->>'sides')::integer;
        v_results := v_item->'results';

        -- limites de quantity e sides
        if v_qty < 1 or v_qty > 100 then
          raise exception 'Quantidade de dados fora do intervalo (1-100): %.', v_qty;
        end if;
        if v_sides < 2 or v_sides > 1000 then
          raise exception 'Número de lados fora do intervalo (2-1000): %.', v_sides;
        end if;

        -- results deve ser array com tamanho = quantity
        if jsonb_typeof(v_results) <> 'array' then
          raise exception 'results deve ser um array JSON em roll_breakdown.';
        end if;
        if jsonb_array_length(v_results) <> v_qty then
          raise exception 'Tamanho de results (%) deve ser igual à quantity (%).', jsonb_array_length(v_results), v_qty;
        end if;

        -- cada valor de results dentro de [1, sides]
        for i in 0..(v_qty - 1) loop
          v_val := (v_results->i)::integer;
          if v_val < 1 or v_val > v_sides then
            raise exception 'Resultado individual % fora do intervalo do dado (1-%).', v_val, v_sides;
          end if;
        end loop;

        v_subtotal := (v_item->>'subtotal')::integer;

        if v_type = 'sum' then
          -- subtotal deve ser igual à soma dos results
          v_sum := 0;
          for i in 0..(v_qty - 1) loop
            v_sum := v_sum + (v_results->i)::integer;
          end loop;
          if v_subtotal <> v_sum then
            raise exception 'subtotal (%) não corresponde à soma de results (%) para termo sum.', v_subtotal, v_sum;
          end if;

        else
          -- keep_highest: kept deve ser o maior valor de results
          v_kept := (v_item->>'kept')::integer;
          v_max  := 0;
          for i in 0..(v_qty - 1) loop
            v_val := (v_results->i)::integer;
            if v_val > v_max then v_max := v_val; end if;
          end loop;
          if v_kept <> v_max then
            raise exception 'kept (%) não é o maior resultado (%).', v_kept, v_max;
          end if;
          -- subtotal deve ser igual a kept
          if v_subtotal <> v_kept then
            raise exception 'subtotal (%) deve ser igual a kept (%) para tipo keep_highest.', v_subtotal, v_kept;
          end if;
        end if;

        v_calc_total := v_calc_total + v_subtotal;

      elsif v_type = 'modifier' then
        v_mod_val := (v_item->>'value')::integer;
        if v_mod_val < -999 or v_mod_val > 999 then
          raise exception 'Modificador fora do intervalo (-999 a 999): %.', v_mod_val;
        end if;
        v_calc_total := v_calc_total + v_mod_val;
      end if;
    end loop;

    -- roll_breakdown precisa ter pelo menos um termo de dado
    if not v_has_dice_term then
      raise exception 'A rolagem precisa ter pelo menos um termo de dado.';
    end if;

    -- aplica mínimo 1
    if v_calc_total < 1 then
      v_calc_total := 1;
    end if;

    -- total_result deve bater com o calculado
    if new.total_result <> v_calc_total then
      raise exception 'total_result (%) não corresponde ao cálculo do roll_breakdown (%).', new.total_result, v_calc_total;
    end if;

  else
    -- ── Fallback: validação simples para rolagens sem roll_breakdown ──

    -- Validar individual_results quando presentes
    if new.individual_results is not null then
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

      v_arr_len := array_length(new.individual_results, 1);

      if v_arr_len is null or v_arr_len <> new.quantity then
        raise exception 'Número de resultados individuais (%) deve ser igual à quantidade de dados (%).', v_arr_len, new.quantity;
      end if;

      if v_die_max is not null then
        for i in 1..v_arr_len loop
          if new.individual_results[i] < 1 or new.individual_results[i] > v_die_max then
            raise exception 'Resultado individual % fora do intervalo do dado (1-%).', new.individual_results[i], v_die_max;
          end if;
        end loop;
      end if;
    end if;

    -- Sem roll_breakdown: keep_highest exige pelo menos 2 dados
    -- (com roll_breakdown, 1#d3 é permitido — manter o único resultado)
    if new.roll_mode = 'keep_highest' and new.quantity < 2 then
      raise exception 'Para manter o maior resultado, use pelo menos 2 dados.';
    end if;

  end if;

  return new;
end;
$$ language plpgsql set search_path = public;

create trigger validate_dice_roll_before_insert
  before insert on public.dice_rolls
  for each row execute function public.validate_dice_roll_fields();
