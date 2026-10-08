-- ============================================================
-- Vorterium — Vortable: vários mundos por campanha
-- Migration: 20240194000000_vortable_mundos.sql
-- Aplicar após: 20240193000000_vortable_controle.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
-- ============================================================
--
-- Até aqui a campanha tinha um mundo só. Agora o mestre tem vários mundos
-- (cada um é um conjunto de zonas) e escolhe qual abrir: os jogadores são
-- colocados no mundo aberto (active). A policy de cada tabela continua a
-- mesma: membro lê, só o mestre mexe nos mundos e nas zonas.
-- ============================================================

-- ── Mundos: uma linha por mundo ────────────────────────────

alter table public.vortable_worlds add column if not exists id text;
alter table public.vortable_worlds add column if not exists name text not null default 'Mundo';
alter table public.vortable_worlds add column if not exists active boolean not null default false;

-- o mundo que já existia mantém o id que estava dentro dos dados
update public.vortable_worlds
   set id   = coalesce(nullif(data->>'id', ''), 'mundo-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
       name = coalesce(nullif(data->>'name', ''), 'Mundo principal'),
       active = true
 where id is null;

alter table public.vortable_worlds alter column id set not null;

alter table public.vortable_worlds drop constraint if exists vortable_worlds_pkey;
alter table public.vortable_worlds add primary key (campaign_id, id);

alter table public.vortable_worlds drop constraint if exists vortable_world_name_length;
alter table public.vortable_worlds add constraint vortable_world_name_length check (char_length(name) <= 80);

-- um mundo aberto por campanha
create unique index if not exists vortable_worlds_one_active
  on public.vortable_worlds (campaign_id) where active;


-- ── Zonas: a que mundo cada uma pertence ───────────────────

alter table public.vortable_zones add column if not exists world_id text;

update public.vortable_zones z
   set world_id = w.id
  from public.vortable_worlds w
 where w.campaign_id = z.campaign_id
   and z.world_id is null;

create index if not exists vortable_zones_world on public.vortable_zones (campaign_id, world_id);


-- ── Tempo real: os jogadores acompanham qual mundo está aberto ──

do $$
begin
  alter publication supabase_realtime add table public.vortable_worlds;
exception when others then
  null;
end;
$$;
