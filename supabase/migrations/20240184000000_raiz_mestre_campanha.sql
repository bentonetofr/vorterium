-- ════════════════════════════════════════════════════════
-- Raiz Mestre: o botão SE TORNAR UM MESTRE só na campanha escolhida.
--
-- Antes, com a Raiz Mestre "No site", o botão aparecia em TODAS as
-- campanhas de Altherium. Agora o dono do site escolhe UMA campanha (no
-- Painel de controle, com a página dela aberta) e o botão só aparece —
-- e só funciona — nela. Escolher outra campanha tira o botão da anterior
-- (quem já tinha apertado lá continua guardado, se ela voltar a ser a
-- escolhida).
--
-- A chave do Painel continua sendo o liga/desliga geral: desligada, o
-- botão some de todo lugar; ligada, aparece só na campanha escolhida.
-- ════════════════════════════════════════════════════════

-- ── 1. A campanha escolhida ─────────────────────────────
-- No máximo uma linha (a função que escolhe apaga as outras).

create table if not exists public.altherium_mestre_campaigns (
  campaign_id  uuid         primary key references public.campaigns(id) on delete cascade,
  chosen_at    timestamptz  not null default now()
);

alter table public.altherium_mestre_campaigns enable row level security;

-- Cada um só fica sabendo se a SUA campanha é a escolhida.
drop policy if exists "mestre_campaigns: membros veem" on public.altherium_mestre_campaigns;
create policy "mestre_campaigns: membros veem" on public.altherium_mestre_campaigns
  for select to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()) or public.is_site_owner());

revoke all on public.altherium_mestre_campaigns from anon, authenticated;
grant select on public.altherium_mestre_campaigns to authenticated;

-- Quem já estava no meio (Raiz Mestre ligada e gente que já apertou): a
-- campanha com o aperto mais recente vira a escolhida, pra não sumir o botão.
insert into public.altherium_mestre_campaigns (campaign_id)
select c.campaign_id
from public.altherium_mestre_calls c
where exists (select 1 from public.site_features where key = 'raiz-mestre' and enabled)
  and not exists (select 1 from public.altherium_mestre_ascensions a where a.campaign_id = c.campaign_id)
  and not exists (select 1 from public.altherium_mestre_campaigns)
order by c.created_at desc
limit 1
on conflict do nothing;

-- ── 2. O dono escolhe a campanha ────────────────────────

create or replace function public.mestre_choose_campaign(p_campaign uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if not public.is_site_owner() then
    raise exception 'Só o dono do site.';
  end if;
  select name into v_name from public.campaigns where id = p_campaign and system = 'altherium';
  if v_name is null then
    raise exception 'Só campanhas de Altherium.';
  end if;
  delete from public.altherium_mestre_campaigns where campaign_id <> p_campaign;
  insert into public.altherium_mestre_campaigns (campaign_id) values (p_campaign)
  on conflict do nothing;
  return v_name;
end;
$$;
revoke all on function public.mestre_choose_campaign(uuid) from public, anon;
grant execute on function public.mestre_choose_campaign(uuid) to authenticated;

-- Em qual campanha está (o nome, pro Painel). null = em nenhuma.
create or replace function public.mestre_chosen_campaign()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_site_owner() then
    raise exception 'Só o dono do site.';
  end if;
  return (select c.name from public.altherium_mestre_campaigns m join public.campaigns c on c.id = m.campaign_id limit 1);
end;
$$;
revoke all on function public.mestre_chosen_campaign() from public, anon;
grant execute on function public.mestre_chosen_campaign() to authenticated;

-- ── 3. O botão só vale na campanha escolhida ────────────
-- (igual à da migration 20240176, mais a conferência da campanha)

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
  if not exists (select 1 from public.altherium_mestre_campaigns where campaign_id = p_campaign) then
    raise exception 'A Raiz Mestre não está liberada nesta campanha.';
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

-- ── 4. Tempo real: o botão aparece/some na hora ─────────

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'altherium_mestre_campaigns') then
    alter publication supabase_realtime add table public.altherium_mestre_campaigns;
  end if;
end $$;
