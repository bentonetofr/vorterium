-- ════════════════════════════════════════════════════════
-- A Torre do Observatório — joguinho em pixel art para EXATAMENTE 2
-- jogadores da campanha (os outros e o mestre assistem), no mesmo molde do
-- Livro Bloqueado. Abre em tela cheia pra todos quando o dono liga no
-- Painel de controle (recurso "torre-observatorio").
--
-- A torre tem dois andares separados por uma grade de ferro, e os dois
-- jogadores não se veem:
--   • 1º escolhido → o Observador (Capa Azul), no andar de CIMA;
--   • 2º escolhido → o Mecânico (Capa Vermelha), no andar de BAIXO.
--
-- O BANCO MANDA no que importa: quem joga, em que fase a sala está e (no
-- marco 2) o estado dos enigmas — o estado completo (tor_state) ninguém lê
-- pelo site; cada um pede a SUA visão (tor_view).
-- O movimento dos bonecos NÃO passa pelo banco: vai direto entre os
-- navegadores pelo canal "torre:<sala>" (broadcast + presence).
--
-- Tempo real: cada mudança sobe tor_rooms.version; o site escuta a linha e
-- pede a visão de novo.
--
-- Marco 1: abrir/encerrar a sala, saguão (o mestre escolhe os 2), começar,
-- voltar ao saguão.
-- ════════════════════════════════════════════════════════

-- ── 1. Tabelas ──────────────────────────────────────────

create table if not exists public.tor_rooms (
  id           uuid         primary key default gen_random_uuid(),
  campaign_id  uuid         not null references public.campaigns(id) on delete cascade,
  status       text         not null default 'lobby' check (status in ('lobby', 'jogo', 'fim')),
  version      bigint       not null default 0,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);
-- Uma sala aberta por campanha.
create unique index if not exists tor_rooms_one_open on public.tor_rooms (campaign_id) where status <> 'fim';

create table if not exists public.tor_state (
  room_id  uuid   primary key references public.tor_rooms(id) on delete cascade,
  state    jsonb  not null
);

alter table public.tor_rooms enable row level security;
alter table public.tor_state enable row level security;

drop policy if exists "tor_rooms: membros veem" on public.tor_rooms;
create policy "tor_rooms: membros veem" on public.tor_rooms
  for select to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()));

grant select on public.tor_rooms to authenticated;
-- tor_state: sem policy e sem grant — só as funções abaixo.
revoke all on public.tor_state from anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tor_rooms') then
    alter publication supabase_realtime add table public.tor_rooms;
  end if;
end $$;

-- ── 2. Ajudantes ────────────────────────────────────────

create or replace function public.tor__ms()
returns bigint language sql stable as $$ select (extract(epoch from now()) * 1000)::bigint $$;

create or replace function public.tor__name(p_uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(display_name), ''), 'Jogador') from public.profiles where id = p_uid
$$;

create or replace function public.tor__save(p_room uuid, s jsonb)
returns void language sql as $$
  update public.tor_state set state = s where room_id = p_room;
  update public.tor_rooms set version = version + 1, updated_at = now() where id = p_room;
$$;

-- ── 3. Abrir a sala (mestre da campanha) ────────────────

create or replace function public.tor_open(p_campaign uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  if not public.is_campaign_master(p_campaign, auth.uid()) then
    raise exception 'Só o mestre da campanha abre a Torre do Observatório.';
  end if;
  if not exists (select 1 from public.site_features where key = 'torre-observatorio' and enabled) and not public.is_site_owner() then
    raise exception 'A Torre do Observatório ainda não foi liberada.';
  end if;
  select id into rid from public.tor_rooms where campaign_id = p_campaign and status <> 'fim';
  if rid is not null then return rid; end if;

  insert into public.tor_rooms (campaign_id) values (p_campaign) returning id into rid;
  insert into public.tor_state (room_id, state) values (rid, jsonb_build_object(
    'players', '[]'::jsonb,
    'started_at', null));
  return rid;
end $$;

-- Desligar no painel: fecha as salas abertas das campanhas em que eu sou o mestre.
create or replace function public.tor_close_mine()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  with closed as (
    update public.tor_rooms r set status = 'fim', version = version + 1, updated_at = now()
    where r.status <> 'fim' and public.is_campaign_master(r.campaign_id, auth.uid())
    returning 1)
  select count(*) into n from closed;
  return n;
end $$;

-- ── 4. Mestre ───────────────────────────────────────────

create or replace function public.tor_gm(p_room uuid, p_action jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.tor_rooms;
  s jsonb;
  a text := p_action->>'a';
  picked jsonb;
  u text;
begin
  select * into r from public.tor_rooms where id = p_room for update;
  if r.id is null then raise exception 'Sala não encontrada.'; end if;
  if not public.is_campaign_master(r.campaign_id, auth.uid()) then raise exception 'Só o mestre.'; end if;
  if r.status = 'fim' then raise exception 'Esta sala já foi encerrada.'; end if;
  select state into s from public.tor_state where room_id = p_room for update;

  if a = 'pick' then
    -- Quem joga, na ordem: o 1º é o Observador (cima), o 2º o Mecânico (baixo).
    if r.status <> 'lobby' then raise exception 'Volte ao saguão pra trocar quem joga.'; end if;
    picked := coalesce(p_action->'uids', '[]'::jsonb);
    if jsonb_typeof(picked) <> 'array' or jsonb_array_length(picked) > 2 then raise exception 'Escolha 2 jogadores.'; end if;
    for u in select jsonb_array_elements_text(picked) loop
      if not exists (select 1 from public.campaign_members where campaign_id = r.campaign_id and user_id::text = u) then
        raise exception 'Essa pessoa não é da campanha.';
      end if;
    end loop;
    if jsonb_array_length(picked) = 2 and picked->>0 = picked->>1 then raise exception 'Escolha duas pessoas diferentes.'; end if;
    s := jsonb_set(s, '{players}', picked);
  elsif a = 'start' then
    if r.status <> 'lobby' then return; end if;
    -- A torre não se resolve sozinho: um em cada andar.
    if jsonb_array_length(s->'players') <> 2 then raise exception 'A torre precisa de 2 jogadores: um em cima, um embaixo.'; end if;
    update public.tor_rooms set status = 'jogo' where id = p_room;
    s := jsonb_set(s, '{started_at}', to_jsonb(public.tor__ms()));
  elsif a = 'lobby' then
    update public.tor_rooms set status = 'lobby' where id = p_room;
  elsif a = 'close' then
    update public.tor_rooms set status = 'fim' where id = p_room;
  else
    raise exception 'Ação desconhecida.';
  end if;

  perform public.tor__save(p_room, s);
end $$;

-- ── 5. A visão de cada um ───────────────────────────────

create or replace function public.tor_view(p_room uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.tor_rooms;
  s jsonb;
  me text := auth.uid()::text;
  players jsonb := '[]'::jsonb;
  i int;
  u text;
begin
  select * into r from public.tor_rooms where id = p_room;
  if r.id is null or not public.is_campaign_member(r.campaign_id, auth.uid()) then raise exception 'Sala não encontrada.'; end if;
  select state into s from public.tor_state where room_id = p_room;

  for i in 0 .. jsonb_array_length(s->'players') - 1 loop
    u := s->'players'->>i;
    players := players || jsonb_build_array(jsonb_build_object('uid', u, 'name', public.tor__name(u::uuid), 'slot', i));
  end loop;

  return jsonb_build_object(
    'room', jsonb_build_object('id', r.id, 'campaign_id', r.campaign_id, 'status', r.status, 'version', r.version),
    'now', public.tor__ms(),
    'started_at', (s->>'started_at')::bigint,
    'me', jsonb_build_object(
      'uid', me,
      'gm', public.is_campaign_master(r.campaign_id, auth.uid()),
      'slot', (select (x.ord - 1)::int from jsonb_array_elements_text(s->'players') with ordinality x(v, ord) where x.v = me)),
    'players', players,
    'members', (select coalesce(jsonb_agg(jsonb_build_object('uid', m.user_id, 'name', public.tor__name(m.user_id), 'role', m.role)
                                 order by (m.role = 'master') desc, public.tor__name(m.user_id)), '[]'::jsonb)
                from public.campaign_members m where m.campaign_id = r.campaign_id));
end $$;

-- ── 6. Permissões ───────────────────────────────────────

revoke all on function public.tor__name(uuid) from public, anon, authenticated;
revoke all on function public.tor__save(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.tor_open(uuid) from public, anon;
revoke all on function public.tor_close_mine() from public, anon;
revoke all on function public.tor_gm(uuid, jsonb) from public, anon;
revoke all on function public.tor_view(uuid) from public, anon;
grant execute on function public.tor_open(uuid) to authenticated;
grant execute on function public.tor_close_mine() to authenticated;
grant execute on function public.tor_gm(uuid, jsonb) to authenticated;
grant execute on function public.tor_view(uuid) to authenticated;
