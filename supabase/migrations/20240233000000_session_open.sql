-- ────────────────────────────────────────────────────────
-- Sessão aberta: o site reconhece sozinho quando a mesa está em sessão.
--
-- A sessão está ABERTA (por campanha) quando vale uma destas duas:
--   • 'scheduled': existe uma sessão planejada com data E horário, e agora está entre 15 minutos antes do horário e o fim (horário + duração,
--     4 horas se ninguém mudar). O horário vale em Brasília.
--   • 'together': o mestre e pelo menos um jogador estão online na campanha ao mesmo tempo (batida de presença nos últimos 2 minutos).
--
-- Cada rolagem nasce com `session_open` (true se a sessão estava aberta no instante em que foi gravada). Quem decide é o banco, num
-- gatilho: o que o navegador mandar nessa coluna é ignorado, e ninguém consegue alterar depois (a tabela só tem política de ver e de
-- inserir). As conquistas e os conjuntos de dados só contam rolagens com session_open = true. As rolagens de antes desta migration
-- ficam false e não contam.
-- ────────────────────────────────────────────────────────

-- ── 1. Horário e duração da sessão planejada ──
alter table public.campaign_sessions
  add column if not exists session_time time,
  add column if not exists duration_min integer not null default 240;

alter table public.campaign_sessions drop constraint if exists campaign_sessions_duration_check;
alter table public.campaign_sessions
  add constraint campaign_sessions_duration_check check (duration_min between 30 and 1440);

-- ── 2. A rolagem guarda se a sessão estava aberta ──
alter table public.dice_rolls
  add column if not exists session_open boolean not null default false;

-- ── 3. Por que a sessão está aberta (null = fechada) ──
create or replace function public._campaign_session_reason(p_campaign uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1
      from public.campaign_sessions s
      where s.campaign_id = p_campaign
        and s.status = 'planned'
        and s.session_date is not null
        and s.session_time is not null
        and now() >= ((s.session_date + s.session_time) at time zone 'America/Sao_Paulo') - interval '15 minutes'
        and now() <= ((s.session_date + s.session_time) at time zone 'America/Sao_Paulo') + make_interval(mins => s.duration_min)
    ) then 'scheduled'
    when exists (
      select 1
      from public.campaign_presence p
      join public.campaign_members m on m.campaign_id = p.campaign_id and m.user_id = p.user_id
      where p.campaign_id = p_campaign and m.role = 'master' and p.last_seen_at > now() - interval '2 minutes'
    ) and exists (
      select 1
      from public.campaign_presence p
      join public.campaign_members m on m.campaign_id = p.campaign_id and m.user_id = p.user_id
      where p.campaign_id = p_campaign and m.role = 'player' and p.last_seen_at > now() - interval '2 minutes'
    ) then 'together'
    else null
  end;
$$;

revoke all on function public._campaign_session_reason(uuid) from public;

-- ── 4. O estado da sessão, pra tela (só membros da campanha) ──
create or replace function public.campaign_session_status(campaign_id_input uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_reason text;
  v_next   timestamptz;
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

  return jsonb_build_object('open', v_reason is not null, 'reason', v_reason, 'next_at', v_next);
end;
$$;

grant execute on function public.campaign_session_status(uuid) to authenticated;

-- ── 5. O banco carimba cada rolagem nova ──
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
