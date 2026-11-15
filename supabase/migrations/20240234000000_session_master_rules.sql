-- ────────────────────────────────────────────────────────
-- Sessão aberta, regras do mestre (refina 20240233):
--   • Só o MESTRE abre a sessão. Sem o mestre ativo (batida de presença nos últimos 2 minutos) a sessão nunca está aberta, mesmo com
--     jogadores online ou no horário marcado.
--   • Com o mestre ativo, a sessão abre sozinha de três jeitos ('reason'):
--       'manual'    — o mestre abriu pelo botão (vale até ele encerrar ou 12 horas);
--       'scheduled' — está no horário marcado de uma sessão planejada (15 min antes até horário + duração);
--       'together'  — pelo menos a METADE dos jogadores da campanha está online (arredondando pra cima; 4 jogadores = 2, 3 = 2).
--   • O mestre também pode ENCERRAR: a sessão fica fechada por 6 horas (ou até ele abrir de novo), mesmo que o resto continue valendo.
--     Isso evita que a sessão reabra sozinha logo depois de acabar, com todo mundo ainda online.
--
-- O estado manual fica numa tabela que só as funções abaixo mexem (sem policy: o navegador não escreve nela).
-- ────────────────────────────────────────────────────────

create table if not exists public.campaign_session_override (
  campaign_id uuid        primary key references public.campaigns(id) on delete cascade,
  mode        text        not null check (mode in ('open', 'closed')),
  set_by      uuid        references public.profiles(id) on delete set null,
  set_at      timestamptz not null default now(),
  expires_at  timestamptz not null
);

alter table public.campaign_session_override enable row level security;

-- Por que a sessão está aberta (null = fechada)
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
  -- o mestre ativo é a condição de tudo
  select exists (
    select 1
    from public.campaign_presence p
    join public.campaign_members m on m.campaign_id = p.campaign_id and m.user_id = p.user_id
    where p.campaign_id = p_campaign and m.role = 'master' and p.last_seen_at > now() - interval '2 minutes'
  ) into v_master_online;
  if not v_master_online then
    return null;
  end if;

  -- o mestre encerrou ou abriu à mão
  select o.mode into v_mode
  from public.campaign_session_override o
  where o.campaign_id = p_campaign and o.expires_at > now();
  if v_mode = 'closed' then return null; end if;
  if v_mode = 'open' then return 'manual'; end if;

  -- no horário marcado
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

  -- pelo menos a metade dos jogadores online
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

-- O estado da sessão, pra tela (só membros da campanha)
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

-- O mestre abre, encerra ou volta ao automático. Jogador nenhum chama isto com efeito.
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
