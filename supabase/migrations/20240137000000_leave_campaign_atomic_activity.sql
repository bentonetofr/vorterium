-- ============================================================
-- Vorterium — leave_campaign registra atividade atomicamente
-- Migration: 20240137000000_leave_campaign_atomic_activity.sql
-- Aplicar após: 20240136000000_dice_rolls_realtime.sql
-- ============================================================

-- Antes, o cliente registrava "member_left" em campaign_activity ANTES de
-- chamar esta RPC (comentário original: depois de sair, o usuário perde
-- acesso — via is_campaign_member — para registrar atividade). Se a RPC
-- falhasse depois (ex: "mestre não pode sair"), o registro de atividade
-- ficava como um falso histórico permanente, já que as duas chamadas não
-- eram atômicas.
--
-- Move o registro pra dentro da própria função: como ela já roda como
-- SECURITY DEFINER, grava em campaign_activity sem depender da membership
-- do usuário (que esta mesma função acabou de remover), e tudo acontece
-- na mesma transação — ou os dois efeitos acontecem juntos, ou nenhum.

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

  insert into public.campaign_activity (campaign_id, actor_id, type, message)
  values (campaign_id_input, v_user_id, 'member_left', 'Um jogador saiu da campanha.');
end;
$$;
