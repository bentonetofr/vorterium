-- ============================================================
-- Campaign Lab — Hardening de sessões da campanha
-- Migration: 20240114000000_harden_campaign_sessions.sql
-- Aplicar após: 20240113000000_campaign_sessions.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
-- ============================================================


-- ── Trigger: impede alteração de campos estruturais ──────────
--
-- campaign_id, created_by e created_at são imutáveis após
-- a criação da sessão. A policy de UPDATE já restringe quem
-- pode editar (apenas o mestre via is_campaign_master), mas
-- esta trigger garante no nível do banco que nenhum UPDATE
-- consegue mover a sessão para outra campanha, trocar o autor
-- ou falsificar a data de criação.
--
-- Campos editáveis: title, session_date, summary, updated_at.

create or replace function public.prevent_campaign_session_structural_update()
returns trigger as $$
begin
  if new.campaign_id <> old.campaign_id then
    raise exception
      'Campos estruturais da sessão não podem ser alterados.';
  end if;

  if new.created_by <> old.created_by then
    raise exception
      'Campos estruturais da sessão não podem ser alterados.';
  end if;

  if new.created_at <> old.created_at then
    raise exception
      'Campos estruturais da sessão não podem ser alterados.';
  end if;

  return new;
end;
$$ language plpgsql set search_path = public;

create trigger enforce_session_immutable_fields
  before update on public.campaign_sessions
  for each row execute function public.prevent_campaign_session_structural_update();
