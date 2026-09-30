-- ============================================================
-- Vorterium — Caderno do jogador ("Anotações da Bruna")
-- Migration: 20240163000000_player_notebook.sql
-- Aplicar após: 20240162000000_altherium_genesis_skald_recent.sql
-- ============================================================
--
-- Um caderno rápido de anotações, ligado por conta (hoje, só a Bruna):
-- em toda campanha de que a pessoa participa aparece um botão flutuante
-- que abre o caderno. As anotações ficam por sessão da campanha (várias
-- por sessão) e o MESTRE daquela campanha lê e edita tudo numa seção
-- própria. Ninguém mais vê: nem os outros jogadores, nem o painel do
-- desenvolvedor.
--
-- Quem tem caderno fica em player_notebook_users — só o SQL Editor mexe:
--
--   insert into public.player_notebook_users (user_id, title)
--   select id, 'Anotações da Bruna' from auth.users where email = 'EMAIL-DELA';

-- ── 1. Quem tem caderno ─────────────────────────────────

create table if not exists public.player_notebook_users (
  user_id     uuid         primary key references auth.users(id) on delete cascade,
  title       text         not null default 'Minhas anotações',
  created_at  timestamptz  not null default now(),
  constraint player_notebook_users_title_length check (char_length(btrim(title)) between 1 and 60)
);

alter table public.player_notebook_users enable row level security;
revoke insert, update, delete on public.player_notebook_users from anon, authenticated;

-- A própria pessoa sabe que tem caderno; o mestre sabe quem da campanha dele tem.
create or replace function public.has_notebook(user_id_input uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.player_notebook_users where user_id = user_id_input);
$$;
revoke all on function public.has_notebook(uuid) from public;
grant execute on function public.has_notebook(uuid) to authenticated;

create or replace function public.shares_campaign_as_master(player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from   public.campaign_members p
    join   public.campaign_members m on m.campaign_id = p.campaign_id
    where  p.user_id = player_id
      and  m.user_id = auth.uid()
      and  m.role = 'master'
  );
$$;
revoke all on function public.shares_campaign_as_master(uuid) from public;
grant execute on function public.shares_campaign_as_master(uuid) to authenticated;

drop policy if exists "notebook_users: dono e mestres veem" on public.player_notebook_users;
create policy "notebook_users: dono e mestres veem"
  on public.player_notebook_users for select
  to authenticated
  using (user_id = auth.uid() or public.shares_campaign_as_master(user_id));


-- ── 2. Anotações ────────────────────────────────────────

create table if not exists public.player_session_notes (
  id           uuid         primary key default gen_random_uuid(),
  campaign_id  uuid         not null references public.campaigns(id) on delete cascade,
  author_id    uuid         not null default auth.uid() references public.profiles(id) on delete cascade,
  -- null = sem sessão definida (a campanha ainda não tem sessões marcadas).
  session_id   uuid         references public.campaign_sessions(id) on delete set null,
  content      text         not null default '',
  updated_by   uuid         default auth.uid() references public.profiles(id) on delete set null,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now(),
  constraint player_session_notes_content_length check (char_length(content) <= 20000)
);

create index if not exists idx_player_session_notes_campaign
  on public.player_session_notes(campaign_id, session_id, created_at);

-- Sessão tem que ser da mesma campanha; atualiza quem mexeu e quando.
create or replace function public.player_session_notes_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Campanha, autor e criação não mudam depois de criada.
  if tg_op = 'UPDATE' then
    new.campaign_id := old.campaign_id;
    new.author_id   := old.author_id;
    new.created_at  := old.created_at;
  end if;
  if new.session_id is not null and not exists (
    select 1 from public.campaign_sessions s where s.id = new.session_id and s.campaign_id = new.campaign_id
  ) then
    raise exception 'A sessão não é desta campanha.' using errcode = '23514';
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists player_session_notes_guard on public.player_session_notes;
create trigger player_session_notes_guard
  before insert or update on public.player_session_notes
  for each row execute function public.player_session_notes_guard();

alter table public.player_session_notes enable row level security;

drop policy if exists "session_notes: autor e mestre veem" on public.player_session_notes;
create policy "session_notes: autor e mestre veem"
  on public.player_session_notes for select
  to authenticated
  using (author_id = auth.uid() or public.is_campaign_master(campaign_id, auth.uid()));

drop policy if exists "session_notes: dono do caderno cria" on public.player_session_notes;
create policy "session_notes: dono do caderno cria"
  on public.player_session_notes for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and public.has_notebook(auth.uid())
    and public.is_campaign_member(campaign_id, auth.uid())
  );

drop policy if exists "session_notes: autor e mestre editam" on public.player_session_notes;
create policy "session_notes: autor e mestre editam"
  on public.player_session_notes for update
  to authenticated
  using (
    (author_id = auth.uid() and public.is_campaign_member(campaign_id, auth.uid()))
    or public.is_campaign_master(campaign_id, auth.uid())
  )
  with check (
    (author_id = auth.uid() and public.is_campaign_member(campaign_id, auth.uid()))
    or public.is_campaign_master(campaign_id, auth.uid())
  );

drop policy if exists "session_notes: autor apaga" on public.player_session_notes;
create policy "session_notes: autor apaga"
  on public.player_session_notes for delete
  to authenticated
  using (author_id = auth.uid());

-- Privado: só a autora e os mestres da campanha leem. Diferente das outras
-- tabelas (20240161), o painel do desenvolvedor NÃO lê o caderno.
drop policy if exists "dev: le tudo" on public.player_session_notes;
drop policy if exists "dev: le tudo" on public.player_notebook_users;

-- Tempo real: o mestre vê as anotações chegando.
do $$
begin
  alter publication supabase_realtime add table public.player_session_notes;
exception when duplicate_object then null;
end;
$$;
