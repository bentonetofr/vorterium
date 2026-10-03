-- ════════════════════════════════════════════════════════
-- A Torre do Observatório — marco 2: os enigmas. É UM enigma com cinco
-- portas (telescópio e mapa em cima; espelhos e manivela embaixo; o
-- pêndulo atravessa os dois) e o Astrário no centro, que mostra o estado
-- da "máquina" e recebe as respostas finais — metade de cada lado.
--
-- O segredo (tor_state.game.secret) é sorteado ao começar e NUNCA vai pro
-- navegador. Cada um recebe a visão do SEU andar (tor__game_view com o
-- lado): o Observador não vê nada de baixo e o Mecânico nada de cima. Quem
-- assiste vê os dois. O que depende de tempo (as sombras do pêndulo) só
-- vem na visão DURANTE a janela: o site pede a visão de novo no começo de
-- cada janela.
--
-- O caminho (cada passo usa só o que já apareceu):
--   1. Telescópio (A): 3 estrelas brilham; as outras 4 estão apagadas.
--   2. Espelhos (B): 4 espelhos, 8 posições cada. Espelho certo → acende
--      uma estrela (cada uma de uma cor) no céu de A. A uma posição de
--      distância, a estrela só tremeluz (A guia no "quente/frio").
--      Os espelhos 1 e 2 funcionam desde o começo; com os dois certos, a
--      trava de vidro da engrenagem acende e a manivela solta.
--   3. Manivela (B): gira a cúpula (16 posições). A vê pelo telescópio uma
--      constelação diferente a cada posição; a certa é a desenhada em ouro
--      no mapa. Com a cúpula ali, os pontos dos espelhos 3 e 4 ficam sob a
--      fresta (fora dela, a luz bate no ferro da cúpula).
--   4. Espelhos 3 e 4 (B, guiado por A) → as 4 estrelas acesas.
--   5. Mapa (A): 4 buracos. Cada estrela vista vira um marcador da cor
--      dela; o mapa é visto de fora, então o buraco certo é o ESPELHADO da
--      posição no céu. Os 4 certos → o mapa gira: a borda ganha 4 casas
--      (escuras) e uma seta aponta 2 runas (o trinco da manivela).
--      Errou: os marcadores caem.
--   6. Pêndulo (B empurra): balança 60 s (5 ciclos de 12 s). Com as 4
--      estrelas acesas, a cada ciclo:
--        • 4 janelas: B vê a FORMA de um símbolo no chão; ao mesmo tempo,
--          A vê qual CASA da borda do mapa acende. Juntos: a sequência.
--        • 1 janela: só B vê um número de 3 algarismos na sombra.
--        • 1 janela: o pêndulo passa na frente da estrela mais brilhante e
--          A vê, por um instante, a 5ª estrela escondida atrás dela.
--   7. Trinco (B): as 2 argolas nas runas da seta do mapa → chave de
--      bronze. Errou: as argolas voltam ao começo.
--   8. Astrário: A põe a sequência (4 casas) e a 5ª estrela (1 de 8
--      pontos); B põe o número e a chave. Os dois giram até 3 s um do
--      outro. Certo: a cúpula se abre. Errado: o que foi posto volta (a
--      chave fica).
-- Nenhum erro faz perder a partida.
-- ════════════════════════════════════════════════════════

-- ── 1. Ajudantes ────────────────────────────────────────

create or replace function public.tor__shuffle(p jsonb)
returns jsonb language sql volatile as $$
  select coalesce(jsonb_agg(x order by random()), '[]'::jsonb) from jsonb_array_elements(p) x
$$;

-- Ritmo do pêndulo (o site tem os mesmos números pra animar).
create or replace function public.tor__period() returns int language sql immutable as $$ select 12000 $$;
create or replace function public.tor__swing_ms() returns int language sql immutable as $$ select 60000 $$;

-- Uma partida nova: o segredo sorteado e o estado inicial.
create or replace function public.tor__new_game()
returns jsonb
language plpgsql volatile
as $$
declare
  slots    jsonb := '[]'::jsonb;
  mir      jsonb := '[]'::jsonb;
  start    jsonb := '[]'::jsonb;
  patterns jsonb := '[]'::jsonb;
  pat      jsonb;
  p        int;
  k        int;
  s        int;
  dome     int := 4 + floor(random() * 9)::int;            -- 4..12 (a cúpula começa no 0)
begin
  -- Estrelas escondidas: uma de cada par espelhado {0,7} {1,6} {2,5} {3,4},
  -- pra nenhuma cair onde está o buraco de outra.
  for p in 0..3 loop
    slots := slots || to_jsonb(case when random() < 0.5 then p else 7 - p end);
  end loop;
  slots := public.tor__shuffle(slots);

  -- Espelhos: posição certa e posição inicial (nunca já certa nem vizinha).
  for k in 0..3 loop
    s := floor(random() * 8)::int;
    mir := mir || to_jsonb(s);
    start := start || to_jsonb((s + 2 + floor(random() * 5)::int) % 8);
  end loop;

  -- Uma constelação (5 pontos numa faixa de 40×18) pra cada posição da cúpula.
  for p in 0..15 loop
    select jsonb_agg(jsonb_build_array(floor(random() * 40)::int, floor(random() * 18)::int)) into pat from generate_series(1, 5);
    patterns := patterns || jsonb_build_array(pat);
  end loop;

  return jsonb_build_object(
    'secret', jsonb_build_object(
      'slots',    slots,                                                -- onde fica no céu a estrela de cada espelho (0..7)
      'mir',      mir,                                                  -- posição certa de cada espelho (0..7)
      'dome',     dome,                                                 -- posição da cúpula com a constelação (0..15)
      'patterns', patterns,                                             -- constelação vista em cada posição da cúpula
      'seq',      public.tor__shuffle('["sol","lua","estrela","cruz"]'), -- símbolo de cada casa da borda do mapa
      'order',    public.tor__shuffle('[0,1,2,3]'),                     -- ordem em que as casas aparecem no balanço
      'num',      100 + floor(random() * 900)::int,                     -- o número da sombra
      'runes',    jsonb_build_array(1 + floor(random() * 7)::int, 1 + floor(random() * 7)::int),
      'fifth',    floor(random() * 8)::int),                            -- onde aparece a 5ª estrela (0..7)
    'st', jsonb_build_object(
      'mirrors',     start,
      'dome',        0,
      'seen',        '[false,false,false,false]'::jsonb,
      'gear_seen',   false,
      'dome_found',  false,
      'markers',     '[null,null,null,null,null,null,null,null]'::jsonb,
      'map_turned',  false,
      'latch',       '[0,0]'::jsonb,
      'key_taken',   false,
      'swing_t0',    null,
      'swing_until', null,
      'pend_shadow', false,
      'pend_full',   false,
      'ast',         jsonb_build_object('seq', '[null,null,null,null]'::jsonb, 'star', null, 'num', '', 'key', false, 'go_cima', null, 'go_baixo', null),
      'inv',         jsonb_build_object('chave', false),
      'opened',      false,
      'finished_at', null));
end $$;

-- A estrela do espelho k está acesa? (3 e 4 só com a cúpula na constelação)
create or replace function public.tor__lit(sec jsonb, st jsonb, k int)
returns boolean language sql immutable as $$
  select (st->'mirrors'->>k)::int = (sec->'mir'->>k)::int
     and (k < 2 or (st->>'dome')::int = (sec->>'dome')::int)
$$;

-- Tremeluz: a uma posição de distância (e o ponto ao alcance).
create or replace function public.tor__glimmer(sec jsonb, st jsonb, k int)
returns boolean language sql immutable as $$
  select ((st->'mirrors'->>k)::int - (sec->'mir'->>k)::int + 8) % 8 in (1, 7)
     and (k < 2 or (st->>'dome')::int = (sec->>'dome')::int)
$$;

create or replace function public.tor__beam_full(sec jsonb, st jsonb)
returns boolean language sql immutable as $$
  select public.tor__lit(sec, st, 0) and public.tor__lit(sec, st, 1) and public.tor__lit(sec, st, 2) and public.tor__lit(sec, st, 3)
$$;

-- Em que janela do balanço estamos agora (null = nenhuma).
--   {w:'sym', k, until} · {w:'num', until} · {w:'occ', until}
create or replace function public.tor__window(st jsonb, p_now bigint)
returns jsonb language plpgsql immutable as $$
declare
  t0  bigint := (st->>'swing_t0')::bigint;
  ph  bigint;
  k   int;
  base bigint;
begin
  if t0 is null or p_now < t0 or p_now >= (st->>'swing_until')::bigint then return null; end if;
  ph := (p_now - t0) % public.tor__period();
  base := p_now - ph;
  if ph >= 1000 and ph < 9000 and (ph - 1000) % 2000 < 1200 then
    k := ((ph - 1000) / 2000)::int;
    return jsonb_build_object('w', 'sym', 'k', k, 'until', base + 1000 + k * 2000 + 1200);
  elsif ph >= 9000 and ph < 10200 then
    return jsonb_build_object('w', 'num', 'until', base + 10200);
  elsif ph >= 10600 and ph < 11400 then
    return jsonb_build_object('w', 'occ', 'until', base + 11400);
  end if;
  return null;
end $$;

-- ── 2. O que cada lado vê ───────────────────────────────
-- p_side: 'cima' (Observador), 'baixo' (Mecânico) ou 'todos' (quem assiste).

create or replace function public.tor__game_view(sec jsonb, st jsonb, p_side text, p_now bigint)
returns jsonb
language plpgsql immutable
as $$
declare
  up      boolean := p_side in ('cima', 'todos');
  down    boolean := p_side in ('baixo', 'todos');
  full_   boolean := public.tor__beam_full(sec, st);
  swing   boolean := st->>'swing_t0' is not null and p_now < (st->>'swing_until')::bigint;
  win     jsonb := case when full_ then public.tor__window(st, p_now) end;
  stars   jsonb := '[]'::jsonb;
  holes   jsonb := '[]'::jsonb;
  seen_k  jsonb := '[]'::jsonb;
  reach   jsonb := '[]'::jsonb;
  any_seen boolean := st->'seen' @> '[true]';
  all_seen boolean := not (st->'seen' @> '[false]');
  gear    boolean := public.tor__lit(sec, st, 0) and public.tor__lit(sec, st, 1);
  marked  boolean := exists (select 1 from jsonb_array_elements(st->'markers') x where x <> 'null'::jsonb);
  links   jsonb := '[]'::jsonb;
  ast     jsonb := st->'ast';
  v       jsonb;
  k       int;
begin
  for k in 0..3 loop
    if public.tor__lit(sec, st, k) then
      stars := stars || jsonb_build_array(jsonb_build_object('k', k, 'slot', sec->'slots'->k, 'state', 'lit'));
    elsif public.tor__glimmer(sec, st, k) then
      stars := stars || jsonb_build_array(jsonb_build_object('k', k, 'slot', sec->'slots'->k, 'state', 'glimmer'));
    end if;
    holes := holes || to_jsonb(7 - (sec->'slots'->>k)::int);
    if (st->'seen'->>k)::boolean then seen_k := seen_k || to_jsonb(k); end if;
    reach := reach || to_jsonb(k < 2 or (st->>'dome')::int = (sec->>'dome')::int);
  end loop;

  -- ligações descobertas (o diagrama do Astrário)
  if any_seen then links := links || '[["espelhos","telescopio"]]'; end if;
  if (st->>'gear_seen')::boolean then links := links || '[["espelhos","manivela"]]'; end if;
  if (st->>'dome_found')::boolean then links := links || '[["telescopio","manivela"]]'; end if;
  if (st->'seen'->>2)::boolean or (st->'seen'->>3)::boolean then links := links || '[["manivela","espelhos"]]'; end if;
  if marked or (st->>'map_turned')::boolean then links := links || '[["telescopio","mapa"]]'; end if;
  if (st->>'pend_shadow')::boolean then links := links || '[["espelhos","pendulo"]]'; end if;
  if (st->>'pend_full')::boolean then links := links || '[["pendulo","mapa"]]'; end if;
  if (st->>'pend_shadow')::boolean then links := links || '[["pendulo","telescopio"]]'; end if;
  if (st->>'key_taken')::boolean then links := links || '[["mapa","manivela"]]'; end if;

  v := jsonb_build_object(
    'side', p_side,
    'pend', jsonb_build_object('t0', st->'swing_t0', 'until', st->'swing_until', 'period', public.tor__period()),
    'progress', jsonb_build_object(
      'telescopio', case when (st->>'pend_shadow')::boolean then 3 when (st->>'dome_found')::boolean then 2 when any_seen then 1 else 0 end,
      'mapa',       case when (st->>'key_taken')::boolean then 3 when (st->>'map_turned')::boolean then 2 when marked then 1 else 0 end,
      'espelhos',   case when all_seen then 3 when (st->>'gear_seen')::boolean then 2 when any_seen then 1 else 0 end,
      'manivela',   case when (st->>'key_taken')::boolean then 3 when (st->>'dome_found')::boolean then 2 when (st->>'gear_seen')::boolean then 1 else 0 end,
      'pendulo',    case when (st->>'pend_full')::boolean then 3 when (st->>'pend_shadow')::boolean then 2 when st->>'swing_t0' is not null then 1 else 0 end),
    'links', links,
    'inv', st->'inv',
    'opened', st->'opened',
    'finished_at', st->'finished_at');

  if up then
    v := v || jsonb_build_object(
      'tele', jsonb_build_object(
        'stars',   stars,
        'pattern', sec->'patterns'->((st->>'dome')::int),
        'fifth',   case when win->>'w' = 'occ' then jsonb_build_object('s', sec->'fifth', 'until', win->'until') end),
      'map', jsonb_build_object(
        'pattern', sec->'patterns'->((sec->>'dome')::int),
        'holes',   holes,
        'markers', st->'markers',
        'colors',  seen_k,
        'turned',  st->'map_turned',
        'runes',   case when (st->>'map_turned')::boolean then sec->'runes' end,
        'rim',     case when (st->>'map_turned')::boolean and win->>'w' = 'sym'
                        then jsonb_build_object('casa', sec->'order'->((win->>'k')::int), 'until', win->'until') end),
      'ast_cima', jsonb_build_object('seq', ast->'seq', 'star', ast->'star', 'go', ast->'go_cima'));
  end if;

  if down then
    v := v || jsonb_build_object(
      'mir', jsonb_build_object(
        'pos',   st->'mirrors',
        'reach', reach,
        'full',  full_),
      'crank', jsonb_build_object(
        'dome',  st->'dome',
        'gear',  gear,
        'latch', st->'latch',
        'key',   st->'key_taken'),
      'shadow', case
        when win->>'w' = 'sym' then jsonb_build_object('sym', sec->'seq'->((sec->'order'->>((win->>'k')::int))::int), 'until', win->'until')
        when win->>'w' = 'num' then jsonb_build_object('num', sec->'num', 'until', win->'until') end,
      'ast_baixo', jsonb_build_object('num', ast->'num', 'key', ast->'key', 'go', ast->'go_baixo'));
  end if;

  -- O outro lado: só "preencheu" e "girou agora" (sem os valores).
  v := v || jsonb_build_object('other', jsonb_build_object(
    'cima_ready',  not (ast->'seq' @> '[null]') and ast->'star' <> 'null'::jsonb,
    'baixo_ready', length(ast->>'num') = 3 and (ast->>'key')::boolean,
    'cima_go',     case when ast->>'go_cima' is not null and p_now - (ast->>'go_cima')::bigint < 3000 then ast->'go_cima' end,
    'baixo_go',    case when ast->>'go_baixo' is not null and p_now - (ast->>'go_baixo')::bigint < 3000 then ast->'go_baixo' end));
  return v;
end $$;

-- ── 3. As jogadas (só quem está jogando, e só do seu andar) ──

create or replace function public.tor_play(p_room uuid, p_action jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r      public.tor_rooms;
  s      jsonb;
  sec    jsonb;
  st     jsonb;
  me     text := auth.uid()::text;
  a      text := p_action->>'a';
  side   text;
  other  text;
  ok     boolean := true;
  msg    text := null;
  now_   bigint := public.tor__ms();
  i      int;
  k      int;
  n      int;
  v      int;
  txt    text;
  good   boolean;
  ast    jsonb;
begin
  select * into r from public.tor_rooms where id = p_room for update;
  if r.id is null then raise exception 'Sala não encontrada.'; end if;
  if r.status <> 'jogo' then raise exception 'O jogo não está rolando.'; end if;
  select state into s from public.tor_state where room_id = p_room for update;
  if not (s->'players' ? me) then raise exception 'Só quem está jogando mexe nos objetos.'; end if;
  if not (s ? 'game') then raise exception 'O jogo ainda não começou.'; end if;
  side := case when s->'players'->>0 = me then 'cima' else 'baixo' end;
  other := case when side = 'cima' then 'baixo' else 'cima' end;
  sec := s->'game'->'secret';
  st  := s->'game'->'st';
  if (st->>'opened')::boolean then return jsonb_build_object('ok', false, 'msg', 'A cúpula já se abriu.'); end if;

  -- Cada objeto é de um andar (o pêndulo: empurrar é de baixo).
  if a in ('mirror', 'dome', 'latch', 'pull', 'push', 'ast_num', 'ast_key') and side <> 'baixo' then
    raise exception 'Isso fica no andar de baixo.';
  end if;
  if a in ('marker', 'ast_seq', 'ast_star') and side <> 'cima' then
    raise exception 'Isso fica no andar de cima.';
  end if;

  if a = 'mirror' then
    -- ── Espelhos: girar um ──
    k := (p_action->>'k')::int;
    v := (p_action->>'p')::int;
    if k is null or k < 0 or k > 3 or v is null or v < 0 or v > 7 then raise exception 'Espelho inválido.'; end if;
    st := jsonb_set(st, array['mirrors', k::text], to_jsonb(v));

  elsif a = 'dome' then
    -- ── Manivela: girar a cúpula (só com a trava de vidro acesa) ──
    v := (p_action->>'d')::int;
    if v not in (-1, 1) then raise exception 'Direção inválida.'; end if;
    if not (public.tor__lit(sec, st, 0) and public.tor__lit(sec, st, 1)) then
      ok := false;
      msg := 'A manivela não sai do lugar. Na engrenagem há uma trava de vidro, apagada.';
    else
      st := jsonb_set(st, '{dome}', to_jsonb(((st->>'dome')::int + v + 16) % 16));
    end if;

  elsif a = 'latch' then
    -- ── Trinco: girar uma das argolas ──
    if (st->>'key_taken')::boolean then return jsonb_build_object('ok', true); end if;
    i := (p_action->>'ring')::int;
    v := (p_action->>'d')::int;
    if i not in (0, 1) or v not in (-1, 1) then raise exception 'Argola inválida.'; end if;
    st := jsonb_set(st, array['latch', i::text], to_jsonb(((st->'latch'->>i)::int + v + 8) % 8));

  elsif a = 'pull' then
    if (st->>'key_taken')::boolean then return jsonb_build_object('ok', true); end if;
    if st->'latch' = sec->'runes' then
      st := jsonb_set(jsonb_set(st, '{key_taken}', 'true'), '{inv,chave}', 'true');
      msg := 'O trinco cede. Dentro do eixo da manivela, uma chave de bronze.';
    else
      st := jsonb_set(st, '{latch}', '[0,0]');
      ok := false;
      msg := 'O trinco estala e as argolas voltam ao começo.';
    end if;

  elsif a = 'push' then
    -- ── Pêndulo: empurrar (balança 60 s) ──
    st := jsonb_set(jsonb_set(st, '{swing_t0}', to_jsonb(now_)), '{swing_until}', to_jsonb(now_ + public.tor__swing_ms()));
    msg := case when public.tor__beam_full(sec, st)
                then 'O pêndulo começa a balançar. A sombra dele corre pelo chão.'
                else 'O pêndulo balança no escuro. Sem luz, não faz sombra nenhuma.' end;

  elsif a = 'marker' then
    -- ── Mapa: pôr/tirar um marcador num buraco ──
    if (st->>'map_turned')::boolean then raise exception 'O mapa já girou.'; end if;
    i := (p_action->>'pos')::int;
    if i is null or i < 0 or i > 7 then raise exception 'Posição inválida.'; end if;
    good := false;
    for n in 0..3 loop if 7 - (sec->'slots'->>n)::int = i then good := true; end if; end loop;
    if not good then raise exception 'Ali não há buraco.'; end if;
    k := (p_action->>'k')::int;
    if k is not null then
      if k < 0 or k > 3 or not (st->'seen'->>k)::boolean then raise exception 'Vocês ainda não viram essa estrela.'; end if;
      for n in 0..7 loop
        if st->'markers'->>n = k::text then st := jsonb_set(st, array['markers', n::text], 'null'); end if;
      end loop;
    end if;
    st := jsonb_set(st, array['markers', i::text], coalesce(to_jsonb(k), 'null'::jsonb));
    -- os 4 buracos cheios: confere
    if (select count(*) from jsonb_array_elements(st->'markers') x where x <> 'null'::jsonb) = 4 then
      good := true;
      for n in 0..3 loop
        if st->'markers'->>(7 - (sec->'slots'->>n)::int) is distinct from n::text then good := false; end if;
      end loop;
      if good then
        st := jsonb_set(st, '{map_turned}', 'true');
        msg := 'O mapa gira sozinho. Na borda aparecem quatro casas apagadas, e uma seta aponta duas runas.';
      else
        st := jsonb_set(st, '{markers}', '[null,null,null,null,null,null,null,null]');
        ok := false;
        msg := 'Os marcadores escorregam e caem no chão.';
      end if;
    end if;

  elsif a = 'ast_seq' then
    -- ── Astrário, face de cima ──
    i := (p_action->>'i')::int;
    txt := p_action->>'sym';
    if i is null or i < 0 or i > 3 or (txt is not null and txt not in ('sol', 'lua', 'estrela', 'cruz')) then raise exception 'Casa inválida.'; end if;
    st := jsonb_set(st, array['ast', 'seq', i::text], coalesce(to_jsonb(txt), 'null'::jsonb));
    st := jsonb_set(st, '{ast,go_cima}', 'null');

  elsif a = 'ast_star' then
    v := (p_action->>'s')::int;
    if v is not null and (v < 0 or v > 7) then raise exception 'Ponto inválido.'; end if;
    st := jsonb_set(st, '{ast,star}', coalesce(to_jsonb(v), 'null'::jsonb));
    st := jsonb_set(st, '{ast,go_cima}', 'null');

  elsif a = 'ast_num' then
    -- ── Astrário, face de baixo ──
    txt := coalesce(p_action->>'text', '');
    if txt !~ '^[0-9]{0,3}$' then raise exception 'Só 3 algarismos.'; end if;
    st := jsonb_set(st, '{ast,num}', to_jsonb(txt));
    st := jsonb_set(st, '{ast,go_baixo}', 'null');

  elsif a = 'ast_key' then
    if not (st->'inv'->>'chave')::boolean then
      ok := false;
      msg := 'Há uma fechadura pequena no disco. Falta a chave.';
    elsif not (st->'ast'->>'key')::boolean then
      st := jsonb_set(st, '{ast,key}', 'true');
      msg := 'A chave entra e gira até a metade.';
    end if;

  elsif a = 'go' then
    -- ── Girar a minha metade do disco (os dois, até 3 s um do outro) ──
    ast := st->'ast';
    if side = 'cima' and (ast->'seq' @> '[null]' or ast->'star' = 'null'::jsonb) then
      return jsonb_build_object('ok', false, 'msg', 'Falta preencher a sua metade: as quatro casas e a estrela.');
    end if;
    if side = 'baixo' and (length(ast->>'num') <> 3 or not (ast->>'key')::boolean) then
      return jsonb_build_object('ok', false, 'msg', 'Falta preencher a sua metade: o número e a chave.');
    end if;
    st := jsonb_set(st, array['ast', 'go_' || side], to_jsonb(now_));
    if ast->>('go_' || other) is not null and now_ - (ast->>('go_' || other))::bigint <= 3000 then
      good := ast->'seq' = sec->'seq' and (ast->>'star')::int = (sec->>'fifth')::int and ast->>'num' = sec->>'num';
      if good then
        st := jsonb_set(jsonb_set(st, '{opened}', 'true'), '{finished_at}', to_jsonb(now_));
        msg := 'As duas metades giram juntas. A cúpula começa a se abrir.';
      else
        st := jsonb_set(st, '{ast}', jsonb_build_object('seq', '[null,null,null,null]'::jsonb, 'star', null, 'num', '', 'key', ast->'key', 'go_cima', null, 'go_baixo', null));
        ok := false;
        msg := 'O disco gira, range… e volta. Algo estava errado: o que foi posto se apaga.';
      end if;
    else
      msg := 'Você gira a sua metade. Ela volta devagar: o outro lado precisa girar junto.';
    end if;

  else
    raise exception 'Ação desconhecida.';
  end if;

  -- marcas do que a dupla já viu (o diagrama do Astrário usa)
  for k in 0..3 loop
    if public.tor__lit(sec, st, k) then st := jsonb_set(st, array['seen', k::text], 'true'); end if;
  end loop;
  if public.tor__lit(sec, st, 0) and public.tor__lit(sec, st, 1) then st := jsonb_set(st, '{gear_seen}', 'true'); end if;
  if (st->>'dome')::int = (sec->>'dome')::int then st := jsonb_set(st, '{dome_found}', 'true'); end if;
  if st->>'swing_t0' is not null and now_ < (st->>'swing_until')::bigint and public.tor__beam_full(sec, st) then
    st := jsonb_set(st, '{pend_shadow}', 'true');
    if (st->>'map_turned')::boolean then st := jsonb_set(st, '{pend_full}', 'true'); end if;
  end if;

  s := jsonb_set(s, '{game,st}', st);
  if msg is not null then
    s := jsonb_set(s, '{events}', (coalesce(s->'events', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('t', now_, 'm', public.tor__name(auth.uid()) || ': ' || msg))));
    if jsonb_array_length(s->'events') > 200 then s := jsonb_set(s, '{events}', (s->'events') - 0); end if;
  end if;
  perform public.tor__save(p_room, s);
  return jsonb_build_object('ok', ok, 'msg', msg);
end $$;

-- ── 4. Mestre: começar cria a partida; recomeçar sorteia outra ──

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
    if jsonb_array_length(s->'players') <> 2 then raise exception 'A torre precisa de 2 jogadores: um em cima, um embaixo.'; end if;
    update public.tor_rooms set status = 'jogo' where id = p_room;
    if not (s ? 'game') then s := s || jsonb_build_object('game', public.tor__new_game()); end if;
    s := jsonb_set(s, '{started_at}', to_jsonb(public.tor__ms()));
  elsif a = 'reset' then
    -- Recomeçar: outra partida, com outro segredo.
    s := s || jsonb_build_object('game', public.tor__new_game(), 'events', '[]'::jsonb);
    if r.status = 'jogo' then s := jsonb_set(s, '{started_at}', to_jsonb(public.tor__ms())); end if;
  elsif a = 'lobby' then
    update public.tor_rooms set status = 'lobby' where id = p_room;
  elsif a = 'close' then
    update public.tor_rooms set status = 'fim' where id = p_room;
  else
    raise exception 'Ação desconhecida.';
  end if;

  perform public.tor__save(p_room, s);
end $$;

-- ── 5. A visão de cada um (agora com o jogo do seu andar) ──

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
                 case slot when 0 then 'cima' when 1 then 'baixo' else 'todos' end, now_) end);

  -- O mestre vê também a solução e a linha do tempo (pra ajudar, se precisar).
  if gm and s ? 'game' then
    v := v || jsonb_build_object('gm', jsonb_build_object('secret', s->'game'->'secret', 'events', coalesce(s->'events', '[]'::jsonb)));
  end if;
  return v;
end $$;

-- ── 6. Permissões ───────────────────────────────────────

revoke all on function public.tor__shuffle(jsonb) from public, anon, authenticated;
revoke all on function public.tor__period() from public, anon, authenticated;
revoke all on function public.tor__swing_ms() from public, anon, authenticated;
revoke all on function public.tor__new_game() from public, anon, authenticated;
revoke all on function public.tor__lit(jsonb, jsonb, int) from public, anon, authenticated;
revoke all on function public.tor__glimmer(jsonb, jsonb, int) from public, anon, authenticated;
revoke all on function public.tor__beam_full(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.tor__window(jsonb, bigint) from public, anon, authenticated;
revoke all on function public.tor__game_view(jsonb, jsonb, text, bigint) from public, anon, authenticated;

revoke all on function public.tor_play(uuid, jsonb) from public, anon;
grant execute on function public.tor_play(uuid, jsonb) to authenticated;
grant execute on function public.tor_gm(uuid, jsonb) to authenticated;
grant execute on function public.tor_view(uuid) to authenticated;
