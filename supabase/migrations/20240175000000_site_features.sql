-- ════════════════════════════════════════════════════════
-- Painel de controle do dono do site: recursos novos que podem ficar
-- GUARDADOS (só o dono vê, pra testar) ou ir PRO SITE (todo mundo vê).
--
-- Dono do site ≠ desenvolvedor: a conta de desenvolvedor (app_developers)
-- lê tudo e mora só no painel /dev; o dono do site é uma conta normal de
-- jogador/mestre que, além disso, pode ligar e desligar esses recursos —
-- e mais nada (não vê nada a mais de ninguém).
--
-- Cada recurso é uma linha (key) com enabled = true/false. Sem linha =
-- guardado. Todos podem LER (o site precisa saber o que mostrar); só o
-- dono do site muda.
-- ════════════════════════════════════════════════════════

-- ── 1. Quem é dono do site ──────────────────────────────
-- Como app_developers: o site não lê nem altera esta tabela, só o SQL Editor.

create table if not exists public.app_owners (
  user_id     uuid         primary key references auth.users(id) on delete cascade,
  created_at  timestamptz  not null default now()
);

alter table public.app_owners enable row level security;
revoke all on public.app_owners from anon, authenticated;

create or replace function public.is_site_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_owners where user_id = auth.uid());
$$;

revoke all on function public.is_site_owner() from public;
grant execute on function public.is_site_owner() to authenticated;

insert into public.app_owners (user_id)
select id from auth.users where email = 'bentonetofr@gmail.com'
on conflict (user_id) do nothing;


-- ── 2. Os recursos ──────────────────────────────────────

create table if not exists public.site_features (
  key         text         primary key,
  enabled     boolean      not null default false,
  updated_at  timestamptz  not null default now(),
  updated_by  uuid         references auth.users(id) on delete set null default auth.uid(),
  constraint site_features_key check (key ~ '^[a-z0-9][a-z0-9_-]{1,63}$')
);

alter table public.site_features enable row level security;

drop policy if exists "site_features: todos leem" on public.site_features;
create policy "site_features: todos leem" on public.site_features
  for select to anon, authenticated
  using (true);

drop policy if exists "site_features: dono cria" on public.site_features;
create policy "site_features: dono cria" on public.site_features
  for insert to authenticated
  with check (public.is_site_owner());

drop policy if exists "site_features: dono altera" on public.site_features;
create policy "site_features: dono altera" on public.site_features
  for update to authenticated
  using (public.is_site_owner())
  with check (public.is_site_owner());

drop policy if exists "site_features: dono apaga" on public.site_features;
create policy "site_features: dono apaga" on public.site_features
  for delete to authenticated
  using (public.is_site_owner());

grant select on public.site_features to anon, authenticated;
grant insert, update, delete on public.site_features to authenticated;

-- Quem mexeu e quando (o site não precisa mandar).
create or replace function public.site_features_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists site_features_touch on public.site_features;
create trigger site_features_touch
  before insert or update on public.site_features
  for each row execute function public.site_features_touch();

-- Ligou/desligou: o site de todo mundo atualiza na hora.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'site_features'
  ) then
    alter publication supabase_realtime add table public.site_features;
  end if;
end $$;
