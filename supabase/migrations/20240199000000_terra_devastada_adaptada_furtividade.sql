-- ============================================================
-- Vorterium — Terra Devastada Adaptada: furtividade (Alerta da cena)
-- Migration: 20240199000000_terra_devastada_adaptada_furtividade.sql
-- Aplicar após: 20240198000000_terra_devastada_adaptada_suprimentos.sql
-- ============================================================
--
-- tda_scene: uma linha por campanha com o estado de furtividade da cena.
--   alert     0 Oculto, 1 Suspeito, 2 Alertado, 3 Caçado
--   attention 1 a 6: a Atenção do lugar, a meta pra não ser notado
-- Todos da campanha leem (pra mostrar o Alerta na ficha); só o mestre mexe.

create table if not exists public.tda_scene (
  campaign_id  uuid        primary key references public.campaigns(id) on delete cascade,
  alert        integer     not null default 0 check (alert between 0 and 3),
  attention    integer     not null default 2 check (attention between 1 and 6),
  updated_at   timestamptz not null default now()
);

drop trigger if exists set_tda_scene_updated_at on public.tda_scene;
create trigger set_tda_scene_updated_at
  before update on public.tda_scene
  for each row execute function public.set_updated_at();

alter table public.tda_scene enable row level security;

drop policy if exists "tda_scene: membro ve" on public.tda_scene;
create policy "tda_scene: membro ve" on public.tda_scene
  for select to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()));

drop policy if exists "tda_scene: mestre cria" on public.tda_scene;
create policy "tda_scene: mestre cria" on public.tda_scene
  for insert to authenticated
  with check (public.is_campaign_master(campaign_id, auth.uid()));

drop policy if exists "tda_scene: mestre altera" on public.tda_scene;
create policy "tda_scene: mestre altera" on public.tda_scene
  for update to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()))
  with check (public.is_campaign_master(campaign_id, auth.uid()));

grant select, insert, update on public.tda_scene to authenticated;

-- Painel do desenvolvedor lê tudo (como nas outras tabelas, 20240161).
drop policy if exists "dev: le tudo" on public.tda_scene;
create policy "dev: le tudo" on public.tda_scene
  for select to authenticated using (public.is_developer());

-- Tempo real: o Alerta muda na ficha de todo mundo na hora.
do $$
begin
  alter publication supabase_realtime add table public.tda_scene;
exception when others then
  null;
end;
$$;
