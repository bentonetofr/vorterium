-- ════════════════════════════════════════════════════════
-- O Livro Bloqueado — correções do encadeamento (atalhos fechados).
--
--   • Ângulo: o número das sombras, o rosto, o medalhão e a tradução só
--     aparecem depois que o ponteiro do astrolábio parou na marca (antes
--     dava pra achar girando o mostrador "Olhar de" marca por marca).
--   • Pavios selados: a ordem só é conferida no 4º pavio (antes cada
--     clique dizia se estava certo — dava pra achar no chute).
--   • Estante: a ordem dos livros só é conferida no 4º livro, e os glifos
--     só aparecem com os 4 certos (mesmo motivo).
--   • Pedestal: as fechaduras só giram com a tampa do astrolábio aberta
--     (a ordem das correntes vazava pela mensagem de erro).
--   • Voltar ao saguão e começar de novo não zera mais o relógio.
--   • O medalhão sai do inventário ao entrar na gaveta; a chave, ao abrir
--     a tampa.
-- Partidas em andamento continuam valendo (st antigo é aceito).
-- ════════════════════════════════════════════════════════

-- ── 1. O que a dupla (e quem assiste) vê ────────────────

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
        'retrato',    case when (st->'inv'->>'medalhao')::boolean then 3 when (st->>'face_seen')::boolean then 2 when (st->>'seen_partial')::boolean then 1 else 0 end,
        'astrolabio', case when (st->>'lid')::boolean then 3 when found then 2 when filled then 1 else 0 end,
        'estante',    case when (st->>'drawer')::boolean then 3 when (st->>'word_ok')::boolean then 2 when npulled = 4 then 1 else 0 end),
      'links', links),
    -- o que a dupla carrega AGORA (o medalhão fica na gaveta; a chave, na tampa)
    'inv', jsonb_build_object(
      'medalhao', coalesce((st->'inv'->>'medalhao')::boolean, false) and not coalesce((st->>'drawer')::boolean, false),
      'chave',    coalesce((st->'inv'->>'chave')::boolean, false) and not coalesce((st->>'lid')::boolean, false)),
    'finished_at', st->'finished_at');
end $$;

-- ── 2. As jogadas (só quem está jogando) ────────────────

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

-- ── 3. Mestre: voltar ao saguão e começar de novo não zera o relógio ──

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
    -- Partida nova: relógio do zero. Partida que já existia (voltou do saguão): o relógio segue.
    if not (s ? 'game') then
      s := s || jsonb_build_object('game', public.lb__new_game());
      s := jsonb_set(s, '{started_at}', to_jsonb(public.lb__ms()));
    elsif s->'started_at' is null or s->'started_at' = 'null'::jsonb then
      s := jsonb_set(s, '{started_at}', to_jsonb(public.lb__ms()));
    end if;
  elsif a = 'reset' then
    -- Recomeçar: outra partida, com outro segredo.
    s := s || jsonb_build_object('game', public.lb__new_game(), 'events', '[]'::jsonb);
    -- (no saguão, o relógio começa no "Começar")
    s := jsonb_set(s, '{started_at}', case when r.status = 'jogo' then to_jsonb(public.lb__ms()) else 'null'::jsonb end);
  elsif a = 'lobby' then
    update public.lb_rooms set status = 'lobby' where id = p_room;
  elsif a = 'close' then
    update public.lb_rooms set status = 'fim' where id = p_room;
  else
    raise exception 'Ação desconhecida.';
  end if;

  perform public.lb__save(p_room, s);
end $$;

-- ── 4. Permissões (as mesmas de antes) ──────────────────

revoke all on function public.lb__game_view(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.lb_play(uuid, jsonb) from public, anon;
revoke all on function public.lb_gm(uuid, jsonb) from public, anon;
grant execute on function public.lb_play(uuid, jsonb) to authenticated;
grant execute on function public.lb_gm(uuid, jsonb) to authenticated;
