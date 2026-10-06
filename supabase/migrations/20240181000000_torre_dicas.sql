-- ════════════════════════════════════════════════════════
-- A Torre do Observatório — marco 3: a dica do mestre. No painel do
-- mestre dá pra mandar uma dica (sugerida pela etapa em que a dupla está,
-- ou escrita na hora); ela aparece pra todo mundo da sala por 25 s.
-- Recomeçar apaga a dica. Só muda tor_gm (ação "hint") e tor_view (campo
-- "hint"); o resto é o do marco 2.
-- ════════════════════════════════════════════════════════

-- ── 1. Mestre: as ações do marco 2 e agora a dica ──

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
  txt text;
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
    if jsonb_array_length(s->'players') <> 2 then raise exception 'A torre precisa de 2 jogadores: um em cima, um embaixo.'; end if;
    update public.tor_rooms set status = 'jogo' where id = p_room;
    if not (s ? 'game') then s := s || jsonb_build_object('game', public.tor__new_game()); end if;
    s := jsonb_set(s, '{started_at}', to_jsonb(public.tor__ms()));
  elsif a = 'reset' then
    -- Recomeçar: outra partida, com outro segredo.
    s := (s || jsonb_build_object('game', public.tor__new_game(), 'events', '[]'::jsonb)) - 'hint';
    if r.status = 'jogo' then s := jsonb_set(s, '{started_at}', to_jsonb(public.tor__ms())); end if;
  elsif a = 'hint' then
    -- Uma dica pros jogadores: aparece pra todo mundo por 25 s.
    if r.status <> 'jogo' then raise exception 'A dica é durante o jogo.'; end if;
    txt := trim(coalesce(p_action->>'text', ''));
    if txt = '' or length(txt) > 240 then raise exception 'A dica precisa ter de 1 a 240 letras.'; end if;
    s := s || jsonb_build_object('hint', jsonb_build_object('t', public.tor__ms(), 'text', txt));
  elsif a = 'lobby' then
    update public.tor_rooms set status = 'lobby' where id = p_room;
  elsif a = 'close' then
    update public.tor_rooms set status = 'fim' where id = p_room;
  else
    raise exception 'Ação desconhecida.';
  end if;

  perform public.tor__save(p_room, s);
end $$;

-- ── 2. A visão de cada um (agora com a dica) ──

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
  gm boolean;
  slot int;
  players jsonb := '[]'::jsonb;
  i int;
  u text;
  v jsonb;
  now_ bigint := public.tor__ms();
begin
  select * into r from public.tor_rooms where id = p_room;
  if r.id is null or not public.is_campaign_member(r.campaign_id, auth.uid()) then raise exception 'Sala não encontrada.'; end if;
  select state into s from public.tor_state where room_id = p_room;
  gm := public.is_campaign_master(r.campaign_id, auth.uid());
  slot := (select (x.ord - 1)::int from jsonb_array_elements_text(s->'players') with ordinality x(val, ord) where x.val = me);

  for i in 0 .. jsonb_array_length(s->'players') - 1 loop
    u := s->'players'->>i;
    players := players || jsonb_build_array(jsonb_build_object('uid', u, 'name', public.tor__name(u::uuid), 'slot', i));
  end loop;

  v := jsonb_build_object(
    'room', jsonb_build_object('id', r.id, 'campaign_id', r.campaign_id, 'status', r.status, 'version', r.version),
    'now', now_,
    'started_at', (s->>'started_at')::bigint,
    'me', jsonb_build_object('uid', me, 'gm', gm, 'slot', slot),
    'players', players,
    'members', (select coalesce(jsonb_agg(jsonb_build_object('uid', m.user_id, 'name', public.tor__name(m.user_id), 'role', m.role)
                                 order by (m.role = 'master') desc, public.tor__name(m.user_id)), '[]'::jsonb)
                from public.campaign_members m where m.campaign_id = r.campaign_id),
    'game', case when s ? 'game' then public.tor__game_view(s->'game'->'secret', s->'game'->'st',
                 case slot when 0 then 'cima' when 1 then 'baixo' else 'todos' end, now_) end,
    -- a dica do mestre, enquanto vale (25 s)
    'hint', case when s ? 'hint' and now_ - (s->'hint'->>'t')::bigint < 25000 then s->'hint' end);

  -- O mestre vê também a solução e a linha do tempo (pra ajudar, se precisar).
  if gm and s ? 'game' then
    v := v || jsonb_build_object('gm', jsonb_build_object('secret', s->'game'->'secret', 'events', coalesce(s->'events', '[]'::jsonb)));
  end if;
  return v;
end $$;

-- ── 3. Permissões ───────────────────────────────────────

revoke all on function public.tor_gm(uuid, jsonb) from public, anon;
revoke all on function public.tor_view(uuid) from public, anon;
grant execute on function public.tor_gm(uuid, jsonb) to authenticated;
grant execute on function public.tor_view(uuid) to authenticated;
