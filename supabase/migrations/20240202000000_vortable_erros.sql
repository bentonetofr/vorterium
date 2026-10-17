-- ============================================================
-- Vorterium — Vortable: registro dos erros (códigos VT-...)
-- Migration: 20240202000000_vortable_erros.sql
-- Aplicar após: 20240201000000_altherium_limite_triunfos.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
-- ============================================================
--
-- Cada erro do Vortable tem um código estável (VT-NET-002, VT-SALA-007...,
-- catálogo em src/features/vortable/errors/catalog.ts). O navegador de quem
-- teve o erro guarda numa fila e manda em lotes pra esta tabela.
--
--   quem grava: cada pessoa, só os próprios erros, só em campanha da qual é membro
--   quem lê:    o mestre da campanha (todos os da campanha), a própria pessoa e o
--               perfil de desenvolvedor (todos)
--   quem apaga: o mestre (botão "Limpar" da lista no Vortable)
--
-- Limites: 120 linhas por pessoa por hora (o resto é ignorado em silêncio) e
-- linhas com mais de 30 dias são apagadas sozinhas.
-- ============================================================

create table if not exists public.vortable_errors (
  id           uuid        primary key default gen_random_uuid(),
  campaign_id  uuid        not null references public.campaigns(id) on delete cascade,
  user_id      uuid        references public.profiles(id) on delete set null default auth.uid(),
  role         text        not null default 'player' check (role in ('master', 'player', 'spectator')),
  code         text        not null check (code ~ '^VT-[A-Z]+-[0-9]{3}$'),
  severity     text        not null check (severity in ('info', 'aviso', 'erro', 'grave')),
  detail       text        not null default '' check (char_length(detail) <= 500),
  context      jsonb       not null default '{}'::jsonb check (pg_column_size(context) <= 8192),
  count        integer     not null default 1 check (count between 1 and 10000),
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists vortable_errors_campaign_created on public.vortable_errors (campaign_id, created_at desc);
create index if not exists vortable_errors_created on public.vortable_errors (created_at desc);
create index if not exists vortable_errors_user_created on public.vortable_errors (user_id, created_at desc);


-- ── Regras que a policy sozinha não cobre ─────────────────

create or replace function public.vortable_errors_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- quem grava é sempre a conta logada, e a hora é a do servidor
  new.user_id    := auth.uid();
  new.created_at := now();
  -- hora do aparelho fora do razoável (relógio errado): vale a do servidor
  if new.occurred_at > now() + interval '1 day' or new.occurred_at < now() - interval '30 days' then
    new.occurred_at := now();
  end if;

  -- no máximo 120 linhas por pessoa por hora: o excesso é ignorado
  if (select count(*) from public.vortable_errors
      where user_id = new.user_id and created_at > now() - interval '1 hour') >= 120 then
    return null;
  end if;

  -- de vez em quando, apaga o que tem mais de 30 dias
  if random() < 0.02 then
    delete from public.vortable_errors where created_at < now() - interval '30 days';
  end if;

  return new;
end;
$$;

drop trigger if exists vortable_errors_guard on public.vortable_errors;
create trigger vortable_errors_guard
  before insert on public.vortable_errors
  for each row execute function public.vortable_errors_guard();


-- ── Policies ──────────────────────────────────────────────

alter table public.vortable_errors enable row level security;

drop policy if exists "vortable_errors: membro grava os seus" on public.vortable_errors;
create policy "vortable_errors: membro grava os seus"
  on public.vortable_errors for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_campaign_member(campaign_id, auth.uid())
  );

drop policy if exists "vortable_errors: mestre, a pessoa e o dev leem" on public.vortable_errors;
create policy "vortable_errors: mestre, a pessoa e o dev leem"
  on public.vortable_errors for select
  to authenticated
  using (
    public.is_campaign_master(campaign_id, auth.uid())
    or user_id = auth.uid()
    or public.is_developer()
  );

drop policy if exists "vortable_errors: mestre limpa" on public.vortable_errors;
create policy "vortable_errors: mestre limpa"
  on public.vortable_errors for delete
  to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()));


-- ── Tempo real (a lista do mestre atualiza na hora) ──────

do $$
begin
  alter publication supabase_realtime add table public.vortable_errors;
exception when others then
  -- a publication não existe ou a tabela já está nela
  null;
end;
$$;
