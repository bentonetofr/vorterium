-- ============================================================
-- Vorterium — Iniciativa de combate (Mesa da Sessão)
-- Migration: 20240138000000_campaign_initiative.sql
-- Aplicar após: 20240137000000_leave_campaign_atomic_activity.sql
-- ============================================================

-- ── 1. campaign_initiative_participants ──
--
-- Uma linha por participante do combate atual: um membro da campanha
-- (user_id preenchido) ou um NPC/monstro adicionado à mão (user_id nulo).
-- initiative_value fica nulo até ser rolado ou digitado.

create table public.campaign_initiative_participants (
  id               uuid        primary key default gen_random_uuid(),
  campaign_id      uuid        not null references public.campaigns(id) on delete cascade,
  user_id          uuid        references public.profiles(id) on delete cascade,
  name             text        not null check (char_length(name) between 1 and 80),
  initiative_value int         check (initiative_value between -50 and 100),
  created_at       timestamptz not null default now()
);

-- Evita duplicar o mesmo membro duas vezes num "Iniciar combate" repetido
-- (permite várias linhas com user_id nulo — vários NPCs sem nome único).
create unique index idx_initiative_participant_unique_member
  on public.campaign_initiative_participants(campaign_id, user_id)
  where user_id is not null;

create index idx_initiative_participants_campaign
  on public.campaign_initiative_participants(campaign_id);

alter table public.campaign_initiative_participants enable row level security;

create policy "initiative_participants: membro ve"
  on public.campaign_initiative_participants for select
  to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()));

create policy "initiative_participants: mestre adiciona"
  on public.campaign_initiative_participants for insert
  to authenticated
  with check (
    public.is_campaign_master(campaign_id, auth.uid())
    and (user_id is null or public.is_campaign_member(campaign_id, user_id))
  );

create policy "initiative_participants: dono ou mestre atualiza"
  on public.campaign_initiative_participants for update
  to authenticated
  using (user_id = auth.uid() or public.is_campaign_master(campaign_id, auth.uid()))
  with check (user_id = auth.uid() or public.is_campaign_master(campaign_id, auth.uid()));

create policy "initiative_participants: mestre remove"
  on public.campaign_initiative_participants for delete
  to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()));


-- ── 2. campaign_initiative_state ──
--
-- Uma linha por campanha: rodada atual + de quem é a vez. Sem policy de
-- INSERT/UPDATE direta — só as RPCs abaixo escrevem (SECURITY DEFINER),
-- mesmo padrão de campaign_chat_reads/campaign_presence.

create table public.campaign_initiative_state (
  campaign_id                 uuid primary key references public.campaigns(id) on delete cascade,
  round_number                int  not null default 1 check (round_number >= 1),
  current_turn_participant_id uuid references public.campaign_initiative_participants(id) on delete set null,
  updated_at                  timestamptz not null default now()
);

alter table public.campaign_initiative_state enable row level security;

create policy "initiative_state: membro ve"
  on public.campaign_initiative_state for select
  to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()));


-- ── 3. RPCs ──

create or replace function public.start_initiative_encounter(
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

  if not public.is_campaign_master(campaign_id_input, v_user_id) then
    raise exception 'Apenas o mestre pode iniciar o combate.';
  end if;

  insert into public.campaign_initiative_participants (campaign_id, user_id, name)
  select campaign_id_input, cm.user_id, p.display_name
  from public.campaign_members cm
  join public.profiles p on p.id = cm.user_id
  where cm.campaign_id = campaign_id_input
  on conflict (campaign_id, user_id) where user_id is not null do nothing;

  insert into public.campaign_initiative_state (campaign_id, round_number, current_turn_participant_id)
  values (campaign_id_input, 1, null)
  on conflict (campaign_id) do update
    set round_number = 1, current_turn_participant_id = null, updated_at = now();
end;
$$;

create or replace function public.advance_initiative_turn(
  campaign_id_input uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id    uuid := auth.uid();
  v_current_id uuid;
  v_round      int;
  v_ids        uuid[];
  v_idx        int;
  v_next_id    uuid;
  v_wrapped    boolean := false;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not public.is_campaign_master(campaign_id_input, v_user_id) then
    raise exception 'Apenas o mestre pode avançar o turno.';
  end if;

  select current_turn_participant_id, round_number
    into v_current_id, v_round
  from public.campaign_initiative_state
  where campaign_id = campaign_id_input;

  if not found then
    raise exception 'Nenhum combate ativo nesta campanha.';
  end if;

  -- Monta a ordem de turno como array — mais simples e seguro do que
  -- comparar tuplas (initiative_value desc, created_at asc são direções
  -- diferentes, e initiative_value pode ser nulo).
  select array_agg(id order by initiative_value desc nulls last, created_at)
    into v_ids
  from public.campaign_initiative_participants
  where campaign_id = campaign_id_input;

  if v_ids is null or array_length(v_ids, 1) = 0 then
    raise exception 'Nenhum participante no combate.';
  end if;

  if v_current_id is null then
    v_next_id := v_ids[1];
  else
    v_idx := array_position(v_ids, v_current_id);
    if v_idx is null or v_idx = array_length(v_ids, 1) then
      -- Não achou (linha removida) ou já era o último — volta pro
      -- primeiro e soma uma rodada.
      v_next_id := v_ids[1];
      v_wrapped := true;
    else
      v_next_id := v_ids[v_idx + 1];
    end if;
  end if;

  update public.campaign_initiative_state
  set current_turn_participant_id = v_next_id,
      round_number = case when v_wrapped then v_round + 1 else v_round end,
      updated_at = now()
  where campaign_id = campaign_id_input;
end;
$$;

create or replace function public.end_initiative_encounter(
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

  if not public.is_campaign_master(campaign_id_input, v_user_id) then
    raise exception 'Apenas o mestre pode encerrar o combate.';
  end if;

  delete from public.campaign_initiative_state where campaign_id = campaign_id_input;
  delete from public.campaign_initiative_participants where campaign_id = campaign_id_input;
end;
$$;


-- ── 4. Realtime ──

do $$
begin
  alter publication supabase_realtime add table public.campaign_initiative_participants;
exception when others then
  null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.campaign_initiative_state;
exception when others then
  null;
end;
$$;
