-- ============================================================
-- Vorterium — D&D 5e: classes, recursos e características (Marco 2, parte 2)
-- Migration: 20240204000000_dnd_classes_recursos.sql
-- Aplicar após: 20240203000000_dnd_ficha_nova.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
-- ============================================================
--
-- Três tabelas repetíveis ligadas à ficha (dnd_character_sheets):
--   • dnd_character_classes   uma linha por classe do personagem (multiclasse
--                             desde o começo), com nível, subclasse e os PV
--                             rolados em cada nível;
--   • dnd_character_resources espaços de magia, Fúria, Ki, Inspiração de Bardo...
--                             (atual / máximo / quando recarrega);
--   • dnd_character_features  características de classe, raça, talento e itens,
--                             com anotações e usos.
-- Todas herdam a autorização da ficha: mestre da campanha, ou o dono da ficha
-- enquanto membro. NPC mostrado pelo mestre: os jogadores leem. Enquanto o
-- recurso "dnd5e" estiver guardado, só o dono do site (dnd_open()).
-- ============================================================


-- ── 1. Classes do personagem ────────────────────────────
-- hp_rolls: um valor por nível de classe acima do primeiro nível do
-- personagem (o nível 1 inicial usa o dado cheio). 0 = usou a média; 1 a 12 =
-- o valor rolado. Cada classe tem no máximo `level` entradas. O motor de regras
-- (src/features/sheets/dnd/rules) monta o PV a partir daqui.

create table if not exists public.dnd_character_classes (
  id           uuid        primary key default gen_random_uuid(),
  sheet_id     uuid        not null references public.dnd_character_sheets(id) on delete cascade,
  class_key    text        not null check (class_key ~ '^[a-z0-9_]{2,60}$'),
  level        smallint    not null check (level between 1 and 20),
  subclass_key text        check (subclass_key is null or subclass_key ~ '^[a-z0-9_]{2,60}$'),
  is_initial   boolean     not null default false,
  hp_rolls     smallint[]  not null default '{}'::smallint[],
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (sheet_id, class_key),
  check (cardinality(hp_rolls) <= level),
  check (hp_rolls <@ array[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::smallint[])
);

-- Uma só classe inicial por ficha.
create unique index if not exists dnd_character_classes_one_initial
  on public.dnd_character_classes (sheet_id) where is_initial;
create index if not exists dnd_character_classes_sheet_idx
  on public.dnd_character_classes (sheet_id);

-- A soma dos níveis das classes não passa de 20.
create or replace function public.dnd_classes_check_total()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_other integer;
begin
  select coalesce(sum(level), 0) into v_other
  from public.dnd_character_classes
  where sheet_id = new.sheet_id and id <> new.id;
  if v_other + new.level > 20 then
    raise exception 'O personagem não passa do nível 20 (soma dos níveis das classes).';
  end if;
  return new;
end;
$$;

drop trigger if exists dnd_classes_check_total on public.dnd_character_classes;
create trigger dnd_classes_check_total
  before insert or update on public.dnd_character_classes
  for each row execute function public.dnd_classes_check_total();

-- A ficha guarda o nível total e a classe inicial (pros cards do mestre e
-- pras telas antigas): este gatilho mantém os dois em sincronia com as classes.
create or replace function public.dnd_classes_sync_sheet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sheet   uuid := coalesce(new.sheet_id, old.sheet_id);
  v_level   integer;
  v_initial text;
begin
  select coalesce(sum(level), 0) into v_level from public.dnd_character_classes where sheet_id = v_sheet;
  select class_key into v_initial from public.dnd_character_classes where sheet_id = v_sheet and is_initial limit 1;
  update public.dnd_character_sheets
     set level = greatest(1, least(20, v_level)),
         class_key = v_initial
   where id = v_sheet;
  return null;
end;
$$;
revoke all on function public.dnd_classes_sync_sheet() from public, anon, authenticated;

drop trigger if exists dnd_classes_sync_sheet on public.dnd_character_classes;
create trigger dnd_classes_sync_sheet
  after insert or update or delete on public.dnd_character_classes
  for each row execute function public.dnd_classes_sync_sheet();


-- ── 2. Recursos (espaços de magia, Fúria, Ki...) ────────
-- key: 'spell_slot_1' a 'spell_slot_9', 'pact_slot', 'rage', 'ki', 'bardic_inspiration'...
-- recharge: short = descanso curto, long = descanso longo, dawn = amanhecer, manual.

create table if not exists public.dnd_character_resources (
  id            uuid        primary key default gen_random_uuid(),
  sheet_id      uuid        not null references public.dnd_character_sheets(id) on delete cascade,
  key           text        not null check (key ~ '^[a-z0-9_]{2,60}$'),
  label         text        not null check (char_length(trim(label)) between 1 and 80),
  current_value smallint    not null default 0 check (current_value between 0 and 999),
  max_value     smallint    not null default 0 check (max_value between 0 and 999),
  recharge      text        not null default 'manual' check (recharge in ('short', 'long', 'dawn', 'manual')),
  source        text        not null default 'manual' check (source in ('class', 'race', 'feat', 'item', 'spell_slots', 'manual')),
  sort_order    integer     not null default 0 check (sort_order >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (sheet_id, key)
);

create index if not exists dnd_character_resources_sheet_idx
  on public.dnd_character_resources (sheet_id, sort_order);


-- ── 3. Características ──────────────────────────────────
-- feature_key aponta pro catálogo (ex.: 'second_wind'); null = característica
-- livre, escrita pelo jogador.

create table if not exists public.dnd_character_features (
  id            uuid        primary key default gen_random_uuid(),
  sheet_id      uuid        not null references public.dnd_character_sheets(id) on delete cascade,
  source        text        not null check (source in ('class', 'subclass', 'race', 'subrace', 'background', 'feat', 'item', 'manual')),
  feature_key   text        check (feature_key is null or feature_key ~ '^[a-z0-9_]{2,80}$'),
  name          text        not null check (char_length(trim(name)) between 1 and 120),
  level         smallint    check (level is null or level between 1 and 20),
  notes         text        not null default '' check (char_length(notes) <= 2000),
  uses_current  smallint    check (uses_current is null or uses_current between 0 and 999),
  uses_max      smallint    check (uses_max is null or uses_max between 0 and 999),
  recharge      text        check (recharge is null or recharge in ('short', 'long', 'dawn', 'manual')),
  sort_order    integer     not null default 0 check (sort_order >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists dnd_character_features_unique_catalog
  on public.dnd_character_features (sheet_id, source, feature_key) where feature_key is not null;
create index if not exists dnd_character_features_sheet_idx
  on public.dnd_character_features (sheet_id, sort_order);


-- ── 4. updated_at e proteção do sheet_id ────────────────
-- (funções de 20240127000000)

do $$
declare t text;
begin
  foreach t in array array['dnd_character_classes', 'dnd_character_resources', 'dnd_character_features'] loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$I', t);
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$I for each row execute function public.set_dnd_detail_updated_at()', t);
    execute format('drop trigger if exists trg_%1$s_structural on public.%1$I', t);
    execute format('create trigger trg_%1$s_structural before update on public.%1$I for each row execute function public.protect_dnd_detail_sheet_id()', t);
  end loop;
end $$;


-- ── 5. RLS ──────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array['dnd_character_classes', 'dnd_character_resources', 'dnd_character_features'] loop
    execute format('alter table public.%I enable row level security', t);

    -- Mestre da campanha, ou o dono da ficha enquanto membro (função de 20240203000000).
    execute format('drop policy if exists "%1$s: select" on public.%1$I', t);
    execute format('create policy "%1$s: select" on public.%1$I for select to authenticated using (public.dnd_sheet_access(sheet_id))', t);
    execute format('drop policy if exists "%1$s: insert" on public.%1$I', t);
    execute format('create policy "%1$s: insert" on public.%1$I for insert to authenticated with check (public.dnd_sheet_access(sheet_id))', t);
    execute format('drop policy if exists "%1$s: update" on public.%1$I', t);
    execute format('create policy "%1$s: update" on public.%1$I for update to authenticated using (public.dnd_sheet_access(sheet_id)) with check (public.dnd_sheet_access(sheet_id))', t);
    execute format('drop policy if exists "%1$s: delete" on public.%1$I', t);
    execute format('create policy "%1$s: delete" on public.%1$I for delete to authenticated using (public.dnd_sheet_access(sheet_id))', t);

    -- NPC mostrado pelo mestre: os jogadores leem.
    execute format('drop policy if exists "npc: visivel pros jogadores" on public.%I', t);
    execute format('create policy "npc: visivel pros jogadores" on public.%I for select to authenticated using (public.dnd_sheet_npc_shown(sheet_id))', t);

    -- Guardado: só o dono do site (ou todos, com o recurso ligado).
    execute format('drop policy if exists "dnd: so quando liberado" on public.%I', t);
    execute format('create policy "dnd: so quando liberado" on public.%I as restrictive for all to authenticated using (public.dnd_open()) with check (public.dnd_open())', t);
  end loop;
end $$;


-- ── 6. Tempo real: cards do mestre (classe, nível, espaços de magia) ──

do $$
begin
  alter publication supabase_realtime add table public.dnd_character_classes;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.dnd_character_resources;
exception when others then null;
end $$;
