-- ============================================================
-- Vorterium — Sistema Terra Devastada
-- Migration: 20240157000000_terra_devastada.sql
-- Aplicar após: 20240156000000_altherium_runaskin_trail_overrides.sql
-- ============================================================
--
-- 1. Campanhas aceitam o sistema 'terra_devastada'.
-- 2. Ficha própria (td_character_sheets): conceito, descrição,
--    antecedentes, características fixas, condições, trunfos, inventário,
--    Horror (0–12) e Convicção (0–24, começa em 12).
-- 3. Rolagens aceitam o teste de pares do sistema: a parada de d6 conta
--    os PARES (desempenho), e todo 6 rola de novo (Golpe de Sorte). O
--    desempenho pode ser 0, então esse tipo de rolagem aceita total 0.


-- ── 1. Sistema permitido nas campanhas ────────────────────

alter table public.campaigns
  drop constraint if exists campaigns_system_valid;

alter table public.campaigns
  add constraint campaigns_system_valid
    check (system in ('generic', 'dnd5e', 'altherium', 'terra_devastada'));

-- Mesma função de 20240122000000, só com o sistema novo na lista.
create or replace function public.create_campaign(
  campaign_name        text,
  campaign_system      text default 'generic',
  campaign_description text default null
)
returns public.campaigns as $$
declare
  v_campaign public.campaigns;
  v_user_id  uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if trim(campaign_name) = '' then
    raise exception 'O nome da campanha não pode ser vazio.';
  end if;

  if char_length(trim(campaign_name)) > 120 then
    raise exception 'O nome da campanha deve ter no máximo 120 caracteres.';
  end if;

  if campaign_system not in ('generic', 'dnd5e', 'altherium', 'terra_devastada') then
    raise exception 'Sistema inválido: %', campaign_system;
  end if;

  if campaign_description is not null
     and char_length(campaign_description) > 1000 then
    raise exception 'A descrição deve ter no máximo 1000 caracteres.';
  end if;

  insert into public.campaigns (name, system, master_id, description, status)
  values (
    trim(campaign_name),
    campaign_system,
    v_user_id,
    nullif(trim(coalesce(campaign_description, '')), ''),
    'active'
  )
  returning * into v_campaign;

  insert into public.campaign_members (campaign_id, user_id, role)
  values (v_campaign.id, v_user_id, 'master');

  return v_campaign;
end;
$$ language plpgsql security definer set search_path = public;


-- ── 2. Ficha Terra Devastada ──────────────────────────────
--
-- As listas (características, condições, trunfos, inventário) são JSONB:
-- a ficha é salva inteira pelo salvamento automático, e nenhuma delas é
-- consultada item a item. Formatos:
--   traits     [{ "id", "name", "tag": null | "motiva" | "desmotiva" }]
--   conditions [{ "id", "name", "duration": "curta"|"media"|"longa"|"indeterminada" }]
--   trunfos    [{ "id", "name", "description" }]
--   inventory  [{ "id", "name", "qty", "kind": "item"|"arma"|"protecao", "level": 0..3 }]

create table public.td_character_sheets (
  id              uuid        primary key default gen_random_uuid(),
  campaign_id     uuid        not null references public.campaigns(id) on delete cascade,
  user_id         uuid        not null references public.profiles(id) on delete cascade,

  character_name  text        check (char_length(character_name) <= 80),
  concept         text        check (char_length(concept)        <= 160),
  description     text        check (char_length(description)    <= 600),
  background      text        check (char_length(background)     <= 4000),

  traits          jsonb       not null default '[]'::jsonb,
  conditions      jsonb       not null default '[]'::jsonb,
  trunfos         jsonb       not null default '[]'::jsonb,
  inventory       jsonb       not null default '[]'::jsonb,

  -- Horror: 6 no começo (o jogador ajusta pelas motivações); 0 a 12.
  horror          integer     not null default 6  check (horror     between 0 and 12),
  -- Convicção: 12 no começo; a trilha da ficha vai até 24.
  conviction      integer     not null default 12 check (conviction between 0 and 24),

  notes           text        check (char_length(notes) <= 2000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (campaign_id, user_id),

  constraint td_sheets_traits_array     check (jsonb_typeof(traits)     = 'array'),
  constraint td_sheets_conditions_array check (jsonb_typeof(conditions) = 'array'),
  constraint td_sheets_trunfos_array    check (jsonb_typeof(trunfos)    = 'array'),
  constraint td_sheets_inventory_array  check (jsonb_typeof(inventory)  = 'array'),
  constraint td_sheets_traits_size      check (jsonb_array_length(traits)     <= 60),
  constraint td_sheets_conditions_size  check (jsonb_array_length(conditions) <= 40),
  constraint td_sheets_trunfos_size     check (jsonb_array_length(trunfos)    <= 40),
  constraint td_sheets_inventory_size   check (jsonb_array_length(inventory)  <= 120),
  constraint td_sheets_lists_bytes      check (
    pg_column_size(traits) + pg_column_size(conditions)
    + pg_column_size(trunfos) + pg_column_size(inventory) <= 120000
  )
);

create trigger set_td_sheets_updated_at
  before update on public.td_character_sheets
  for each row execute function public.set_updated_at();

create index idx_td_sheets_campaign_id on public.td_character_sheets(campaign_id);
create index idx_td_sheets_user_id     on public.td_character_sheets(user_id);

alter table public.td_character_sheets enable row level security;

create policy "td_sheets: dono ou mestre pode ver"
  on public.td_character_sheets for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_campaign_master(campaign_id, auth.uid())
  );

create policy "td_sheets: membro cria propria ficha"
  on public.td_character_sheets for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_campaign_member(campaign_id, auth.uid())
  );

create policy "td_sheets: dono ou mestre pode atualizar"
  on public.td_character_sheets for update
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_campaign_master(campaign_id, auth.uid())
  )
  with check (
    user_id = auth.uid()
    or public.is_campaign_master(campaign_id, auth.uid())
  );

-- Sem policy de DELETE — ficha não é apagada pelo app.

create or replace function public.prevent_td_sheet_structural_change()
returns trigger as $$
begin
  if new.campaign_id <> old.campaign_id then
    raise exception 'Não é permitido alterar campaign_id de uma ficha após criação.';
  end if;
  if new.user_id <> old.user_id then
    raise exception 'Não é permitido alterar user_id de uma ficha após criação.';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

create trigger enforce_td_sheet_immutable_fields
  before update on public.td_character_sheets
  for each row execute function public.prevent_td_sheet_structural_change();

-- Cards do mestre acompanham Horror/Convicção sem recarregar.
do $$
begin
  alter publication supabase_realtime add table public.td_character_sheets;
exception when others then
  null;
end;
$$;


-- ── 3. Teste de pares nas rolagens ────────────────────────
--
-- Termo novo em roll_breakdown:
--   { "type": "evens", "notation": "3d6", "quantity": 3, "sides": 6,
--     "results": [..um por dado da parada..],
--     "bonus":   [..rolagens extras do Golpe de Sorte, em ordem..],
--     "subtotal": <quantidade de pares> }
-- Cada 6 (nos dados ou nas extras) gera exatamente uma rolagem extra.
-- Pode vir com um "modifier" de 0 a 10 (pontos de desempenho comprados
-- com Convicção). Não se mistura com outros termos de dado.

alter table public.dice_rolls
  drop constraint if exists dice_rolls_result_check;

alter table public.dice_rolls
  drop constraint if exists dice_rolls_roll_mode_valid;

alter table public.dice_rolls
  add constraint dice_rolls_roll_mode_valid
    check (roll_mode in ('sum', 'keep_highest', 'keep_lowest', 'evens'));

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
  v_bonus      jsonb;
  v_kept       integer;
  v_subtotal   integer;
  v_mod_val    integer;
  v_calc_total    integer;
  v_sum           integer;
  v_max           integer;
  v_min           integer;
  v_die_max       integer;
  v_arr_len       integer;
  i               integer;
  v_val           integer;
  v_has_dice_term boolean;
  v_has_evens     boolean;
  v_has_other     boolean;
  v_sixes         integer;
  v_evens         integer;
  v_bonus_len     integer;
begin

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
    v_has_evens     := false;
    v_has_other     := false;

    for v_item in select * from jsonb_array_elements(new.roll_breakdown)
    loop
      v_type := v_item->>'type';

      if v_type is null or v_type not in ('sum', 'keep_highest', 'keep_lowest', 'evens', 'modifier') then
        raise exception 'Tipo inválido em roll_breakdown: %.', coalesce(v_type, 'null');
      end if;

      if v_type = 'evens' then
        -- ── Teste de pares (Terra Devastada) ──
        if v_has_evens or v_has_other then
          raise exception 'O teste de pares não se mistura com outros dados.';
        end if;
        v_has_evens     := true;
        v_has_dice_term := true;
        v_qty      := (v_item->>'quantity')::integer;
        v_sides    := (v_item->>'sides')::integer;
        v_results  := v_item->'results';
        v_bonus    := v_item->'bonus';
        v_subtotal := (v_item->>'subtotal')::integer;

        -- Campo faltando viraria null e passaria pelas comparações.
        if v_qty is null or v_sides is null or v_subtotal is null
           or v_results is null or v_bonus is null then
          raise exception 'Termo de pares incompleto.';
        end if;

        if v_qty < 1 or v_qty > 6 then
          raise exception 'A parada do teste de pares vai de 1 a 6 dados: %.', v_qty;
        end if;
        if v_sides <> 6 then
          raise exception 'O teste de pares usa d6.';
        end if;
        if jsonb_typeof(v_results) <> 'array' or jsonb_array_length(v_results) <> v_qty then
          raise exception 'results deve ter um valor por dado da parada.';
        end if;
        if jsonb_typeof(v_bonus) <> 'array' then
          raise exception 'bonus deve ser um array JSON.';
        end if;
        v_bonus_len := jsonb_array_length(v_bonus);
        if v_bonus_len > 100 then
          raise exception 'Rolagens extras demais no teste de pares.';
        end if;

        v_sixes := 0;
        v_evens := 0;
        for i in 0..(v_qty - 1) loop
          v_val := (v_results->i)::integer;
          if v_val < 1 or v_val > 6 then
            raise exception 'Resultado individual % fora do intervalo do dado (1-6).', v_val;
          end if;
          if v_val = 6 then v_sixes := v_sixes + 1; end if;
          if v_val % 2 = 0 then v_evens := v_evens + 1; end if;
        end loop;
        if v_bonus_len > 0 then
          for i in 0..(v_bonus_len - 1) loop
            v_val := (v_bonus->i)::integer;
            if v_val < 1 or v_val > 6 then
              raise exception 'Resultado extra % fora do intervalo do dado (1-6).', v_val;
            end if;
            if v_val = 6 then v_sixes := v_sixes + 1; end if;
            if v_val % 2 = 0 then v_evens := v_evens + 1; end if;
          end loop;
        end if;

        -- Cada 6 rola de novo exatamente uma vez.
        if v_sixes <> v_bonus_len then
          raise exception 'Cada 6 deve gerar uma rolagem extra (6: %, extras: %).', v_sixes, v_bonus_len;
        end if;

        if v_subtotal <> v_evens then
          raise exception 'subtotal (%) não corresponde aos pares rolados (%).', v_subtotal, v_evens;
        end if;

        v_calc_total := v_calc_total + v_subtotal;

      elsif v_type in ('sum', 'keep_highest', 'keep_lowest') then
        if v_has_evens then
          raise exception 'O teste de pares não se mistura com outros dados.';
        end if;
        v_has_other     := true;
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
          v_sum := 0;
          for i in 0..(v_qty - 1) loop
            v_sum := v_sum + (v_results->i)::integer;
          end loop;
          if v_subtotal <> v_sum then
            raise exception 'subtotal (%) não corresponde à soma de results (%) para termo sum.', v_subtotal, v_sum;
          end if;

        elsif v_type = 'keep_highest' then
          v_kept := (v_item->>'kept')::integer;
          v_max  := 0;
          for i in 0..(v_qty - 1) loop
            v_val := (v_results->i)::integer;
            if v_val > v_max then v_max := v_val; end if;
          end loop;
          if v_kept <> v_max then
            raise exception 'kept (%) não é o maior resultado (%).', v_kept, v_max;
          end if;
          if v_subtotal <> v_kept then
            raise exception 'subtotal (%) deve ser igual a kept (%) para tipo keep_highest.', v_subtotal, v_kept;
          end if;

        else
          v_kept := (v_item->>'kept')::integer;
          v_min  := (v_results->0)::integer;
          for i in 0..(v_qty - 1) loop
            v_val := (v_results->i)::integer;
            if v_val < v_min then v_min := v_val; end if;
          end loop;
          if v_kept <> v_min then
            raise exception 'kept (%) não é o menor resultado (%).', v_kept, v_min;
          end if;
          if v_subtotal <> v_kept then
            raise exception 'subtotal (%) deve ser igual a kept (%) para tipo keep_lowest.', v_subtotal, v_kept;
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

    if v_has_evens then
      -- Teste de pares: desempenho pode ser 0; Convicção soma de 0 a 10.
      for v_item in select * from jsonb_array_elements(new.roll_breakdown)
      loop
        if v_item->>'type' = 'modifier'
           and ((v_item->>'value') is null
                or (v_item->>'value')::integer < 0 or (v_item->>'value')::integer > 10) then
          raise exception 'No teste de pares, a Convicção soma de 0 a 10 pontos.';
        end if;
      end loop;
      if new.roll_mode <> 'evens' then
        raise exception 'Teste de pares deve usar roll_mode evens.';
      end if;
    else
      if new.roll_mode = 'evens' then
        raise exception 'roll_mode evens exige um termo de pares.';
      end if;
      -- aplica mínimo 1
      if v_calc_total < 1 then
        v_calc_total := 1;
      end if;
    end if;

    if v_calc_total is null or new.total_result <> v_calc_total then
      raise exception 'total_result (%) não corresponde ao cálculo do roll_breakdown (%).', new.total_result, v_calc_total;
    end if;

  else
    -- ── Fallback: rolagens sem roll_breakdown ──

    if new.result < 1 then
      raise exception 'Resultado final deve ser pelo menos 1.';
    end if;

    if new.roll_mode = 'evens' then
      raise exception 'Teste de pares precisa de roll_breakdown.';
    end if;

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

    if new.roll_mode in ('keep_highest', 'keep_lowest') and new.quantity < 2 then
      raise exception 'Para manter o maior ou o menor resultado, use pelo menos 2 dados.';
    end if;

  end if;

  -- Só o teste de pares pode dar 0; nada fica negativo.
  if new.result < 0 then
    raise exception 'Resultado final não pode ser negativo.';
  end if;
  if new.result = 0 and new.roll_mode <> 'evens' then
    raise exception 'Resultado final deve ser pelo menos 1.';
  end if;

  return new;
end;
$$ language plpgsql set search_path = public;

create trigger validate_dice_roll_before_insert
  before insert on public.dice_rolls
  for each row execute function public.validate_dice_roll_fields();
