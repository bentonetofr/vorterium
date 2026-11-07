-- ============================================================
-- Vorterium — Biblioteca de NPCs do Vortable
-- Migration: 20240227000000_vortable_npc_library.sql
-- Aplicar após: 20240226000000_altherium_companion.sql
-- ============================================================
--
-- O mestre importa personagens (arquivos do criador de personagens) ou guarda os
-- que o gerador sorteou, e eles ficam na CONTA dele: valem em todas as campanhas e
-- em qualquer navegador, prontos pra colocar na cena sem importar de novo.
-- Só o dono vê e mexe nos seus.

create table if not exists public.vortable_npc_library (
  id         uuid        primary key default gen_random_uuid(),
  owner_id   uuid        not null default auth.uid() references public.profiles(id) on delete cascade,
  name       text        not null check (char_length(name) between 1 and 60),
  role       text        not null default '' check (char_length(role) <= 120),
  gear       text        not null default '' check (char_length(gear) <= 120),
  appearance jsonb       not null check (pg_column_size(appearance) <= 60000),
  created_at timestamptz not null default now()
);

create index if not exists vortable_npc_library_owner_idx on public.vortable_npc_library (owner_id, created_at desc);

alter table public.vortable_npc_library enable row level security;

drop policy if exists "npc_library: dono le" on public.vortable_npc_library;
create policy "npc_library: dono le"
  on public.vortable_npc_library for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "npc_library: dono cria" on public.vortable_npc_library;
create policy "npc_library: dono cria"
  on public.vortable_npc_library for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "npc_library: dono muda" on public.vortable_npc_library;
create policy "npc_library: dono muda"
  on public.vortable_npc_library for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "npc_library: dono apaga" on public.vortable_npc_library;
create policy "npc_library: dono apaga"
  on public.vortable_npc_library for delete to authenticated
  using (owner_id = auth.uid());
