-- ============================================================
-- Vorterium — Sistema Terra Devastada Adaptada
-- Migration: 20240196000000_terra_devastada_adaptada.sql
-- Aplicar após: 20240195000000_altherium_movimento.sql
-- ============================================================
--
-- Versão adaptada do Terra Devastada (inspirada em The Last of Us), que
-- nasce como cópia da original e vai sendo mexida à parte:
--   1. Campanhas aceitam o sistema 'terra_devastada_adaptada'.
--   2. Ficha própria (tda_character_sheets), igual à td_character_sheets
--      de 20240157 + as colunas de NPC de 20240189 — já nasce com tudo.
--   3. Painel do desenvolvedor passa a contar essas fichas.
-- O teste de pares nas rolagens (dice_rolls) não muda: é o mesmo.


-- ── 1. Sistema permitido nas campanhas ────────────────────

alter table public.campaigns
  drop constraint if exists campaigns_system_valid;

alter table public.campaigns
  add constraint campaigns_system_valid
    check (system in ('generic', 'dnd5e', 'altherium', 'terra_devastada', 'terra_devastada_adaptada', 'vampiro'));

-- Mesma função de 20240187000000, com o sistema novo na lista.
create or replace function public.create_campaign(
  campaign_name        text,
  campaign_system      text default 'generic',
  campaign_description text default null
)
returns public.campaigns as $$
declare
  v_campaign public.campaigns;
  v_user_id  uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if trim(campaign_name) = '' then
    raise exception 'O nome da campanha não pode ser vazio.';
  end if;

  if char_length(trim(campaign_name)) > 120 then
    raise exception 'O nome da campanha deve ter no máximo 120 caracteres.';
  end if;

  if campaign_system not in ('generic', 'dnd5e', 'altherium', 'terra_devastada', 'terra_devastada_adaptada', 'vampiro') then
    raise exception 'Sistema inválido: %', campaign_system;
  end if;

  -- Vampiro ainda guardado: só com o recurso ligado (ou o dono do site, testando).
  if campaign_system = 'vampiro'
     and not exists (select 1 from public.site_features where key = 'vampiro' and enabled)
     and not public.is_site_owner() then
    raise exception 'Vampiro: A Máscara ainda não está liberado.';
  end if;

  if campaign_description is not null
     and char_length(campaign_description) > 1000 then
    raise exception 'A descrição deve ter no máximo 1000 caracteres.';
  end if;

  insert into public.campaigns (name, system, master_id, description, status)
  values (
    trim(campaign_name),
    campaign_system,
    v_user_id,
    nullif(trim(coalesce(campaign_description, '')), ''),
    'active'
  )
  returning * into v_campaign;

  insert into public.campaign_members (campaign_id, user_id, role)
  values (v_campaign.id, v_user_id, 'master');

  return v_campaign;
end;
$$ language plpgsql security definer set search_path = public;


-- ── 2. Ficha Terra Devastada Adaptada ─────────────────────
--
-- Mesmos formatos de lista da original:
--   traits     [{ "id", "name", "tag": null | "motiva" | "desmotiva" }]
--   conditions [{ "id", "name", "duration": "curta"|"media"|"longa"|"indeterminada" }]
--   trunfos    [{ "id", "name", "description" }]
--   inventory  [{ "id", "name", "qty", "kind": "item"|"arma"|"protecao", "level": 0..3 }]

create table if not exists public.tda_character_sheets (
  id              uuid        primary key default gen_random_uuid(),
  campaign_id     uuid        not null references public.campaigns(id) on delete cascade,
  user_id         uuid        not null references public.profiles(id) on delete cascade,

  character_name  text        check (char_length(character_name) <= 80),
  concept         text        check (char_length(concept)        <= 160),
  description     text        check (char_length(description)    <= 600),
  background      text        check (char_length(background)     <= 4000),

  traits          jsonb       not null default '[]'::jsonb,
  conditions      jsonb       not null default '[]'::jsonb,
  trunfos         jsonb       not null default '[]'::jsonb,
  inventory       jsonb       not null default '[]'::jsonb,

  -- Horror: 6 no começo (o jogador ajusta pelas motivações); 0 a 12.
  horror          integer     not null default 6  check (horror     between 0 and 12),
  -- Convicção: 12 no começo; a trilha da ficha vai até 24.
  conviction      integer     not null default 12 check (conviction between 0 and 24),

  notes           text        check (char_length(notes) <= 2000),

  -- Ficha de NPC do mestre (como em 20240189000000).
  is_npc          boolean     not null default false,
  npc_visible     boolean     not null default false,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint tda_sheets_traits_array     check (jsonb_typeof(traits)     = 'array'),
  constraint tda_sheets_conditions_array check (jsonb_typeof(conditions) = 'array'),
  constraint tda_sheets_trunfos_array    check (jsonb_typeof(trunfos)    = 'array'),
  constraint tda_sheets_inventory_array  check (jsonb_typeof(inventory)  = 'array'),
  constraint tda_sheets_traits_size      check (jsonb_array_length(traits)     <= 60),
  constraint tda_sheets_conditions_size  check (jsonb_array_length(conditions) <= 40),
  constraint tda_sheets_trunfos_size     check (jsonb_array_length(trunfos)    <= 40),
  constraint tda_sheets_inventory_size   check (jsonb_array_length(inventory)  <= 120),
  constraint tda_sheets_lists_bytes      check (
    pg_column_size(traits) + pg_column_size(conditions)
    + pg_column_size(trunfos) + pg_column_size(inventory) <= 120000
  )
);

-- Uma ficha de jogador por pessoa em cada campanha; NPCs podem ser vários.
create unique index if not exists tda_character_sheets_one_pc_per_user
  on public.tda_character_sheets (campaign_id, user_id) where not is_npc;
create index if not exists tda_character_sheets_npcs
  on public.tda_character_sheets (campaign_id) where is_npc;
create index if not exists idx_tda_sheets_campaign_id on public.tda_character_sheets(campaign_id);
create index if not exists idx_tda_sheets_user_id     on public.tda_character_sheets(user_id);

drop trigger if exists set_tda_sheets_updated_at on public.tda_character_sheets;
create trigger set_tda_sheets_updated_at
  before update on public.tda_character_sheets
  for each row execute function public.set_updated_at();

alter table public.tda_character_sheets enable row level security;

drop policy if exists "tda_sheets: dono ou mestre pode ver" on public.tda_character_sheets;
create policy "tda_sheets: dono ou mestre pode ver"
  on public.tda_character_sheets for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_campaign_master(campaign_id, auth.uid())
  );

drop policy if exists "tda_sheets: membro cria propria ficha" on public.tda_character_sheets;
create policy "tda_sheets: membro cria propria ficha"
  on public.tda_character_sheets for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_campaign_member(campaign_id, auth.uid())
  );

drop policy if exists "tda_sheets: dono ou mestre pode atualizar" on public.tda_character_sheets;
create policy "tda_sheets: dono ou mestre pode atualizar"
  on public.tda_character_sheets for update
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_campaign_master(campaign_id, auth.uid())
  )
  with check (
    user_id = auth.uid()
    or public.is_campaign_master(campaign_id, auth.uid())
  );

-- NPC: só o mestre cria e mexe (somado às policies de cima).
drop policy if exists "npc: so o mestre cria" on public.tda_character_sheets;
create policy "npc: so o mestre cria" on public.tda_character_sheets
  as restrictive for insert to authenticated
  with check (not is_npc or public.is_campaign_master(campaign_id, auth.uid()));

drop policy if exists "npc: so o mestre altera" on public.tda_character_sheets;
create policy "npc: so o mestre altera" on public.tda_character_sheets
  as restrictive for update to authenticated
  using (not is_npc or public.is_campaign_master(campaign_id, auth.uid()))
  with check (not is_npc or public.is_campaign_master(campaign_id, auth.uid()));

-- NPC mostrado pelo mestre: os jogadores da campanha leem.
drop policy if exists "npc: visivel pros jogadores" on public.tda_character_sheets;
create policy "npc: visivel pros jogadores" on public.tda_character_sheets
  for select to authenticated
  using (is_npc and npc_visible and public.is_campaign_member(campaign_id, auth.uid()));

-- Ficha de jogador não é apagada pelo app; NPC o mestre apaga.
drop policy if exists "npc: o mestre apaga" on public.tda_character_sheets;
create policy "npc: o mestre apaga" on public.tda_character_sheets
  for delete to authenticated
  using (is_npc and public.is_campaign_master(campaign_id, auth.uid()));
grant delete on public.tda_character_sheets to authenticated;

-- Painel do desenvolvedor lê tudo (como nas outras tabelas, 20240161).
drop policy if exists "dev: le tudo" on public.tda_character_sheets;
create policy "dev: le tudo" on public.tda_character_sheets
  for select to authenticated using (public.is_developer());

-- Campanha e dono não mudam depois de criada.
create or replace function public.prevent_tda_sheet_structural_change()
returns trigger as $$
begin
  if new.campaign_id <> old.campaign_id then
    raise exception 'Não é permitido alterar campaign_id de uma ficha após criação.';
  end if;
  if new.user_id <> old.user_id then
    raise exception 'Não é permitido alterar user_id de uma ficha após criação.';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists enforce_tda_sheet_immutable_fields on public.tda_character_sheets;
create trigger enforce_tda_sheet_immutable_fields
  before update on public.tda_character_sheets
  for each row execute function public.prevent_tda_sheet_structural_change();

-- A ficha não vira NPC (nem deixa de ser) depois de criada.
drop trigger if exists npc_kind_fixed on public.tda_character_sheets;
create trigger npc_kind_fixed
  before update on public.tda_character_sheets
  for each row execute function public.npc_kind_fixed();

-- Tempo real: os cards do mestre acompanham Horror/Convicção.
do $$
begin
  alter publication supabase_realtime add table public.tda_character_sheets;
exception when others then
  null;
end;
$$;


-- ── 3. Painel do desenvolvedor: conta as fichas novas ─────
-- (igual à de 20240187000000, com a tabela adaptada na soma)

create or replace function public.dev_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_developer() then
    raise exception 'Acesso restrito ao desenvolvedor.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'users',          (select count(*) from public.profiles),
    'users_7d',       (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'active_24h',     (select count(distinct user_id) from public.campaign_presence where last_seen_at > now() - interval '24 hours'),
    'online_now',     (select count(distinct user_id) from public.campaign_presence where last_seen_at > now() - interval '3 minutes'),
    'campaigns',      (select count(*) from public.campaigns),
    'campaigns_by_system', (
      select coalesce(jsonb_object_agg(system, n), '{}'::jsonb)
      from (select system, count(*) as n from public.campaigns group by system) s
    ),
    'sheets',         (select count(*) from public.character_sheets)
                    + (select count(*) from public.altherium_character_sheets)
                    + (select count(*) from public.td_character_sheets)
                    + (select count(*) from public.tda_character_sheets)
                    + (select count(*) from public.vtm_character_sheets),
    'messages',       (select count(*) from public.campaign_messages),
    'messages_24h',   (select count(*) from public.campaign_messages where created_at > now() - interval '24 hours'),
    'rolls',          (select count(*) from public.dice_rolls),
    'rolls_24h',      (select count(*) from public.dice_rolls where created_at > now() - interval '24 hours'),
    'documents',      (select count(*) from public.campaign_documents),
    'feedback_new',   (select count(*) from public.site_feedback where status = 'novo')
  );
end;
$$;

revoke all on function public.dev_overview() from public;
grant execute on function public.dev_overview() to authenticated;
