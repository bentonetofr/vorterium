-- ============================================================
-- Campaign Lab — Incremento 4: Membros da Campanha
-- Migration: 20240102000000_campaign_members.sql
-- Aplicar após: 20240101000000_initial_schema.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
-- ============================================================


-- ── 1. Nova policy em profiles ───────────────────────────
--
-- A migration anterior permite que cada usuário veja APENAS
-- o próprio perfil. Para listar membros de uma campanha,
-- precisamos permitir que co-membros vejam o perfil uns dos outros.
--
-- Políticas permissivas são unidas por OR: o usuário pode ver
-- um profile se QUALQUER política autorizar. A política anterior
-- já cobre "ver o próprio perfil", então apenas adicionamos a nova.

create policy "profiles: membro pode ver perfis da mesma campanha"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1
      from   public.campaign_members cm1
      join   public.campaign_members cm2 on cm1.campaign_id = cm2.campaign_id
      where  cm1.user_id = auth.uid()
        and  cm2.user_id = public.profiles.id
    )
  );


-- ── 2. RPC find_profile_by_email ─────────────────────────
--
-- Busca segura de perfil por e-mail, disponível apenas para
-- usuários autenticados. Retorna exatamente os campos necessários
-- sem expor a tabela completa de usuários.

create or replace function public.find_profile_by_email(profile_email text)
returns table (
  id           uuid,
  display_name text,
  email        text,
  avatar_url   text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  return query
  select
    p.id,
    p.display_name,
    p.email,
    p.avatar_url
  from public.profiles p
  where p.email = lower(trim(profile_email))
  limit 1;
end;
$$;


-- ── 3. RPC add_campaign_player ───────────────────────────
--
-- Adiciona um jogador a uma campanha. Apenas o mestre pode chamar.
-- Validações: caller é mestre, jogador existe, jogador não é membro.

create or replace function public.add_campaign_player(
  campaign_id_input uuid,
  player_id_input   uuid
)
returns public.campaign_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.campaign_members;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not public.is_campaign_master(campaign_id_input, auth.uid()) then
    raise exception 'Apenas o mestre pode adicionar jogadores.';
  end if;

  if not exists (
    select 1 from public.profiles where id = player_id_input
  ) then
    raise exception 'Usuário não encontrado.';
  end if;

  if public.is_campaign_member(campaign_id_input, player_id_input) then
    raise exception 'Este usuário já faz parte da campanha.';
  end if;

  insert into public.campaign_members (campaign_id, user_id, role)
  values (campaign_id_input, player_id_input, 'player')
  returning * into v_member;

  return v_member;
end;
$$;


-- ── 4. RPC remove_campaign_player ────────────────────────
--
-- Remove um jogador de uma campanha. Apenas o mestre pode chamar.
-- Validações: caller é mestre, alvo não é mestre, alvo não é o próprio caller.

create or replace function public.remove_campaign_player(
  campaign_id_input uuid,
  player_id_input   uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not public.is_campaign_master(campaign_id_input, auth.uid()) then
    raise exception 'Apenas o mestre pode remover jogadores.';
  end if;

  if player_id_input = auth.uid() then
    raise exception 'O mestre não pode remover a si mesmo.';
  end if;

  if public.is_campaign_master(campaign_id_input, player_id_input) then
    raise exception 'Não é possível remover o mestre da campanha.';
  end if;

  delete from public.campaign_members
  where campaign_id = campaign_id_input
    and user_id     = player_id_input
    and role        = 'player';

  if not found then
    raise exception 'Jogador não encontrado na campanha.';
  end if;
end;
$$;
