-- ────────────────────────────────────────────────────────
-- Sessão aberta: antes de fechar, pergunta ao mestre se a sessão acabou (refina 20240233 a 20240235).
--
-- Quando a sessão estava aberta e o motivo some (os jogadores foram saindo, e a mesa deixa de estar reunida), ela NÃO fecha de uma vez:
-- fica no estado 'ending' por até 10 minutos, ainda aberta, esperando a resposta do mestre. Nesse estado o mestre recebe a pergunta
-- "a sessão acabou?" ('leaving'). O mesmo vale quando chega o horário de término de uma sessão marcada e a mesa continua reunida ('schedule').
--   • "Sim, acabou": a sessão fecha (o mestre encerra, como o botão Encerrar sessão: fechada por 6 horas).
--   • "Não, continua": a sessão fica aberta por mais 30 minutos e a pergunta só volta depois disso.
--   • Sem resposta: o 'ending' passa dos 10 minutos e a sessão fecha sozinha.
-- A memória de "esteve aberta há pouco" fica em campaign_session_live (só estas funções escrevem nela).
-- ────────────────────────────────────────────────────────

create table if not exists public.campaign_session_live (
  campaign_id  uuid        primary key references public.campaigns(id) on delete cascade,
  last_open_at timestamptz,
  snooze_until timestamptz
);

alter table public.campaign_session_live enable row level security;

-- Por que a sessão está aberta (null = fechada); 'ending' = esteve aberta há pouco e espera o mestre dizer se acabou
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

  -- sem motivo agora, mas estava aberta há pouco: espera a resposta do mestre (até 10 minutos)
  if exists (
    select 1 from public.campaign_session_live l
    where l.campaign_id = p_campaign and l.last_open_at > now() - interval '10 minutes'
  ) then
    return 'ending';
  end if;
  return null;
end;
$$;

revoke all on function public._campaign_session_reason(uuid) from public;

-- Hora de perguntar ao mestre se a sessão acabou? 'leaving' (os jogadores saíram), 'schedule' (chegou o horário de término) ou null
create or replace function public._campaign_session_ask(p_campaign uuid, p_reason text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_snooze timestamptz;
  v_last   timestamptz;
begin
  if p_reason is null then return null; end if;

  select l.snooze_until, l.last_open_at into v_snooze, v_last
  from public.campaign_session_live l where l.campaign_id = p_campaign;

  -- o mestre disse "continua": só pergunta de novo depois do prazo
  if v_snooze is not null and v_snooze > now() then return null; end if;

  if p_reason = 'ending' then return 'leaving'; end if;

  -- passou do horário de término de uma sessão marcada (nas últimas 3 horas) em que a mesa esteve aberta, e a mesa continua
  if p_reason in ('together', 'manual') and v_last is not null and exists (
    select 1
    from public.campaign_sessions s
    where s.campaign_id = p_campaign
      and s.status = 'planned'
      and s.session_date is not null
      and s.session_time is not null
      and ((s.session_date + s.session_time) at time zone 'America/Sao_Paulo') + make_interval(mins => s.duration_min) <= now()
      and ((s.session_date + s.session_time) at time zone 'America/Sao_Paulo') + make_interval(mins => s.duration_min) > now() - interval '3 hours'
      and v_last >= ((s.session_date + s.session_time) at time zone 'America/Sao_Paulo')
  ) then
    return 'schedule';
  end if;
  return null;
end;
$$;

revoke all on function public._campaign_session_ask(uuid, text) from public;

-- O estado da sessão, pra tela (só membros da campanha). Também anota que a sessão esteve aberta agora.
create or replace function public.campaign_session_status(campaign_id_input uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason         text;
  v_ask            text;
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

  -- aberta de verdade (não 'ending'): lembra o instante, no máximo uma gravação a cada 30 segundos
  if v_reason in ('manual', 'scheduled', 'together') then
    insert into public.campaign_session_live (campaign_id, last_open_at)
    values (campaign_id_input, now())
    on conflict (campaign_id) do update set last_open_at = now()
      where public.campaign_session_live.last_open_at is null or public.campaign_session_live.last_open_at < now() - interval '30 seconds';
  end if;

  v_ask := public._campaign_session_ask(campaign_id_input, v_reason);

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
    'open', v_reason is not null, 'reason', v_reason, 'next_at', v_next, 'override', v_override, 'ask_end', v_ask,
    'master_online', v_master_online, 'players_online', v_players_online, 'players_total', v_players_total
  );
end;
$$;

grant execute on function public.campaign_session_status(uuid) to authenticated;

-- O mestre abre, encerra, continua ou volta ao automático. Jogador nenhum chama isto com efeito.
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
    update public.campaign_session_live set snooze_until = null where campaign_id = campaign_id_input;
  elsif action = 'continue' then
    -- "não acabou": segue aberta por mais 30 minutos, e a pergunta só volta depois disso
    insert into public.campaign_session_override (campaign_id, mode, set_by, set_at, expires_at)
    values (campaign_id_input, 'open', auth.uid(), now(), now() + interval '30 minutes')
    on conflict (campaign_id) do update
      set mode = 'open', set_by = auth.uid(), set_at = now(), expires_at = now() + interval '30 minutes';
    insert into public.campaign_session_live (campaign_id, last_open_at, snooze_until)
    values (campaign_id_input, now(), now() + interval '30 minutes')
    on conflict (campaign_id) do update set last_open_at = now(), snooze_until = now() + interval '30 minutes';
  elsif action = 'auto' then
    delete from public.campaign_session_override where campaign_id = campaign_id_input;
  else
    raise exception 'Ação inválida (use open, close, continue ou auto).';
  end if;
end;
$$;

grant execute on function public.set_campaign_session(uuid, text) to authenticated;
