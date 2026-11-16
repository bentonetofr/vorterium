-- ============================================================
-- Vorterium — DaggerHeart (SRD 2.0, Darrington Press)
-- Migration: 20240237000000_daggerheart_base.sql
-- Aplicar após: 20240236000000_session_end_prompt.sql
--
-- Cria o sistema 'daggerheart' nas campanhas e todas as tabelas
-- da ficha de personagem:
--   · dh_character_sheets  — dados principais da ficha
--   · dh_experiences       — experiências do personagem (2+ por ficha)
--   · dh_domain_cards      — cartas de domínio (ativas + cofre)
--   · dh_weapons           — armas equipadas/inventário
--   · dh_inventory         — itens gerais
--
-- Nasce GUARDADO no Painel de controle do dono.
-- ============================================================


-- ── 1. Adiciona 'daggerheart' ao constraint de sistema ──────

alter table public.campaigns
  drop constraint if exists campaigns_system_valid;

alter table public.campaigns
  add constraint campaigns_system_valid
    check (system in (
      'generic', 'dnd5e', 'altherium', 'terra_devastada',
      'vampiro', 'terra_devastada_adaptada', 'daggerheart'
    ));

-- Atualiza a função create_campaign para aceitar o novo sistema.
-- Padrão do projeto: a função é recriada integralmente a cada novo sistema.
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
    raise exception 'Nome da campanha muito longo (máximo 120 caracteres).';
  end if;

  if campaign_system not in (
    'generic', 'dnd5e', 'altherium', 'terra_devastada',
    'vampiro', 'terra_devastada_adaptada', 'daggerheart'
  ) then
    raise exception 'Sistema de campanha inválido: %', campaign_system;
  end if;

  -- Sistemas guardados só podem ser criados pelo dono do site.
  if campaign_system in ('vampiro', 'terra_devastada_adaptada', 'daggerheart')
     and not public.is_site_owner()
  then
    if not exists (
      select 1 from public.site_features
      where key = campaign_system and enabled = true
    ) then
      raise exception 'Este sistema ainda não está disponível publicamente.';
    end if;
  end if;

  insert into public.campaigns (name, system, description, master_id)
  values (
    trim(campaign_name),
    campaign_system,
    nullif(trim(coalesce(campaign_description, '')), ''),
    v_user_id
  )
  returning * into v_campaign;

  insert into public.campaign_members (campaign_id, user_id, role)
  values (v_campaign.id, v_user_id, 'master');

  return v_campaign;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.create_campaign(text, text, text) from public;
grant execute on function public.create_campaign(text, text, text) to authenticated;


-- ── 2. Tabela principal da ficha ────────────────────────────

create table if not exists public.dh_character_sheets (

  -- Estruturais
  id           uuid        primary key default gen_random_uuid(),
  campaign_id  uuid        not null references public.campaigns(id)  on delete cascade,
  user_id      uuid        not null references public.profiles(id)   on delete cascade,

  -- Identidade
  character_name  text,
  pronouns        text,
  class_key       text    not null default 'warrior'
                            check (class_key in (
                              'assassin','bard','brawler','druid','guardian',
                              'ranger','rogue','seraph','sorcerer','warlock',
                              'warrior','witch','wizard'
                            )),
  subclass_key    text,
  level           smallint not null default 1 check (level between 1 and 10),

  -- Herança
  ancestry        text,
  community       text,

  -- Traços (-5 a +5)
  trait_agility   smallint not null default 0  check (trait_agility   between -5 and 5),
  trait_strength  smallint not null default 0  check (trait_strength  between -5 and 5),
  trait_finesse   smallint not null default 0  check (trait_finesse   between -5 and 5),
  trait_instinct  smallint not null default 0  check (trait_instinct  between -5 and 5),
  trait_presence  smallint not null default 0  check (trait_presence  between -5 and 5),
  trait_knowledge smallint not null default 0  check (trait_knowledge between -5 and 5),

  -- Proficiência e Lançamento
  proficiency     smallint not null default 1  check (proficiency between 1 and 6),
  spellcast_trait text               check (spellcast_trait in (
                                       'agility','strength','finesse',
                                       'instinct','presence','knowledge'
                                     )),

  -- Combate
  evasion         smallint not null default 10 check (evasion between 0 and 30),

  -- Pontos de Vida (slots/caixas)
  hp_current      smallint not null default 5  check (hp_current  between 0 and 12),
  hp_max          smallint not null default 5  check (hp_max      between 1 and 12),

  -- Estresse (slots/caixas)
  stress_current  smallint not null default 0  check (stress_current between 0 and 12),
  stress_max      smallint not null default 6  check (stress_max     between 1 and 12),

  -- Esperança (tokens)
  hope            smallint not null default 2  check (hope between 0 and 6),

  -- Armadura equipada (cópia do item — evita JOIN na tela de jogo)
  armor_name          text,
  armor_score         smallint not null default 0  check (armor_score     between 0 and 10),
  armor_score_current smallint not null default 0  check (armor_score_current between 0 and 10),
  armor_base_major    smallint not null default 3  check (armor_base_major  between 0 and 30),
  armor_base_severe   smallint not null default 7  check (armor_base_severe between 0 and 30),
  -- Limiares calculados no servidor só para consistência; o site recalcula dinamicamente:
  -- threshold_major  = armor_base_major  + level
  -- threshold_severe = armor_base_severe + level

  -- Ouro (abstrato: 1 bag = 10 handfuls; 1 chest = 10 bags)
  gold_handfuls   smallint not null default 1  check (gold_handfuls between 0 and 99),
  gold_bags       smallint not null default 0  check (gold_bags     between 0 and 99),
  gold_chests     smallint not null default 0  check (gold_chests   between 0 and 99),

  -- Narrativa
  background_notes  text,
  connections_notes text,
  notes             text,

  -- Timestamps
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Um jogador tem no máximo uma ficha por campanha
  unique (campaign_id, user_id)
);

create index if not exists dh_sheets_campaign_idx on public.dh_character_sheets (campaign_id);
create index if not exists dh_sheets_user_idx     on public.dh_character_sheets (user_id);


-- ── 3. Experiências ─────────────────────────────────────────

create table if not exists public.dh_experiences (
  id        uuid     primary key default gen_random_uuid(),
  sheet_id  uuid     not null references public.dh_character_sheets(id) on delete cascade,
  label     text     not null check (char_length(trim(label)) between 1 and 120),
  modifier  smallint not null default 2  check (modifier between -5 and 10),
  sort_order smallint not null default 0
);

create index if not exists dh_experiences_sheet_idx on public.dh_experiences (sheet_id);


-- ── 4. Cartas de Domínio ────────────────────────────────────

create table if not exists public.dh_domain_cards (
  id          uuid     primary key default gen_random_uuid(),
  sheet_id    uuid     not null references public.dh_character_sheets(id) on delete cascade,
  domain      text     not null check (domain in (
                          'arcana','blade','bone','codex','grace',
                          'midnight','sage','splendor','valor','wanderer'
                        )),
  card_name   text     not null check (char_length(trim(card_name)) between 1 and 120),
  card_level  smallint not null default 1 check (card_level between 1 and 6),
  is_equipped boolean  not null default true,  -- false = no cofre
  notes       text
);

create index if not exists dh_domain_cards_sheet_idx on public.dh_domain_cards (sheet_id);


-- ── 5. Armas ────────────────────────────────────────────────

create table if not exists public.dh_weapons (
  id          uuid     primary key default gen_random_uuid(),
  sheet_id    uuid     not null references public.dh_character_sheets(id) on delete cascade,
  weapon_name text     not null check (char_length(trim(weapon_name)) between 1 and 120),
  trait_key   text     not null default 'strength'
                         check (trait_key in (
                           'agility','strength','finesse',
                           'instinct','presence','knowledge'
                         )),
  damage_die  smallint not null default 6  check (damage_die in (4,6,8,10,12)),
  damage_mod  smallint not null default 0  check (damage_mod between -10 and 20),
  is_primary  boolean  not null default true,  -- primária ou secundária (1H secundária)
  is_equipped boolean  not null default true,
  notes       text
);

create index if not exists dh_weapons_sheet_idx on public.dh_weapons (sheet_id);


-- ── 6. Inventário ───────────────────────────────────────────

create table if not exists public.dh_inventory (
  id         uuid     primary key default gen_random_uuid(),
  sheet_id   uuid     not null references public.dh_character_sheets(id) on delete cascade,
  item_name  text     not null check (char_length(trim(item_name)) between 1 and 120),
  quantity   smallint not null default 1 check (quantity >= 0),
  notes      text,
  sort_order smallint not null default 0
);

create index if not exists dh_inventory_sheet_idx on public.dh_inventory (sheet_id);


-- ── 7. Trigger: updated_at ───────────────────────────────────

create or replace function public.set_dh_sheet_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_dh_sheet_updated_at on public.dh_character_sheets;
create trigger trg_dh_sheet_updated_at
  before update on public.dh_character_sheets
  for each row execute function public.set_dh_sheet_updated_at();


-- ── 8. Trigger: campos estruturais imutáveis ─────────────────

create or replace function public.protect_dh_sheet_structural_fields()
returns trigger language plpgsql as $$
begin
  if new.campaign_id <> old.campaign_id then
    raise exception 'O campo campaign_id não pode ser alterado.';
  end if;
  if new.user_id <> old.user_id then
    raise exception 'O campo user_id não pode ser alterado.';
  end if;
  if new.created_at <> old.created_at then
    raise exception 'O campo created_at não pode ser alterado.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_dh_sheet_structural on public.dh_character_sheets;
create trigger trg_dh_sheet_structural
  before update on public.dh_character_sheets
  for each row execute function public.protect_dh_sheet_structural_fields();


-- ── 9. RLS — dh_character_sheets ────────────────────────────

alter table public.dh_character_sheets enable row level security;

drop policy if exists "dh_sheets_select" on public.dh_character_sheets;
create policy "dh_sheets_select"
  on public.dh_character_sheets for select
  using (
    is_campaign_master(campaign_id, auth.uid())
    or (
      user_id = auth.uid()
      and is_campaign_member(campaign_id, auth.uid())
    )
  );

drop policy if exists "dh_sheets_insert" on public.dh_character_sheets;
create policy "dh_sheets_insert"
  on public.dh_character_sheets for insert
  with check (
    user_id = auth.uid()
    and is_campaign_member(campaign_id, auth.uid())
    and exists (
      select 1 from public.campaigns
      where id = campaign_id
        and system = 'daggerheart'
    )
  );

drop policy if exists "dh_sheets_update" on public.dh_character_sheets;
create policy "dh_sheets_update"
  on public.dh_character_sheets for update
  using (
    is_campaign_master(campaign_id, auth.uid())
    or (
      user_id = auth.uid()
      and is_campaign_member(campaign_id, auth.uid())
    )
  )
  with check (
    is_campaign_master(campaign_id, auth.uid())
    or (
      user_id = auth.uid()
      and is_campaign_member(campaign_id, auth.uid())
    )
  );


-- ── 10. RLS — tabelas filhas (herdadas via sheet_id) ─────────
-- Padrão: lê/escreve quem pode ver/editar a ficha pai.

-- Helper reutilizado pelas 4 tabelas filhas
create or replace function public.can_read_dh_sheet(p_sheet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.dh_character_sheets s
    where s.id = p_sheet_id
      and (
        is_campaign_master(s.campaign_id, auth.uid())
        or (s.user_id = auth.uid() and is_campaign_member(s.campaign_id, auth.uid()))
      )
  );
$$;

create or replace function public.can_write_dh_sheet(p_sheet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.dh_character_sheets s
    where s.id = p_sheet_id
      and (
        is_campaign_master(s.campaign_id, auth.uid())
        or (s.user_id = auth.uid() and is_campaign_member(s.campaign_id, auth.uid()))
      )
  );
$$;

-- dh_experiences
alter table public.dh_experiences enable row level security;

drop policy if exists "dh_exp_select" on public.dh_experiences;
create policy "dh_exp_select" on public.dh_experiences for select
  using (can_read_dh_sheet(sheet_id));

drop policy if exists "dh_exp_insert" on public.dh_experiences;
create policy "dh_exp_insert" on public.dh_experiences for insert
  with check (can_write_dh_sheet(sheet_id));

drop policy if exists "dh_exp_update" on public.dh_experiences;
create policy "dh_exp_update" on public.dh_experiences for update
  using (can_write_dh_sheet(sheet_id));

drop policy if exists "dh_exp_delete" on public.dh_experiences;
create policy "dh_exp_delete" on public.dh_experiences for delete
  using (can_write_dh_sheet(sheet_id));

-- dh_domain_cards
alter table public.dh_domain_cards enable row level security;

drop policy if exists "dh_cards_select" on public.dh_domain_cards;
create policy "dh_cards_select" on public.dh_domain_cards for select
  using (can_read_dh_sheet(sheet_id));

drop policy if exists "dh_cards_insert" on public.dh_domain_cards;
create policy "dh_cards_insert" on public.dh_domain_cards for insert
  with check (can_write_dh_sheet(sheet_id));

drop policy if exists "dh_cards_update" on public.dh_domain_cards;
create policy "dh_cards_update" on public.dh_domain_cards for update
  using (can_write_dh_sheet(sheet_id));

drop policy if exists "dh_cards_delete" on public.dh_domain_cards;
create policy "dh_cards_delete" on public.dh_domain_cards for delete
  using (can_write_dh_sheet(sheet_id));

-- dh_weapons
alter table public.dh_weapons enable row level security;

drop policy if exists "dh_weapons_select" on public.dh_weapons;
create policy "dh_weapons_select" on public.dh_weapons for select
  using (can_read_dh_sheet(sheet_id));

drop policy if exists "dh_weapons_insert" on public.dh_weapons;
create policy "dh_weapons_insert" on public.dh_weapons for insert
  with check (can_write_dh_sheet(sheet_id));

drop policy if exists "dh_weapons_update" on public.dh_weapons;
create policy "dh_weapons_update" on public.dh_weapons for update
  using (can_write_dh_sheet(sheet_id));

drop policy if exists "dh_weapons_delete" on public.dh_weapons;
create policy "dh_weapons_delete" on public.dh_weapons for delete
  using (can_write_dh_sheet(sheet_id));

-- dh_inventory
alter table public.dh_inventory enable row level security;

drop policy if exists "dh_inv_select" on public.dh_inventory;
create policy "dh_inv_select" on public.dh_inventory for select
  using (can_read_dh_sheet(sheet_id));

drop policy if exists "dh_inv_insert" on public.dh_inventory;
create policy "dh_inv_insert" on public.dh_inventory for insert
  with check (can_write_dh_sheet(sheet_id));

drop policy if exists "dh_inv_update" on public.dh_inventory;
create policy "dh_inv_update" on public.dh_inventory for update
  using (can_write_dh_sheet(sheet_id));

drop policy if exists "dh_inv_delete" on public.dh_inventory;
create policy "dh_inv_delete" on public.dh_inventory for delete
  using (can_write_dh_sheet(sheet_id));


-- ── 11. Registra o recurso como GUARDADO ─────────────────────

insert into public.site_features (key, enabled)
values ('daggerheart', false)
on conflict (key) do nothing;
