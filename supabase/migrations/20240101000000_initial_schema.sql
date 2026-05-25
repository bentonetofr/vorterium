-- ============================================================
-- Campaign Lab — Incremento 3: Banco inicial
-- Migration: 20240101000000_initial_schema.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
--
-- Se a migration já foi aplicada anteriormente, basta re-executar
-- apenas as seções de CREATE OR REPLACE FUNCTION (seções 5, 6 e 7)
-- para aplicar a correção de search_path nas funções SECURITY DEFINER.
-- ============================================================


-- ── 1. Função set_updated_at ─────────────────────────────

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;


-- ── 2. Tabela profiles ───────────────────────────────────

create table if not exists public.profiles (
  id            uuid        primary key references auth.users(id) on delete cascade,
  display_name  text        not null,
  email         text        not null,
  avatar_url    text,
  main_provider text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();


-- ── 3. Tabela campaigns ──────────────────────────────────

create table if not exists public.campaigns (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null check (trim(name) <> ''),
  system     text        not null default 'generic'
               check (system in ('generic', 'dnd5e', 'altherium', 'custom')),
  master_id  uuid        not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_campaigns_updated_at
  before update on public.campaigns
  for each row execute function public.set_updated_at();


-- ── 4. Tabela campaign_members ───────────────────────────

create table if not exists public.campaign_members (
  id          uuid        primary key default gen_random_uuid(),
  campaign_id uuid        not null references public.campaigns(id) on delete cascade,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  role        text        not null check (role in ('master', 'player')),
  created_at  timestamptz not null default now(),
  unique (campaign_id, user_id)
);

create index if not exists idx_campaign_members_campaign_id on public.campaign_members(campaign_id);
create index if not exists idx_campaign_members_user_id     on public.campaign_members(user_id);


-- ── 5. Trigger handle_new_user ───────────────────────────
--
-- Cria perfil automaticamente após inserção em auth.users.
-- Ordem de leitura do nome:
--   1. display_name  (enviado pelo cadastro do front-end)
--   2. full_name     (Google OAuth)
--   3. name          (outros providers)
--   4. parte do e-mail antes do @
--
-- set search_path = public: previne ataques de search_path hijacking
-- em funções SECURITY DEFINER (recomendação do Supabase).

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, email, avatar_url, main_provider)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'full_name'),    ''),
      nullif(trim(new.raw_user_meta_data->>'name'),         ''),
      split_part(new.email, '@', 1)
    ),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    new.raw_app_meta_data->>'provider'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ── 6. Funções auxiliares de verificação de acesso ───────

create or replace function public.is_campaign_member(
  campaign_id_input uuid,
  user_id_input     uuid
)
returns boolean as $$
  select exists (
    select 1
    from   public.campaign_members
    where  campaign_id = campaign_id_input
      and  user_id     = user_id_input
  );
$$ language sql security definer stable set search_path = public;

create or replace function public.is_campaign_master(
  campaign_id_input uuid,
  user_id_input     uuid
)
returns boolean as $$
  select exists (
    select 1
    from   public.campaign_members
    where  campaign_id = campaign_id_input
      and  user_id     = user_id_input
      and  role        = 'master'
  );
$$ language sql security definer stable set search_path = public;


-- ── 7. RPC create_campaign ───────────────────────────────
--
-- Cria a campanha e insere o criador como mestre em uma
-- única operação atômica.

create or replace function public.create_campaign(
  campaign_name   text,
  campaign_system text default 'generic'
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

  insert into public.campaigns (name, system, master_id)
  values (trim(campaign_name), campaign_system, v_user_id)
  returning * into v_campaign;

  insert into public.campaign_members (campaign_id, user_id, role)
  values (v_campaign.id, v_user_id, 'master');

  return v_campaign;
end;
$$ language plpgsql security definer set search_path = public;


-- ── 8. Row Level Security ────────────────────────────────

alter table public.profiles         enable row level security;
alter table public.campaigns        enable row level security;
alter table public.campaign_members enable row level security;

-- profiles
create policy "profiles: ver o próprio perfil"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles: atualizar o próprio perfil"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- campaigns
create policy "campaigns: membro pode ver"
  on public.campaigns for select
  to authenticated
  using (public.is_campaign_member(id, auth.uid()));

create policy "campaigns: autenticado pode criar"
  on public.campaigns for insert
  to authenticated
  with check (master_id = auth.uid());

create policy "campaigns: mestre pode atualizar"
  on public.campaigns for update
  to authenticated
  using    (public.is_campaign_master(id, auth.uid()))
  with check (public.is_campaign_master(id, auth.uid()));

create policy "campaigns: mestre pode excluir"
  on public.campaigns for delete
  to authenticated
  using (public.is_campaign_master(id, auth.uid()));

-- campaign_members
create policy "campaign_members: membro pode ver membros"
  on public.campaign_members for select
  to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()));

create policy "campaign_members: mestre pode adicionar membros"
  on public.campaign_members for insert
  to authenticated
  with check (public.is_campaign_master(campaign_id, auth.uid()));

create policy "campaign_members: mestre pode remover jogadores"
  on public.campaign_members for delete
  to authenticated
  using (
    public.is_campaign_master(campaign_id, auth.uid())
    and role = 'player'
  );


-- ── 9. Backfill opcional para usuários pré-existentes ────
--
-- Execute esta seção APENAS se já existiam usuários em auth.users
-- antes da migration ser aplicada. Ela cria perfis para quem não
-- passou pelo trigger handle_new_user.
--
-- IMPORTANTE: verifique antes de executar se o resultado faz sentido
-- para o seu projeto. Em projetos novos, esta seção é desnecessária.
--
-- Para executar, copie e rode separadamente no SQL Editor:
--
-- insert into public.profiles (id, display_name, email, avatar_url, main_provider)
-- select
--   u.id,
--   coalesce(
--     nullif(trim(u.raw_user_meta_data->>'display_name'), ''),
--     nullif(trim(u.raw_user_meta_data->>'full_name'),    ''),
--     nullif(trim(u.raw_user_meta_data->>'name'),         ''),
--     split_part(u.email, '@', 1)
--   ),
--   u.email,
--   u.raw_user_meta_data->>'avatar_url',
--   u.raw_app_meta_data->>'provider'
-- from auth.users u
-- where not exists (
--   select 1 from public.profiles p where p.id = u.id
-- );
