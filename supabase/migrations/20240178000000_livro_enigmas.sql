-- ════════════════════════════════════════════════════════
-- O Livro Bloqueado — marco 2: os enigmas. É UM enigma com quatro portas
-- (castiçal, retrato, astrolábio, estante) e o pedestal no centro, que
-- mostra o estado da "máquina" e recebe as 4 respostas.
--
-- O segredo de cada partida (lb_state.game.secret) é sorteado ao começar e
-- NUNCA vai pro navegador: a visão de cada um (lb__game_view) só traz o que
-- a dupla já conseguiu ver. As jogadas passam por lb_play, que confere tudo.
--
-- Encadeamento (versão aprovada):
--   • Castiçal: 3 velas acendem; 4 têm o pavio selado. Com as 3 acesas, o
--     retrato recebe luz parcial e mostra a silhueta = a ORDEM de abrir os
--     4 pavios selados (errou: tudo sela de novo). Sombras das velas acesas
--     têm forma de símbolo (pista do astrolábio). Com as 7 acesas e olhando
--     do ÂNGULO certo, as sombras formam um número de 4 dígitos.
--   • Retrato: no escuro, 2 símbolos nos cantos; com luz parcial, os 4 e a
--     silhueta; com luz total + ângulo certo, o rosto (um dos dois bonecos)
--     → medalhão, e o quadro de tradução (glifo → letra).
--   • Astrolábio: 4 encaixes com runas; o símbolo certo de cada encaixe é a
--     sombra que cai no gancho daquela runa. Certo: o ponteiro mostra o
--     ÂNGULO (1 de 8 marcas). A tampa abre com a chave de bronze e mostra a
--     ORDEM das correntes do pedestal.
--   • Estante: puxar os livros nas posições do NÚMERO das sombras, na ordem
--     (errou: voltam todos); aparece uma palavra em glifos. A palavra certa
--     + o medalhão abrem a gaveta secreta → chave de bronze.
--   • Pedestal: 4 correntes — I castiçal (número), II retrato (os 4
--     símbolos dos cantos), III astrolábio (ângulo), IV estante (palavra) —
--     abertas na ordem da tampa. Errou valor ou ordem: todas se apertam.
-- ════════════════════════════════════════════════════════

-- ── 1. Ajudantes ────────────────────────────────────────

create or replace function public.lb__shuffle(p jsonb)
returns jsonb language sql volatile as $$
  select coalesce(jsonb_agg(x order by random()), '[]'::jsonb) from jsonb_array_elements(p) x
$$;

-- Uma partida nova: o segredo sorteado e o estado inicial.
create or replace function public.lb__new_game()
returns jsonb
language plpgsql volatile
as $$
declare
  idx     jsonb := public.lb__shuffle('[0,1,2,3,4,5,6]');
  syms    jsonb := public.lb__shuffle('["sol","lua","estrela","cruz"]');
  nat     jsonb;
  sealed  jsonb;
  keyc    int;
  words   text[] := array['LUME', 'VELA', 'SINO', 'NOME', 'ROSA', 'MURO', 'SELO', 'RUNA', 'LIRA', 'CERA'];
  word    text;
  pool    jsonb;
  letters jsonb;
  glyphs  jsonb := public.lb__shuffle('[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]');
  tbl     jsonb := '[]'::jsonb;
  sl      jsonb := '[false,false,false,false,false,false,false]'::jsonb;
  k       int;
begin
  nat     := jsonb_build_array(idx->0, idx->1, idx->2);
  sealed  := jsonb_build_array(idx->3, idx->4, idx->5, idx->6);   -- já na ordem certa de abrir
  keyc    := (sealed->>(floor(random() * 4))::int)::int;          -- o selado cuja sombra completa os 4 símbolos
  word    := words[1 + floor(random() * array_length(words, 1))::int];
  for k in 0..3 loop sl := jsonb_set(sl, array[sealed->>k], 'true'); end loop;

  -- quadro de tradução: as 4 letras da palavra + 6 que não estão nela, cada uma com um glifo
  select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) into pool
    from (select c from unnest(string_to_array('A,B,C,D,E,F,G,I,L,M,N,O,P,R,S,T,U,V', ',')) c
          where position(c in word) = 0 order by random() limit 6) q;
  select jsonb_agg(to_jsonb(substr(word, n, 1))) into letters from generate_series(1, 4) n;
  letters := public.lb__shuffle(letters || pool);
  for k in 0..9 loop tbl := tbl || jsonb_build_array(jsonb_build_object('l', letters->>k, 'g', glyphs->k)); end loop;

  return jsonb_build_object(
    'secret', jsonb_build_object(
      'corners',     public.lb__shuffle('["sol","lua","estrela","cruz"]'),  -- cantos: sup.esq, sup.dir, inf.esq, inf.dir
      'natural',     nat,
      'seal_order',  sealed,
      'key_candle',  keyc,
      'shadow',      jsonb_build_object(nat->>0, syms->0, nat->>1, syms->1, nat->>2, syms->2, keyc::text, syms->3),
      'slot_runes',  public.lb__shuffle(jsonb_build_array(nat->0, nat->1, nat->2, keyc)),  -- encaixes N, L, S, O
      'angle',       2 + floor(random() * 7)::int,
      'number',      (select jsonb_agg(x) from (select x from jsonb_array_elements('[1,2,3,4,5,6,7,8,9]'::jsonb) x order by random() limit 4) q),
      'word',        word,
      'table',       tbl,
      'face',        floor(random() * 2)::int,
      'chain_order', public.lb__shuffle('[1,2,3,4]')),
    'st', jsonb_build_object(
      'lit',          '[false,false,false,false,false,false,false]'::jsonb,
      'sealed',       sl,
      'seal_n',       0,
      'cast_view',    1,
      'ret_view',     1,
      'slots',        '[null,null,null,null]'::jsonb,
      'pointer',      0,
      'angle_found',  false,
      'books',        public.lb__shuffle('[0,1,2,3,4,5,6,7,8,9,10,11]'),
      'pulled',       '[]'::jsonb,
      'word_ok',      false,
      'drawer',       false,
      'lid',          false,
      'inv',          jsonb_build_object('medalhao', false, 'chave', false),
      'seen_partial', false,
      'num_seen',     false,
      'face_seen',    false,
      'chains',       '[]'::jsonb,
      'opened',       false,
      'finished_at',  null));
end $$;

-- Luz no retrato: 'escuro', 'parcial' (as 3 velas naturais acesas) ou 'total' (as 7).
create or replace function public.lb__light(sec jsonb, st jsonb)
returns text language sql immutable as $$
  select case
    when not exists (select 1 from jsonb_array_elements(st->'lit') x where x <> 'true'::jsonb) then 'total'
    when not exists (select 1 from jsonb_array_elements_text(sec->'natural') n where st->'lit'->>(n::int) <> 'true') then 'parcial'
    else 'escuro' end
$$;

-- Símbolos que a dupla já viu no retrato (os do astrolábio e do pedestal saem daqui).
create or replace function public.lb__known(sec jsonb, st jsonb)
returns jsonb language sql immutable as $$
  select case when (st->>'seen_partial')::boolean or public.lb__light(sec, st) <> 'escuro'
    then sec->'corners'
    else jsonb_build_array(sec->'corners'->0, sec->'corners'->3) end
$$;

-- ── 2. O que a dupla (e quem assiste) vê ────────────────

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
  if (st->>'seal_n')::int > 0 or full_ then links := links || '[["retrato","castical"]]'; end if;
  if filled then links := links || '[["retrato","astrolabio"]]'; end if;
  if found then links := links || '[["castical","astrolabio"]]'; end if;
  if (st->>'num_seen')::boolean then links := links || '[["astrolabio","castical"]]'; end if;
  if (st->>'face_seen')::boolean then links := links || '[["astrolabio","retrato"]]'; end if;
  if npulled > 0 or (st->>'word_ok')::boolean then links := links || '[["castical","estante"]]'; end if;
  if (st->>'word_ok')::boolean then links := links || '[["retrato","estante"]]'; end if;
  if (st->>'lid')::boolean then links := links || '[["estante","astrolabio"]]'; end if;

  return jsonb_build_object(
    'light', light,
    'cast', jsonb_build_object(
      'lit',     st->'lit',
      'sealed',  st->'sealed',
      'view',    st->'cast_view',
      'shadows', shadows,
      'digits',  case when full_ and (st->>'cast_view')::int = angle then sec->'number' end),
    'ret', jsonb_build_object(
      'view',       st->'ret_view',
      'corners',    jsonb_build_array(sec->'corners'->0, case when part then sec->'corners'->1 end, case when part then sec->'corners'->2 end, sec->'corners'->3),
      'silhouette', case when part then sec->'seal_order' end,
      'face',       case when full_ and (st->>'ret_view')::int = angle then sec->'face' end,
      'table',      case when full_ and (st->>'ret_view')::int = angle then sec->'table' end),
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
      'glyphs',  (select coalesce(jsonb_agg(t->'g' order by n), '[]'::jsonb)
                  from generate_series(1, npulled) n, jsonb_array_elements(sec->'table') t
                  where t->>'l' = substr(sec->>'word', n, 1)),
      'word_ok', st->'word_ok',
      'drawer',  st->'drawer'),
    'ped', jsonb_build_object(
      'chains',   st->'chains',
      'opened',   st->'opened',
      'progress', jsonb_build_object(
        'castical',   case when (st->>'num_seen')::boolean then 3 when full_ then 2 when st->'lit' @> '[true]' then 1 else 0 end,
        'retrato',    case when (st->'inv'->>'medalhao')::boolean then 3 when (st->>'face_seen')::boolean then 2 when (st->>'seen_partial')::boolean then 1 else 0 end,
        'astrolabio', case when (st->>'lid')::boolean then 3 when found then 2 when filled then 1 else 0 end,
        'estante',    case when (st->>'drawer')::boolean then 3 when (st->>'word_ok')::boolean then 2 when npulled > 0 then 1 else 0 end),
      'links', links),
    'inv', st->'inv',
    'finished_at', st->'finished_at');
end $$;

-- ── 3. As jogadas (só quem está jogando) ────────────────

create or replace function public.lb_play(p_room uuid, p_action jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r      public.lb_rooms;
  s      jsonb;
  sec    jsonb;
  st     jsonb;
  me     text := auth.uid()::text;
  a      text := p_action->>'a';
  ok     boolean := true;
  msg    text := null;
  i      int;
  n      int;
  v      int;
  k      int;
  sym    text;
  txt    text;
  angle  int;
  val    jsonb;
  good   boolean;
begin
  select * into r from public.lb_rooms where id = p_room for update;
  if r.id is null then raise exception 'Sala não encontrada.'; end if;
  if r.status <> 'jogo' then raise exception 'O jogo não está rolando.'; end if;
  select state into s from public.lb_state where room_id = p_room for update;
  if not (s->'players' ? me) then raise exception 'Só quem está jogando mexe nos objetos.'; end if;
  if not (s ? 'game') then raise exception 'O jogo ainda não começou.'; end if;
  sec := s->'game'->'secret';
  st  := s->'game'->'st';
  angle := (sec->>'angle')::int;
  if (st->>'opened')::boolean then return jsonb_build_object('ok', false, 'msg', 'O livro já foi aberto.'); end if;

  if a = 'light' then
    -- ── Castiçal: acender / abrir pavio selado ──
    i := (p_action->>'i')::int;
    if i is null or i < 0 or i > 6 then raise exception 'Vela inválida.'; end if;
    if st->'sealed'->>i = 'true' then
      n := (st->>'seal_n')::int;
      if (sec->'seal_order'->>n)::int = i then
        st := jsonb_set(jsonb_set(jsonb_set(st, array['sealed', i::text], 'false'), array['lit', i::text], 'true'), '{seal_n}', to_jsonb(n + 1));
        msg := case when n + 1 = 4 then 'Os quatro pavios se abriram.' else 'A cera do pavio se parte.' end;
      else
        for k in 0..3 loop
          st := jsonb_set(jsonb_set(st, array['sealed', sec->'seal_order'->>k], 'true'), array['lit', sec->'seal_order'->>k], 'false');
        end loop;
        st := jsonb_set(st, '{seal_n}', '0');
        ok := false;
        msg := 'A cera escorre e endurece de novo. A ordem estava errada.';
      end if;
    else
      st := jsonb_set(st, array['lit', i::text], to_jsonb(not (st->'lit'->>i)::boolean));
    end if;

  elsif a = 'cast_view' or a = 'ret_view' then
    v := (p_action->>'v')::int;
    if v is null or v < 1 or v > 8 then raise exception 'Marca inválida.'; end if;
    st := jsonb_set(st, array[a], to_jsonb(v));

  elsif a = 'slot' then
    -- ── Astrolábio: pôr/tirar símbolo num encaixe ──
    if (st->>'angle_found')::boolean then raise exception 'Os encaixes já travaram.'; end if;
    k := (p_action->>'k')::int;
    if k is null or k < 0 or k > 3 then raise exception 'Encaixe inválido.'; end if;
    sym := p_action->>'sym';
    if sym is not null then
      if not (public.lb__known(sec, st) ? sym) then raise exception 'Vocês ainda não viram esse símbolo.'; end if;
      for n in 0..3 loop
        if st->'slots'->>n = sym then st := jsonb_set(st, array['slots', n::text], 'null'); end if;
      end loop;
    end if;
    st := jsonb_set(st, array['slots', k::text], coalesce(to_jsonb(sym), 'null'::jsonb));
    if not exists (select 1 from jsonb_array_elements(st->'slots') x where x = 'null'::jsonb) then
      good := true;
      for n in 0..3 loop
        if st->'slots'->>n <> sec->'shadow'->>(sec->'slot_runes'->>n) then good := false; end if;
      end loop;
      if good then
        st := jsonb_set(jsonb_set(st, '{angle_found}', 'true'), '{pointer}', to_jsonb(angle - 1));
        msg := 'O ponteiro gira sozinho... e para numa das marcas.';
      else
        ok := false;
        msg := 'O ponteiro estremece, mas não sai do lugar.';
      end if;
    end if;

  elsif a = 'spin' then
    if not (st->>'angle_found')::boolean then
      v := (p_action->>'p')::int;
      if v is null or v < 0 or v > 7 then raise exception 'Posição inválida.'; end if;
      st := jsonb_set(st, '{pointer}', to_jsonb(v));
    end if;

  elsif a = 'lid' then
    if (st->>'lid')::boolean then return jsonb_build_object('ok', true); end if;
    if not (st->'inv'->>'chave')::boolean then
      ok := false;
      msg := 'A tampa está trancada. Há um buraco de fechadura pequeno, de bronze.';
    else
      st := jsonb_set(st, '{lid}', 'true');
      msg := 'A chave gira. A tampa se abre: há quatro números gravados.';
    end if;

  elsif a = 'medal' then
    -- ── Retrato: pegar o medalhão (só com o rosto à vista) ──
    if public.lb__light(sec, st) <> 'total' or (st->>'ret_view')::int <> angle then raise exception 'Não dá pra ver o rosto daqui.'; end if;
    st := jsonb_set(st, '{inv,medalhao}', 'true');
    msg := 'Você solta o medalhão da moldura.';

  elsif a = 'books' then
    -- ── Estante: reordenar (não muda nada... e devolve os puxados) ──
    val := p_action->'order';
    if jsonb_typeof(val) <> 'array' or jsonb_array_length(val) <> 12
       or (select count(distinct x) from jsonb_array_elements_text(val) x where x ~ '^([0-9]|1[01])$') <> 12 then
      raise exception 'Ordem inválida.';
    end if;
    st := jsonb_set(st, '{books}', val);
    if not (st->>'word_ok')::boolean then st := jsonb_set(st, '{pulled}', '[]'); end if;

  elsif a = 'pull' then
    if (st->>'word_ok')::boolean then return jsonb_build_object('ok', true); end if;
    i := (p_action->>'pos')::int;
    if i is null or i < 1 or i > 12 then raise exception 'Posição inválida.'; end if;
    n := jsonb_array_length(st->'pulled');
    if n >= 4 or st->'pulled' @> to_jsonb(array[i]) then return jsonb_build_object('ok', true); end if;
    if (sec->'number'->>n)::int = i then
      st := jsonb_set(st, '{pulled}', (st->'pulled') || to_jsonb(i));
      msg := case when n + 1 = 4 then 'Atrás dos livros, uma frase gravada. Nas lombadas, uma palavra em símbolos.' else 'O livro desliza pra fora. Um símbolo aparece na lombada.' end;
    else
      st := jsonb_set(st, '{pulled}', '[]');
      ok := false;
      msg := 'Um estalo: os livros voltam todos pro lugar.';
    end if;

  elsif a = 'word' or a = 'drawer' then
    if a = 'word' then
      if jsonb_array_length(st->'pulled') < 4 then raise exception 'Ainda não há palavra nenhuma.'; end if;
      txt := upper(trim(coalesce(p_action->>'text', '')));
      if txt <> sec->>'word' then
        return jsonb_build_object('ok', false, 'msg', 'Nada acontece.');
      end if;
      st := jsonb_set(st, '{word_ok}', 'true');
    end if;
    if not (st->>'word_ok')::boolean then raise exception 'Nada acontece.'; end if;
    if (st->>'drawer')::boolean then
      msg := null;
    elsif (st->'inv'->>'medalhao')::boolean then
      st := jsonb_set(jsonb_set(st, '{drawer}', 'true'), '{inv,chave}', 'true');
      msg := 'O medalhão encaixa. A gaveta secreta se abre: uma chave de bronze.';
    else
      ok := a = 'word';
      msg := 'Algo destrava atrás dos livros. Uma gaveta escondida tem um encaixe redondo, vazio.';
    end if;

  elsif a = 'chain' then
    -- ── Pedestal: abrir uma corrente ──
    n := (p_action->>'n')::int;
    if n is null or n < 1 or n > 4 then raise exception 'Corrente inválida.'; end if;
    if st->'chains' @> to_jsonb(array[n]) then return jsonb_build_object('ok', true); end if;
    val := p_action->'value';
    good := case n
      when 1 then coalesce(val #>> '{}', '') = (select string_agg(x, '' order by o) from jsonb_array_elements_text(sec->'number') with ordinality t(x, o))
      when 2 then val = sec->'corners'
      when 3 then (val #>> '{}') = angle::text
      when 4 then upper(trim(coalesce(val #>> '{}', ''))) = sec->>'word'
    end;
    if good and (sec->'chain_order'->>jsonb_array_length(st->'chains'))::int = n then
      st := jsonb_set(st, '{chains}', (st->'chains') || to_jsonb(n));
      if jsonb_array_length(st->'chains') = 4 then
        st := jsonb_set(jsonb_set(st, '{opened}', 'true'), '{finished_at}', to_jsonb(public.lb__ms()));
        msg := 'As quatro correntes caem. O livro se abre.';
      else
        msg := 'A fechadura cede. A corrente cai.';
      end if;
    else
      st := jsonb_set(st, '{chains}', '[]');
      ok := false;
      msg := case when good then 'A fechadura gira... e as outras correntes se apertam de novo. Não era a vez dela.'
                  else 'A fechadura não cede. As correntes se apertam.' end;
    end if;

  else
    raise exception 'Ação desconhecida.';
  end if;

  -- marcas do que a dupla já viu (o diagrama do pedestal usa)
  if public.lb__light(sec, st) <> 'escuro' then st := jsonb_set(st, '{seen_partial}', 'true'); end if;
  if public.lb__light(sec, st) = 'total' and (st->>'cast_view')::int = angle then st := jsonb_set(st, '{num_seen}', 'true'); end if;
  if public.lb__light(sec, st) = 'total' and (st->>'ret_view')::int = angle then st := jsonb_set(st, '{face_seen}', 'true'); end if;

  s := jsonb_set(s, '{game,st}', st);
  if msg is not null then
    s := jsonb_set(s, '{events}', (coalesce(s->'events', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('t', public.lb__ms(), 'm', public.lb__name(auth.uid()) || ': ' || msg))));
    if jsonb_array_length(s->'events') > 200 then s := jsonb_set(s, '{events}', (s->'events') - 0); end if;
  end if;
  perform public.lb__save(p_room, s);
  return jsonb_build_object('ok', ok, 'msg', msg);
end $$;

-- ── 4. Mestre: começar cria a partida; recomeçar sorteia outra ──

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
    if not (s ? 'game') then s := s || jsonb_build_object('game', public.lb__new_game()); end if;
    s := jsonb_set(s, '{started_at}', to_jsonb(public.lb__ms()));
  elsif a = 'reset' then
    -- Recomeçar: outra partida, com outro segredo.
    s := s || jsonb_build_object('game', public.lb__new_game(), 'events', '[]'::jsonb);
    if r.status = 'jogo' then s := jsonb_set(s, '{started_at}', to_jsonb(public.lb__ms())); end if;
  elsif a = 'lobby' then
    update public.lb_rooms set status = 'lobby' where id = p_room;
  elsif a = 'close' then
    update public.lb_rooms set status = 'fim' where id = p_room;
  else
    raise exception 'Ação desconhecida.';
  end if;

  perform public.lb__save(p_room, s);
end $$;

-- ── 5. A visão de cada um (agora com o jogo) ────────────

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
  players jsonb := '[]'::jsonb;
  i int;
  u text;
  v jsonb;
begin
  select * into r from public.lb_rooms where id = p_room;
  if r.id is null or not public.is_campaign_member(r.campaign_id, auth.uid()) then raise exception 'Sala não encontrada.'; end if;
  select state into s from public.lb_state where room_id = p_room;
  gm := public.is_campaign_master(r.campaign_id, auth.uid());

  for i in 0 .. jsonb_array_length(s->'players') - 1 loop
    u := s->'players'->>i;
    players := players || jsonb_build_array(jsonb_build_object('uid', u, 'name', public.lb__name(u::uuid), 'slot', i));
  end loop;

  v := jsonb_build_object(
    'room', jsonb_build_object('id', r.id, 'campaign_id', r.campaign_id, 'status', r.status, 'version', r.version),
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
    'game', case when s ? 'game' then public.lb__game_view(s->'game'->'secret', s->'game'->'st') end);

  -- O mestre vê também a solução e a linha do tempo (pra ajudar, se precisar).
  if gm and s ? 'game' then
    v := v || jsonb_build_object('gm', jsonb_build_object('secret', s->'game'->'secret', 'events', coalesce(s->'events', '[]'::jsonb)));
  end if;
  return v;
end $$;

-- ── 6. Permissões ───────────────────────────────────────

revoke all on function public.lb__shuffle(jsonb) from public, anon, authenticated;
revoke all on function public.lb__new_game() from public, anon, authenticated;
revoke all on function public.lb__light(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.lb__known(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.lb__game_view(jsonb, jsonb) from public, anon, authenticated;

revoke all on function public.lb_play(uuid, jsonb) from public, anon;
grant execute on function public.lb_play(uuid, jsonb) to authenticated;
grant execute on function public.lb_gm(uuid, jsonb) to authenticated;
grant execute on function public.lb_view(uuid) to authenticated;
