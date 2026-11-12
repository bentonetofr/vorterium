-- ────────────────────────────────────────────────────────
-- Ajuste do próximo dado de um jogador (ferramenta privada do dono do site).
-- Uma linha por jogador e campanha: o que o PRÓXIMO dado dele deve mostrar. O cliente do jogador lê a própria linha, usa uma vez
-- (rolagem forçada, que não conta pras conquistas) e apaga. Só o dono do site cria ou troca; o jogador só enxerga e apaga a própria.
-- ────────────────────────────────────────────────────────

create table if not exists public.roll_nudges (
  campaign_id    uuid        not null references public.campaigns(id) on delete cascade,
  target_user_id uuid        not null references auth.users(id) on delete cascade,
  mode           text        not null check (mode in ('max', 'min', 'fixed')),
  fixed          integer     not null default 20 check (fixed between 1 and 1000),
  d20_only       boolean     not null default false,
  created_at     timestamptz not null default now(),
  primary key (campaign_id, target_user_id)
);

alter table public.roll_nudges enable row level security;

drop policy if exists roll_nudges_select on public.roll_nudges;
create policy roll_nudges_select on public.roll_nudges for select to authenticated
  using (target_user_id = auth.uid() or public.is_site_owner());

drop policy if exists roll_nudges_insert on public.roll_nudges;
create policy roll_nudges_insert on public.roll_nudges for insert to authenticated
  with check (public.is_site_owner());

drop policy if exists roll_nudges_update on public.roll_nudges;
create policy roll_nudges_update on public.roll_nudges for update to authenticated
  using (public.is_site_owner()) with check (public.is_site_owner());

-- o dono cancela; o jogador apaga a própria linha depois de usar
drop policy if exists roll_nudges_delete on public.roll_nudges;
create policy roll_nudges_delete on public.roll_nudges for delete to authenticated
  using (target_user_id = auth.uid() or public.is_site_owner());

-- o jogador fica sabendo na hora (sem recarregar a página)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'roll_nudges'
  ) then
    alter publication supabase_realtime add table public.roll_nudges;
  end if;
end $$;
