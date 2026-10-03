-- ════════════════════════════════════════════════════════
-- Trocar de jogo no meio da sessão: o Livro Bloqueado e a Torre do
-- Observatório podem estar abertos na mesma campanha, mas só UM aparece.
-- Abrir um (pelo menu ≡ do mestre, "Trocar para…", ou pelo Painel de
-- controle) PAUSA o outro exatamente onde estava; abrir de novo o pausado
-- RETOMA.
--
-- Pausado: a sala não aparece pra ninguém e recusa jogadas. Ao retomar,
-- todos os relógios andam junto com o tempo de pausa (tempo de jogo,
-- balanço do pêndulo, "girou agora" do Astrário, dica do mestre) — o
-- pêndulo volta balançando com o mesmo tempo que faltava.
--
-- A posição de cada boneco (e a janela que estava aberta) agora fica no
-- banco: cada jogador salva a sua (<jogo>_save_pos) na troca, ao abrir ou
-- fechar uma janela e a cada ~3 s andando. Salvar posição NÃO sobe a
-- versão da sala (não acorda as outras telas). O movimento ao vivo
-- continua fora do banco.
-- ════════════════════════════════════════════════════════

-- ── 1. A pausa ──────────────────────────────────────────

alter table public.lb_rooms  add column if not exists paused_at timestamptz;
alter table public.tor_rooms add column if not exists paused_at timestamptz;

-- Pausa os jogos abertos da campanha, menos o que vai ficar na tela.
create or replace function public.mesa__pause_others(p_campaign uuid, p_keep text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_keep <> 'livro' then
    update public.lb_rooms set paused_at = now(), version = version + 1, updated_at = now()
     where campaign_id = p_campaign and status <> 'fim' and paused_at is null;
  end if;
  if p_keep <> 'torre' then
    update public.tor_rooms set paused_at = now(), version = version + 1, updated_at = now()
     where campaign_id = p_campaign and status <> 'fim' and paused_at is null;
  end if;
end $$;

-- Soma `d` ms num número do json, se existir.
create or replace function public.mesa__shift(j jsonb, path text[], d bigint)
returns jsonb language sql immutable as $$
  select case when jsonb_typeof(j #> path) = 'number' then jsonb_set(j, path, to_jsonb((j #>> path)::bigint + d)) else j end
$$;

-- Retomar o Livro: o tempo de jogo anda junto com a pausa.
create or replace function public.lb__resume(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.lb_rooms;
  s jsonb;
  d bigint;
begin
  select * into r from public.lb_rooms where id = p_room for update;
  if r.paused_at is null then return; end if;
  d := (extract(epoch from (now() - r.paused_at)) * 1000)::bigint;
  select state into s from public.lb_state where room_id = p_room for update;
  s := public.mesa__shift(s, '{started_at}', d);
  s := public.mesa__shift(s, '{game,st,finished_at}', d);
  update public.lb_state set state = s where room_id = p_room;
  update public.lb_rooms set paused_at = null, version = version + 1, updated_at = now() where id = p_room;
end $$;

-- Retomar a Torre: tempo de jogo, pêndulo, Astrário e dica andam junto.
create or replace function public.tor__resume(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.tor_rooms;
  s jsonb;
  d bigint;
begin
  select * into r from public.tor_rooms where id = p_room for update;
  if r.paused_at is null then return; end if;
  d := (extract(epoch from (now() - r.paused_at)) * 1000)::bigint;
  select state into s from public.tor_state where room_id = p_room for update;
  s := public.mesa__shift(s, '{started_at}', d);
  s := public.mesa__shift(s, '{hint,t}', d);
  s := public.mesa__shift(s, '{game,st,swing_t0}', d);
  s := public.mesa__shift(s, '{game,st,swing_until}', d);
  s := public.mesa__shift(s, '{game,st,ast,go_cima}', d);
  s := public.mesa__shift(s, '{game,st,ast,go_baixo}', d);
  s := public.mesa__shift(s, '{game,st,finished_at}', d);
  update public.tor_state set state = s where room_id = p_room;
  update public.tor_rooms set paused_at = null, version = version + 1, updated_at = now() where id = p_room;
end $$;

-- ── 2. Abrir = pausar o outro e retomar este ────────────

create or replace function public.lb_open(p_campaign uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  if not public.is_campaign_master(p_campaign, auth.uid()) then
    raise exception 'Só o mestre da campanha abre o Livro Bloqueado.';
  end if;
  if not exists (select 1 from public.site_features where key = 'livro-bloqueado' and enabled) and not public.is_site_owner() then
    raise exception 'O Livro Bloqueado ainda não foi liberado.';
  end if;
  -- Um jogo por vez na tela: o outro fica pausado onde estava.
  perform public.mesa__pause_others(p_campaign, 'livro');
  select id into rid from public.lb_rooms where campaign_id = p_campaign and status <> 'fim';
  if rid is not null then
    perform public.lb__resume(rid);
    return rid;
  end if;

  insert into public.lb_rooms (campaign_id) values (p_campaign) returning id into rid;
  insert into public.lb_state (room_id, state) values (rid, jsonb_build_object(
    'seed', floor(random() * 1000000000)::bigint,
    'players', '[]'::jsonb,
    'started_at', null));
  return rid;
end $$;

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
  -- Um jogo por vez na tela: o outro fica pausado onde estava.
  perform public.mesa__pause_others(p_campaign, 'torre');
  select id into rid from public.tor_rooms where campaign_id = p_campaign and status <> 'fim';
  if rid is not null then
    perform public.tor__resume(rid);
    return rid;
  end if;

  insert into public.tor_rooms (campaign_id) values (p_campaign) returning id into rid;
  insert into public.tor_state (room_id, state) values (rid, jsonb_build_object(
    'players', '[]'::jsonb,
    'started_at', null));
  return rid;
end $$;

-- ── 3. Jogadas: recusadas com o jogo pausado (iguais às das correções do Livro e do marco 2 da Torre, com uma linha a mais) ──

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
  tried  jsonb;
  remain jsonb;
begin
  select * into r from public.lb_rooms where id = p_room for update;
  if r.id is null then raise exception 'Sala não encontrada.'; end if;
  if r.status <> 'jogo' then raise exception 'O jogo não está rolando.'; end if;
  if r.paused_at is not null then raise exception 'O jogo está pausado.'; end if;
  select state into s from public.lb_state where room_id = p_room for update;
  if not (s->'players' ? me) then raise exception 'Só quem está jogando mexe nos objetos.'; end if;
  if not (s ? 'game') then raise exception 'O jogo ainda não começou.'; end if;
  sec := s->'game'->'secret';
  st  := s->'game'->'st';
  angle := (sec->>'angle')::int;
  if (st->>'opened')::boolean then return jsonb_build_object('ok', false, 'msg', 'O livro já foi aberto.'); end if;

  if a = 'light' then
    -- ── Castiçal: acender / trincar um pavio selado ──
    i := (p_action->>'i')::int;
    if i is null or i < 0 or i > 6 then raise exception 'Vela inválida.'; end if;
    if st->'sealed'->>i = 'true' then
      -- Os pavios selados só se abrem juntos: a ordem é conferida no último.
      tried := coalesce(st->'seal_try', '[]'::jsonb);
      if tried @> to_jsonb(array[i]) then return jsonb_build_object('ok', true); end if;
      tried := tried || to_jsonb(i);
      select coalesce(jsonb_agg(x order by o), '[]'::jsonb) into remain
        from jsonb_array_elements(sec->'seal_order') with ordinality t(x, o)
        where st->'sealed'->>((x::text)::int) = 'true';
      if jsonb_array_length(tried) < jsonb_array_length(remain) then
        st := jsonb_set(st, '{seal_try}', tried);
        msg := 'A cera do pavio trinca.';
      elsif tried = remain then
        for k in 0 .. jsonb_array_length(remain) - 1 loop
          st := jsonb_set(jsonb_set(st, array['sealed', remain->>k], 'false'), array['lit', remain->>k], 'true');
        end loop;
        st := jsonb_set(jsonb_set(st, '{seal_try}', '[]'), '{seal_n}', '4');
        msg := 'Os quatro pavios se abriram.';
      else
        st := jsonb_set(st, '{seal_try}', '[]');
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
    if (st->'inv'->>'medalhao')::boolean then return jsonb_build_object('ok', true); end if;
    if public.lb__light(sec, st) <> 'total' or not (st->>'angle_found')::boolean or (st->>'ret_view')::int <> angle then
      raise exception 'Não dá pra ver o rosto daqui.';
    end if;
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
    -- A ordem dos livros só é conferida no 4º.
    if (st->>'word_ok')::boolean then return jsonb_build_object('ok', true); end if;
    i := (p_action->>'pos')::int;
    if i is null or i < 1 or i > 12 then raise exception 'Posição inválida.'; end if;
    n := jsonb_array_length(st->'pulled');
    if n >= 4 or st->'pulled' @> to_jsonb(array[i]) then return jsonb_build_object('ok', true); end if;
    st := jsonb_set(st, '{pulled}', (st->'pulled') || to_jsonb(i));
    if n + 1 < 4 then
      msg := 'O livro desliza pra fora.';
    elsif st->'pulled' = sec->'number' then
      msg := 'Atrás dos livros, uma frase gravada. Nas lombadas, uma palavra em símbolos.';
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
    -- ── Pedestal: abrir uma corrente (só com a ordem à vista, na tampa) ──
    n := (p_action->>'n')::int;
    if n is null or n < 1 or n > 4 then raise exception 'Corrente inválida.'; end if;
    if not (st->>'lid')::boolean then
      return jsonb_build_object('ok', false, 'msg', 'As fechaduras estão travadas. Falta saber em que ordem abrir.');
    end if;
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
      msg := 'A fechadura não cede. As correntes se apertam.';
    end if;

  else
    raise exception 'Ação desconhecida.';
  end if;

  -- marcas do que a dupla já viu (o diagrama do pedestal usa)
  if public.lb__light(sec, st) <> 'escuro' then st := jsonb_set(st, '{seen_partial}', 'true'); end if;
  if public.lb__light(sec, st) = 'total' and (st->>'angle_found')::boolean and (st->>'cast_view')::int = angle then st := jsonb_set(st, '{num_seen}', 'true'); end if;
  if public.lb__light(sec, st) = 'total' and (st->>'angle_found')::boolean and (st->>'ret_view')::int = angle then st := jsonb_set(st, '{face_seen}', 'true'); end if;

  s := jsonb_set(s, '{game,st}', st);
  if msg is not null then
    s := jsonb_set(s, '{events}', (coalesce(s->'events', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('t', public.lb__ms(), 'm', public.lb__name(auth.uid()) || ': ' || msg))));
    if jsonb_array_length(s->'events') > 200 then s := jsonb_set(s, '{events}', (s->'events') - 0); end if;
  end if;
  perform public.lb__save(p_room, s);
  return jsonb_build_object('ok', ok, 'msg', msg);
end $$;

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
  if r.paused_at is not null then raise exception 'O jogo está pausado.'; end if;
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

-- ── 4. A posição de cada boneco ─────────────────────────
-- {x, y, d, p}: onde está, pra onde olha e a janela aberta (ou null).
-- Só quem joga, só a sua. Não sobe a versão (ninguém precisa pedir a visão).

create or replace function public.mesa__check_pos(p jsonb, panels text[])
returns boolean language sql immutable as $$
  select jsonb_typeof(p) = 'object'
     and jsonb_typeof(p->'x') = 'number' and (p->>'x')::numeric between 0 and 384
     and jsonb_typeof(p->'y') = 'number' and (p->>'y')::numeric between 0 and 216
     and p->>'d' in ('down', 'up', 'left', 'right')
     and (p->'p' is null or p->'p' = 'null'::jsonb or p->>'p' = any(panels))
$$;

create or replace function public.lb_save_pos(p_room uuid, p_pos jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me text := auth.uid()::text;
begin
  if not public.mesa__check_pos(p_pos, array['castical', 'retrato', 'astrolabio', 'estante', 'pedestal']) then raise exception 'Posição inválida.'; end if;
  update public.lb_state set state = jsonb_set(state, array['pos'], coalesce(state->'pos', '{}'::jsonb) || jsonb_build_object(me,
           jsonb_build_object('x', p_pos->'x', 'y', p_pos->'y', 'd', p_pos->'d', 'p', coalesce(p_pos->'p', 'null'::jsonb))))
   where room_id = p_room and state->'players' ? me
     and exists (select 1 from public.lb_rooms where id = p_room and status = 'jogo');
end $$;

create or replace function public.tor_save_pos(p_room uuid, p_pos jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me text := auth.uid()::text;
begin
  if not public.mesa__check_pos(p_pos, array['telescopio', 'mapa', 'espelhos', 'manivela', 'pendulo', 'astrario']) then raise exception 'Posição inválida.'; end if;
  update public.tor_state set state = jsonb_set(state, array['pos'], coalesce(state->'pos', '{}'::jsonb) || jsonb_build_object(me,
           jsonb_build_object('x', p_pos->'x', 'y', p_pos->'y', 'd', p_pos->'d', 'p', coalesce(p_pos->'p', 'null'::jsonb))))
   where room_id = p_room and state->'players' ? me
     and exists (select 1 from public.tor_rooms where id = p_room and status = 'jogo');
end $$;

-- ── 5. As visões: pausado? e as posições ────────────────

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
    'game', case when s ? 'game' then public.lb__game_view(s->'game'->'secret', s->'game'->'st') end);

  -- O mestre vê também a solução e a linha do tempo (pra ajudar, se precisar).
  if gm and s ? 'game' then
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

  -- O mestre vê também a solução e a linha do tempo (pra ajudar, se precisar).
  if gm and s ? 'game' then
    v := v || jsonb_build_object('gm', jsonb_build_object('secret', s->'game'->'secret', 'events', coalesce(s->'events', '[]'::jsonb)));
  end if;
  return v;
end $$;

-- ── 6. Permissões ───────────────────────────────────────

revoke all on function public.mesa__pause_others(uuid, text) from public, anon, authenticated;
revoke all on function public.mesa__shift(jsonb, text[], bigint) from public, anon, authenticated;
revoke all on function public.lb__resume(uuid) from public, anon, authenticated;
revoke all on function public.tor__resume(uuid) from public, anon, authenticated;
revoke all on function public.mesa__check_pos(jsonb, text[]) from public, anon, authenticated;
revoke all on function public.lb_open(uuid) from public, anon;
revoke all on function public.tor_open(uuid) from public, anon;
revoke all on function public.lb_play(uuid, jsonb) from public, anon;
revoke all on function public.tor_play(uuid, jsonb) from public, anon;
revoke all on function public.lb_view(uuid) from public, anon;
revoke all on function public.tor_view(uuid) from public, anon;
revoke all on function public.lb_save_pos(uuid, jsonb) from public, anon;
revoke all on function public.tor_save_pos(uuid, jsonb) from public, anon;
grant execute on function public.lb_open(uuid) to authenticated;
grant execute on function public.tor_open(uuid) to authenticated;
grant execute on function public.lb_play(uuid, jsonb) to authenticated;
grant execute on function public.tor_play(uuid, jsonb) to authenticated;
grant execute on function public.lb_view(uuid) to authenticated;
grant execute on function public.tor_view(uuid) to authenticated;
grant execute on function public.lb_save_pos(uuid, jsonb) to authenticated;
grant execute on function public.tor_save_pos(uuid, jsonb) to authenticated;
