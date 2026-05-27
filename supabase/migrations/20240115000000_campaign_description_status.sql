-- ============================================================
-- Campaign Lab — Descrição e status de campanha
-- Migration: 20240115000000_campaign_description_status.sql
-- Aplicar após: 20240114000000_harden_campaign_sessions.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
-- ============================================================


-- ── 1. Novos campos em public.campaigns ──────────────────
--
-- description: texto livre, opcional, até 1000 caracteres.
-- status:      estado operacional da campanha, obrigatório.
--              Default 'active' para campanhas já existentes.

alter table public.campaigns
  add column if not exists description text,
  add column if not exists status      text not null default 'active';


-- ── 2. Constraints de integridade ────────────────────────

-- Descrição limitada a 1000 caracteres quando preenchida
alter table public.campaigns
  add constraint campaigns_description_length
    check (description is null or char_length(description) <= 1000);

-- Status restrito a valores válidos
alter table public.campaigns
  add constraint campaigns_status_valid
    check (status in ('active', 'paused', 'archived'));


-- ── 3. Recria create_campaign com descrição opcional ─────
--
-- A assinatura anterior era create_campaign(text, text).
-- Removemos para evitar sobrecarga (overload) ambígua e
-- recriamos com o novo parâmetro opcional campaign_description.

drop function if exists public.create_campaign(text, text);

create or replace function public.create_campaign(
  campaign_name        text,
  campaign_system      text default 'generic',
  campaign_description text default null
)
returns public.campaigns as $$
declare
  v_campaign public.campaigns;
  v_user_id  uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if trim(campaign_name) = '' then
    raise exception 'O nome da campanha não pode ser vazio.';
  end if;

  if campaign_system not in ('generic', 'dnd5e', 'altherium', 'custom') then
    raise exception 'Sistema inválido: %', campaign_system;
  end if;

  if campaign_description is not null
     and char_length(campaign_description) > 1000 then
    raise exception 'A descrição deve ter no máximo 1000 caracteres.';
  end if;

  insert into public.campaigns (name, system, master_id, description, status)
  values (
    trim(campaign_name),
    campaign_system,
    v_user_id,
    nullif(trim(coalesce(campaign_description, '')), ''),
    'active'
  )
  returning * into v_campaign;

  insert into public.campaign_members (campaign_id, user_id, role)
  values (v_campaign.id, v_user_id, 'master');

  return v_campaign;
end;
$$ language plpgsql security definer set search_path = public;


-- ── 4. RPC update_campaign_details ───────────────────────
--
-- Permite ao mestre atualizar nome, descrição e status
-- em uma única chamada atômica.
-- Nunca altera: id, master_id, created_at.

create or replace function public.update_campaign_details(
  campaign_id_input uuid,
  new_name          text,
  new_description   text,
  new_status        text
)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid := auth.uid();
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

  if new_description is not null
     and char_length(new_description) > 1000 then
    raise exception 'A descrição deve ter no máximo 1000 caracteres.';
  end if;

  if new_status not in ('active', 'paused', 'archived') then
    raise exception 'Status inválido: %', new_status;
  end if;

  update public.campaigns
  set    name        = trim(new_name),
         description = nullif(trim(coalesce(new_description, '')), ''),
         status      = new_status,
         updated_at  = now()
  where  id = campaign_id_input
  returning * into v_campaign;

  if not found then
    raise exception 'Campanha não encontrada.';
  end if;

  return v_campaign;
end;
$$;
