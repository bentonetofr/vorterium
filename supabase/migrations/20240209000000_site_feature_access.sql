-- ============================================================
-- Vorterium — Acesso de pessoas específicas a recursos guardados
-- Migration: 20240209000000_site_feature_access.sql
-- Aplicar após: 20240208000000_dnd_automatizar.sql
-- ============================================================
--
-- Um recurso guardado no Painel de controle (site_features) só aparece
-- pro dono do site. Esta tabela deixa o dono liberar um recurso pra
-- pessoas específicas, pelo e-mail da conta, sem ligar pro site inteiro:
-- a pessoa passa a ver e usar o recurso como jogador e como mestre
-- (criar campanha, ficha, tudo). O e-mail pode ser cadastrado antes da
-- pessoa criar a conta: vale assim que existir uma conta com ele.
--
-- Como app_owners: o site não lê nem altera a tabela, só o SQL Editor.
-- Pra liberar mais gente (ou tirar), edite a tabela:
--   insert into public.site_feature_access (feature, email)
--   values ('dnd5e', 'fulano@exemplo.com') on conflict do nothing;
--   delete from public.site_feature_access
--   where feature = 'dnd5e' and email = 'fulano@exemplo.com';
-- ============================================================

create table if not exists public.site_feature_access (
  feature     text         not null,
  email       text         not null,
  created_at  timestamptz  not null default now(),
  primary key (feature, email),
  constraint site_feature_access_feature check (feature ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  constraint site_feature_access_email   check (email = lower(btrim(email)) and email like '%_@_%')
);

alter table public.site_feature_access enable row level security;
revoke all on public.site_feature_access from anon, authenticated;


-- Esta conta tem acesso liberado a este recurso pelo e-mail?
create or replace function public.feature_tester(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.site_feature_access a
    join auth.users u on lower(u.email) = a.email
    where a.feature = p_key and u.id = auth.uid()
  );
$$;
revoke all on function public.feature_tester(text) from public, anon;
grant execute on function public.feature_tester(text) to authenticated;

-- Os recursos liberados pra conta logada (o site usa pra mostrar o que está guardado).
create or replace function public.my_feature_access()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select a.feature
  from public.site_feature_access a
  join auth.users u on lower(u.email) = a.email
  where u.id = auth.uid();
$$;
revoke all on function public.my_feature_access() from public, anon;
grant execute on function public.my_feature_access() to authenticated;


-- D&D liberado pra esta pessoa? Recurso ligado no Painel, dono do site ou e-mail liberado.
create or replace function public.dnd_open()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.site_features where key = 'dnd5e' and enabled)
      or public.is_site_owner()
      or public.feature_tester('dnd5e');
$$;
revoke all on function public.dnd_open() from public, anon;
grant execute on function public.dnd_open() to authenticated;


-- ── Liberação de agora ──────────────────────────────────
insert into public.site_feature_access (feature, email)
values ('dnd5e', 'nicolas@campinas.com'),
       ('dnd5e', 'mariacoutinho016@gmail.com'),
       ('dnd5e', 'brunaferreirapedroso@gmail.com')
on conflict do nothing;
