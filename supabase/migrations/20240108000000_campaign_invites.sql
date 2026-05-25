-- ============================================================
-- Campaign Lab — Incremento 8: Convite de campanha por link
-- Migration: 20240108000000_campaign_invites.sql
-- Aplicar após: 20240107000000_allow_profile_self_insert.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
-- ============================================================


-- ── 1. Tabela campaign_invites ────────────────────────────

create table public.campaign_invites (
  id          uuid        primary key default gen_random_uuid(),
  campaign_id uuid        not null references public.campaigns(id) on delete cascade,
  token       text        not null unique,
  created_by  uuid        not null references public.profiles(id) on delete cascade,
  is_active   boolean     not null default true,
  expires_at  timestamptz,           -- null = sem expiração no MVP
  created_at  timestamptz not null default now()
);

create index idx_campaign_invites_campaign_id on public.campaign_invites(campaign_id);
create index idx_campaign_invites_token       on public.campaign_invites(token);


-- ── 2. Row Level Security ────────────────────────────────

alter table public.campaign_invites enable row level security;

-- Mestre pode visualizar convites da própria campanha
create policy "campaign_invites: mestre pode ver convites"
  on public.campaign_invites for select
  to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()));

-- Nenhuma policy de INSERT/UPDATE/DELETE — tudo via RPC SECURITY DEFINER


-- ── 3. RPC create_campaign_invite ────────────────────────
--
-- Cria um convite ativo para a campanha.
-- Se já existir convite ativo sem expiração, retorna o existente
-- em vez de criar novo (evita acúmulo de convites).

create or replace function public.create_campaign_invite(
  campaign_id_input uuid
)
returns public.campaign_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite  public.campaign_invites%rowtype;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not public.is_campaign_master(campaign_id_input, v_user_id) then
    raise exception 'Apenas o mestre pode gerar convites.';
  end if;

  -- Reutiliza convite ativo sem expiração, se existir
  select * into v_invite
  from public.campaign_invites
  where campaign_id = campaign_id_input
    and is_active   = true
    and expires_at  is null
  order by created_at desc
  limit 1;

  if found then
    return v_invite;
  end if;

  -- Cria novo convite com token UUID
  insert into public.campaign_invites (campaign_id, token, created_by)
  values (campaign_id_input, gen_random_uuid()::text, v_user_id)
  returning * into v_invite;

  return v_invite;
end;
$$;


-- ── 4. RPC accept_campaign_invite ────────────────────────
--
-- Aceita um convite e adiciona o usuário autenticado como jogador.
-- Retorna campaign_id para que o front-end possa redirecionar.
-- Se o usuário já for membro, retorna campaign_id sem duplicar.

create or replace function public.accept_campaign_invite(
  invite_token text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite  public.campaign_invites%rowtype;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  -- Busca convite ativo e não expirado
  select * into v_invite
  from public.campaign_invites
  where token     = invite_token
    and is_active = true
    and (expires_at is null or expires_at > now())
  limit 1;

  if not found then
    raise exception 'Convite inválido ou expirado.';
  end if;

  -- Se já for membro, retorna campaign_id sem duplicar
  if public.is_campaign_member(v_invite.campaign_id, v_user_id) then
    return v_invite.campaign_id;
  end if;

  -- Insere como jogador — nunca como mestre
  insert into public.campaign_members (campaign_id, user_id, role)
  values (v_invite.campaign_id, v_user_id, 'player');

  return v_invite.campaign_id;
end;
$$;


-- ── 5. RPC deactivate_campaign_invite ────────────────────
--
-- Desativa um convite. Apenas o mestre da campanha pode desativar.

create or replace function public.deactivate_campaign_invite(
  invite_token text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite  public.campaign_invites%rowtype;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select * into v_invite
  from public.campaign_invites
  where token = invite_token;

  if not found then
    raise exception 'Convite não encontrado.';
  end if;

  if not public.is_campaign_master(v_invite.campaign_id, v_user_id) then
    raise exception 'Apenas o mestre pode desativar convites.';
  end if;

  update public.campaign_invites
  set is_active = false
  where token = invite_token;
end;
$$;
