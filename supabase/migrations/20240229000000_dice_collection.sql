-- ============================================================
-- Vorterium — Coleção de dados (skins ganhas por conquistas)
-- Migration: 20240229000000_dice_collection.sql
-- Aplicar após: 20240228000000_altherium_armor_parts.sql
-- ============================================================
--
-- Cada conta tem a sua coleção de conjuntos de dados, valendo em todas as
-- campanhas. Os 20 conjuntos da coleção (ids abaixo, os mesmos de skins.ts) só
-- podem ser escolhidos, e usados numa rolagem, por quem os ganhou; os três
-- iniciais (madeira, granito e plástico) e o exclusivo dos betas seguem como
-- eram. As regras das conquistas (secretas) ficam no site: ele confere as
-- rolagens gravadas e chama unlock_dice_skin quando uma conquista se cumpre.
-- ============================================================

create table if not exists public.dice_skin_unlocks (
  user_id        uuid        not null references auth.users(id) on delete cascade,
  skin_id        text        not null check (skin_id ~ '^[a-z0-9_-]{1,32}$'),
  achievement_id text        not null,
  unlocked_at    timestamptz not null default now(),
  primary key (user_id, skin_id)
);

alter table public.dice_skin_unlocks enable row level security;

-- Cada um lê só a própria coleção; ninguém grava direto (só pela função abaixo).
drop policy if exists dice_skin_unlocks_select_own on public.dice_skin_unlocks;
create policy dice_skin_unlocks_select_own on public.dice_skin_unlocks
  for select using (user_id = auth.uid());


-- Os conjuntos da coleção (a lista de skins.ts com tier).
create or replace function public.dice_collection_skins()
returns text[] as $$
  select array[
    'osso', 'ferro', 'argila', 'giz', 'cobre',
    'marfim', 'onix', 'ametista', 'granada', 'jade', 'fume',
    'gelo', 'magma', 'meteorito', 'fungo', 'ambar',
    'morte', 'vagalumes', 'runico',
    'vortice'
  ]::text[];
$$ language sql immutable;


-- Concede um conjunto à conta logada (true = é novo, false = já era dela).
create or replace function public.unlock_dice_skin(p_skin text, p_achievement text)
returns boolean as $$
declare
  n integer;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;
  if not (p_skin = any (public.dice_collection_skins())) then
    raise exception 'Conjunto de dados desconhecido.';
  end if;
  insert into public.dice_skin_unlocks (user_id, skin_id, achievement_id)
  values (auth.uid(), p_skin, left(coalesce(p_achievement, ''), 40))
  on conflict do nothing;
  get diagnostics n = row_count;
  return n > 0;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.unlock_dice_skin(text, text) from public;
grant execute on function public.unlock_dice_skin(text, text) to authenticated;


-- Só quem ganhou o conjunto escolhe (no perfil) ou rola com ele (na rolagem).
-- Sem login (SQL Editor, serviço) passa: é o dono do site mexendo.
create or replace function public.dice_collection_guard()
returns trigger as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or new.dice_skin is null or not (new.dice_skin = any (public.dice_collection_skins())) then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.dice_skin is not distinct from new.dice_skin then
    return new;
  end if;
  if not exists (select 1 from public.dice_skin_unlocks where user_id = uid and skin_id = new.dice_skin) then
    raise exception 'Este conjunto de dados ainda não foi conquistado.';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists profiles_dice_collection_guard on public.profiles;
create trigger profiles_dice_collection_guard
  before update of dice_skin on public.profiles
  for each row execute function public.dice_collection_guard();

drop trigger if exists dice_rolls_dice_collection_guard on public.dice_rolls;
create trigger dice_rolls_dice_collection_guard
  before insert on public.dice_rolls
  for each row execute function public.dice_collection_guard();
