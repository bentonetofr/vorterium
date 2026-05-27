-- ============================================================
-- Campaign Lab — Sessões de Campanha
-- Migration: 20240113000000_campaign_sessions.sql
-- Aplicar após: 20240112000000_custom_dice_rolls.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
-- ============================================================


-- ── 1. Tabela campaign_sessions ──────────────────────────────

create table public.campaign_sessions (
  id           uuid        primary key default gen_random_uuid(),
  campaign_id  uuid        not null references public.campaigns(id) on delete cascade,
  title        text        not null,
  session_date date,
  summary      text,
  created_by   uuid        not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint campaign_sessions_title_not_empty
    check (char_length(trim(title)) > 0),

  constraint campaign_sessions_title_length
    check (char_length(title) <= 120),

  constraint campaign_sessions_summary_length
    check (char_length(summary) <= 5000)
);

-- Reutiliza a função set_updated_at criada na migration inicial
create trigger set_campaign_sessions_updated_at
  before update on public.campaign_sessions
  for each row execute function public.set_updated_at();

-- Índice primário de acesso por campanha
create index idx_campaign_sessions_campaign_id
  on public.campaign_sessions(campaign_id);

-- Índice para ordenação padrão: data desc + criação desc
create index idx_campaign_sessions_order
  on public.campaign_sessions(campaign_id, session_date desc nulls last, created_at desc);


-- ── 2. Row Level Security ────────────────────────────────────

alter table public.campaign_sessions enable row level security;

-- SELECT: qualquer membro da campanha pode visualizar sessões
create policy "campaign_sessions: membro pode visualizar"
  on public.campaign_sessions for select
  to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()));

-- INSERT: apenas o mestre pode criar; created_by deve ser o próprio usuário
create policy "campaign_sessions: mestre pode criar"
  on public.campaign_sessions for insert
  to authenticated
  with check (
    public.is_campaign_master(campaign_id, auth.uid())
    and created_by = auth.uid()
  );

-- UPDATE: apenas o mestre pode editar
create policy "campaign_sessions: mestre pode editar"
  on public.campaign_sessions for update
  to authenticated
  using  (public.is_campaign_master(campaign_id, auth.uid()))
  with check (public.is_campaign_master(campaign_id, auth.uid()));

-- DELETE: apenas o mestre pode excluir
create policy "campaign_sessions: mestre pode excluir"
  on public.campaign_sessions for delete
  to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()));
