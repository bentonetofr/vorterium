-- ============================================================
-- Campaign Lab — Incremento 5: Ficha Simples
-- Migration: 20240104000000_character_sheets.sql
-- Aplicar após: 20240103000000_harden_campaign_members_insert.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
-- ============================================================


-- ── 1. Tabela character_sheets ───────────────────────────

create table public.character_sheets (
  id             uuid        primary key default gen_random_uuid(),
  campaign_id    uuid        not null references public.campaigns(id) on delete cascade,
  user_id        uuid        not null references public.profiles(id) on delete cascade,
  character_name text,
  archetype      text,
  level          integer     not null default 1  check (level >= 1),
  hp_current     integer     not null default 10 check (hp_current >= 0),
  hp_max         integer     not null default 10 check (hp_max >= 1),
  strength       integer     not null default 10 check (strength >= 1),
  dexterity      integer     not null default 10 check (dexterity >= 1),
  constitution   integer     not null default 10 check (constitution >= 1),
  intelligence   integer     not null default 10 check (intelligence >= 1),
  wisdom         integer     not null default 10 check (wisdom >= 1),
  charisma       integer     not null default 10 check (charisma >= 1),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (campaign_id, user_id)
);

-- Reutiliza a função set_updated_at já criada na migration inicial
create trigger set_character_sheets_updated_at
  before update on public.character_sheets
  for each row execute function public.set_updated_at();

-- Índices para acesso eficiente
create index idx_character_sheets_campaign_id on public.character_sheets(campaign_id);
create index idx_character_sheets_user_id     on public.character_sheets(user_id);


-- ── 2. Row Level Security ────────────────────────────────

alter table public.character_sheets enable row level security;

-- SELECT: dono vê a própria ficha; mestre vê todas da campanha
create policy "character_sheets: dono ou mestre pode ver"
  on public.character_sheets for select
  to authenticated
  using (
    user_id = auth.uid()
    OR public.is_campaign_master(campaign_id, auth.uid())
  );

-- INSERT: apenas para si mesmo, apenas se for membro da campanha
create policy "character_sheets: membro cria própria ficha"
  on public.character_sheets for insert
  to authenticated
  with check (
    user_id = auth.uid()
    AND public.is_campaign_member(campaign_id, auth.uid())
  );

-- UPDATE: dono edita a própria; mestre edita qualquer ficha da campanha
create policy "character_sheets: dono ou mestre pode atualizar"
  on public.character_sheets for update
  to authenticated
  using (
    user_id = auth.uid()
    OR public.is_campaign_master(campaign_id, auth.uid())
  )
  with check (
    user_id = auth.uid()
    OR public.is_campaign_master(campaign_id, auth.uid())
  );

-- DELETE: não permitido no MVP (nenhuma policy = nenhum delete)
