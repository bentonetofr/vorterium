-- ============================================================
-- Campaign Lab — Gerenciamento de campanha
-- Migration: 20240110000000_campaign_management.sql
-- Aplicar após: 20240109000000_improve_campaign_invites.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
-- ============================================================


-- ── RPC update_campaign_name ─────────────────────────────
--
-- Atualiza o nome da campanha. Apenas o mestre pode chamar.
-- Valida nome não vazio e retorna a campanha atualizada.

create or replace function public.update_campaign_name(
  campaign_id_input uuid,
  new_name          text
)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_campaign public.campaigns%rowtype;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not public.is_campaign_master(campaign_id_input, v_user_id) then
    raise exception 'Apenas o mestre pode editar a campanha.';
  end if;

  if trim(new_name) = '' then
    raise exception 'O nome da campanha não pode ser vazio.';
  end if;

  update public.campaigns
  set    name       = trim(new_name),
         updated_at = now()
  where  id = campaign_id_input
  returning * into v_campaign;

  if not found then
    raise exception 'Campanha não encontrada.';
  end if;

  return v_campaign;
end;
$$;


-- ── RPC delete_campaign ──────────────────────────────────
--
-- Exclui a campanha. Apenas o mestre pode chamar.
-- A exclusão em cascata (ON DELETE CASCADE) remove automaticamente:
-- campaign_members, campaign_invites, character_sheets, dice_rolls.

create or replace function public.delete_campaign(
  campaign_id_input uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not public.is_campaign_master(campaign_id_input, v_user_id) then
    raise exception 'Apenas o mestre pode excluir a campanha.';
  end if;

  delete from public.campaigns
  where id = campaign_id_input;
end;
$$;


-- ── RPC leave_campaign ───────────────────────────────────
--
-- Remove o próprio usuário da campanha como jogador.
-- Mestre não pode sair por este fluxo.

create or replace function public.leave_campaign(
  campaign_id_input uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not public.is_campaign_member(campaign_id_input, v_user_id) then
    raise exception 'Você não é membro desta campanha.';
  end if;

  if public.is_campaign_master(campaign_id_input, v_user_id) then
    raise exception 'O mestre não pode sair da campanha por este fluxo.';
  end if;

  delete from public.campaign_members
  where  campaign_id = campaign_id_input
    and  user_id     = v_user_id
    and  role        = 'player';
end;
$$;
