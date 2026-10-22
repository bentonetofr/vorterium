-- ============================================================
-- Vorterium — Dados 3D do D&D (etapa 2): rótulo, contexto e conjunto das
-- rolagens, conjunto de dados de cada pessoa e pedido de teste do mestre.
-- Migration: 20240210000000_dados_3d_dnd.sql
-- Aplicar após: 20240209000000_site_feature_access.sql
-- Plano: docs/superpowers/specs/2026-10-22-dados-3d-dnd-design.md
-- ============================================================


-- ── 1. dice_rolls: rótulo, contexto, conjunto e piso opcional ──
--
-- roll_label   "Furtividade", "Dano: Espada longa"... (o chat e o rolador mostram)
-- roll_context o que a ficha sabia ao rolar: tipo, CD, vantagem, reações,
--              natural do d20, sucesso/falha, pedido do mestre, rolagem refeita
-- dice_skin    conjunto visual dos dados, para a mesa ver na cor de quem rolou
-- no_floor     o total pode ficar abaixo de 1 (teste do D&D: 1 no d20 com −2 dá −1);
--              só em campanha de D&D. Sem isso, continua o mínimo de 1.

alter table public.dice_rolls
  add column if not exists roll_label   text,
  add column if not exists roll_context jsonb,
  add column if not exists dice_skin    text,
  add column if not exists no_floor     boolean not null default false;

alter table public.dice_rolls drop constraint if exists dice_rolls_roll_label_length;
alter table public.dice_rolls add constraint dice_rolls_roll_label_length
  check (roll_label is null or (length(btrim(roll_label)) between 1 and 120));

alter table public.dice_rolls drop constraint if exists dice_rolls_roll_context_shape;
alter table public.dice_rolls add constraint dice_rolls_roll_context_shape
  check (roll_context is null or (jsonb_typeof(roll_context) = 'object' and pg_column_size(roll_context) <= 4096));

alter table public.dice_rolls drop constraint if exists dice_rolls_dice_skin_valid;
alter table public.dice_rolls add constraint dice_rolls_dice_skin_valid
  check (dice_skin is null or dice_skin ~ '^[a-z0-9_-]{1,32}$');


-- ── 2. Validação: mesma de 20240157, com o piso opcional ──────

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

  -- Sem piso só em campanha de D&D.
  if new.no_floor and not exists (select 1 from public.campaigns where id = new.campaign_id and system = 'dnd5e') then
    raise exception 'Rolagem sem mínimo de 1 só vale em campanha de D&D.';
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

        if v_qty < 1 or v_qty > 100 then
          raise exception 'Quantidade de dados fora do intervalo (1-100): %.', v_qty;
        end if;
        if v_sides < 2 or v_sides > 1000 then
          raise exception 'Número de lados fora do intervalo (2-1000): %.', v_sides;
        end if;

        if jsonb_typeof(v_results) <> 'array' then
          raise exception 'results deve ser um array JSON em roll_breakdown.';
        end if;
        if jsonb_array_length(v_results) <> v_qty then
          raise exception 'Tamanho de results (%) deve ser igual à quantity (%).', jsonb_array_length(v_results), v_qty;
        end if;

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

    if not v_has_dice_term then
      raise exception 'A rolagem precisa ter pelo menos um termo de dado.';
    end if;

    if v_has_evens then
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
      -- mínimo 1, menos quando a rolagem pede sem piso (D&D)
      if v_calc_total < 1 and not new.no_floor then
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

  return new;
end;
$$ language plpgsql set search_path = public;

create trigger validate_dice_roll_before_insert
  before insert on public.dice_rolls
  for each row execute function public.validate_dice_roll_fields();


-- ── 3. Conjunto de dados de cada pessoa ───────────────────

alter table public.profiles
  add column if not exists dice_skin text;

alter table public.profiles drop constraint if exists profiles_dice_skin_valid;
alter table public.profiles add constraint profiles_dice_skin_valid
  check (dice_skin is null or dice_skin ~ '^[a-z0-9_-]{1,32}$');


-- ── 4. Pedido de teste do mestre ──────────────────────────
--
-- O mestre pede um teste (perícia, salvaguarda, atributo...) a um ou mais
-- jogadores, com CD. Com a CD oculta, ela fica só em dnd_check_request_dc
-- (que só o mestre lê) e o jogador a recebe por dnd_check_reveal() depois
-- de rolar. A resposta é a própria rolagem, com o id do pedido em
-- roll_context.request_id.

create table if not exists public.dnd_check_requests (
  id          uuid         primary key default gen_random_uuid(),
  campaign_id uuid         not null references public.campaigns(id) on delete cascade,
  master_id   uuid         not null default auth.uid() references public.profiles(id) on delete cascade,
  targets     uuid[]       not null,
  kind        text         not null,
  check_key   text,
  label       text         not null,
  dc          integer,
  dc_hidden   boolean      not null default false,
  advantage   text         not null default 'normal',
  status      text         not null default 'open',
  created_at  timestamptz  not null default now(),
  closed_at   timestamptz,
  constraint dnd_check_requests_targets check (cardinality(targets) between 1 and 20),
  constraint dnd_check_requests_kind check (kind in ('skill', 'save', 'ability', 'attack', 'initiative', 'death', 'custom')),
  constraint dnd_check_requests_key check (check_key is null or check_key ~ '^[a-z_]{1,32}$'),
  constraint dnd_check_requests_label check (length(btrim(label)) between 1 and 80),
  constraint dnd_check_requests_dc check (dc is null or dc between 1 and 40),
  -- CD oculta não fica nesta tabela (o jogador lê esta linha)
  constraint dnd_check_requests_hidden_dc check (not dc_hidden or dc is null),
  constraint dnd_check_requests_advantage check (advantage in ('normal', 'advantage', 'disadvantage')),
  constraint dnd_check_requests_status check (status in ('open', 'closed'))
);

create index if not exists idx_dnd_check_requests_campaign on public.dnd_check_requests(campaign_id, created_at desc);

create table if not exists public.dnd_check_request_dc (
  request_id uuid    primary key references public.dnd_check_requests(id) on delete cascade,
  dc         integer not null check (dc between 1 and 40)
);

alter table public.dnd_check_requests   enable row level security;
alter table public.dnd_check_request_dc enable row level security;

-- Pedido: só em campanha de D&D, criado pelo mestre para membros da campanha.
create or replace function public.dnd_check_request_guard()
returns trigger as $$
declare v_target uuid;
begin
  if not exists (select 1 from public.campaigns where id = new.campaign_id and system = 'dnd5e') then
    raise exception 'Pedido de teste só em campanha de D&D.';
  end if;
  if tg_op = 'UPDATE' then
    if new.campaign_id <> old.campaign_id or new.master_id <> old.master_id or new.targets <> old.targets
       or new.kind <> old.kind or new.check_key is distinct from old.check_key or new.label <> old.label
       or new.dc is distinct from old.dc or new.dc_hidden <> old.dc_hidden or new.advantage <> old.advantage
       or new.created_at <> old.created_at then
      raise exception 'Do pedido de teste só muda a situação.';
    end if;
    if new.status = 'closed' and old.status = 'open' then new.closed_at := now(); end if;
    return new;
  end if;
  foreach v_target in array new.targets loop
    if not public.is_campaign_member(new.campaign_id, v_target) then
      raise exception 'Todo jogador do pedido precisa ser da campanha.';
    end if;
  end loop;
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists dnd_check_request_guard on public.dnd_check_requests;
create trigger dnd_check_request_guard
  before insert or update on public.dnd_check_requests
  for each row execute function public.dnd_check_request_guard();

drop policy if exists "dnd_check_requests: mestre e alvos veem" on public.dnd_check_requests;
create policy "dnd_check_requests: mestre e alvos veem" on public.dnd_check_requests
  for select to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()) or auth.uid() = any(targets));

drop policy if exists "dnd_check_requests: mestre cria" on public.dnd_check_requests;
create policy "dnd_check_requests: mestre cria" on public.dnd_check_requests
  for insert to authenticated
  with check (master_id = auth.uid() and public.is_campaign_master(campaign_id, auth.uid()));

drop policy if exists "dnd_check_requests: mestre fecha" on public.dnd_check_requests;
create policy "dnd_check_requests: mestre fecha" on public.dnd_check_requests
  for update to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()))
  with check (public.is_campaign_master(campaign_id, auth.uid()));

drop policy if exists "dnd_check_requests: mestre apaga" on public.dnd_check_requests;
create policy "dnd_check_requests: mestre apaga" on public.dnd_check_requests
  for delete to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()));

drop policy if exists "dnd_check_request_dc: so o mestre" on public.dnd_check_request_dc;
create policy "dnd_check_request_dc: so o mestre" on public.dnd_check_request_dc
  for all to authenticated
  using (exists (select 1 from public.dnd_check_requests r where r.id = request_id and public.is_campaign_master(r.campaign_id, auth.uid())))
  with check (exists (select 1 from public.dnd_check_requests r where r.id = request_id and r.dc_hidden and public.is_campaign_master(r.campaign_id, auth.uid())));

-- Guardado junto com o D&D.
drop policy if exists "dnd: so quando liberado" on public.dnd_check_requests;
create policy "dnd: so quando liberado" on public.dnd_check_requests
  as restrictive for all to authenticated using (public.dnd_open()) with check (public.dnd_open());
drop policy if exists "dnd: so quando liberado" on public.dnd_check_request_dc;
create policy "dnd: so quando liberado" on public.dnd_check_request_dc
  as restrictive for all to authenticated using (public.dnd_open()) with check (public.dnd_open());

grant select, insert, update, delete on public.dnd_check_requests   to authenticated;
grant select, insert, update, delete on public.dnd_check_request_dc to authenticated;

-- A CD de um pedido: aberta para todos os alvos; oculta, só para o mestre ou
-- para quem já respondeu (rolou com o id do pedido).
create or replace function public.dnd_check_reveal(p_request uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not r.dc_hidden then r.dc
    when public.is_campaign_master(r.campaign_id, auth.uid())
      or exists (select 1 from public.dice_rolls d
                 where d.campaign_id = r.campaign_id and d.user_id = auth.uid()
                   and d.roll_context->>'request_id' = r.id::text)
      then (select dc from public.dnd_check_request_dc where request_id = r.id)
    else null
  end
  from public.dnd_check_requests r
  where r.id = p_request
    and public.dnd_open()
    and (public.is_campaign_master(r.campaign_id, auth.uid()) or auth.uid() = any(r.targets));
$$;
revoke all on function public.dnd_check_reveal(uuid) from public, anon;
grant execute on function public.dnd_check_reveal(uuid) to authenticated;

-- Realtime: o painel abre na tela do jogador quando o mestre pede.
do $$
begin
  alter publication supabase_realtime add table public.dnd_check_requests;
exception when others then
  null;
end;
$$;
