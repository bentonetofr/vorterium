-- ════════════════════════════════════════════════════════
-- O Livro Bloqueado — marco 3 (e um ajuste na Torre):
--   • Dica do mestre: no painel do mestre dá pra mandar uma dica
--     (sugerida pela etapa da dupla ou escrita na hora); aparece pra todo
--     mundo da sala por 25 s. Recomeçar apaga a dica. (Igual à Torre.)
--   • Rosto com 1 jogador: o rosto do retrato é sempre de quem está
--     jogando (antes podia sair o da Capa Vermelha, que não existia).
--   • Mestre jogando: se o mestre se escolhe pra jogar, a solução e a
--     linha do tempo NÃO vão pro navegador dele — no Livro e na Torre.
--   • Diagrama do pedestal: o retrato fica na etapa 3 depois que o
--     medalhão vai pra gaveta (antes voltava pra 2, porque o medalhão sai
--     do inventário ao ser usado).
-- As funções partem das versões mais novas (correções do Livro e troca de
-- jogo) e só ganham as linhas novas.
-- ════════════════════════════════════════════════════════

-- ── 1. Mestre: dica e rosto ─────────────────────────────

create or replace function public.lb_gm(p_room uuid, p_action jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.lb_rooms;
  s jsonb;
  a text := p_action->>'a';
  picked jsonb;
  u text;
  txt text;
begin
  select * into r from public.lb_rooms where id = p_room for update;
  if r.id is null then raise exception 'Sala não encontrada.'; end if;
  if not public.is_campaign_master(r.campaign_id, auth.uid()) then raise exception 'Só o mestre.'; end if;
  if r.status = 'fim' then raise exception 'Esta sala já foi encerrada.'; end if;
  select state into s from public.lb_state where room_id = p_room for update;

  if a = 'pick' then
    -- Quem joga (na ordem: o 1º é a Capa Azul, o 2º a Capa Vermelha).
    if r.status <> 'lobby' then raise exception 'Volte ao saguão pra trocar quem joga.'; end if;
    picked := coalesce(p_action->'uids', '[]'::jsonb);
    if jsonb_typeof(picked) <> 'array' or jsonb_array_length(picked) > 2 then raise exception 'Escolha até 2 jogadores.'; end if;
    for u in select jsonb_array_elements_text(picked) loop
      if not exists (select 1 from public.campaign_members where campaign_id = r.campaign_id and user_id::text = u) then
        raise exception 'Essa pessoa não é da campanha.';
      end if;
    end loop;
    if jsonb_array_length(picked) = 2 and picked->>0 = picked->>1 then raise exception 'Escolha duas pessoas diferentes.'; end if;
    s := jsonb_set(s, '{players}', picked);
  elsif a = 'start' then
    if r.status <> 'lobby' then return; end if;
    if jsonb_array_length(s->'players') < 1 then raise exception 'Escolha quem joga primeiro.'; end if;
    update public.lb_rooms set status = 'jogo' where id = p_room;
    -- Partida nova: relógio do zero. Partida que já existia (voltou do saguão): o relógio segue.
    if not (s ? 'game') then
      s := s || jsonb_build_object('game', public.lb__new_game());
      s := jsonb_set(s, '{started_at}', to_jsonb(public.lb__ms()));
    elsif s->'started_at' is null or s->'started_at' = 'null'::jsonb then
      s := jsonb_set(s, '{started_at}', to_jsonb(public.lb__ms()));
    end if;
  elsif a = 'reset' then
    -- Recomeçar: outra partida, com outro segredo (e sem a dica no ar).
    s := (s || jsonb_build_object('game', public.lb__new_game(), 'events', '[]'::jsonb)) - 'hint';
    -- (no saguão, o relógio começa no "Começar")
    s := jsonb_set(s, '{started_at}', case when r.status = 'jogo' then to_jsonb(public.lb__ms()) else 'null'::jsonb end);
  elsif a = 'hint' then
    -- Uma dica pra dupla: aparece pra todo mundo da sala por 25 s.
    if r.status <> 'jogo' then raise exception 'A dica é durante o jogo.'; end if;
    txt := trim(coalesce(p_action->>'text', ''));
    if txt = '' or length(txt) > 240 then raise exception 'A dica precisa ter de 1 a 240 letras.'; end if;
    s := s || jsonb_build_object('hint', jsonb_build_object('t', public.lb__ms(), 'text', txt));
  elsif a = 'lobby' then
    update public.lb_rooms set status = 'lobby' where id = p_room;
  elsif a = 'close' then
    update public.lb_rooms set status = 'fim' where id = p_room;
  else
    raise exception 'Ação desconhecida.';
  end if;

  -- Com 1 jogador só, o rosto do retrato é o dele (a Capa Azul).
  if s ? 'game' and jsonb_array_length(s->'players') = 1 and s->'game'->'secret'->>'face' = '1' then
    s := jsonb_set(s, '{game,secret,face}', '0');
  end if;

  perform public.lb__save(p_room, s);
end $$;

-- ── 2. As visões ────────────────────────────────────────

create or replace function public.lb__game_view(sec jsonb, st jsonb)
returns jsonb
language plpgsql immutable
as $$
declare
  light   text := public.lb__light(sec, st);
  part    boolean := light <> 'escuro';
  full_   boolean := light = 'total';
  angle   int := (sec->>'angle')::int;
  found   boolean := (st->>'angle_found')::boolean;
  at_cast boolean := full_ and found and (st->>'cast_view')::int = angle;
  at_ret  boolean := full_ and found and (st->>'ret_view')::int = angle;
  tried   jsonb := coalesce(st->'seal_try', '[]'::jsonb);
  shadows jsonb := '[]'::jsonb;
  filled  boolean := exists (select 1 from jsonb_array_elements(st->'slots') x where x <> 'null'::jsonb);
  npulled int := jsonb_array_length(st->'pulled');
  k       int;
  links   jsonb := '[]'::jsonb;
begin
  -- sombra em forma de símbolo só nas velas acesas que têm uma
  for k in 0..6 loop
    shadows := shadows || jsonb_build_array(case when st->'lit'->>k = 'true' and sec->'shadow' ? k::text then sec->'shadow'->(k::text) else 'null'::jsonb end);
  end loop;

  if (st->>'seen_partial')::boolean then links := links || '[["castical","retrato"]]'; end if;
  if (st->>'seal_n')::int > 0 or jsonb_array_length(tried) > 0 or full_ then links := links || '[["retrato","castical"]]'; end if;
  if filled then links := links || '[["retrato","astrolabio"]]'; end if;
  if found then links := links || '[["castical","astrolabio"]]'; end if;
  if (st->>'num_seen')::boolean then links := links || '[["astrolabio","castical"]]'; end if;
  if (st->>'face_seen')::boolean then links := links || '[["astrolabio","retrato"]]'; end if;
  if npulled = 4 or (st->>'word_ok')::boolean then links := links || '[["castical","estante"]]'; end if;
  if (st->>'word_ok')::boolean then links := links || '[["retrato","estante"]]'; end if;
  if (st->>'lid')::boolean then links := links || '[["estante","astrolabio"]]'; end if;

  return jsonb_build_object(
    'light', light,
    'cast', jsonb_build_object(
      'lit',     st->'lit',
      'sealed',  st->'sealed',
      'tried',   tried,
      'view',    st->'cast_view',
      'shadows', shadows,
      'digits',  case when at_cast then sec->'number' end),
    'ret', jsonb_build_object(
      'view',       st->'ret_view',
      'corners',    jsonb_build_array(sec->'corners'->0, case when part then sec->'corners'->1 end, case when part then sec->'corners'->2 end, sec->'corners'->3),
      'silhouette', case when part then sec->'seal_order' end,
      'face',       case when at_ret then sec->'face' end,
      'taken',      coalesce((st->'inv'->>'medalhao')::boolean, false),
      'table',      case when at_ret then sec->'table' end),
    'astro', jsonb_build_object(
      'runes',   sec->'slot_runes',
      'slots',   st->'slots',
      'known',   public.lb__known(sec, st),
      'angle',   case when found then angle end,
      'pointer', st->'pointer',
      'lid',     st->'lid',
      'seq',     case when (st->>'lid')::boolean then sec->'chain_order' end),
    'est', jsonb_build_object(
      'books',   st->'books',
      'pulled',  st->'pulled',
      -- os glifos só com os 4 livros certos puxados
      'glyphs',  case when npulled = 4 then
                   (select coalesce(jsonb_agg(t->'g' order by n), '[]'::jsonb)
                    from generate_series(1, 4) n, jsonb_array_elements(sec->'table') t
                    where t->>'l' = substr(sec->>'word', n, 1))
                 else '[]'::jsonb end,
      'word_ok', st->'word_ok',
      'drawer',  st->'drawer'),
    'ped', jsonb_build_object(
      'chains',   st->'chains',
      'opened',   st->'opened',
      'progress', jsonb_build_object(
        'castical',   case when (st->>'num_seen')::boolean then 3 when full_ then 2 when st->'lit' @> '[true]' then 1 else 0 end,
        'retrato',    case when (st->'inv'->>'medalhao')::boolean or (st->>'drawer')::boolean then 3 when (st->>'face_seen')::boolean then 2 when (st->>'seen_partial')::boolean then 1 else 0 end,
        'astrolabio', case when (st->>'lid')::boolean then 3 when found then 2 when filled then 1 else 0 end,
        'estante',    case when (st->>'drawer')::boolean then 3 when (st->>'word_ok')::boolean then 2 when npulled = 4 then 1 else 0 end),
      'links', links),
    -- o que a dupla carrega AGORA (o medalhão fica na gaveta; a chave, na tampa)
    'inv', jsonb_build_object(
      'medalhao', coalesce((st->'inv'->>'medalhao')::boolean, false) and not coalesce((st->>'drawer')::boolean, false),
      'chave',    coalesce((st->'inv'->>'chave')::boolean, false) and not coalesce((st->>'lid')::boolean, false)),
    'finished_at', st->'finished_at');
end $$;

create or replace function public.lb_view(p_room uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.lb_rooms;
  s jsonb;
  me text := auth.uid()::text;
  gm boolean;
  slot int;
  players jsonb := '[]'::jsonb;
  i int;
  u text;
  v jsonb;
begin
  select * into r from public.lb_rooms where id = p_room;
  if r.id is null or not public.is_campaign_member(r.campaign_id, auth.uid()) then raise exception 'Sala não encontrada.'; end if;
  select state into s from public.lb_state where room_id = p_room;
  gm := public.is_campaign_master(r.campaign_id, auth.uid());
  slot := (select (x.ord - 1)::int from jsonb_array_elements_text(s->'players') with ordinality x(val, ord) where x.val = me);

  for i in 0 .. jsonb_array_length(s->'players') - 1 loop
    u := s->'players'->>i;
    players := players || jsonb_build_array(jsonb_build_object('uid', u, 'name', public.lb__name(u::uuid), 'slot', i));
  end loop;

  v := jsonb_build_object(
    'room', jsonb_build_object('id', r.id, 'campaign_id', r.campaign_id, 'status', r.status, 'version', r.version, 'paused', r.paused_at is not null),
    -- onde cada boneco estava (pra voltar ao mesmo lugar depois de uma troca de jogo)
    'pos', coalesce(s->'pos', '{}'::jsonb),
    'now', public.lb__ms(),
    'started_at', (s->>'started_at')::bigint,
    'me', jsonb_build_object(
      'uid', me,
      'gm', gm,
      'slot', (select (x.ord - 1)::int from jsonb_array_elements_text(s->'players') with ordinality x(val, ord) where x.val = me)),
    'players', players,
    'members', (select coalesce(jsonb_agg(jsonb_build_object('uid', m.user_id, 'name', public.lb__name(m.user_id), 'role', m.role)
                                 order by (m.role = 'master') desc, public.lb__name(m.user_id)), '[]'::jsonb)
                from public.campaign_members m where m.campaign_id = r.campaign_id),
    'game', case when s ? 'game' then public.lb__game_view(s->'game'->'secret', s->'game'->'st') end,
    -- a dica do mestre, enquanto vale (25 s)
    'hint', case when s ? 'hint' and public.lb__ms() - (s->'hint'->>'t')::bigint < 25000 then s->'hint' end);

  -- O mestre vê também a solução e a linha do tempo (pra ajudar, se precisar)
  -- — a não ser que ele mesmo esteja jogando.
  if gm and slot is null and s ? 'game' then
    v := v || jsonb_build_object('gm', jsonb_build_object('secret', s->'game'->'secret', 'events', coalesce(s->'events', '[]'::jsonb)));
  end if;
  return v;
end $$;

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
    'room', jsonb_build_object('id', r.id, 'campaign_id', r.campaign_id, 'status', r.status, 'version', r.version, 'paused', r.paused_at is not null),
    -- onde cada boneco estava: quem joga só recebe a sua (o outro andar não se vê); quem assiste, todas
    'pos', case when slot is null then coalesce(s->'pos', '{}'::jsonb)
                else jsonb_strip_nulls(jsonb_build_object(me, s->'pos'->me)) end,
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

  -- O mestre vê também a solução e a linha do tempo (pra ajudar, se precisar)
  -- — a não ser que ele mesmo esteja jogando.
  if gm and slot is null and s ? 'game' then
    v := v || jsonb_build_object('gm', jsonb_build_object('secret', s->'game'->'secret', 'events', coalesce(s->'events', '[]'::jsonb)));
  end if;
  return v;
end $$;

-- ── 3. Permissões ───────────────────────────────────────

revoke all on function public.lb__game_view(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.lb_gm(uuid, jsonb) from public, anon;
revoke all on function public.lb_view(uuid) from public, anon;
revoke all on function public.tor_view(uuid) from public, anon;
grant execute on function public.lb_gm(uuid, jsonb) to authenticated;
grant execute on function public.lb_view(uuid) to authenticated;
grant execute on function public.tor_view(uuid) to authenticated;
