-- ════════════════════════════════════════════════════════
-- Raiz Mestre: o botão NÃO ME TORNAR UM MESTRE.
--
-- Junto do SE TORNAR UM MESTRE, cada jogador pode recusar. Quem recusa:
--   • sai da conta da ascensão: os outros viram Mestre quando todos os
--     que NÃO recusaram apertarem (se só faltava quem recusou, a
--     campanha ascende na hora);
--   • tem a ficha rebaixada ao nível 1:
--       - PV, PE, FV, PR e cartas com máximo 10 (o atual fica, cortado
--         em 10);
--       - atributos voltam aos 16 pontos da criação (tira 1 ponto por
--         vez do atributo mais alto; empate, sorteio);
--       - só 5 domínios continuam (sorteados entre os que tinham ponto),
--         com 1 ponto cada; os outros vão a 0;
--       - as runas do Runaskin (os triunfos criados depois dos 3 da
--         trilha) são apagadas;
--       - os triunfos do Berserker acima do limite do nível 1 saem
--         (sorteio de quais ficam).
-- Antes de mexer, a ficha inteira (com domínios e runas) é guardada:
-- o mestre da mesa ou o dono do site pode DESFAZER a recusa.
-- ════════════════════════════════════════════════════════

-- ── 1. Ficha: máximo de cartas e a cópia de antes ───────
-- cards_max nulo = como sempre (13 por nível); com valor, é esse.

alter table public.altherium_character_sheets
  add column if not exists cards_max integer check (cards_max is null or cards_max >= 1),
  add column if not exists mestre_refusal_backup jsonb;

-- ── 2. Quem recusou ─────────────────────────────────────

create table if not exists public.altherium_mestre_refusals (
  campaign_id  uuid         not null references public.campaigns(id) on delete cascade,
  user_id      uuid         not null references public.profiles(id) on delete cascade,
  created_at   timestamptz  not null default now(),
  primary key (campaign_id, user_id)
);

alter table public.altherium_mestre_refusals enable row level security;

drop policy if exists "mestre_refusals: membros veem" on public.altherium_mestre_refusals;
create policy "mestre_refusals: membros veem" on public.altherium_mestre_refusals
  for select to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()) or public.is_site_owner());

revoke all on public.altherium_mestre_refusals from anon, authenticated;
grant select on public.altherium_mestre_refusals to authenticated;

-- ── 3. Rebaixar uma ficha (guardando como era) ──────────

create or replace function public.mestre_demote_sheet(p_sheet uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s       public.altherium_character_sheets;
  a       jsonb;
  k       text;
  used    int;
  lim     int;
  removed uuid[];
begin
  select * into s from public.altherium_character_sheets where id = p_sheet for update;
  if s.id is null or s.mestre_refusal_backup is not null then return; end if;

  -- a cópia: a ficha, os domínios e as runas
  update public.altherium_character_sheets
  set mestre_refusal_backup = jsonb_build_object(
        'sheet',   to_jsonb(s) - 'mestre_refusal_backup' - 'mestre_backup',
        'domains', (select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) from public.altherium_character_domains d where d.sheet_id = p_sheet),
        'runes',   (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.altherium_runaskin_runes r where r.sheet_id = p_sheet))
  where id = p_sheet;

  -- atributos: de volta aos 16 pontos da criação (o Runaskin tem 2 de Rúnico de graça)
  a := jsonb_build_object('furia', s.attr_furia, 'destino', s.attr_destino, 'espirito', s.attr_espirito,
                          'impulso', s.attr_impulso, 'estrategia', s.attr_estrategia, 'runico', s.attr_runico);
  loop
    select sum(value::int) into used from jsonb_each_text(a);
    if s.raiz = 'runaskin' then used := used - least(2, (a->>'runico')::int); end if;
    exit when used <= 16;
    select key into k from jsonb_each_text(a)
     where value::int = (select max(value::int) from jsonb_each_text(a))
     order by random() limit 1;
    a := jsonb_set(a, array[k], to_jsonb((a->>k)::int - 1));
  end loop;

  -- domínios: 5 sorteados entre os que tinham ponto ficam com 1; o resto vai a 0
  with keep as (
    select id from public.altherium_character_domains
     where sheet_id = p_sheet and points > 0
     order by random() limit 5
  )
  update public.altherium_character_domains d
     set points = case when d.id in (select id from keep) then 1 else 0 end
   where d.sheet_id = p_sheet and d.points > 0;

  -- runas do Runaskin: apagadas (e saem dos "recentes")
  select coalesce(array_agg(id), '{}') into removed from public.altherium_runaskin_runes where sheet_id = p_sheet;
  delete from public.altherium_runaskin_runes where sheet_id = p_sheet;

  -- triunfos do Berserker: no máximo ⌊(2 + domínios com ponto) ÷ 2⌋, sorteados
  select (2 + count(*)) / 2 into lim from public.altherium_character_domains where sheet_id = p_sheet and points > 0;

  update public.altherium_character_sheets set
    level              = 1,
    attr_furia         = (a->>'furia')::int,
    attr_destino       = (a->>'destino')::int,
    attr_espirito      = (a->>'espirito')::int,
    attr_impulso       = (a->>'impulso')::int,
    attr_estrategia    = (a->>'estrategia')::int,
    attr_runico        = (a->>'runico')::int,
    vitality_max       = 10,
    equilibrio_max     = 10,
    fv_max             = 10,
    pr_max             = 10,
    cards_max          = 10,
    vitality_current   = least(vitality_current, 10),
    equilibrio_current = least(equilibrio_current, 10),
    fv_current         = least(fv_current, 10),
    pr_current         = least(pr_current, 10),
    cards_current      = least(cards_current, 10),
    runaskin_scene_uses = 0,
    berserker_triumphs = case
      when raiz = 'berserker' and coalesce(array_length(berserker_triumphs, 1), 0) > lim then
        array(select t from unnest(berserker_triumphs) with ordinality u(t, o)
               where o in (select o2 from generate_series(1, array_length(berserker_triumphs, 1)) o2 order by random() limit lim)
               order by o)
      else berserker_triumphs end,
    recent_triumphs = array(select x from unnest(recent_triumphs) x
                             where not exists (select 1 from unnest(removed) r where x like '%' || r::text || '%'))
  where id = p_sheet;
end;
$$;
revoke all on function public.mestre_demote_sheet(uuid) from public, anon, authenticated;

-- ── 4. A ascensão: conta só quem não recusou ────────────

create or replace function public.mestre__try_ascend(p_campaign uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_players uuid[];
  v_called  int;
begin
  if exists (select 1 from public.altherium_mestre_ascensions where campaign_id = p_campaign) then
    return jsonb_build_object('called', 0, 'total', 0, 'ascended', true);
  end if;

  select array_agg(m.user_id) into v_players
  from public.campaign_members m
  where m.campaign_id = p_campaign and m.role = 'player'
    and not exists (select 1 from public.altherium_mestre_refusals r where r.campaign_id = p_campaign and r.user_id = m.user_id);

  select count(*) into v_called
  from public.altherium_mestre_calls
  where campaign_id = p_campaign and user_id = any(v_players);

  if coalesce(array_length(v_players, 1), 0) = 0 or v_called < array_length(v_players, 1) then
    return jsonb_build_object('called', v_called, 'total', coalesce(array_length(v_players, 1), 0), 'ascended', false);
  end if;

  -- Todos os que não recusaram apertaram: a campanha ascende (uma vez só).
  insert into public.altherium_mestre_ascensions (campaign_id) values (p_campaign)
  on conflict do nothing;
  perform public.mestre_convert_sheets(p_campaign, v_players);
  update public.profiles set mestre_at = coalesce(mestre_at, now()) where id = any(v_players);
  return jsonb_build_object('called', v_called, 'total', v_called, 'ascended', true);
end;
$$;
revoke all on function public.mestre__try_ascend(uuid) from public, anon, authenticated;

-- O botão SE TORNAR (igual à da 20240184, sem contar quem recusou).
create or replace function public.call_mestre(p_campaign uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.site_features where key = 'raiz-mestre' and enabled) then
    raise exception 'A Raiz Mestre ainda não foi liberada.';
  end if;
  if not exists (select 1 from public.campaigns where id = p_campaign and system = 'altherium') then
    raise exception 'Só campanhas de Altherium.';
  end if;
  if not exists (select 1 from public.altherium_mestre_campaigns where campaign_id = p_campaign) then
    raise exception 'A Raiz Mestre não está liberada nesta campanha.';
  end if;
  if not exists (
    select 1 from public.campaign_members
    where campaign_id = p_campaign and user_id = auth.uid() and role = 'player'
  ) then
    raise exception 'Só os jogadores da campanha.';
  end if;
  if exists (select 1 from public.altherium_mestre_refusals where campaign_id = p_campaign and user_id = auth.uid()) then
    raise exception 'Você recusou se tornar um Mestre.';
  end if;

  if not exists (select 1 from public.altherium_mestre_ascensions where campaign_id = p_campaign) then
    insert into public.altherium_mestre_calls (campaign_id, user_id)
    values (p_campaign, auth.uid())
    on conflict do nothing;
  end if;
  return public.mestre__try_ascend(p_campaign);
end;
$$;
revoke all on function public.call_mestre(uuid) from public, anon;
grant execute on function public.call_mestre(uuid) to authenticated;

-- ── 5. O botão NÃO ME TORNAR ────────────────────────────
-- (o dono do site, testando numa campanha em que não joga, também pode:
-- só a ficha dele muda, e ele não entra na conta)

create or replace function public.mestre_refuse(p_campaign uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player boolean;
  v_sheet  uuid;
begin
  if not exists (select 1 from public.site_features where key = 'raiz-mestre' and enabled) then
    raise exception 'A Raiz Mestre ainda não foi liberada.';
  end if;
  if not exists (select 1 from public.campaigns where id = p_campaign and system = 'altherium') then
    raise exception 'Só campanhas de Altherium.';
  end if;
  if not exists (select 1 from public.altherium_mestre_campaigns where campaign_id = p_campaign) then
    raise exception 'A Raiz Mestre não está liberada nesta campanha.';
  end if;
  v_player := exists (
    select 1 from public.campaign_members
    where campaign_id = p_campaign and user_id = auth.uid() and role = 'player');
  if not v_player and not public.is_site_owner() then
    raise exception 'Só os jogadores da campanha.';
  end if;
  if exists (select 1 from public.altherium_mestre_ascensions where campaign_id = p_campaign) then
    raise exception 'A campanha já ascendeu.';
  end if;
  if exists (select 1 from public.altherium_mestre_refusals where campaign_id = p_campaign and user_id = auth.uid()) then
    return jsonb_build_object('ascended', false);
  end if;

  insert into public.altherium_mestre_refusals (campaign_id, user_id) values (p_campaign, auth.uid());
  delete from public.altherium_mestre_calls where campaign_id = p_campaign and user_id = auth.uid();

  select id into v_sheet from public.altherium_character_sheets where campaign_id = p_campaign and user_id = auth.uid();
  if v_sheet is not null then perform public.mestre_demote_sheet(v_sheet); end if;

  -- se só faltava quem recusou, os outros ascendem agora
  return jsonb_build_object('ascended', (public.mestre__try_ascend(p_campaign)->>'ascended')::boolean);
end;
$$;
revoke all on function public.mestre_refuse(uuid) from public, anon;
grant execute on function public.mestre_refuse(uuid) to authenticated;

-- ── 6. Desfazer a recusa (mestre da mesa ou dono do site) ──

create or replace function public.mestre_undo_refusal(p_campaign uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s   public.altherium_character_sheets;
  b   jsonb;
  prev public.altherium_character_sheets;
begin
  if not (public.is_campaign_master(p_campaign, auth.uid()) or public.is_site_owner()) then
    raise exception 'Só o mestre da mesa.';
  end if;

  select * into s from public.altherium_character_sheets where campaign_id = p_campaign and user_id = p_user for update;
  b := s.mestre_refusal_backup;
  if b is not null then
    prev := jsonb_populate_record(null::public.altherium_character_sheets, b->'sheet');
    update public.altherium_character_sheets set
      level              = prev.level,
      attr_furia         = prev.attr_furia,
      attr_destino       = prev.attr_destino,
      attr_espirito      = prev.attr_espirito,
      attr_impulso       = prev.attr_impulso,
      attr_estrategia    = prev.attr_estrategia,
      attr_runico        = prev.attr_runico,
      vitality_max       = prev.vitality_max,
      equilibrio_max     = prev.equilibrio_max,
      fv_max             = prev.fv_max,
      pr_max             = prev.pr_max,
      cards_max          = prev.cards_max,
      vitality_current   = prev.vitality_current,
      equilibrio_current = prev.equilibrio_current,
      fv_current         = prev.fv_current,
      pr_current         = prev.pr_current,
      cards_current      = prev.cards_current,
      runaskin_scene_uses = prev.runaskin_scene_uses,
      berserker_triumphs = prev.berserker_triumphs,
      recent_triumphs    = prev.recent_triumphs,
      mestre_refusal_backup = null
    where id = s.id;

    delete from public.altherium_character_domains where sheet_id = s.id;
    insert into public.altherium_character_domains
    select * from jsonb_populate_recordset(null::public.altherium_character_domains, b->'domains');

    insert into public.altherium_runaskin_runes
    select * from jsonb_populate_recordset(null::public.altherium_runaskin_runes, b->'runes')
    on conflict (id) do nothing;
  end if;

  delete from public.altherium_mestre_refusals where campaign_id = p_campaign and user_id = p_user;
end;
$$;
revoke all on function public.mestre_undo_refusal(uuid, uuid) from public, anon;
grant execute on function public.mestre_undo_refusal(uuid, uuid) to authenticated;

-- ── 7. Tempo real: a contagem muda na hora pra todos ────

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'altherium_mestre_refusals') then
    alter publication supabase_realtime add table public.altherium_mestre_refusals;
  end if;
end $$;
