-- ============================================================
-- Vorterium — Tipo de atividade "triumph_used" (Altherium)
-- Migration: 20240149000000_triumph_used_activity.sql
-- Aplicar após: 20240148000000_altherium_runes_action_range.sql
-- ============================================================
--
-- Quando alguém clica "Usar" num triunfo da ficha Altherium, a mesa toda
-- vê na Atividade (e no chat) — ex.: "Galaxy usou Fôlego Extra (−4 FV)".
-- Qualquer membro pode registrar (não é tipo administrativo). Todos os
-- tipos anteriores são mantidos; a função é a mesma da migration
-- 20240120000000, só com o tipo novo na lista.

-- ── 1. Constraint de tipos ──────────────────────────────

alter table public.campaign_activity
  drop constraint campaign_activity_type_valid;

alter table public.campaign_activity
  add constraint campaign_activity_type_valid
    check (type in (
      'campaign_created',   'campaign_updated',
      'member_joined',      'member_left',        'member_removed',
      'invite_created',     'invite_deactivated',
      'session_created',    'session_updated',    'session_deleted',
      'sheet_updated',      'dice_rolled',
      'note_created',       'note_updated',       'note_deleted',
      'triumph_used'
    ));

-- ── 2. RPC create_campaign_activity ─────────────────────

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
    'sheet_updated',      'dice_rolled',
    'note_created',       'note_updated',       'note_deleted',
    'triumph_used'
  ) then
    raise exception 'Tipo de atividade inválido: %', activity_type;
  end if;

  -- 4. Tipos administrativos exigem papel de mestre
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
