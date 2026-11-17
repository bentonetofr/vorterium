-- ============================================================
-- Vorterium — DaggerHeart (Livro Básico, Darrington Press)
-- Migration: 20240237000000_daggerheart_base.sql
-- Aplicar após: 20240236000000_session_end_prompt.sql
--
-- Libera o sistema 'daggerheart' nas campanhas (constraint e create_campaign).
-- As tabelas da ficha vêm na migration 20240238 (a ficha inteira numa linha jsonb).
-- Nasce GUARDADO no Painel de controle do dono.
-- ============================================================


-- ── 1. Adiciona 'daggerheart' ao constraint de sistema ──────

alter table public.campaigns
  drop constraint if exists campaigns_system_valid;

alter table public.campaigns
  add constraint campaigns_system_valid
    check (system in (
      'generic', 'dnd5e', 'altherium', 'terra_devastada',
      'vampiro', 'terra_devastada_adaptada', 'daggerheart'
    ));

-- Atualiza a função create_campaign para aceitar o novo sistema.
-- Padrão do projeto: a função é recriada integralmente a cada novo sistema.
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
    raise exception 'Nome da campanha muito longo (máximo 120 caracteres).';
  end if;

  if campaign_system not in (
    'generic', 'dnd5e', 'altherium', 'terra_devastada',
    'vampiro', 'terra_devastada_adaptada', 'daggerheart'
  ) then
    raise exception 'Sistema de campanha inválido: %', campaign_system;
  end if;

  -- Sistemas guardados só podem ser criados pelo dono do site.
  if campaign_system in ('vampiro', 'terra_devastada_adaptada', 'daggerheart')
     and not public.is_site_owner()
  then
    if not exists (
      select 1 from public.site_features
      where key = campaign_system and enabled = true
    ) then
      raise exception 'Este sistema ainda não está disponível publicamente.';
    end if;
  end if;

  insert into public.campaigns (name, system, description, master_id)
  values (
    trim(campaign_name),
    campaign_system,
    nullif(trim(coalesce(campaign_description, '')), ''),
    v_user_id
  )
  returning * into v_campaign;

  insert into public.campaign_members (campaign_id, user_id, role)
  values (v_campaign.id, v_user_id, 'master');

  return v_campaign;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.create_campaign(text, text, text) from public;
grant execute on function public.create_campaign(text, text, text) to authenticated;
