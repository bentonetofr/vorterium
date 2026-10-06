-- ============================================================
-- Vorterium — Fichas de NPC (todos os sistemas)
-- Migration: 20240189000000_fichas_de_npc.sql
-- Aplicar após: 20240188000000_vampiro_so_dono.sql
-- ============================================================
--
-- Na aba Ficha, o mestre cria quantas fichas quiser pra NPCs (aliados,
-- inimigos, figurantes), no sistema da campanha: Genérica, Altherium,
-- Terra Devastada e Vampiro.
--   • is_npc: a ficha é de NPC (do mestre, que fica como user_id). A regra
--     "uma ficha por pessoa por campanha" passa a valer só pras fichas de
--     jogador (índice único parcial).
--   • npc_visible: o mestre mostra a ficha pros jogadores, que só leem.
--   • Só o mestre cria, altera, mostra e apaga NPCs; ficha de jogador
--     continua sem delete. Ficha não troca de tipo depois de criada.
--   • Raiz Mestre (virar Mestre, recusar, desfazer) ignora NPCs.
-- ============================================================

-- Tira a regra antiga "uma ficha por (campanha, pessoa)" — o nome dela
-- varia de tabela pra tabela, então acha pelas colunas.
create or replace function pg_temp.drop_pc_unique(t regclass)
returns void language plpgsql as $$
declare c text;
begin
  for c in
    select con.conname from pg_constraint con
    where con.conrelid = t and con.contype = 'u'
      and (select array_agg(att.attname::text order by att.attname) from pg_attribute att
           where att.attrelid = t and att.attnum = any(con.conkey)) = array['campaign_id', 'user_id']
  loop
    execute format('alter table %s drop constraint %I', t, c);
  end loop;
end $$;

-- A ficha não vira NPC (nem deixa de ser) depois de criada.
create or replace function public.npc_kind_fixed()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.is_npc is distinct from old.is_npc then
    raise exception 'Uma ficha não muda de jogador pra NPC (nem o contrário).';
  end if;
  return new;
end $$;

-- ── Genérica (character_sheets) ──

alter table public.character_sheets
  add column if not exists is_npc      boolean not null default false,
  add column if not exists npc_visible boolean not null default false;

select pg_temp.drop_pc_unique('public.character_sheets'::regclass);
create unique index if not exists character_sheets_one_pc_per_user
  on public.character_sheets (campaign_id, user_id) where not is_npc;
create index if not exists character_sheets_npcs on public.character_sheets (campaign_id) where is_npc;

-- NPC: só o mestre cria e mexe (somado às policies de antes).
drop policy if exists "npc: so o mestre cria" on public.character_sheets;
create policy "npc: so o mestre cria" on public.character_sheets
  as restrictive for insert to authenticated
  with check (not is_npc or public.is_campaign_master(campaign_id, auth.uid()));

drop policy if exists "npc: so o mestre altera" on public.character_sheets;
create policy "npc: so o mestre altera" on public.character_sheets
  as restrictive for update to authenticated
  using (not is_npc or public.is_campaign_master(campaign_id, auth.uid()))
  with check (not is_npc or public.is_campaign_master(campaign_id, auth.uid()));

-- NPC mostrado pelo mestre: os jogadores da campanha leem.
drop policy if exists "npc: visivel pros jogadores" on public.character_sheets;
create policy "npc: visivel pros jogadores" on public.character_sheets
  for select to authenticated
  using (is_npc and npc_visible and public.is_campaign_member(campaign_id, auth.uid()));

-- Ficha de jogador continua sem delete; NPC o mestre apaga.
drop policy if exists "npc: o mestre apaga" on public.character_sheets;
create policy "npc: o mestre apaga" on public.character_sheets
  for delete to authenticated
  using (is_npc and public.is_campaign_master(campaign_id, auth.uid()));
grant delete on public.character_sheets to authenticated;

drop trigger if exists npc_kind_fixed on public.character_sheets;
create trigger npc_kind_fixed
  before update on public.character_sheets
  for each row execute function public.npc_kind_fixed();

-- ── Altherium (altherium_character_sheets) ──

alter table public.altherium_character_sheets
  add column if not exists is_npc      boolean not null default false,
  add column if not exists npc_visible boolean not null default false;

select pg_temp.drop_pc_unique('public.altherium_character_sheets'::regclass);
create unique index if not exists altherium_character_sheets_one_pc_per_user
  on public.altherium_character_sheets (campaign_id, user_id) where not is_npc;
create index if not exists altherium_character_sheets_npcs on public.altherium_character_sheets (campaign_id) where is_npc;

-- NPC: só o mestre cria e mexe (somado às policies de antes).
drop policy if exists "npc: so o mestre cria" on public.altherium_character_sheets;
create policy "npc: so o mestre cria" on public.altherium_character_sheets
  as restrictive for insert to authenticated
  with check (not is_npc or public.is_campaign_master(campaign_id, auth.uid()));

drop policy if exists "npc: so o mestre altera" on public.altherium_character_sheets;
create policy "npc: so o mestre altera" on public.altherium_character_sheets
  as restrictive for update to authenticated
  using (not is_npc or public.is_campaign_master(campaign_id, auth.uid()))
  with check (not is_npc or public.is_campaign_master(campaign_id, auth.uid()));

-- NPC mostrado pelo mestre: os jogadores da campanha leem.
drop policy if exists "npc: visivel pros jogadores" on public.altherium_character_sheets;
create policy "npc: visivel pros jogadores" on public.altherium_character_sheets
  for select to authenticated
  using (is_npc and npc_visible and public.is_campaign_member(campaign_id, auth.uid()));

-- Ficha de jogador continua sem delete; NPC o mestre apaga.
drop policy if exists "npc: o mestre apaga" on public.altherium_character_sheets;
create policy "npc: o mestre apaga" on public.altherium_character_sheets
  for delete to authenticated
  using (is_npc and public.is_campaign_master(campaign_id, auth.uid()));
grant delete on public.altherium_character_sheets to authenticated;

drop trigger if exists npc_kind_fixed on public.altherium_character_sheets;
create trigger npc_kind_fixed
  before update on public.altherium_character_sheets
  for each row execute function public.npc_kind_fixed();

-- Domínios, inventário e runas do NPC mostrado: os jogadores leem também
-- (senão a ficha aparece pela metade). Escrever continua só dono ou mestre.
drop policy if exists "npc: visivel pros jogadores" on public.altherium_character_domains;
create policy "npc: visivel pros jogadores" on public.altherium_character_domains
  for select to authenticated
  using (exists (
    select 1 from public.altherium_character_sheets s
    where s.id = sheet_id
      and s.is_npc and s.npc_visible
      and public.is_campaign_member(s.campaign_id, auth.uid())
  ));
drop policy if exists "npc: visivel pros jogadores" on public.altherium_character_inventory;
create policy "npc: visivel pros jogadores" on public.altherium_character_inventory
  for select to authenticated
  using (exists (
    select 1 from public.altherium_character_sheets s
    where s.id = sheet_id
      and s.is_npc and s.npc_visible
      and public.is_campaign_member(s.campaign_id, auth.uid())
  ));
drop policy if exists "npc: visivel pros jogadores" on public.altherium_runaskin_runes;
create policy "npc: visivel pros jogadores" on public.altherium_runaskin_runes
  for select to authenticated
  using (exists (
    select 1 from public.altherium_character_sheets s
    where s.id = sheet_id
      and s.is_npc and s.npc_visible
      and public.is_campaign_member(s.campaign_id, auth.uid())
  ));

-- ── Terra Devastada (td_character_sheets) ──

alter table public.td_character_sheets
  add column if not exists is_npc      boolean not null default false,
  add column if not exists npc_visible boolean not null default false;

select pg_temp.drop_pc_unique('public.td_character_sheets'::regclass);
create unique index if not exists td_character_sheets_one_pc_per_user
  on public.td_character_sheets (campaign_id, user_id) where not is_npc;
create index if not exists td_character_sheets_npcs on public.td_character_sheets (campaign_id) where is_npc;

-- NPC: só o mestre cria e mexe (somado às policies de antes).
drop policy if exists "npc: so o mestre cria" on public.td_character_sheets;
create policy "npc: so o mestre cria" on public.td_character_sheets
  as restrictive for insert to authenticated
  with check (not is_npc or public.is_campaign_master(campaign_id, auth.uid()));

drop policy if exists "npc: so o mestre altera" on public.td_character_sheets;
create policy "npc: so o mestre altera" on public.td_character_sheets
  as restrictive for update to authenticated
  using (not is_npc or public.is_campaign_master(campaign_id, auth.uid()))
  with check (not is_npc or public.is_campaign_master(campaign_id, auth.uid()));

-- NPC mostrado pelo mestre: os jogadores da campanha leem.
drop policy if exists "npc: visivel pros jogadores" on public.td_character_sheets;
create policy "npc: visivel pros jogadores" on public.td_character_sheets
  for select to authenticated
  using (is_npc and npc_visible and public.is_campaign_member(campaign_id, auth.uid()));

-- Ficha de jogador continua sem delete; NPC o mestre apaga.
drop policy if exists "npc: o mestre apaga" on public.td_character_sheets;
create policy "npc: o mestre apaga" on public.td_character_sheets
  for delete to authenticated
  using (is_npc and public.is_campaign_master(campaign_id, auth.uid()));
grant delete on public.td_character_sheets to authenticated;

drop trigger if exists npc_kind_fixed on public.td_character_sheets;
create trigger npc_kind_fixed
  before update on public.td_character_sheets
  for each row execute function public.npc_kind_fixed();

-- ── Vampiro (vtm_character_sheets) ──

alter table public.vtm_character_sheets
  add column if not exists is_npc      boolean not null default false,
  add column if not exists npc_visible boolean not null default false;

select pg_temp.drop_pc_unique('public.vtm_character_sheets'::regclass);
create unique index if not exists vtm_character_sheets_one_pc_per_user
  on public.vtm_character_sheets (campaign_id, user_id) where not is_npc;
create index if not exists vtm_character_sheets_npcs on public.vtm_character_sheets (campaign_id) where is_npc;

-- NPC: só o mestre cria e mexe (somado às policies de antes).
drop policy if exists "npc: so o mestre cria" on public.vtm_character_sheets;
create policy "npc: so o mestre cria" on public.vtm_character_sheets
  as restrictive for insert to authenticated
  with check (not is_npc or public.is_campaign_master(campaign_id, auth.uid()));

drop policy if exists "npc: so o mestre altera" on public.vtm_character_sheets;
create policy "npc: so o mestre altera" on public.vtm_character_sheets
  as restrictive for update to authenticated
  using (not is_npc or public.is_campaign_master(campaign_id, auth.uid()))
  with check (not is_npc or public.is_campaign_master(campaign_id, auth.uid()));

-- NPC mostrado pelo mestre: os jogadores da campanha leem.
drop policy if exists "npc: visivel pros jogadores" on public.vtm_character_sheets;
create policy "npc: visivel pros jogadores" on public.vtm_character_sheets
  for select to authenticated
  using (public.vtm_open() and is_npc and npc_visible and public.is_campaign_member(campaign_id, auth.uid()));

-- Ficha de jogador continua sem delete; NPC o mestre apaga.
drop policy if exists "npc: o mestre apaga" on public.vtm_character_sheets;
create policy "npc: o mestre apaga" on public.vtm_character_sheets
  for delete to authenticated
  using (is_npc and public.is_campaign_master(campaign_id, auth.uid()));
grant delete on public.vtm_character_sheets to authenticated;

drop trigger if exists npc_kind_fixed on public.vtm_character_sheets;
create trigger npc_kind_fixed
  before update on public.vtm_character_sheets
  for each row execute function public.npc_kind_fixed();


-- ── Raiz Mestre: NPC não vira Mestre nem é rebaixado ──
-- (as mesmas de 20240176 e 20240186, só com "not is_npc")

create or replace function public.mestre_convert_sheets(p_campaign uuid, p_users uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.altherium_character_sheets s set
    mestre_backup      = jsonb_build_object(
                           'raiz', s.raiz,
                           'vitality_max', s.vitality_max, 'vitality_current', s.vitality_current,
                           'equilibrio_max', s.equilibrio_max, 'equilibrio_current', s.equilibrio_current,
                           'torre_current', s.torre_current),
    raiz               = 'mestre',
    vitality_max       = s.vitality_max * 2,
    vitality_current   = s.vitality_max * 2,
    equilibrio_max     = s.equilibrio_max * 2,
    equilibrio_current = s.equilibrio_max * 2,
    torre_current      = greatest(0, s.attr_estrategia * 5)
  where s.campaign_id = p_campaign
    and s.user_id = any(p_users)
    and s.raiz is distinct from 'mestre'
    and not s.is_npc;
$$;
revoke all on function public.mestre_convert_sheets(uuid, uuid[]) from public, anon, authenticated;

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

  select id into v_sheet from public.altherium_character_sheets where campaign_id = p_campaign and user_id = auth.uid() and not is_npc;
  if v_sheet is not null then perform public.mestre_demote_sheet(v_sheet); end if;

  -- se só faltava quem recusou, os outros ascendem agora
  return jsonb_build_object('ascended', (public.mestre__try_ascend(p_campaign)->>'ascended')::boolean);
end;
$$;
revoke all on function public.mestre_refuse(uuid) from public, anon;
grant execute on function public.mestre_refuse(uuid) to authenticated;

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

  select * into s from public.altherium_character_sheets where campaign_id = p_campaign and user_id = p_user and not is_npc for update;
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
