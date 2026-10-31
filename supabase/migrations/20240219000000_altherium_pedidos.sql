-- Altherium: pedidos de teste do mestre (painel do mestre).
-- O mestre pede "Furtividade, DT 8" (ou uma perda de Equilíbrio, ou um teste
-- de domínio) a um ou mais jogadores; o pedido aparece na ficha deles com a
-- DT já preenchida, e a resposta é a própria rolagem (dice_rolls, com o id do
-- pedido em roll_context.request_id). Só o mestre cria e encerra.

create table if not exists public.altherium_check_requests (
  id          uuid        primary key default gen_random_uuid(),
  campaign_id uuid        not null references public.campaigns(id) on delete cascade,
  master_id   uuid        not null references public.profiles(id) on delete cascade,
  targets     uuid[]      not null default '{}',
  kind        text        not null check (kind in ('domain', 'stealth', 'equilibrium')),
  domain      text,
  label       text        not null check (char_length(label) between 1 and 80),
  dt          integer     check (dt is null or dt between 1 and 40),
  -- Equilíbrio: a perda do evento (passou na DT perde metade, falhou perde tudo).
  amount      integer     check (amount is null or amount between 0 and 99),
  status      text        not null default 'open' check (status in ('open', 'closed')),
  created_at  timestamptz not null default now(),
  closed_at   timestamptz
);

create index if not exists altherium_check_requests_campaign_idx
  on public.altherium_check_requests (campaign_id, status, created_at desc);

alter table public.altherium_check_requests enable row level security;

drop policy if exists "altherium_requests: mestre e alvos veem" on public.altherium_check_requests;
create policy "altherium_requests: mestre e alvos veem" on public.altherium_check_requests
  for select to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()) or auth.uid() = any (targets));

drop policy if exists "altherium_requests: mestre cria" on public.altherium_check_requests;
create policy "altherium_requests: mestre cria" on public.altherium_check_requests
  for insert to authenticated
  with check (master_id = auth.uid() and public.is_campaign_master(campaign_id, auth.uid()));

drop policy if exists "altherium_requests: mestre altera" on public.altherium_check_requests;
create policy "altherium_requests: mestre altera" on public.altherium_check_requests
  for update to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()))
  with check (public.is_campaign_master(campaign_id, auth.uid()));

grant select, insert, update on public.altherium_check_requests to authenticated;

-- Painel do desenvolvedor lê tudo (como nas outras tabelas, 20240161).
drop policy if exists "dev: le tudo" on public.altherium_check_requests;
create policy "dev: le tudo" on public.altherium_check_requests
  for select to authenticated using (public.is_developer());

-- Tempo real: o pedido aparece na ficha do jogador na hora.
do $$
begin
  alter publication supabase_realtime add table public.altherium_check_requests;
exception when others then
  null;
end;
$$;
