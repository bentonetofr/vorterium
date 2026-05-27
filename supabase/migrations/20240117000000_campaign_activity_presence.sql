-- ============================================================
-- Campaign Lab — Atividade e presença online da campanha
-- Migration: 20240117000000_campaign_activity_presence.sql
-- Aplicar após: 20240116000000_harden_campaign_structural_fields.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
-- ============================================================


-- ── 1. Tabela campaign_activity ──────────────────────────
--
-- Registra eventos operacionais da campanha (sessões, membros,
-- rolagens, etc.). actor_id pode ser null se o perfil foi excluído
-- (ON DELETE SET NULL).

create table public.campaign_activity (
  id          uuid        primary key default gen_random_uuid(),
  campaign_id uuid        not null references public.campaigns(id) on delete cascade,
  actor_id    uuid        null        references public.profiles(id) on delete set null,
  type        text        not null,
  message     text        not null,
  metadata    jsonb       null,
  created_at  timestamptz not null default now()
);

create index idx_campaign_activity_campaign_id
  on public.campaign_activity(campaign_id);
create index idx_campaign_activity_created_at
  on public.campaign_activity(created_at desc);

alter table public.campaign_activity
  add constraint campaign_activity_type_valid
    check (type in (
      'campaign_created',   'campaign_updated',
      'member_joined',      'member_left',        'member_removed',
      'invite_created',     'invite_deactivated',
      'session_created',    'session_updated',    'session_deleted',
      'sheet_updated',      'dice_rolled'
    ));


-- ── 2. Tabela campaign_presence ──────────────────────────
--
-- Controla a presença online dos membros via heartbeat periódico.
-- last_seen_at é atualizado a cada 60 segundos pelo front-end.
-- Um usuário é considerado "online" se last_seen_at < 2 minutos atrás.

create table public.campaign_presence (
  campaign_id  uuid        not null references public.campaigns(id) on delete cascade,
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create index idx_campaign_presence_campaign_id
  on public.campaign_presence(campaign_id);


-- ── 3. Row Level Security ────────────────────────────────

alter table public.campaign_activity enable row level security;
alter table public.campaign_presence  enable row level security;

-- Activity: apenas membros podem ver; insert somente via RPC (sem policy de insert)
create policy "activity: membro pode ver"
  on public.campaign_activity for select
  to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()));

-- Presence: membros podem ver a presença de co-membros
create policy "presence: membro pode ver"
  on public.campaign_presence for select
  to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()));


-- ── 4. RPC create_campaign_activity ─────────────────────
--
-- Registra um evento de atividade na campanha.
-- SECURITY DEFINER: faz bypass de RLS para poder inserir
-- (a tabela não possui policy de INSERT — apenas esta RPC pode inserir).
-- Valida: autenticação + membership + type permitido.

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
  v_user_id  uuid    := auth.uid();
  v_is_master boolean;
  v_row      public.campaign_activity%rowtype;
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


-- ── 5. RPC touch_campaign_presence ──────────────────────
--
-- Atualiza o timestamp de presença do usuário autenticado.
-- Chamado a cada 60 segundos pelo front-end enquanto a página está aberta.
-- SECURITY DEFINER: faz bypass de RLS (sem policy de INSERT/UPDATE direta).
-- Valida: autenticação + membership.

create or replace function public.touch_campaign_presence(
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
    raise exception 'Apenas membros da campanha podem atualizar presença.';
  end if;

  insert into public.campaign_presence (campaign_id, user_id, last_seen_at)
  values (campaign_id_input, v_user_id, now())
  on conflict (campaign_id, user_id)
  do update set last_seen_at = now();
end;
$$;
