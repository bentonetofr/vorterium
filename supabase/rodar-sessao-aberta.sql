-- ────────────────────────────────────────────────────────
-- SESSÃO ABERTA, TUDO DE UMA VEZ (junta as migrations 20240233, 20240234 e 20240235).
-- Cole no SQL Editor do Supabase e rode uma vez. Pode rodar de novo sem estragar nada.
-- ────────────────────────────────────────────────────────

-- 1. Horário e duração da sessão planejada; a rolagem guarda se a sessão estava aberta
alter table public.campaign_sessions
  add column if not exists session_time time,
  add column if not exists duration_min integer not null default 240;

alter table public.campaign_sessions drop constraint if exists campaign_sessions_duration_check;
alter table public.campaign_sessions
  add constraint campaign_sessions_duration_check check (duration_min between 30 and 1440);

alter table public.dice_rolls
  add column if not exists session_open boolean not null default false;

-- 2. O que o mestre decidiu à mão (abrir ou encerrar)
create table if not exists public.campaign_session_override (
  campaign_id uuid        primary key references public.campaigns(id) on delete cascade,
  mode        text        not null check (mode in ('open', 'closed')),
  set_by      uuid        references public.profiles(id) on delete set null,
  set_at      timestamptz not null default now(),
  expires_at  timestamptz not null
);

alter table public.campaign_session_override enable row level security;

-- 3. Por que a sessão está aberta (null = fechada)
create or replace function public._campaign_session_reason(p_campaign uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mode           text;
  v_master_online  boolean;
  v_players_total  integer;
  v_players_online integer;
begin
  select exists (
    select 1
    from public.campaign_presence p
    join public.campaign_members m on m.campaign_id = p.campaign_id and m.user_id = p.user_id
    where p.campaign_id = p_campaign and m.role = 'master' and p.last_seen_at > now() - interval '2 minutes'
  ) into v_master_online;
  if not v_master_online then
    return null;
  end if;

  select o.mode into v_mode
  from public.campaign_session_override o
  where o.campaign_id = p_campaign and o.expires_at > now();
  if v_mode = 'closed' then return null; end if;
  if v_mode = 'open' then return 'manual'; end if;

  if exists (
    select 1
    from public.campaign_sessions s
    where s.campaign_id = p_campaign
      and s.status = 'planned'
      and s.session_date is not null
      and s.session_time is not null
      and now() >= ((s.session_date + s.session_time) at time zone 'America/Sao_Paulo') - interval '15 minutes'
      and now() <= ((s.session_date + s.session_time) at time zone 'America/Sao_Paulo') + make_interval(mins => s.duration_min)
  ) then
    return 'scheduled';
  end if;

  select count(*) into v_players_total
  from public.campaign_members m
  where m.campaign_id = p_campaign and m.role = 'player';

  select count(*) into v_players_online
  from public.campaign_presence p
  join public.campaign_members m on m.campaign_id = p.campaign_id and m.user_id = p.user_id
  where p.campaign_id = p_campaign and m.role = 'player' and p.last_seen_at > now() - interval '2 minutes';

  if v_players_total > 0 and v_players_online >= 1 and v_players_online * 2 >= v_players_total then
    return 'together';
  end if;
  return null;
end;
$$;

revoke all on function public._campaign_session_reason(uuid) from public;

-- 4. O estado da sessão, pra tela (só membros da campanha)
create or replace function public.campaign_session_status(campaign_id_input uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_reason         text;
  v_next           timestamptz;
  v_override       text;
  v_master_online  boolean;
  v_players_total  integer;
  v_players_online integer;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;
  if not public.is_campaign_member(campaign_id_input, auth.uid()) then
    raise exception 'Apenas membros da campanha podem ver o estado da sessão.';
  end if;

  v_reason := public._campaign_session_reason(campaign_id_input);

  select min((s.session_date + s.session_time) at time zone 'America/Sao_Paulo') into v_next
  from public.campaign_sessions s
  where s.campaign_id = campaign_id_input
    and s.status = 'planned'
    and s.session_date is not null
    and s.session_time is not null
    and ((s.session_date + s.session_time) at time zone 'America/Sao_Paulo') - interval '15 minutes' > now();

  select o.mode into v_override
  from public.campaign_session_override o
  where o.campaign_id = campaign_id_input and o.expires_at > now();

  select exists (
    select 1
    from public.campaign_presence p
    join public.campaign_members m on m.campaign_id = p.campaign_id and m.user_id = p.user_id
    where p.campaign_id = campaign_id_input and m.role = 'master' and p.last_seen_at > now() - interval '2 minutes'
  ) into v_master_online;

  select count(*) into v_players_total
  from public.campaign_members m where m.campaign_id = campaign_id_input and m.role = 'player';

  select count(*) into v_players_online
  from public.campaign_presence p
  join public.campaign_members m on m.campaign_id = p.campaign_id and m.user_id = p.user_id
  where p.campaign_id = campaign_id_input and m.role = 'player' and p.last_seen_at > now() - interval '2 minutes';

  return jsonb_build_object(
    'open', v_reason is not null, 'reason', v_reason, 'next_at', v_next, 'override', v_override,
    'master_online', v_master_online, 'players_online', v_players_online, 'players_total', v_players_total
  );
end;
$$;

grant execute on function public.campaign_session_status(uuid) to authenticated;

-- 5. O mestre abre, encerra ou volta ao automático
create or replace function public.set_campaign_session(campaign_id_input uuid, action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;
  if not public.is_campaign_master(campaign_id_input, auth.uid()) then
    raise exception 'Só o mestre da campanha abre ou encerra a sessão.';
  end if;

  if action = 'open' then
    insert into public.campaign_session_override (campaign_id, mode, set_by, set_at, expires_at)
    values (campaign_id_input, 'open', auth.uid(), now(), now() + interval '12 hours')
    on conflict (campaign_id) do update
      set mode = 'open', set_by = auth.uid(), set_at = now(), expires_at = now() + interval '12 hours';
  elsif action = 'close' then
    insert into public.campaign_session_override (campaign_id, mode, set_by, set_at, expires_at)
    values (campaign_id_input, 'closed', auth.uid(), now(), now() + interval '6 hours')
    on conflict (campaign_id) do update
      set mode = 'closed', set_by = auth.uid(), set_at = now(), expires_at = now() + interval '6 hours';
  elsif action = 'auto' then
    delete from public.campaign_session_override where campaign_id = campaign_id_input;
  else
    raise exception 'Ação inválida (use open, close ou auto).';
  end if;
end;
$$;

grant execute on function public.set_campaign_session(uuid, text) to authenticated;

-- 6. O banco carimba cada rolagem nova com session_open
create or replace function public.set_roll_session_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.session_open := public._campaign_session_reason(new.campaign_id) is not null;
  return new;
end;
$$;

drop trigger if exists trg_dice_rolls_session_open on public.dice_rolls;
create trigger trg_dice_rolls_session_open
  before insert on public.dice_rolls
  for each row execute function public.set_roll_session_open();

-- 7. O aviso de sessão aberta, em qualquer página do site
create or replace function public.my_open_sessions()
returns table (campaign_id uuid, campaign_name text, role text, reason text)
language sql
stable
security definer
set search_path = public
as $$
  select t.campaign_id, t.campaign_name, t.role, t.reason
  from (
    select c.id as campaign_id, c.name as campaign_name, m.role::text as role, public._campaign_session_reason(c.id) as reason
    from public.campaign_members m
    join public.campaigns c on c.id = m.campaign_id
    where m.user_id = auth.uid()
  ) t
  where t.reason is not null;
$$;

revoke all on function public.my_open_sessions() from public;
grant execute on function public.my_open_sessions() to authenticated;
