-- ============================================================
-- Campaign Lab — Incremento 9+: get_campaign_invite_public
-- Migration: 20240109000000_improve_campaign_invites.sql
-- Aplicar após: 20240108000000_campaign_invites.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── RPC get_campaign_invite_public ───────────────────────
--
-- Retorna dados públicos de um convite para exibição na InvitePage,
-- inclusive antes do login (acessível por anon).
--
-- Retorna apenas: campaign_id, campaign_name, campaign_system,
--                 is_active, expires_at.
-- NÃO retorna: created_by, e-mails, lista de membros ou dados privados.

create or replace function public.get_campaign_invite_public(
  invite_token text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_build_object(
    'campaign_id',     c.id,
    'campaign_name',   c.name,
    'campaign_system', c.system,
    'is_active',       i.is_active,
    'expires_at',      i.expires_at
  ) into v_result
  from public.campaign_invites i
  join public.campaigns        c on c.id = i.campaign_id
  where i.token = invite_token;

  if not found then
    raise exception 'Convite não encontrado.';
  end if;

  return v_result;
end;
$$;

-- Permite que usuários não autenticados consultem dados públicos do convite
grant execute on function public.get_campaign_invite_public(text) to anon, authenticated;
