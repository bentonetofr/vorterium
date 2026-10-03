-- ════════════════════════════════════════════════════════
-- Raiz Mestre (Altherium): quem estudou o suficiente usa tudo — os
-- triunfos de Berserker, Runaskin e Pilar — pagando com TORRE.
--
-- Como se vira Mestre: com o recurso "raiz-mestre" liberado no Painel de
-- controle (site_features), cada jogador de uma campanha de Altherium vê o
-- botão SE TORNAR UM MESTRE. Quando TODOS os jogadores daquela campanha
-- apertam (o mestre da mesa não conta), a campanha "ascende": as fichas
-- dos jogadores viram Mestre e o site deles ganha o tema preto e dourado.
--
-- Na ficha: Vida e PE máximos ×2 (e cheios), TORRE máxima = Estratégia × 5
-- (calculada no site) e cheia. O que a ficha tinha antes fica guardado em
-- mestre_backup.
--
-- O dono do site (app_owners, migration 20240175) pode testar sozinho
-- (mestre_owner_test) e voltar ao normal (mestre_owner_reset) — só nele.
-- ════════════════════════════════════════════════════════

-- ── 1. Ficha: raiz Mestre e TORRE ───────────────────────

alter table public.altherium_character_sheets
  drop constraint if exists altherium_character_sheets_raiz_check;
alter table public.altherium_character_sheets
  add constraint altherium_character_sheets_raiz_check
  check (raiz in ('berserker', 'runaskin', 'pilar', 'mestre'));

alter table public.altherium_character_sheets
  add column if not exists torre_current integer not null default 0 check (torre_current >= 0),
  add column if not exists mestre_backup jsonb;

-- ── 2. Tema do site: quem virou Mestre ──────────────────

alter table public.profiles
  add column if not exists mestre_at timestamptz;

-- ── 3. Quem já apertou o botão, e as campanhas que ascenderam ──

create table if not exists public.altherium_mestre_calls (
  campaign_id  uuid         not null references public.campaigns(id) on delete cascade,
  user_id      uuid         not null references public.profiles(id) on delete cascade,
  created_at   timestamptz  not null default now(),
  primary key (campaign_id, user_id)
);

create table if not exists public.altherium_mestre_ascensions (
  campaign_id  uuid         primary key references public.campaigns(id) on delete cascade,
  ascended_at  timestamptz  not null default now()
);

alter table public.altherium_mestre_calls      enable row level security;
alter table public.altherium_mestre_ascensions enable row level security;

drop policy if exists "mestre_calls: membros veem" on public.altherium_mestre_calls;
create policy "mestre_calls: membros veem" on public.altherium_mestre_calls
  for select to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()));

-- Desistir (tirar o próprio "pronto") — apertar é pela função call_mestre.
drop policy if exists "mestre_calls: jogador desiste" on public.altherium_mestre_calls;
create policy "mestre_calls: jogador desiste" on public.altherium_mestre_calls
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "mestre_ascensions: membros veem" on public.altherium_mestre_ascensions;
create policy "mestre_ascensions: membros veem" on public.altherium_mestre_ascensions
  for select to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()));

grant select, delete on public.altherium_mestre_calls to authenticated;
grant select on public.altherium_mestre_ascensions to authenticated;

-- ── 4. Virar Mestre ─────────────────────────────────────

-- Converte a ficha (Vida/PE ×2 e cheios, Torre cheia), guardando o antes.
create or replace function public.mestre_convert_sheets(p_campaign uuid, p_users uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.altherium_character_sheets s set
    mestre_backup      = jsonb_build_object(
                           'raiz', s.raiz,
                           'vitality_max', s.vitality_max, 'vitality_current', s.vitality_current,
                           'equilibrio_max', s.equilibrio_max, 'equilibrio_current', s.equilibrio_current,
                           'torre_current', s.torre_current),
    raiz               = 'mestre',
    vitality_max       = s.vitality_max * 2,
    vitality_current   = s.vitality_max * 2,
    equilibrio_max     = s.equilibrio_max * 2,
    equilibrio_current = s.equilibrio_max * 2,
    torre_current      = greatest(0, s.attr_estrategia * 5)
  where s.campaign_id = p_campaign
    and s.user_id = any(p_users)
    and s.raiz is distinct from 'mestre';
$$;
revoke all on function public.mestre_convert_sheets(uuid, uuid[]) from public, anon, authenticated;

-- Jogador aperta o botão. Se com ele todos os jogadores apertaram, a
-- campanha ascende (fichas viram Mestre, tema muda). Devolve quantos já
-- apertaram, quantos são, e se ascendeu.
create or replace function public.call_mestre(p_campaign uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_players uuid[];
  v_called  int;
begin
  if not exists (select 1 from public.site_features where key = 'raiz-mestre' and enabled) then
    raise exception 'A Raiz Mestre ainda não foi liberada.';
  end if;
  if not exists (select 1 from public.campaigns where id = p_campaign and system = 'altherium') then
    raise exception 'Só campanhas de Altherium.';
  end if;
  if not exists (
    select 1 from public.campaign_members
    where campaign_id = p_campaign and user_id = auth.uid() and role = 'player'
  ) then
    raise exception 'Só os jogadores da campanha.';
  end if;

  if exists (select 1 from public.altherium_mestre_ascensions where campaign_id = p_campaign) then
    return jsonb_build_object('called', 0, 'total', 0, 'ascended', true);
  end if;

  insert into public.altherium_mestre_calls (campaign_id, user_id)
  values (p_campaign, auth.uid())
  on conflict do nothing;

  select array_agg(user_id) into v_players
  from public.campaign_members
  where campaign_id = p_campaign and role = 'player';

  select count(*) into v_called
  from public.altherium_mestre_calls
  where campaign_id = p_campaign and user_id = any(v_players);

  if v_called < coalesce(array_length(v_players, 1), 0) then
    return jsonb_build_object('called', v_called, 'total', array_length(v_players, 1), 'ascended', false);
  end if;

  -- Todos apertaram: a campanha ascende (uma vez só).
  insert into public.altherium_mestre_ascensions (campaign_id) values (p_campaign)
  on conflict do nothing;
  perform public.mestre_convert_sheets(p_campaign, v_players);
  update public.profiles set mestre_at = coalesce(mestre_at, now()) where id = any(v_players);
  return jsonb_build_object('called', v_called, 'total', v_called, 'ascended', true);
end;
$$;
revoke all on function public.call_mestre(uuid) from public, anon;
grant execute on function public.call_mestre(uuid) to authenticated;

-- ── 5. Testes do dono do site (só nele) ─────────────────

create or replace function public.mestre_owner_test(p_campaign uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_site_owner() then
    raise exception 'Só o dono do site.';
  end if;
  perform public.mestre_convert_sheets(p_campaign, array[auth.uid()]);
  update public.profiles set mestre_at = coalesce(mestre_at, now()) where id = auth.uid();
end;
$$;
revoke all on function public.mestre_owner_test(uuid) from public, anon;
grant execute on function public.mestre_owner_test(uuid) to authenticated;

-- Volta o dono ao normal: fichas como eram, tema azul, botão de novo.
create or replace function public.mestre_owner_reset()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_site_owner() then
    raise exception 'Só o dono do site.';
  end if;
  update public.altherium_character_sheets s set
    raiz               = s.mestre_backup->>'raiz',
    vitality_max       = (s.mestre_backup->>'vitality_max')::int,
    vitality_current   = (s.mestre_backup->>'vitality_current')::int,
    equilibrio_max     = (s.mestre_backup->>'equilibrio_max')::int,
    equilibrio_current = (s.mestre_backup->>'equilibrio_current')::int,
    torre_current      = coalesce((s.mestre_backup->>'torre_current')::int, 0),
    mestre_backup      = null
  where s.user_id = auth.uid() and s.raiz = 'mestre' and s.mestre_backup is not null;
  update public.profiles set mestre_at = null where id = auth.uid();
  delete from public.altherium_mestre_calls where user_id = auth.uid();
end;
$$;
revoke all on function public.mestre_owner_reset() from public, anon;
grant execute on function public.mestre_owner_reset() to authenticated;

-- ── 6. Tempo real: o botão e a animação chegam pra todos juntos ──

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'altherium_mestre_calls') then
    alter publication supabase_realtime add table public.altherium_mestre_calls;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'altherium_mestre_ascensions') then
    alter publication supabase_realtime add table public.altherium_mestre_ascensions;
  end if;
end $$;
