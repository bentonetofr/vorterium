-- ════════════════════════════════════════════════════════
-- O Crime de Caatedrum — jogo de tabuleiro de dedução para 4 jogadores,
-- em tempo real, dentro da campanha (aba Caatedrum da Sessão). Mesma
-- mecânica do jogo físico de referência; conteúdo próprio.
--
-- O BANCO MANDA: o estado completo (caat_state: baralho, mãos, ofertas,
-- solução) ninguém lê pelo site. Cada pessoa pede a SUA visão
-- (caat_view): a própria mão, o que é público e mais nada.
-- O conteúdo (regras, textos, caso) vem de caat_content() — migration
-- 20240178, gerada de jogos/caatedrum/ por scripts/caatedrum-conteudo.mjs.
--
-- Tempo real: cada mudança sobe caat_rooms.version; o site escuta a linha
-- da sala e pede a visão de novo.
-- Liberado pelo Painel de controle (recurso "caatedrum").
--
-- Marco 1: salas, lobby (assentos, apelido, nível, consentimento),
-- pausa, Mestre (pausar, retomar, tirar da mesa, começar, encerrar).
-- Teste do dono do site: ele pode sentar mesmo sendo o mestre e chamar
-- robôs pros lugares vazios (uid "bot-N"; aceitam o aviso sozinhos).
-- ════════════════════════════════════════════════════════

-- ── 1. Tabelas ──────────────────────────────────────────

create table if not exists public.caat_rooms (
  id           uuid         primary key default gen_random_uuid(),
  campaign_id  uuid         not null references public.campaigns(id) on delete cascade,
  status       text         not null default 'lobby' check (status in ('lobby', 'jogo', 'fim')),
  paused       boolean      not null default false,
  version      bigint       not null default 0,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);
-- Uma mesa aberta por campanha.
create unique index if not exists caat_rooms_one_open on public.caat_rooms (campaign_id) where status <> 'fim';

create table if not exists public.caat_state (
  room_id  uuid   primary key references public.caat_rooms(id) on delete cascade,
  state    jsonb  not null
);

alter table public.caat_rooms enable row level security;
alter table public.caat_state enable row level security;

drop policy if exists "caat_rooms: membros veem" on public.caat_rooms;
create policy "caat_rooms: membros veem" on public.caat_rooms
  for select to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()));

grant select on public.caat_rooms to authenticated;
-- caat_state: sem policy e sem grant — só as funções abaixo.
revoke all on public.caat_state from anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'caat_rooms') then
    alter publication supabase_realtime add table public.caat_rooms;
  end if;
end $$;

-- ── 2. Ajudantes ────────────────────────────────────────

create or replace function public.caat__ms()
returns bigint language sql stable as $$ select (extract(epoch from now()) * 1000)::bigint $$;

-- Linha do tempo (o Mestre vê; as últimas 300).
create or replace function public.caat__log(s jsonb, p_msg text)
returns jsonb language plpgsql stable as $$
declare ev jsonb;
begin
  ev := coalesce(s->'events', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('t', public.caat__ms(), 'm', p_msg));
  if jsonb_array_length(ev) > 300 then ev := ev - 0; end if;
  return jsonb_set(s, '{events}', ev);
end $$;

create or replace function public.caat__name(p_uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(display_name), ''), 'Jogador') from public.profiles where id = p_uid
$$;

-- Como a pessoa aparece na mesa: o apelido, se tiver.
create or replace function public.caat__who(s jsonb, p_uid text)
returns text language sql immutable as $$
  select coalesce(nullif(s->'players'->p_uid->>'nick', ''), s->'players'->p_uid->>'name', 'Alguém')
$$;

-- Prazos do jogo (em ms) andam junto quando o jogo volta da pausa.
create or replace function public.caat__shift(s jsonb, p_delta bigint)
returns jsonb language plpgsql immutable as $$
begin
  if jsonb_typeof(s->'deadline') = 'number' then
    s := jsonb_set(s, '{deadline}', to_jsonb((s->>'deadline')::bigint + p_delta));
  end if;
  return s;
end $$;

create or replace function public.caat__save(p_room uuid, s jsonb)
returns void language sql as $$
  update public.caat_state set state = s where room_id = p_room;
  update public.caat_rooms set version = version + 1, updated_at = now() where id = p_room;
$$;

-- ── 3. Abrir a mesa (mestre da campanha) ────────────────

create or replace function public.caat_open(p_campaign uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
  s jsonb;
  c jsonb := public.caat_content();
begin
  if not public.is_campaign_master(p_campaign, auth.uid()) then
    raise exception 'Só o mestre da campanha põe a mesa.';
  end if;
  if not exists (select 1 from public.site_features where key = 'caatedrum' and enabled) and not public.is_site_owner() then
    raise exception 'Caatedrum ainda não foi liberado.';
  end if;
  select id into rid from public.caat_rooms where campaign_id = p_campaign and status <> 'fim';
  if rid is not null then return rid; end if;

  insert into public.caat_rooms (campaign_id) values (p_campaign) returning id into rid;
  s := jsonb_build_object(
    'caso', 'caso1',
    'seed', floor(random() * 1000000000)::bigint,
    'config', c->'regras',
    'seats', jsonb_build_array(null, null, null, null),
    'players', '{}'::jsonb,
    'phase', 'lobby',
    'round', 0,
    'start_seat', null,
    'deadline', null,
    'paused_by', null,
    'paused_at', null,
    'events', '[]'::jsonb);
  s := public.caat__log(s, 'a mesa foi posta');
  insert into public.caat_state (room_id, state) values (rid, s);
  return rid;
end $$;

-- ── 4. Lobby (jogadores da campanha) ────────────────────

create or replace function public.caat_lobby(p_room uuid, p_action jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.caat_rooms;
  s jsonb;
  me text := auth.uid()::text;
  a text := p_action->>'a';
  i int;
  seat int;
  n int;
begin
  select * into r from public.caat_rooms where id = p_room for update;
  if r.id is null then raise exception 'Mesa não encontrada.'; end if;
  if r.status = 'fim' then raise exception 'Esta mesa já foi encerrada.'; end if;
  if not exists (select 1 from public.campaign_members where campaign_id = r.campaign_id and user_id = auth.uid() and role = 'player')
     and not (public.is_site_owner() and public.is_campaign_member(r.campaign_id, auth.uid())) then
    raise exception 'Só os jogadores da campanha sentam à mesa.';
  end if;
  if r.paused then raise exception 'O jogo está pausado.'; end if;
  select state into s from public.caat_state where room_id = p_room for update;

  if a = 'join' then
    if s->'players' ? me then return; end if;
    if r.status <> 'lobby' then raise exception 'A partida já começou.'; end if;
    seat := null;
    for i in 0..3 loop
      if jsonb_typeof(s->'seats'->i) = 'null' then seat := i; exit; end if;
    end loop;
    if seat is null then raise exception 'A mesa já está cheia (4 jogadores).'; end if;
    s := jsonb_set(s, array['seats', seat::text], to_jsonb(me));
    s := jsonb_set(s, array['players', me], jsonb_build_object(
      'name', public.caat__name(auth.uid()), 'nick', '', 'consent', false, 'level', 1, 'seat', seat));
    s := public.caat__log(s, format('%s sentou à mesa', public.caat__name(auth.uid())));
  elsif not (s->'players' ? me) then
    raise exception 'Sente à mesa primeiro.';
  elsif a = 'leave' then
    if r.status <> 'lobby' then raise exception 'A partida já começou.'; end if;
    s := jsonb_set(s, array['seats', s->'players'->me->>'seat'], 'null');
    s := public.caat__log(s, format('%s levantou da mesa', public.caat__who(s, me)));
    s := jsonb_set(s, '{players}', (s->'players') - me);
  elsif a = 'seat' then
    if r.status <> 'lobby' then raise exception 'A partida já começou.'; end if;
    seat := (p_action->>'seat')::int;
    if seat is null or seat < 0 or seat > 3 then raise exception 'Assento inválido.'; end if;
    if (s->'players'->me->>'seat')::int = seat then return; end if;
    if jsonb_typeof(s->'seats'->seat) <> 'null' then raise exception 'Esse lugar já está ocupado.'; end if;
    s := jsonb_set(s, array['seats', s->'players'->me->>'seat'], 'null');
    s := jsonb_set(s, array['seats', seat::text], to_jsonb(me));
    s := jsonb_set(s, array['players', me, 'seat'], to_jsonb(seat));
  elsif a = 'consent' then
    s := jsonb_set(s, array['players', me, 'consent'], 'true');
  elsif a = 'nick' then
    s := jsonb_set(s, array['players', me, 'nick'], to_jsonb(left(trim(coalesce(p_action->>'text', '')), 24)));
  elsif a = 'level' then
    if r.status <> 'lobby' then raise exception 'O nível é escolhido antes de começar.'; end if;
    n := (p_action->>'level')::int;
    if n is null or n < 1 or n > 5 then raise exception 'Nível vai de 1 a 5.'; end if;
    s := jsonb_set(s, array['players', me, 'level'], to_jsonb(n));
  else
    raise exception 'Ação desconhecida.';
  end if;

  perform public.caat__save(p_room, s);
end $$;

-- ── 5. Mestre (mestre da campanha) ──────────────────────

create or replace function public.caat_gm(p_room uuid, p_action jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.caat_rooms;
  s jsonb;
  a text := p_action->>'a';
  u text;
  i int;
begin
  select * into r from public.caat_rooms where id = p_room for update;
  if r.id is null then raise exception 'Mesa não encontrada.'; end if;
  if not public.is_campaign_master(r.campaign_id, auth.uid()) then raise exception 'Só o Mestre.'; end if;
  if r.status = 'fim' then raise exception 'Esta mesa já foi encerrada.'; end if;
  select state into s from public.caat_state where room_id = p_room for update;

  if a = 'pause' then
    if r.paused then return; end if;
    update public.caat_rooms set paused = true where id = p_room;
    s := jsonb_set(jsonb_set(s, '{paused_by}', '"o Mestre"'), '{paused_at}', to_jsonb(public.caat__ms()));
    s := public.caat__log(s, 'o Mestre pausou');
  elsif a = 'resume' then
    if not r.paused then return; end if;
    s := public.caat__shift(s, public.caat__ms() - coalesce((s->>'paused_at')::bigint, public.caat__ms()));
    update public.caat_rooms set paused = false where id = p_room;
    s := jsonb_set(jsonb_set(s, '{paused_by}', 'null'), '{paused_at}', 'null');
    s := public.caat__log(s, 'o Mestre retomou');
  elsif a = 'kick' then
    if r.status <> 'lobby' then raise exception 'Só dá pra tirar alguém antes de começar.'; end if;
    u := p_action->>'uid';
    if not (s->'players' ? u) then return; end if;
    s := jsonb_set(s, array['seats', s->'players'->u->>'seat'], 'null');
    s := public.caat__log(s, format('o Mestre tirou %s da mesa', public.caat__who(s, u)));
    s := jsonb_set(s, '{players}', (s->'players') - u);
  elsif a = 'start' then
    if r.status <> 'lobby' then raise exception 'A partida já começou.'; end if;
    for i in 0..3 loop
      u := s->'seats'->>i;
      if u is null then raise exception 'Faltam jogadores: a mesa precisa de 4.'; end if;
      if not (s->'players'->u->>'consent')::boolean then
        raise exception '% ainda não aceitou o aviso.', public.caat__who(s, u);
      end if;
    end loop;
    update public.caat_rooms set status = 'jogo' where id = p_room;
    s := jsonb_set(s, '{phase}', '"preparacao"');
    s := jsonb_set(s, '{round}', '1');
    s := jsonb_set(s, '{start_seat}', to_jsonb(floor(random() * 4)::int));
    s := public.caat__log(s, format('a partida começou — %s começa', public.caat__who(s, s->'seats'->>((s->>'start_seat')::int))));
  elsif a = 'bots' then
    -- Teste do dono: robôs nos lugares vazios.
    if not public.is_site_owner() then raise exception 'Robôs são só pro teste do dono do site.'; end if;
    if r.status <> 'lobby' then raise exception 'A partida já começou.'; end if;
    for i in 0..3 loop
      if jsonb_typeof(s->'seats'->i) = 'null' then
        u := 'bot-' || i;
        s := jsonb_set(s, array['seats', i::text], to_jsonb(u));
        s := jsonb_set(s, array['players', u], jsonb_build_object(
          'name', (array['Lira', 'Thamior', 'Selene', 'Darian'])[i + 1],
          'nick', '', 'consent', true, 'level', 1, 'seat', i, 'bot', true));
      end if;
    end loop;
    s := public.caat__log(s, 'o Mestre chamou robôs para os lugares vazios');
  elsif a = 'unbots' then
    if r.status <> 'lobby' then raise exception 'A partida já começou.'; end if;
    for u in select k from jsonb_object_keys(s->'players') k loop
      if coalesce((s->'players'->u->>'bot')::boolean, false) then
        s := jsonb_set(s, array['seats', s->'players'->u->>'seat'], 'null');
        s := jsonb_set(s, '{players}', (s->'players') - u);
      end if;
    end loop;
    s := public.caat__log(s, 'o Mestre tirou os robôs');
  elsif a = 'close' then
    update public.caat_rooms set status = 'fim', paused = false where id = p_room;
    s := public.caat__log(s, 'o Mestre encerrou a mesa');
  else
    raise exception 'Ação desconhecida.';
  end if;

  perform public.caat__save(p_room, s);
end $$;

-- ── 6. Jogadas (quem está sentado) ──────────────────────
-- Marco 1: só Pausar. O motor de regras entra no marco 2.

create or replace function public.caat_play(p_room uuid, p_action jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.caat_rooms;
  s jsonb;
  me text := auth.uid()::text;
  a text := p_action->>'a';
begin
  select * into r from public.caat_rooms where id = p_room for update;
  if r.id is null then raise exception 'Mesa não encontrada.'; end if;
  if r.status = 'fim' then raise exception 'Esta mesa já foi encerrada.'; end if;
  select state into s from public.caat_state where room_id = p_room for update;
  if not (s->'players' ? me) then raise exception 'Você não está sentado nesta mesa.'; end if;

  if a = 'pause' then
    -- Qualquer jogador pausa, a qualquer hora; só o Mestre retoma.
    if r.paused then return '{}'::jsonb; end if;
    update public.caat_rooms set paused = true where id = p_room;
    s := jsonb_set(jsonb_set(s, '{paused_by}', to_jsonb(public.caat__who(s, me))), '{paused_at}', to_jsonb(public.caat__ms()));
    s := public.caat__log(s, format('%s pausou', public.caat__who(s, me)));
  else
    if r.paused then raise exception 'O jogo está pausado.'; end if;
    raise exception 'Ação desconhecida.';
  end if;

  perform public.caat__save(p_room, s);
  return '{}'::jsonb;
end $$;

-- ── 7. A visão de cada um ───────────────────────────────

create or replace function public.caat_view(p_room uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.caat_rooms;
  s jsonb;
  c jsonb := public.caat_content();
  me text := auth.uid()::text;
  gm boolean;
  seats jsonb := '[]'::jsonb;
  u text;
  i int;
  v jsonb;
begin
  select * into r from public.caat_rooms where id = p_room;
  if r.id is null then raise exception 'Mesa não encontrada.'; end if;
  if not public.is_campaign_member(r.campaign_id, auth.uid()) then raise exception 'Mesa não encontrada.'; end if;
  select state into s from public.caat_state where room_id = p_room;
  gm := public.is_campaign_master(r.campaign_id, auth.uid());

  for i in 0..3 loop
    u := s->'seats'->>i;
    seats := seats || jsonb_build_array(jsonb_build_object(
      'seat', i,
      'uid', u,
      'name', case when u is null then null else s->'players'->u->>'name' end,
      'nick', case when u is null then null else nullif(s->'players'->u->>'nick', '') end,
      'level', case when u is null then null else (s->'players'->u->>'level')::int end,
      'consent', case when u is null then null else (s->'players'->u->>'consent')::boolean end,
      'bot', coalesce((s->'players'->u->>'bot')::boolean, false),
      'cor', c->'textos'->'assentos'->i->>'cor',
      'emblema', c->'textos'->'assentos'->i->>'emblema'));
  end loop;

  v := jsonb_build_object(
    'room', jsonb_build_object('id', r.id, 'status', r.status, 'paused', r.paused, 'paused_by', s->>'paused_by', 'version', r.version),
    'now', public.caat__ms(),
    'phase', s->>'phase',
    'round', (s->>'round')::int,
    'start_seat', (s->>'start_seat')::int,
    'deadline', (s->>'deadline')::bigint,
    'me', jsonb_build_object(
      'uid', me,
      'gm', gm,
      'owner', public.is_site_owner(),
      'can_sit', exists (select 1 from public.campaign_members where campaign_id = r.campaign_id and user_id = auth.uid() and role = 'player')
                 or public.is_site_owner(),
      'seat', (s->'players'->me->>'seat')::int,
      'consent', coalesce((s->'players'->me->>'consent')::boolean, false),
      'nick', coalesce(s->'players'->me->>'nick', ''),
      'level', coalesce((s->'players'->me->>'level')::int, 1)),
    'seats', seats,
    'textos', c->'textos',
    'regras', s->'config',
    'caso', c->'casos'->(s->>'caso')->'publico');

  if gm then
    v := v || jsonb_build_object('gm', jsonb_build_object('events', s->'events'));
  end if;
  return v;
end $$;

-- ── 8. Permissões ───────────────────────────────────────

revoke all on function public.caat__log(jsonb, text) from public, anon, authenticated;
revoke all on function public.caat__name(uuid) from public, anon, authenticated;
revoke all on function public.caat__who(jsonb, text) from public, anon, authenticated;
revoke all on function public.caat__shift(jsonb, bigint) from public, anon, authenticated;
revoke all on function public.caat__save(uuid, jsonb) from public, anon, authenticated;

revoke all on function public.caat_open(uuid) from public, anon;
revoke all on function public.caat_lobby(uuid, jsonb) from public, anon;
revoke all on function public.caat_gm(uuid, jsonb) from public, anon;
revoke all on function public.caat_play(uuid, jsonb) from public, anon;
revoke all on function public.caat_view(uuid) from public, anon;
grant execute on function public.caat_open(uuid) to authenticated;
grant execute on function public.caat_lobby(uuid, jsonb) to authenticated;
grant execute on function public.caat_gm(uuid, jsonb) to authenticated;
grant execute on function public.caat_play(uuid, jsonb) to authenticated;
grant execute on function public.caat_view(uuid) to authenticated;
