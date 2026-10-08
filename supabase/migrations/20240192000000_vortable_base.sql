-- ============================================================
-- Vorterium — Vortable (mundo 2D da campanha): base
-- Migration: 20240192000000_vortable_base.sql
-- Aplicar após: 20240191000000_tirar_raiz_mestre.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
-- ============================================================
--
-- Um mundo por campanha:
--   • vortable_worlds      — dados do mundo (zona inicial, posições no mapa)
--   • vortable_zones       — cada zona (JSON) + resumo pra listar sem abrir
--   • vortable_characters  — bonecos de cada pessoa na campanha
-- Quem lê: qualquer membro. Quem mexe no mundo e nas zonas: só o mestre.
-- Cada pessoa mexe só nos próprios bonecos.
-- ============================================================


-- ── 1. Mundo ───────────────────────────────────────────────

create table public.vortable_worlds (
  campaign_id uuid        primary key references public.campaigns(id) on delete cascade,
  data        jsonb       not null,
  updated_at  timestamptz not null default now()
);

create trigger set_vortable_worlds_updated_at
  before update on public.vortable_worlds
  for each row execute function public.set_updated_at();


-- ── 2. Zonas ───────────────────────────────────────────────

create table public.vortable_zones (
  campaign_id uuid        not null references public.campaigns(id) on delete cascade,
  id          text        not null,
  name        text        not null,
  summary     jsonb       not null,
  data        jsonb       not null,
  updated_at  timestamptz not null default now(),

  primary key (campaign_id, id),
  constraint vortable_zone_id_length   check (char_length(id)   between 1 and 80),
  constraint vortable_zone_name_length check (char_length(name) <= 120),
  -- trava de segurança contra zonas absurdas (≈ 6 MB de JSON)
  constraint vortable_zone_size        check (pg_column_size(data) <= 6000000)
);

create trigger set_vortable_zones_updated_at
  before update on public.vortable_zones
  for each row execute function public.set_updated_at();


-- ── 3. Bonecos ─────────────────────────────────────────────

create table public.vortable_characters (
  campaign_id uuid        not null references public.campaigns(id) on delete cascade,
  user_id     uuid        not null references public.profiles(id)  on delete cascade,
  id          text        not null,
  name        text        not null,
  appearance  jsonb       not null,
  active      boolean     not null default false,
  updated_at  timestamptz not null default now(),

  primary key (campaign_id, user_id, id),
  constraint vortable_char_id_length   check (char_length(id)   between 1 and 80),
  constraint vortable_char_name_length check (char_length(name) <= 80),
  constraint vortable_char_size        check (pg_column_size(appearance) <= 60000)
);

-- um boneco em uso por pessoa por campanha
create unique index vortable_characters_one_active
  on public.vortable_characters (campaign_id, user_id) where active;

create trigger set_vortable_characters_updated_at
  before update on public.vortable_characters
  for each row execute function public.set_updated_at();


-- ── 4. Row Level Security ──────────────────────────────────

alter table public.vortable_worlds     enable row level security;
alter table public.vortable_zones      enable row level security;
alter table public.vortable_characters enable row level security;

grant select, insert, update, delete on public.vortable_worlds     to authenticated;
grant select, insert, update, delete on public.vortable_zones      to authenticated;
grant select, insert, update, delete on public.vortable_characters to authenticated;

-- Mundo
create policy "vortable_worlds: membro le"
  on public.vortable_worlds for select to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()));
create policy "vortable_worlds: mestre cria"
  on public.vortable_worlds for insert to authenticated
  with check (public.is_campaign_master(campaign_id, auth.uid()));
create policy "vortable_worlds: mestre altera"
  on public.vortable_worlds for update to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()))
  with check (public.is_campaign_master(campaign_id, auth.uid()));
create policy "vortable_worlds: mestre apaga"
  on public.vortable_worlds for delete to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()));

-- Zonas
create policy "vortable_zones: membro le"
  on public.vortable_zones for select to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()));
create policy "vortable_zones: mestre cria"
  on public.vortable_zones for insert to authenticated
  with check (public.is_campaign_master(campaign_id, auth.uid()));
create policy "vortable_zones: mestre altera"
  on public.vortable_zones for update to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()))
  with check (public.is_campaign_master(campaign_id, auth.uid()));
create policy "vortable_zones: mestre apaga"
  on public.vortable_zones for delete to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()));

-- Bonecos (todos da campanha veem; cada um mexe nos seus)
create policy "vortable_characters: membro le"
  on public.vortable_characters for select to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()));
create policy "vortable_characters: dono cria"
  on public.vortable_characters for insert to authenticated
  with check (user_id = auth.uid() and public.is_campaign_member(campaign_id, auth.uid()));
create policy "vortable_characters: dono altera"
  on public.vortable_characters for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_campaign_member(campaign_id, auth.uid()));
create policy "vortable_characters: dono apaga"
  on public.vortable_characters for delete to authenticated
  using (user_id = auth.uid());
