-- ============================================================
-- Vorterium — D&D 5e: base da ficha nova (Marco 2, parte 1)
-- Migration: 20240203000000_dnd_ficha_nova.sql
-- Aplicar após: 20240202000000_vortable_erros.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
-- ============================================================
--
-- Prepara a tabela da ficha de D&D 5e (dnd_character_sheets) para o molde
-- das fichas novas (Vampiro, Altherium), conforme
-- docs/superpowers/specs/2026-10-13-ficha-dnd5e-design.md:
--   • só o dono do site enquanto o recurso "dnd5e" estiver guardado no
--     Painel de controle (mesma ideia de 20240188000000_vampiro_so_dono);
--   • fichas de NPC (is_npc / npc_visible), como em 20240189000000;
--   • retrato (bucket dnd-portraits);
--   • estado de jogo: moedas, condições, exaustão, concentração, dados de
--     vida gastos e as escolhas do criador de personagem;
--   • Realtime, pros cards do mestre.
--
-- Hoje não existe nenhuma ficha de D&D no banco (conferido em 13/10/2026),
-- então as colunas novas entram sem migrar dados.
-- ============================================================


-- ── 1. Colunas novas ────────────────────────────────────

alter table public.dnd_character_sheets
  add column if not exists is_npc          boolean  not null default false,
  add column if not exists npc_visible     boolean  not null default false,
  add column if not exists portrait_url    text,
  add column if not exists hit_dice_used   jsonb    not null default '{}'::jsonb,
  add column if not exists coin_cp         integer  not null default 0,
  add column if not exists coin_sp         integer  not null default 0,
  add column if not exists coin_ep         integer  not null default 0,
  add column if not exists coin_gp         integer  not null default 0,
  add column if not exists coin_pp         integer  not null default 0,
  add column if not exists conditions      text[]   not null default '{}',
  add column if not exists exhaustion      smallint not null default 0,
  add column if not exists concentrating_on text,
  add column if not exists choices         jsonb    not null default '{}'::jsonb,
  add column if not exists build_version   smallint not null default 1;

alter table public.dnd_character_sheets drop constraint if exists dnd_sheets_portrait_url_length;
alter table public.dnd_character_sheets add constraint dnd_sheets_portrait_url_length
  check (portrait_url is null or char_length(portrait_url) <= 2048);

alter table public.dnd_character_sheets drop constraint if exists dnd_sheets_hit_dice_used_valid;
alter table public.dnd_character_sheets add constraint dnd_sheets_hit_dice_used_valid
  check (jsonb_typeof(hit_dice_used) = 'object' and pg_column_size(hit_dice_used) <= 1024);

alter table public.dnd_character_sheets drop constraint if exists dnd_sheets_coins_valid;
alter table public.dnd_character_sheets add constraint dnd_sheets_coins_valid
  check (coin_cp between 0 and 99999999 and coin_sp between 0 and 99999999 and coin_ep between 0 and 99999999
     and coin_gp between 0 and 99999999 and coin_pp between 0 and 99999999);

alter table public.dnd_character_sheets drop constraint if exists dnd_sheets_exhaustion_valid;
alter table public.dnd_character_sheets add constraint dnd_sheets_exhaustion_valid
  check (exhaustion between 0 and 6);

alter table public.dnd_character_sheets drop constraint if exists dnd_sheets_conditions_valid;
alter table public.dnd_character_sheets add constraint dnd_sheets_conditions_valid
  check (
    cardinality(conditions) <= 20
    and conditions <@ array[
      'blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'invisible',
      'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious'
    ]::text[]
  );

alter table public.dnd_character_sheets drop constraint if exists dnd_sheets_concentrating_on_length;
alter table public.dnd_character_sheets add constraint dnd_sheets_concentrating_on_length
  check (concentrating_on is null or char_length(concentrating_on) <= 160);

alter table public.dnd_character_sheets drop constraint if exists dnd_sheets_choices_valid;
alter table public.dnd_character_sheets add constraint dnd_sheets_choices_valid
  check (jsonb_typeof(choices) = 'object' and pg_column_size(choices) <= 65536);


-- ── 2. Funções de acesso ────────────────────────────────

-- D&D liberado pra esta pessoa? (recurso ligado no Painel, ou é o dono do site)
create or replace function public.dnd_open()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.site_features where key = 'dnd5e' and enabled)
      or public.is_site_owner();
$$;
revoke all on function public.dnd_open() from public, anon;
grant execute on function public.dnd_open() to authenticated;

-- A pessoa pode ver e editar esta ficha? (mestre da campanha, ou dono da ficha enquanto membro)
create or replace function public.dnd_sheet_access(p_sheet uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.dnd_character_sheets s
    where s.id = p_sheet
      and (public.is_campaign_master(s.campaign_id, auth.uid())
        or (s.user_id = auth.uid() and public.is_campaign_member(s.campaign_id, auth.uid())))
  );
$$;
revoke all on function public.dnd_sheet_access(uuid) from public, anon;
grant execute on function public.dnd_sheet_access(uuid) to authenticated;

-- É ficha de NPC que o mestre mostrou pros jogadores desta campanha?
create or replace function public.dnd_sheet_npc_shown(p_sheet uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.dnd_character_sheets s
    where s.id = p_sheet
      and s.is_npc and s.npc_visible
      and public.is_campaign_member(s.campaign_id, auth.uid())
  );
$$;
revoke all on function public.dnd_sheet_npc_shown(uuid) from public, anon;
grant execute on function public.dnd_sheet_npc_shown(uuid) to authenticated;


-- ── 3. Guardado: só o dono do site (ou todos, com o recurso ligado) ──
-- Policy "restrictive": soma-se às de antes. Sem o recurso ligado, quem não
-- é o dono do site não vê nem altera nada de D&D.

do $$
declare t text;
begin
  foreach t in array array[
    'dnd_character_sheets', 'dnd_character_skills', 'dnd_character_attacks',
    'dnd_character_inventory', 'dnd_character_spells',
    'dnd_character_proficiencies', 'dnd_character_overrides'
  ] loop
    execute format('drop policy if exists "dnd: so quando liberado" on public.%I', t);
    execute format(
      'create policy "dnd: so quando liberado" on public.%I as restrictive for all to authenticated using (public.dnd_open()) with check (public.dnd_open())',
      t);
  end loop;
end $$;


-- ── 4. Fichas de NPC ────────────────────────────────────

-- Tira a regra antiga "uma ficha por (campanha, pessoa)": agora vale só pras
-- fichas de jogador (índice único parcial).
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

select pg_temp.drop_pc_unique('public.dnd_character_sheets'::regclass);
create unique index if not exists dnd_character_sheets_one_pc_per_user
  on public.dnd_character_sheets (campaign_id, user_id) where not is_npc;
create index if not exists dnd_character_sheets_npcs
  on public.dnd_character_sheets (campaign_id) where is_npc;

-- NPC: só o mestre cria e mexe (somado às policies de antes).
drop policy if exists "npc: so o mestre cria" on public.dnd_character_sheets;
create policy "npc: so o mestre cria" on public.dnd_character_sheets
  as restrictive for insert to authenticated
  with check (not is_npc or public.is_campaign_master(campaign_id, auth.uid()));

drop policy if exists "npc: so o mestre altera" on public.dnd_character_sheets;
create policy "npc: so o mestre altera" on public.dnd_character_sheets
  as restrictive for update to authenticated
  using (not is_npc or public.is_campaign_master(campaign_id, auth.uid()))
  with check (not is_npc or public.is_campaign_master(campaign_id, auth.uid()));

-- NPC mostrado pelo mestre: os jogadores da campanha leem.
drop policy if exists "npc: visivel pros jogadores" on public.dnd_character_sheets;
create policy "npc: visivel pros jogadores" on public.dnd_character_sheets
  for select to authenticated
  using (is_npc and npc_visible and public.is_campaign_member(campaign_id, auth.uid()));

-- Ficha de jogador continua sem delete; NPC o mestre apaga.
drop policy if exists "npc: o mestre apaga" on public.dnd_character_sheets;
create policy "npc: o mestre apaga" on public.dnd_character_sheets
  for delete to authenticated
  using (is_npc and public.is_campaign_master(campaign_id, auth.uid()));
grant delete on public.dnd_character_sheets to authenticated;

-- A ficha não vira NPC (nem deixa de ser) depois de criada (função de 20240189000000).
drop trigger if exists npc_kind_fixed on public.dnd_character_sheets;
create trigger npc_kind_fixed
  before update on public.dnd_character_sheets
  for each row execute function public.npc_kind_fixed();

-- Perícias, ataques, inventário, magias, proficiências e sobrescritas do NPC
-- mostrado: os jogadores leem também (senão a ficha aparece pela metade).
do $$
declare t text;
begin
  foreach t in array array[
    'dnd_character_skills', 'dnd_character_attacks', 'dnd_character_inventory',
    'dnd_character_spells', 'dnd_character_proficiencies', 'dnd_character_overrides'
  ] loop
    execute format('drop policy if exists "npc: visivel pros jogadores" on public.%I', t);
    execute format(
      'create policy "npc: visivel pros jogadores" on public.%I for select to authenticated using (public.dnd_sheet_npc_shown(sheet_id))',
      t);
  end loop;
end $$;


-- ── 5. Tempo real: os cards do mestre acompanham a ficha ──

do $$
begin
  alter publication supabase_realtime add table public.dnd_character_sheets;
exception when others then null;
end $$;


-- ── 6. Retrato (bucket dnd-portraits) ───────────────────
-- O caminho é "<id da ficha>/portrait"; quem pode é o dono da ficha ou o
-- mestre da campanha, com o recurso liberado (igual ao de Vampiro).

insert into storage.buckets (id, name, public)
values ('dnd-portraits', 'dnd-portraits', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "dnd-portraits: dono ou mestre pode visualizar" on storage.objects;
create policy "dnd-portraits: dono ou mestre pode visualizar"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'dnd-portraits'
    and public.dnd_open()
    and exists (
      select 1 from public.dnd_character_sheets s
      where s.id::text = split_part(name, '/', 1)
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );

drop policy if exists "dnd-portraits: dono ou mestre pode enviar" on storage.objects;
create policy "dnd-portraits: dono ou mestre pode enviar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'dnd-portraits'
    and public.dnd_open()
    and exists (
      select 1 from public.dnd_character_sheets s
      where s.id::text = split_part(name, '/', 1)
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );

drop policy if exists "dnd-portraits: dono ou mestre pode atualizar" on storage.objects;
create policy "dnd-portraits: dono ou mestre pode atualizar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'dnd-portraits'
    and public.dnd_open()
    and exists (
      select 1 from public.dnd_character_sheets s
      where s.id::text = split_part(name, '/', 1)
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  )
  with check (
    bucket_id = 'dnd-portraits'
    and public.dnd_open()
    and exists (
      select 1 from public.dnd_character_sheets s
      where s.id::text = split_part(name, '/', 1)
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );

drop policy if exists "dnd-portraits: dono ou mestre pode remover" on storage.objects;
create policy "dnd-portraits: dono ou mestre pode remover"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'dnd-portraits'
    and public.dnd_open()
    and exists (
      select 1 from public.dnd_character_sheets s
      where s.id::text = split_part(name, '/', 1)
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );
