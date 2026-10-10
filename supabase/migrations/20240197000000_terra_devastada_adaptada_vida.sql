-- ============================================================
-- Vorterium — Terra Devastada Adaptada: Vida e bestiário
-- Migration: 20240197000000_terra_devastada_adaptada_vida.sql
-- Aplicar após: 20240196000000_terra_devastada_adaptada.sql
-- ============================================================
--
-- 1. Vida do personagem (0 a 6; começa em 6). Cada golpe de infectado
--    tira de 1 a 6, e 0 é caído.
-- 2. Bestiário da campanha (tda_creatures): criaturas do mestre com Dano,
--    Resistência, Defesa (meta pra acertar) e Ferocidade (meta pra esquivar).
--    Só o mestre da campanha lê e mexe.


-- ── 1. Vida ───────────────────────────────────────────────

alter table public.tda_character_sheets
  add column if not exists health integer not null default 6;

alter table public.tda_character_sheets
  drop constraint if exists tda_sheets_health_range;

alter table public.tda_character_sheets
  add constraint tda_sheets_health_range check (health between 0 and 6);


-- ── 2. Bestiário da campanha ──────────────────────────────

create table if not exists public.tda_creatures (
  id           uuid        primary key default gen_random_uuid(),
  campaign_id  uuid        not null references public.campaigns(id) on delete cascade,
  name         text        not null,
  kind         text        not null default 'outro',
  damage       integer     not null default 1,
  toughness    integer     not null default 1,
  defense      integer     not null default 1,
  ferocity     integer     not null default 1,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint tda_creatures_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint tda_creatures_kind_valid  check (kind in ('infectado', 'humano', 'animal', 'outro')),
  constraint tda_creatures_damage      check (damage    between 1 and 6),
  constraint tda_creatures_toughness   check (toughness between 1 and 12),
  constraint tda_creatures_defense     check (defense   between 1 and 6),
  constraint tda_creatures_ferocity    check (ferocity  between 1 and 6),
  constraint tda_creatures_notes       check (notes is null or char_length(notes) <= 2000)
);

create index if not exists idx_tda_creatures_campaign on public.tda_creatures(campaign_id);

drop trigger if exists set_tda_creatures_updated_at on public.tda_creatures;
create trigger set_tda_creatures_updated_at
  before update on public.tda_creatures
  for each row execute function public.set_updated_at();

alter table public.tda_creatures enable row level security;

drop policy if exists "tda_creatures: mestre ve" on public.tda_creatures;
create policy "tda_creatures: mestre ve" on public.tda_creatures
  for select to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()));

drop policy if exists "tda_creatures: mestre cria" on public.tda_creatures;
create policy "tda_creatures: mestre cria" on public.tda_creatures
  for insert to authenticated
  with check (public.is_campaign_master(campaign_id, auth.uid()));

drop policy if exists "tda_creatures: mestre altera" on public.tda_creatures;
create policy "tda_creatures: mestre altera" on public.tda_creatures
  for update to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()))
  with check (public.is_campaign_master(campaign_id, auth.uid()));

drop policy if exists "tda_creatures: mestre apaga" on public.tda_creatures;
create policy "tda_creatures: mestre apaga" on public.tda_creatures
  for delete to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()));

grant select, insert, update, delete on public.tda_creatures to authenticated;

-- Painel do desenvolvedor lê tudo (como nas outras tabelas, 20240161).
drop policy if exists "dev: le tudo" on public.tda_creatures;
create policy "dev: le tudo" on public.tda_creatures
  for select to authenticated using (public.is_developer());
