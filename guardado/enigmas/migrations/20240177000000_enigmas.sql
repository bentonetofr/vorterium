-- ════════════════════════════════════════════════════════
-- Enigmas — jogos de puzzle em tempo real dentro da campanha (aba
-- Enigmas da Sessão). Primeiro jogo: Caatedrum (4 jogadores, 2 duplas).
--
-- O SERVIDOR MANDA: toda a regra e todas as soluções ficam aqui, em
-- funções do banco. O estado completo (enigma_state) ninguém lê pelo site;
-- cada pessoa pede a SUA visão (enigma_view), filtrada pelo papel dela —
-- o navegador nunca recebe solução, alvo ou o que o parceiro vê.
-- O conteúdo (textos, depoimentos, soluções) vem de enigma_content(),
-- gerado dos JSON em enigmas/<jogo>/ (migration 20240178).
--
-- Tempo real: cada mudança sobe enigma_rooms.version; o site escuta a
-- linha da sala e pede a visão de novo.
-- Liberado pelo Painel de controle (recurso "enigmas").
-- ════════════════════════════════════════════════════════

-- ── 1. Tabelas ──────────────────────────────────────────

create table if not exists public.enigma_rooms (
  id           uuid         primary key default gen_random_uuid(),
  campaign_id  uuid         not null references public.campaigns(id) on delete cascade,
  game         text         not null default 'caatedrum',
  status       text         not null default 'lobby' check (status in ('lobby', 'jogo', 'fim')),
  paused       boolean      not null default false,
  version      bigint       not null default 0,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);
-- Uma sala aberta por campanha.
create unique index if not exists enigma_rooms_one_open on public.enigma_rooms (campaign_id) where status <> 'fim';

create table if not exists public.enigma_state (
  room_id  uuid   primary key references public.enigma_rooms(id) on delete cascade,
  state    jsonb  not null
);

alter table public.enigma_rooms enable row level security;
alter table public.enigma_state enable row level security;

drop policy if exists "enigma_rooms: membros veem" on public.enigma_rooms;
create policy "enigma_rooms: membros veem" on public.enigma_rooms
  for select to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()));

grant select on public.enigma_rooms to authenticated;
-- enigma_state: sem policy e sem grant — só as funções abaixo.
revoke all on public.enigma_state from anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'enigma_rooms') then
    alter publication supabase_realtime add table public.enigma_rooms;
  end if;
end $$;

-- ── 2. Ajudantes ────────────────────────────────────────

create or replace function public.enigma__ms()
returns bigint language sql stable as $$ select (extract(epoch from now()) * 1000)::bigint $$;

-- Linha do tempo do mestre (as últimas 200).
create or replace function public.enigma__log(s jsonb, p_dupla text, p_msg text)
returns jsonb language plpgsql as $$
declare ev jsonb;
begin
  ev := coalesce(s->'events', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('t', public.enigma__ms(), 'd', p_dupla, 'm', p_msg));
  if jsonb_array_length(ev) > 200 then ev := ev - 0; end if;
  return jsonb_set(s, '{events}', ev);
end $$;

-- Dupla da pessoa (A, B ou null).
create or replace function public.enigma__dupla(s jsonb, p_uid uuid)
returns text language sql immutable as $$
  select case
    when (s->'duplas'->'A'->'members') ? p_uid::text then 'A'
    when (s->'duplas'->'B'->'members') ? p_uid::text then 'B'
  end
$$;

-- Papel da pessoa na fase atual da dupla dela. Fase 1: o primeiro do
-- sorteio pega o 1º papel; fases 2 e 3: os papéis se invertem.
create or replace function public.enigma__role(s jsonb, p_uid uuid)
returns text language plpgsql stable as $$
declare
  d text := public.enigma__dupla(s, p_uid);
  c jsonb := public.enigma_content(s->>'game');
  ph int;
  idx int;
begin
  if d is null then return null; end if;
  ph := (s->'duplas'->d->>'phase')::int;
  if ph is null or ph < 1 or ph > 3 then return null; end if;
  idx := case when s->'duplas'->d->'members'->>0 = p_uid::text then 0 else 1 end;
  if ph > 1 then idx := 1 - idx; end if;
  return c->'historia'->'fases'->d->(ph - 1)->'papeis'->>idx;
end $$;

-- Começa uma fase pra dupla.
create or replace function public.enigma__init_phase(s jsonb, d text, ph int)
returns jsonb language plpgsql stable as $$
declare
  c jsonb := public.enigma_content(s->>'game');
  st jsonb;
  key text := 'p' || ph;
begin
  s := jsonb_set(s, array['duplas', d, 'phase'], to_jsonb(ph));
  s := jsonb_set(s, array['duplas', d, 'hints'], '0'::jsonb);
  s := jsonb_set(s, array['duplas', d, 'started_at'], to_jsonb(public.enigma__ms()));
  if ph > 3 then
    -- Terminou as três fases: espera a Banca.
    s := jsonb_set(s, array['duplas', d, 'stage'], '"banca"');
    return public.enigma__log(s, d, 'terminou as três fases e espera a Banca');
  end if;
  s := jsonb_set(s, array['duplas', d, 'stage'], '"jogo"');
  if d = 'A' and ph = 1 then
    st := jsonb_build_object('inks', (c->'a1'->>'tintas')::int, 'read', '[]'::jsonb, 'sealed', '[]'::jsonb,
                             'marks', '{}'::jsonb, 'wrong', 0, 'proposal', null);
  elsif d = 'B' and ph = 1 then
    st := jsonb_build_object('scratch', '', 'board', '{}'::jsonb, 'proposal', null, 'wrong', 0,
                             'deadline', public.enigma__ms() + (c->'b1'->>'relogio_min')::bigint * 60000);
  else
    -- Fases ainda não construídas: aparecem como "em breve".
    st := '{}'::jsonb;
    s := jsonb_set(s, array['duplas', d, 'stage'], '"em-breve"');
  end if;
  s := jsonb_set(s, array['duplas', d, key], st);
  return public.enigma__log(s, d, format('começou a fase %s (%s)', ph, c->'historia'->'fases'->d->(ph - 1)->>'titulo'));
end $$;

-- Termina a fase atual (resolvida ou pulada) → tela de Entrega.
create or replace function public.enigma__finish_phase(s jsonb, d text, p_skipped boolean)
returns jsonb language plpgsql stable as $$
declare
  c jsonb := public.enigma_content(s->>'game');
  ph int := (s->'duplas'->d->>'phase')::int;
  frag text;
begin
  s := jsonb_set(s, array['duplas', d, 'stage'], '"entrega"');
  s := jsonb_set(s, array['duplas', d, 'times', ph::text],
         jsonb_build_object('start', s->'duplas'->d->'started_at', 'end', public.enigma__ms(), 'skipped', p_skipped,
                            'hints', s->'duplas'->d->'hints'));
  frag := c->(lower(d) || ph)->'entrega'->>'fragmento';
  if frag is not null then
    s := jsonb_set(s, array['duplas', d, 'fragments'], coalesce(s->'duplas'->d->'fragments', '[]'::jsonb) || to_jsonb(frag));
  end if;
  return public.enigma__log(s, d, format('%s a fase %s', case when p_skipped then 'pulou (mestre)' else 'resolveu' end, ph));
end $$;

-- Pausa encerrada: os relógios andam pra frente o tempo parado.
create or replace function public.enigma__shift_clocks(s jsonb, p_delta bigint)
returns jsonb language plpgsql stable as $$
declare d text; k text;
begin
  foreach d in array array['A', 'B'] loop
    foreach k in array array['p1', 'p2', 'p3'] loop
      if s->'duplas'->d->k ? 'deadline' then
        s := jsonb_set(s, array['duplas', d, k, 'deadline'], to_jsonb((s->'duplas'->d->k->>'deadline')::bigint + p_delta));
      end if;
    end loop;
  end loop;
  return s;
end $$;

create or replace function public.enigma__name(p_uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(display_name), ''), 'Jogador') from public.profiles where id = p_uid
$$;

-- ── 3. Abrir a câmara (mestre da mesa) ──────────────────

create or replace function public.enigma_open(p_campaign uuid, p_game text default 'caatedrum')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
  s jsonb;
begin
  if not public.is_campaign_master(p_campaign, auth.uid()) then
    raise exception 'Só o mestre da mesa abre a câmara.';
  end if;
  if not exists (select 1 from public.site_features where key = 'enigmas' and enabled) and not public.is_site_owner() then
    raise exception 'Os Enigmas ainda não foram liberados.';
  end if;
  if public.enigma_content(p_game) is null then
    raise exception 'Jogo desconhecido.';
  end if;
  select id into rid from public.enigma_rooms where campaign_id = p_campaign and status <> 'fim';
  if rid is not null then return rid; end if;

  insert into public.enigma_rooms (campaign_id, game) values (p_campaign, p_game) returning id into rid;
  s := jsonb_build_object('game', p_game, 'seed', floor(random() * 1000000000)::bigint,
                          'players', '{}'::jsonb, 'duplas', '{}'::jsonb, 'events', '[]'::jsonb);
  s := public.enigma__log(s, null, 'a câmara se abriu');
  insert into public.enigma_state (room_id, state) values (rid, s);
  return rid;
end $$;

-- ── 4. Lobby (jogadores) ────────────────────────────────

create or replace function public.enigma_lobby(p_room uuid, p_action jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.enigma_rooms;
  s jsonb;
  me text := auth.uid()::text;
  a text := p_action->>'a';
begin
  select * into r from public.enigma_rooms where id = p_room for update;
  if r.id is null then raise exception 'Sala não encontrada.'; end if;
  if not exists (select 1 from public.campaign_members where campaign_id = r.campaign_id and user_id = auth.uid() and role = 'player') then
    raise exception 'Só os jogadores da campanha.';
  end if;
  select state into s from public.enigma_state where room_id = p_room for update;

  if a = 'join' then
    if s->'players' ? me then return; end if;
    if r.status <> 'lobby' then raise exception 'O jogo já começou.'; end if;
    s := jsonb_set(s, array['players', me], jsonb_build_object('name', public.enigma__name(auth.uid()), 'consent', false, 'memory', ''));
    s := public.enigma__log(s, null, format('%s entrou na câmara', public.enigma__name(auth.uid())));
  elsif not (s->'players' ? me) then
    raise exception 'Entre na câmara primeiro.';
  elsif a = 'consent' then
    s := jsonb_set(s, array['players', me, 'consent'], 'true');
  elsif a = 'memory' then
    s := jsonb_set(s, array['players', me, 'memory'], to_jsonb(left(coalesce(p_action->>'text', ''), 200)));
  else
    raise exception 'Ação desconhecida.';
  end if;

  update public.enigma_state set state = s where room_id = p_room;
  update public.enigma_rooms set version = version + 1, updated_at = now() where id = p_room;
end $$;

-- ── 5. Mestre da mesa ───────────────────────────────────

create or replace function public.enigma_gm(p_room uuid, p_action jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.enigma_rooms;
  s jsonb;
  c jsonb;
  a text := p_action->>'a';
  d text := p_action->>'dupla';
  uids text[];
  rolls jsonb := '{}'::jsonb;
  used int[] := '{}';
  roll int;
  u text;
  ordered text[];
  ua text; ub text; da text; db text; ia int; ib int;
  ph int;
  delta bigint;
begin
  select * into r from public.enigma_rooms where id = p_room for update;
  if r.id is null then raise exception 'Sala não encontrada.'; end if;
  if not public.is_campaign_master(r.campaign_id, auth.uid()) then raise exception 'Só o mestre da mesa.'; end if;
  select state into s from public.enigma_state where room_id = p_room for update;
  c := public.enigma_content(s->>'game');

  if a = 'draw' then
    -- Cada jogador rola 1d20 (sem empate). Os dois maiores: dupla A; os dois menores: dupla B.
    -- Dentro da dupla, o maior pega o 1º papel da fase 1.
    if r.status <> 'lobby' then raise exception 'O sorteio é antes de começar.'; end if;
    select array_agg(k) into uids from jsonb_object_keys(s->'players') k;
    if coalesce(array_length(uids, 1), 0) <> 4 then raise exception 'O Caatedrum precisa de exatamente 4 jogadores na câmara.'; end if;
    foreach u in array uids loop
      loop
        roll := 1 + floor(random() * 20)::int;
        exit when not roll = any(used);
      end loop;
      used := used || roll;
      rolls := rolls || jsonb_build_object(u, roll);
    end loop;
    select array_agg(key order by value::int desc) into ordered from jsonb_each_text(rolls);
    s := jsonb_set(s, '{draw}', jsonb_build_object('rolls', rolls, 'at', public.enigma__ms()));
    s := jsonb_set(s, '{duplas}', jsonb_build_object(
      'A', jsonb_build_object('members', jsonb_build_array(ordered[1], ordered[2]), 'score', 100, 'fragments', '[]'::jsonb, 'times', '{}'::jsonb, 'revealed', '{}'::jsonb),
      'B', jsonb_build_object('members', jsonb_build_array(ordered[3], ordered[4]), 'score', 100, 'fragments', '[]'::jsonb, 'times', '{}'::jsonb, 'revealed', '{}'::jsonb)));
    s := public.enigma__log(s, null, 'os dados decidiram as duplas');

  elsif a = 'swap' then
    -- Troca dois jogadores de lugar (dupla e papel), antes de começar.
    if r.status <> 'lobby' then raise exception 'Só antes de começar.'; end if;
    ua := p_action->>'a_uid'; ub := p_action->>'b_uid';
    da := public.enigma__dupla(s, ua::uuid); db := public.enigma__dupla(s, ub::uuid);
    if da is null or db is null or ua = ub then raise exception 'Escolha dois jogadores sorteados.'; end if;
    ia := case when s->'duplas'->da->'members'->>0 = ua then 0 else 1 end;
    ib := case when s->'duplas'->db->'members'->>0 = ub then 0 else 1 end;
    s := jsonb_set(s, array['duplas', da, 'members', ia::text], to_jsonb(ub));
    s := jsonb_set(s, array['duplas', db, 'members', ib::text], to_jsonb(ua));
    s := public.enigma__log(s, null, 'o mestre trocou dois jogadores de lugar');

  elsif a = 'start' then
    if r.status <> 'lobby' then raise exception 'O jogo já começou.'; end if;
    if not (s ? 'draw') then raise exception 'Sorteie as duplas primeiro.'; end if;
    s := public.enigma__init_phase(s, 'A', 1);
    s := public.enigma__init_phase(s, 'B', 1);
    s := public.enigma__log(s, null, 'o jogo começou');
    update public.enigma_rooms set status = 'jogo' where id = p_room;

  elsif a = 'pause' then
    if not r.paused then
      s := jsonb_set(s, '{paused_at}', to_jsonb(public.enigma__ms()));
      s := jsonb_set(s, '{paused_by}', to_jsonb('o mestre'::text));
      s := public.enigma__log(s, null, 'o mestre pausou');
      update public.enigma_rooms set paused = true where id = p_room;
    end if;

  elsif a = 'resume' then
    if r.paused then
      delta := public.enigma__ms() - coalesce((s->>'paused_at')::bigint, public.enigma__ms());
      s := public.enigma__shift_clocks(s, delta);
      s := s - 'paused_at' - 'paused_by';
      s := public.enigma__log(s, null, 'o mestre retomou');
      update public.enigma_rooms set paused = false where id = p_room;
    end if;

  elsif a = 'hint' then
    ph := (s->'duplas'->d->>'phase')::int;
    if coalesce((s->'duplas'->d->>'hints')::int, 0) >= 3 then raise exception 'As três dicas já saíram.'; end if;
    s := jsonb_set(s, array['duplas', d, 'hints'], to_jsonb(coalesce((s->'duplas'->d->>'hints')::int, 0) + 1));
    s := public.enigma__log(s, d, format('o mestre liberou a dica %s (sem custo)', (s->'duplas'->d->>'hints')));

  elsif a = 'skip' then
    if s->'duplas'->d->>'stage' not in ('jogo', 'em-breve') then raise exception 'Nada pra pular agora.'; end if;
    s := public.enigma__finish_phase(s, d, true);

  elsif a = 'reveal' then
    ph := (s->'duplas'->d->>'phase')::int;
    s := jsonb_set(s, array['duplas', d, 'revealed', ph::text], 'true');
    s := public.enigma__log(s, d, format('o mestre viu a solução da fase %s', ph));

  elsif a = 'inks' then
    if not (s->'duplas'->'A' ? 'p1') then raise exception 'A fase das tintas ainda não começou.'; end if;
    s := jsonb_set(s, '{duplas,A,p1,inks}', to_jsonb(greatest(0, (s->'duplas'->'A'->'p1'->>'inks')::int + coalesce((p_action->>'n')::int, 3))));
    s := public.enigma__log(s, 'A', format('o mestre deu %s tintas', coalesce((p_action->>'n')::int, 3)));

  elsif a = 'time' then
    ph := (s->'duplas'->d->>'phase')::int;
    if not (s->'duplas'->d->('p' || ph) ? 'deadline') then raise exception 'Essa fase não tem relógio.'; end if;
    s := jsonb_set(s, array['duplas', d, 'p' || ph, 'deadline'],
                   to_jsonb((s->'duplas'->d->('p' || ph)->>'deadline')::bigint + coalesce((p_action->>'seconds')::bigint, 60) * 1000));
    s := public.enigma__log(s, d, format('o mestre mexeu no relógio (%s s)', coalesce((p_action->>'seconds')::bigint, 60)));

  elsif a = 'close' then
    s := public.enigma__log(s, null, 'a câmara se fechou');
    update public.enigma_rooms set status = 'fim' where id = p_room;

  else
    raise exception 'Ação desconhecida.';
  end if;

  update public.enigma_state set state = s where room_id = p_room;
  update public.enigma_rooms set version = version + 1, updated_at = now() where id = p_room;
end $$;

-- ── 6. Jogadas ──────────────────────────────────────────

create or replace function public.enigma_play(p_room uuid, p_action jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.enigma_rooms;
  s jsonb;
  c jsonb;
  me text := auth.uid()::text;
  a text := p_action->>'a';
  d text;
  ph int;
  role text;
  st jsonb;
  key text;
  item text;
  book text;
  partner text;
  culprit text;
  seal text;
  result jsonb := '{}'::jsonb;
begin
  select * into r from public.enigma_rooms where id = p_room for update;
  if r.id is null then raise exception 'Sala não encontrada.'; end if;
  select state into s from public.enigma_state where room_id = p_room for update;
  c := public.enigma_content(s->>'game');
  d := public.enigma__dupla(s, auth.uid());
  if d is null then raise exception 'Você não está numa dupla.'; end if;
  if r.status <> 'jogo' then raise exception 'O jogo não está rodando.'; end if;

  -- Pausar é segurança da mesa: qualquer um, a qualquer hora.
  if a = 'pause' then
    if not r.paused then
      s := jsonb_set(s, '{paused_at}', to_jsonb(public.enigma__ms()));
      s := jsonb_set(s, '{paused_by}', to_jsonb(s->'players'->me->>'name'));
      s := public.enigma__log(s, d, format('%s pausou o jogo', s->'players'->me->>'name'));
      update public.enigma_rooms set paused = true where id = p_room;
    end if;
    update public.enigma_state set state = s where room_id = p_room;
    update public.enigma_rooms set version = version + 1, updated_at = now() where id = p_room;
    return result;
  end if;
  if r.paused then raise exception 'O jogo está pausado.'; end if;

  ph := (s->'duplas'->d->>'phase')::int;
  role := public.enigma__role(s, auth.uid());
  key := 'p' || ph;
  st := s->'duplas'->d->key;
  partner := case when s->'duplas'->d->'members'->>0 = me then s->'duplas'->d->'members'->>1 else s->'duplas'->d->'members'->>0 end;

  if a = 'next' then
    if s->'duplas'->d->>'stage' <> 'entrega' then raise exception 'Ainda não.'; end if;
    s := public.enigma__init_phase(s, d, ph + 1);

  elsif a = 'hint' then
    if s->'duplas'->d->>'stage' <> 'jogo' then raise exception 'Nada pra dica agora.'; end if;
    if coalesce((s->'duplas'->d->>'hints')::int, 0) >= 3 then raise exception 'As três dicas já saíram.'; end if;
    s := jsonb_set(s, array['duplas', d, 'hints'], to_jsonb(coalesce((s->'duplas'->d->>'hints')::int, 0) + 1));
    s := jsonb_set(s, array['duplas', d, 'score'], to_jsonb(coalesce((s->'duplas'->d->>'score')::int, 100) - 10));
    s := public.enigma__log(s, d, format('%s pediu a dica %s (−10)', s->'players'->me->>'name', s->'duplas'->d->>'hints'));

  elsif s->'duplas'->d->>'stage' <> 'jogo' then
    raise exception 'Agora não dá.';

  -- ── A1: Testemunhas de Papel ──
  elsif d = 'A' and ph = 1 then
    if a = 'read' then
      if role <> 'interrogador' then raise exception 'Só o Interrogador lê os depoimentos.'; end if;
      item := p_action->>'item';
      book := split_part(item, '-', 1);
      if not exists (select 1 from jsonb_array_elements(c->'a1'->'depoimentos') x where x->>'id' = item) then raise exception 'Depoimento desconhecido.'; end if;
      if (st->'sealed') ? book then raise exception 'Esse livro está lacrado.'; end if;
      if (st->'read') ? item then return result; end if;
      if (st->>'inks')::int <= 0 then raise exception 'Acabaram as tintas.'; end if;
      st := jsonb_set(st, '{read}', (st->'read') || to_jsonb(item));
      st := jsonb_set(st, '{inks}', to_jsonb((st->>'inks')::int - 1));
      if (st->>'inks')::int = 0 then s := public.enigma__log(s, d, 'as tintas acabaram — dê mais pelo painel se quiser'); end if;
    elsif a = 'mark' then
      if p_action->>'value' not in ('', 'x', 'o') then raise exception 'Marca inválida.'; end if;
      if not ((c->'a1'->'suspeitos') ? split_part(p_action->>'cell', '|', 1))
         or split_part(p_action->>'cell', '|', 2) !~ '^[0-4]$' then raise exception 'Célula inválida.'; end if;
      if p_action->>'value' = '' then st := jsonb_set(st, '{marks}', (st->'marks') - (p_action->>'cell'));
      else st := jsonb_set(st, array['marks', p_action->>'cell'], to_jsonb(p_action->>'value')); end if;
    elsif a = 'propose' then
      if not ((c->'a1'->'suspeitos') ? (p_action->>'name')) then raise exception 'Suspeito desconhecido.'; end if;
      st := jsonb_set(st, '{proposal}', jsonb_build_object('by', me, 'name', p_action->>'name'));
    elsif a = 'cancel' then
      st := jsonb_set(st, '{proposal}', 'null');
    elsif a = 'confirm' then
      if jsonb_typeof(st->'proposal') <> 'object' then raise exception 'Ninguém acusou ainda.'; end if;
      if st->'proposal'->>'by' = me then raise exception 'Quem confirma é o parceiro.'; end if;
      culprit := st->'proposal'->>'name';
      st := jsonb_set(st, '{proposal}', 'null');
      if culprit = c->'a1'->>'culpado' then
        s := jsonb_set(s, array['duplas', d, key], st);
        s := public.enigma__finish_phase(s, d, false);
        result := jsonb_build_object('ok', true);
        st := null;
      else
        st := jsonb_set(st, '{wrong}', to_jsonb((st->>'wrong')::int + 1));
        st := jsonb_set(st, '{inks}', to_jsonb(greatest(0, (st->>'inks')::int - 2)));
        -- Lacra um livro cuja leitura não é obrigatória (nunca trava a fase).
        select x into seal from jsonb_array_elements_text(c->'a1'->'lacre_ordem') x where not ((st->'sealed') ? x) limit 1;
        if seal is not null then st := jsonb_set(st, '{sealed}', (st->'sealed') || to_jsonb(seal)); end if;
        s := public.enigma__log(s, d, format('acusou %s e errou (−2 tintas%s)', culprit, case when seal is null then '' else ', lacrou um livro' end));
        result := jsonb_build_object('ok', false, 'msg', c->'a1'->>'acusacao_errada');
      end if;
    else
      raise exception 'Ação desconhecida.';
    end if;
    if st is not null then s := jsonb_set(s, array['duplas', d, key], st); end if;

  -- ── B1: O Baile em 3 Valsas ──
  elsif d = 'B' and ph = 1 then
    if a = 'scratch' then
      st := jsonb_set(st, '{scratch}', to_jsonb(left(coalesce(p_action->>'text', ''), 4000)));
    elsif a = 'board' then
      -- Tabuleiro da dupla: célula "valsa|assento|m" (máscara) ou "…|p" (pessoa).
      if coalesce(p_action->>'cell', '') !~ '^[1-3]\|[0-7]\|[mp]$' then raise exception 'Assento inválido.'; end if;
      if coalesce(p_action->>'value', '') <> '' and not (
           (c->'b1'->case when right(p_action->>'cell', 1) = 'm' then 'mascaras' else 'pessoas' end) ? (p_action->>'value'))
      then raise exception 'Nome inválido.'; end if;
      if coalesce(p_action->>'value', '') = '' then st := jsonb_set(st, '{board}', coalesce(st->'board', '{}'::jsonb) - (p_action->>'cell'));
      else st := jsonb_set(st, '{board}', coalesce(st->'board', '{}'::jsonb) || jsonb_build_object(p_action->>'cell', p_action->>'value')); end if;
    elsif a = 'propose' then
      if not ((c->'b1'->'pessoas') ? (p_action->>'name')) then raise exception 'Convidado desconhecido.'; end if;
      st := jsonb_set(st, '{proposal}', jsonb_build_object('by', me, 'name', p_action->>'name'));
    elsif a = 'cancel' then
      st := jsonb_set(st, '{proposal}', 'null');
    elsif a = 'confirm' then
      if jsonb_typeof(st->'proposal') <> 'object' then raise exception 'Ninguém acusou ainda.'; end if;
      if st->'proposal'->>'by' = me then raise exception 'Quem confirma é o parceiro.'; end if;
      culprit := st->'proposal'->>'name';
      st := jsonb_set(st, '{proposal}', 'null');
      if culprit = c->'b1'->>'culpado' then
        s := jsonb_set(s, array['duplas', d, key], st);
        s := public.enigma__finish_phase(s, d, false);
        result := jsonb_build_object('ok', true);
        st := null;
      else
        st := jsonb_set(st, '{wrong}', to_jsonb((st->>'wrong')::int + 1));
        st := jsonb_set(st, '{deadline}', to_jsonb((st->>'deadline')::bigint - (c->'b1'->>'acusacao_errada_seg')::bigint * 1000));
        s := public.enigma__log(s, d, format('acusou %s e errou (−1 minuto)', culprit));
        result := jsonb_build_object('ok', false, 'msg', c->'b1'->>'acusacao_errada');
      end if;
    else
      raise exception 'Ação desconhecida.';
    end if;
    if st is not null then s := jsonb_set(s, array['duplas', d, key], st); end if;

  else
    raise exception 'Essa fase ainda não está pronta.';
  end if;

  update public.enigma_state set state = s where room_id = p_room;
  update public.enigma_rooms set version = version + 1, updated_at = now() where id = p_room;
  return result;
end $$;

-- ── 7. A visão de cada um ───────────────────────────────

-- O que um papel vê da fase atual de uma dupla. p_role: o papel da
-- pessoa, 'espectador' (a outra dupla) ou 'mestre'.
create or replace function public.enigma__phase_view(s jsonb, d text, p_role text, p_me text)
returns jsonb language plpgsql stable as $$
declare
  c jsonb := public.enigma_content(s->>'game');
  du jsonb := s->'duplas'->d;
  ph int := (du->>'phase')::int;
  st jsonb := du->('p' || ph);
  stage text := du->>'stage';
  fase jsonb;
  v jsonb;
  pc jsonb;
  full_ boolean := p_role in ('espectador', 'mestre');
  revealed boolean := p_role = 'mestre' and coalesce((du->'revealed'->>(ph::text))::boolean, false);
  hints int := coalesce((du->>'hints')::int, 0);
  books jsonb;
  ent jsonb;
begin
  if ph is null then return null; end if;
  if ph > 3 then return jsonb_build_object('phase', ph, 'stage', stage); end if;
  fase := c->'historia'->'fases'->d->(ph - 1);
  pc := c->(lower(d) || ph);
  v := jsonb_build_object(
    'phase', ph, 'stage', stage, 'tipo', fase->>'tipo', 'titulo', fase->>'titulo',
    'role', p_role,
    'role_nome', coalesce(c->'historia'->'papeis'->p_role->>'nome', case p_role when 'espectador' then 'Espectador' else 'Mestre' end),
    'role_resumo', c->'historia'->'papeis'->p_role->>'resumo',
    'started_at', du->'started_at',
    'cenario', pc->>'cenario',
    'regras', pc->'regras',
    'hints', coalesce((select jsonb_agg(x) from (select x from jsonb_array_elements_text(pc->'dicas') with ordinality t(x, i) where i <= hints) q), '[]'::jsonb),
    'hints_left', greatest(0, 3 - hints)
  );

  if stage = 'entrega' then
    ent := pc->'entrega';
    v := v || jsonb_build_object('entrega', jsonb_build_object(
      'texto', ent->>'texto', 'libera', ent->>'libera', 'tracos', ent->'tracos',
      -- O fragmento da Banca é segredo da dupla (o outro grupo assiste).
      'fragmento', case when p_role = 'espectador' then null else ent->>'fragmento' end,
      'skipped', coalesce((du->'times'->(ph::text)->>'skipped')::boolean, false)));
    return v;
  end if;
  if stage <> 'jogo' or st is null then return v; end if;

  -- ── A1 ──
  if d = 'A' and ph = 1 then
    select jsonb_agg(jsonb_build_object(
             'id', b->>'id', 'titulo', b->>'titulo', 'sealed', (st->'sealed') ? (b->>'id'),
             'items', (select jsonb_agg(
                jsonb_build_object('id', x->>'id', 'n', (x->>'n')::int, 'read', (st->'read') ? (x->>'id'))
                || case when (full_ or p_role = 'interrogador') and (st->'read') ? (x->>'id') then jsonb_build_object('texto', x->>'texto', 'tipo', x->>'tipo', 'args', x->'args') else '{}'::jsonb end
                || case when full_ or p_role = 'cruzador' then jsonb_build_object('tinta', x->>'tinta') else '{}'::jsonb end
                || case when revealed then jsonb_build_object('verdade', (x->>'verdade')::boolean, 'texto', x->>'texto', 'tipo', x->>'tipo', 'args', x->'args') else '{}'::jsonb end
                order by (x->>'n')::int)
               from jsonb_array_elements(c->'a1'->'depoimentos') x where x->>'livro' = b->>'id')) order by o)
      into books
      from jsonb_array_elements(c->'a1'->'livros') with ordinality t(b, o);
    v := v || jsonb_build_object(
      'books', books,
      'suspects', c->'a1'->'suspeitos',
      'alas', c->'a1'->'alas',
      'alas_curtas', c->'a1'->'alas_curtas',
      'marks', st->'marks',
      'inks', (st->>'inks')::int,
      'inks_max', (c->'a1'->>'tintas')::int,
      'wrong', (st->>'wrong')::int,
      'proposal', case when jsonb_typeof(st->'proposal') = 'object' then jsonb_build_object(
          'name', st->'proposal'->>'name', 'by_name', s->'players'->(st->'proposal'->>'by')->>'name',
          'mine', st->'proposal'->>'by' = p_me) end);
    if revealed then v := v || jsonb_build_object('solucao', c->'a1'->'solucao', 'culpado', c->'a1'->>'culpado'); end if;

  -- ── B1 ──
  elsif d = 'B' and ph = 1 then
    v := v || jsonb_build_object(
      'seats', (c->'b1'->>'assentos')::int,
      'scratch', st->>'scratch',
      'board', coalesce(st->'board', '{}'::jsonb),
      'wrong', (st->>'wrong')::int,
      'deadline', (st->>'deadline')::bigint,
      'guests', c->'b1'->'pessoas',
      'proposal', case when jsonb_typeof(st->'proposal') = 'object' then jsonb_build_object(
          'name', st->'proposal'->>'name', 'by_name', s->'players'->(st->'proposal'->>'by')->>'name',
          'mine', st->'proposal'->>'by' = p_me) end);
    if full_ or p_role = 'mascaras' then
      v := v || jsonb_build_object('masks', c->'b1'->'mascaras',
        'mask_rules', (select jsonb_agg(jsonb_build_object('n', (x->>'n')::int, 'texto', x->'mascaras'->>'texto', 'op', x->'mascaras'->>'op', 'k', x->'mascaras'->'k') order by (x->>'n')::int) from jsonb_array_elements(c->'b1'->'valsas') x));
    end if;
    if full_ or p_role = 'nomes' then
      v := v || jsonb_build_object('people', c->'b1'->'pessoas', 'motivos', c->'b1'->'motivos',
        'people_rules', (select jsonb_agg(jsonb_build_object('n', (x->>'n')::int, 'texto', x->'pessoas'->>'texto', 'op', x->'pessoas'->>'op', 'k', x->'pessoas'->'k') order by (x->>'n')::int) from jsonb_array_elements(c->'b1'->'valsas') x));
    end if;
    v := v || jsonb_build_object('operacoes', c->'b1'->'operacoes');
    if revealed then v := v || jsonb_build_object('solucao', jsonb_build_object('assento', (c->'b1'->>'assento_final')::int, 'culpado', c->'b1'->>'culpado', 'esperado', c->'b1'->'esperado')); end if;
  end if;
  return v;
end $$;

create or replace function public.enigma_view(p_room uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.enigma_rooms;
  s jsonb;
  c jsonb;
  me text := auth.uid()::text;
  gm boolean;
  d text;
  other text;
  role text;
  v jsonb;
  dup jsonb := '{}'::jsonb;
  x text;
  players jsonb;
begin
  select * into r from public.enigma_rooms where id = p_room;
  if r.id is null or not public.is_campaign_member(r.campaign_id, auth.uid()) then raise exception 'Sala não encontrada.'; end if;
  select state into s from public.enigma_state where room_id = p_room;
  c := public.enigma_content(s->>'game');
  gm := public.is_campaign_master(r.campaign_id, auth.uid());
  d := public.enigma__dupla(s, auth.uid());
  other := case d when 'A' then 'B' when 'B' then 'A' end;
  role := public.enigma__role(s, auth.uid());

  select coalesce(jsonb_agg(jsonb_build_object(
           'uid', k, 'name', p->>'name', 'consent', (p->>'consent')::boolean,
           'has_memory', length(coalesce(p->>'memory', '')) > 0,
           'roll', (s->'draw'->'rolls'->>k)::int,
           'dupla', public.enigma__dupla(s, k::uuid))
           || case when gm then jsonb_build_object('memory', p->>'memory') else '{}'::jsonb end
         order by p->>'name'), '[]'::jsonb)
    into players
    from jsonb_each(s->'players') e(k, p);

  foreach x in array array['A', 'B'] loop
    if s->'duplas' ? x then
      dup := dup || jsonb_build_object(x, jsonb_build_object(
        'nome', c->'historia'->'duplas'->x->>'nome',
        'lugar', c->'historia'->'duplas'->x->>'lugar',
        'segue', c->'historia'->'duplas'->x->>'segue',
        'phase', (s->'duplas'->x->>'phase')::int,
        'stage', s->'duplas'->x->>'stage',
        'members', (select jsonb_agg(jsonb_build_object('uid', m, 'name', s->'players'->m->>'name',
                                     'role', public.enigma__role(s, m::uuid)) order by o)
                    from jsonb_array_elements_text(s->'duplas'->x->'members') with ordinality t(m, o)),
        'fases', c->'historia'->'fases'->x));
    end if;
  end loop;

  v := jsonb_build_object(
    'room', jsonb_build_object('id', r.id, 'status', r.status, 'paused', r.paused, 'paused_by', s->>'paused_by', 'version', r.version),
    'now', public.enigma__ms(),
    'historia', jsonb_build_object('nome', c->'historia'->>'nome', 'abertura', c->'historia'->'abertura',
                                   'consentimento', c->'historia'->'consentimento', 'memoria_padrao', c->'historia'->>'memoria_padrao'),
    'me', jsonb_build_object('uid', me, 'gm', gm, 'joined', s->'players' ? me,
                             'consent', coalesce((s->'players'->me->>'consent')::boolean, false),
                             'memory', coalesce(s->'players'->me->>'memory', ''),
                             'dupla', d, 'role', role,
                             'dupla_abertura', case when d is not null then c->'historia'->'duplas'->d->>'abertura' end),
    'players', players,
    'drawn', s ? 'draw',
    'duplas', dup
  );

  if gm then
    v := v || jsonb_build_object('gm', jsonb_build_object(
      'events', coalesce(s->'events', '[]'::jsonb),
      'A', case when s->'duplas' ? 'A' then jsonb_build_object(
             'view', public.enigma__phase_view(s, 'A', 'mestre', me),
             'score', (s->'duplas'->'A'->>'score')::int, 'hints', coalesce((s->'duplas'->'A'->>'hints')::int, 0),
             'times', s->'duplas'->'A'->'times', 'fragments', s->'duplas'->'A'->'fragments',
             'revealed', coalesce((s->'duplas'->'A'->'revealed'->>(s->'duplas'->'A'->>'phase'))::boolean, false)) end,
      'B', case when s->'duplas' ? 'B' then jsonb_build_object(
             'view', public.enigma__phase_view(s, 'B', 'mestre', me),
             'score', (s->'duplas'->'B'->>'score')::int, 'hints', coalesce((s->'duplas'->'B'->>'hints')::int, 0),
             'times', s->'duplas'->'B'->'times', 'fragments', s->'duplas'->'B'->'fragments',
             'revealed', coalesce((s->'duplas'->'B'->'revealed'->>(s->'duplas'->'B'->>'phase'))::boolean, false)) end));
  elsif d is not null and r.status <> 'lobby' then
    v := v || jsonb_build_object(
      'mine', public.enigma__phase_view(s, d, role, me),
      'other', public.enigma__phase_view(s, other, 'espectador', me));
  end if;
  return v;
end $$;

revoke all on function public.enigma__ms() from public, anon;
revoke all on function public.enigma__log(jsonb, text, text) from public, anon, authenticated;
revoke all on function public.enigma__dupla(jsonb, uuid) from public, anon, authenticated;
revoke all on function public.enigma__role(jsonb, uuid) from public, anon, authenticated;
revoke all on function public.enigma__init_phase(jsonb, text, int) from public, anon, authenticated;
revoke all on function public.enigma__finish_phase(jsonb, text, boolean) from public, anon, authenticated;
revoke all on function public.enigma__shift_clocks(jsonb, bigint) from public, anon, authenticated;
revoke all on function public.enigma__phase_view(jsonb, text, text, text) from public, anon, authenticated;
revoke all on function public.enigma__name(uuid) from public, anon, authenticated;
revoke all on function public.enigma_open(uuid, text) from public, anon;
revoke all on function public.enigma_lobby(uuid, jsonb) from public, anon;
revoke all on function public.enigma_gm(uuid, jsonb) from public, anon;
revoke all on function public.enigma_play(uuid, jsonb) from public, anon;
revoke all on function public.enigma_view(uuid) from public, anon;
grant execute on function public.enigma_open(uuid, text) to authenticated;
grant execute on function public.enigma_lobby(uuid, jsonb) to authenticated;
grant execute on function public.enigma_gm(uuid, jsonb) to authenticated;
grant execute on function public.enigma_play(uuid, jsonb) to authenticated;
grant execute on function public.enigma_view(uuid) to authenticated;
