-- ============================================================
-- Vorterium — Notas da Campanha
-- Migration: 20240120000000_campaign_notes.sql
-- Aplicar após: 20240119000000_session_status.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
-- ============================================================


-- ── 1. Estender constraint de tipos de atividade ──────────
--
-- Remove a constraint existente e recria incluindo os tipos de notas.
-- TODOS os tipos anteriores são mantidos.

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
      'note_created',       'note_updated',       'note_deleted'
    ));


-- ── 2. Atualizar RPC create_campaign_activity ─────────────
--
-- Adiciona note_created, note_updated, note_deleted como tipos de membro
-- (qualquer membro autenticado pode registrar eventos de nota).

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
    'note_created',       'note_updated',       'note_deleted'
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


-- ── 3. Tabela campaign_notes ──────────────────────────────

create table public.campaign_notes (
  id          uuid        primary key default gen_random_uuid(),
  campaign_id uuid        not null references public.campaigns(id) on delete cascade,
  author_id   uuid        not null references public.profiles(id)  on delete cascade,
  title       text        not null,
  content     text        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint note_title_nonempty   check (trim(title)   <> ''),
  constraint note_content_nonempty check (trim(content) <> ''),
  constraint note_title_length     check (char_length(title)   <= 120),
  constraint note_content_length   check (char_length(content) <= 10000)
);

create index idx_campaign_notes_campaign_id
  on public.campaign_notes(campaign_id);
create index idx_campaign_notes_updated_at
  on public.campaign_notes(updated_at desc);


-- ── 4. Trigger: atualizar updated_at ─────────────────────

create trigger set_campaign_notes_updated_at
  before update on public.campaign_notes
  for each row execute function public.set_updated_at();


-- ── 5. Trigger: proteger campos estruturais ───────────────

create or replace function public.prevent_note_structural_changes()
returns trigger
language plpgsql
as $$
begin
  if new.campaign_id <> old.campaign_id
    or new.author_id  <> old.author_id
    or new.created_at <> old.created_at then
    raise exception 'Campos estruturais da nota não podem ser alterados.';
  end if;
  return new;
end;
$$;

create trigger prevent_campaign_note_structural_changes
  before update on public.campaign_notes
  for each row execute function public.prevent_note_structural_changes();


-- ── 6. Row Level Security ─────────────────────────────────

alter table public.campaign_notes enable row level security;

-- SELECT: membros podem ver notas da campanha
create policy "notes: membro pode ver"
  on public.campaign_notes for select
  to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()));

-- INSERT: membros podem criar notas; author_id deve ser auth.uid()
create policy "notes: membro pode criar"
  on public.campaign_notes for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and public.is_campaign_member(campaign_id, auth.uid())
  );

-- UPDATE: autor ou mestre da campanha pode editar
create policy "notes: autor ou mestre pode editar"
  on public.campaign_notes for update
  to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.campaign_members
      where campaign_id = campaign_notes.campaign_id
        and user_id     = auth.uid()
        and role        = 'master'
    )
  );

-- DELETE: autor ou mestre da campanha pode excluir
create policy "notes: autor ou mestre pode excluir"
  on public.campaign_notes for delete
  to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.campaign_members
      where campaign_id = campaign_notes.campaign_id
        and user_id     = auth.uid()
        and role        = 'master'
    )
  );
