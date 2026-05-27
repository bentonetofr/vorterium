-- ============================================================
-- Campaign Lab — Endurecimento da RPC create_campaign_activity
-- Migration: 20240118000000_harden_campaign_activity_rpc.sql
-- Aplicar após: 20240117000000_campaign_activity_presence.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
-- ============================================================
--
-- Problema resolvido:
--   A versão anterior da RPC permitia que qualquer membro
--   registrasse qualquer tipo de atividade, incluindo tipos
--   administrativos (campaign_updated, session_deleted, etc.).
--   Um jogador poderia forjar eventos administrativos via
--   chamada direta à API do Supabase.
--
-- Solução:
--   Tipos administrativos agora exigem papel de mestre.
--
-- Tipos administrativos (exigem mestre):
--   campaign_created, campaign_updated
--   member_removed
--   invite_created, invite_deactivated
--   session_created, session_updated, session_deleted
--
-- Tipos de membro (qualquer membro autenticado da campanha):
--   member_joined, member_left
--   sheet_updated
--   dice_rolled
-- ============================================================

create or replace function public.create_campaign_activity(
  campaign_id_input  uuid,
  activity_type      text,
  activity_message   text,
  activity_metadata  jsonb default null
)
returns public.campaign_activity
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id   uuid    := auth.uid();
  v_is_master boolean;
  v_row       public.campaign_activity%rowtype;
begin
  -- 1. Usuário autenticado
  if v_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  -- 2. É membro da campanha
  if not public.is_campaign_member(campaign_id_input, v_user_id) then
    raise exception 'Apenas membros da campanha podem registrar atividade.';
  end if;

  -- 3. Tipo permitido
  if activity_type not in (
    'campaign_created',   'campaign_updated',
    'member_joined',      'member_left',        'member_removed',
    'invite_created',     'invite_deactivated',
    'session_created',    'session_updated',    'session_deleted',
    'sheet_updated',      'dice_rolled'
  ) then
    raise exception 'Tipo de atividade inválido: %', activity_type;
  end if;

  -- 4. Tipos administrativos exigem papel de mestre
  --    (a validação é feita na tabela campaign_members para garantir
  --     que o role atual é realmente 'master', independente do front-end)
  if activity_type in (
    'campaign_created',   'campaign_updated',
    'member_removed',
    'invite_created',     'invite_deactivated',
    'session_created',    'session_updated',    'session_deleted'
  ) then
    select exists(
      select 1 from public.campaign_members
      where campaign_id = campaign_id_input
        and user_id     = v_user_id
        and role        = 'master'
    ) into v_is_master;

    if not v_is_master then
      raise exception 'Apenas o mestre pode registrar este tipo de atividade.';
    end if;
  end if;

  -- 5. Inserir
  insert into public.campaign_activity
    (campaign_id, actor_id, type, message, metadata)
  values
    (campaign_id_input, v_user_id, activity_type, activity_message, activity_metadata)
  returning * into v_row;

  return v_row;
end;
$$;
