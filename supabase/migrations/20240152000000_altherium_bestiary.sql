-- ============================================================
-- Vorterium — Bestiário do mestre (campanhas Altherium)
-- Migration: 20240152000000_altherium_bestiary.sql
-- Aplicar após: 20240151000000_altherium_custom_weapon_stats.sql
-- ============================================================
--
-- Inimigos criados pelo mestre na aba "Bestiário" da Mesa da Sessão.
-- A interface sugere HP e dano a partir das fichas do grupo (regra de
-- criação de inimigos de Altherium); aqui guardamos o resultado final
-- (hp, damage_dice) e os parâmetros usados no cálculo — rodadas, % de
-- perigo e os números do grupo naquele momento — pra poder recalcular
-- depois. Só o mestre da campanha vê e mexe: jogadores não têm acesso.

create table public.altherium_bestiary (
  id            uuid         primary key default gen_random_uuid(),
  campaign_id   uuid         not null references public.campaigns(id) on delete cascade,
  name          text         not null,
  hp            integer      not null,
  damage_dice   text         not null,
  -- Parâmetros da regra: HP ≈ dano do grupo × rodadas;
  -- dano ≈ vida média do grupo × % de perigo.
  rounds        integer      not null default 4,
  danger_pct    integer      not null default 25,
  -- Números do grupo quando a criatura foi calculada (só referência).
  party_damage  numeric(7,2),
  party_avg_hp  numeric(7,2),
  notes         text,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now(),

  constraint altherium_bestiary_name_length   check (char_length(btrim(name)) between 1 and 80),
  constraint altherium_bestiary_hp_range      check (hp between 1 and 9999),
  constraint altherium_bestiary_damage_format check (damage_dice ~ '^[0-9]{0,2}d[0-9]{1,3}([+-][0-9]{1,3})?$'),
  constraint altherium_bestiary_rounds_range  check (rounds between 1 and 20),
  constraint altherium_bestiary_danger_range  check (danger_pct between 1 and 100),
  constraint altherium_bestiary_notes_length  check (notes is null or char_length(notes) <= 2000)
);

create index idx_altherium_bestiary_campaign_id on public.altherium_bestiary(campaign_id);

create trigger set_altherium_bestiary_updated_at
  before update on public.altherium_bestiary
  for each row execute function public.set_updated_at();

alter table public.altherium_bestiary enable row level security;

create policy "altherium_bestiary: mestre pode ver"
  on public.altherium_bestiary for select
  to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()));

create policy "altherium_bestiary: mestre pode criar"
  on public.altherium_bestiary for insert
  to authenticated
  with check (public.is_campaign_master(campaign_id, auth.uid()));

create policy "altherium_bestiary: mestre pode editar"
  on public.altherium_bestiary for update
  to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()))
  with check (public.is_campaign_master(campaign_id, auth.uid()));

create policy "altherium_bestiary: mestre pode remover"
  on public.altherium_bestiary for delete
  to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()));
