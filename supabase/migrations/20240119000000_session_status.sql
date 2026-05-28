-- ============================================================
-- Vorterium — Status de Sessão
-- Migration: 20240119000000_session_status.sql
-- Aplicar após: 20240118000000_harden_campaign_activity_rpc.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
-- ============================================================


-- ── 1. Adicionar coluna status em campaign_sessions ──────────
--
-- planned   → sessão planejada (padrão)
-- completed → sessão concluída
-- canceled  → sessão cancelada

alter table public.campaign_sessions
  add column status text not null default 'planned';


-- ── 2. Constraint: apenas valores permitidos ─────────────────

alter table public.campaign_sessions
  add constraint campaign_sessions_status_check
    check (status in ('planned', 'completed', 'canceled'));
