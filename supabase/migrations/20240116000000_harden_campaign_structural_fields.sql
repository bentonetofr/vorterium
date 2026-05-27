-- ============================================================
-- Campaign Lab — Hardening de campos estruturais de campanha
-- Migration: 20240116000000_harden_campaign_structural_fields.sql
-- Aplicar após: 20240115000000_campaign_description_status.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
-- ============================================================


-- ── 1. Constraint: nome limitado a 120 caracteres ────────
--
-- A verificação de vazio já existe no schema inicial (check trim <> '').
-- Este constraint adiciona limite de comprimento consistente com o
-- front-end (TITLE_MAX = 120 nas sessões, limite lógico para nomes).

alter table public.campaigns
  add constraint campaigns_name_length
    check (char_length(name) <= 120);


-- ── 2. Trigger: impede alteração de campos estruturais ───
--
-- A policy de UPDATE já restringe quem pode editar (is_campaign_master),
-- mas um cliente malicioso poderia tentar mover a campanha para outro
-- mestre (master_id), trocar o sistema, falsificar created_at ou
-- manipular o próprio id via UPDATE direto.
--
-- Esta trigger garante no nível do banco que nenhum UPDATE pode
-- alterar esses campos — independentemente de quem chama.
--
-- Campos imutáveis:  id, master_id, system, created_at
-- Campos editáveis:  name, description, status, updated_at

create or replace function public.prevent_campaign_structural_update()
returns trigger as $$
begin
  if new.id <> old.id then
    raise exception
      'Campos estruturais da campanha não podem ser alterados.';
  end if;

  if new.master_id <> old.master_id then
    raise exception
      'Campos estruturais da campanha não podem ser alterados.';
  end if;

  if new.system <> old.system then
    raise exception
      'Campos estruturais da campanha não podem ser alterados.';
  end if;

  if new.created_at <> old.created_at then
    raise exception
      'Campos estruturais da campanha não podem ser alterados.';
  end if;

  return new;
end;
$$ language plpgsql set search_path = public;

create trigger enforce_campaign_immutable_fields
  before update on public.campaigns
  for each row execute function public.prevent_campaign_structural_update();


-- ── 3. Atualiza create_campaign com validação de comprimento ──
--
-- Mantém assinatura idêntica à migration anterior (text, text, text).
-- Adiciona apenas a verificação char_length(name) <= 120.

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

  if char_length(trim(campaign_name)) > 120 then
    raise exception 'O nome da campanha deve ter no máximo 120 caracteres.';
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


-- ── 4. Atualiza update_campaign_name com validação de comprimento ──

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

  if char_length(trim(new_name)) > 120 then
    raise exception 'O nome da campanha deve ter no máximo 120 caracteres.';
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


-- ── 5. Atualiza update_campaign_details com validação de comprimento ──

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

  if char_length(trim(new_name)) > 120 then
    raise exception 'O nome da campanha deve ter no máximo 120 caracteres.';
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
