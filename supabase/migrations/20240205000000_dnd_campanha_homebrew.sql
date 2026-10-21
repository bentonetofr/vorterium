-- ============================================================
-- Vorterium — D&D 5e: configuração da campanha, homebrew e rótulo de rolagem (Marco 2, parte 3)
-- Migration: 20240205000000_dnd_campanha_homebrew.sql
-- Aplicar após: 20240204000000_dnd_classes_recursos.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
-- ============================================================
--
-- 1. dnd_campaign_settings: configuração de D&D de cada campanha. Hoje só o
--    modo de PV por nível (média ou rolagem), que o mestre escolhe e vale
--    pro criador de personagem e pra subida de nível.
-- 2. dnd_homebrew_entries: conteúdo próprio da campanha (itens, magias,
--    talentos, raças, classes...). Mestre E jogadores criam:
--       personal  só o autor vê e usa (na ficha dele);
--       pending   o autor propôs à campanha, o mestre decide;
--       approved  o mestre aprovou: todos da campanha veem e usam.
--    O mestre cria direto como aprovado. Só o mestre aprova, recusa
--    (volta pra personal, com um recado) e mexe no que já foi aprovado.
-- 3. dice_rolls.roll_label: o motivo da rolagem ("Furtividade", "Ataque com
--    espada longa"), que o chat e o histórico mostram.
-- Tudo guardado: só o dono do site enquanto o recurso "dnd5e" estiver
-- guardado no Painel de controle (dnd_open(), de 20240203000000).
-- ============================================================


-- ── 1. Configuração da campanha ─────────────────────────

create table if not exists public.dnd_campaign_settings (
  campaign_id uuid        primary key references public.campaigns(id) on delete cascade,
  hp_mode     text        not null default 'average' check (hp_mode in ('average', 'rolled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- só campanhas de D&D 5e têm configuração de D&D
create or replace function public.dnd_settings_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.campaigns where id = new.campaign_id and system = 'dnd5e') then
      raise exception 'A configuração de D&D só existe em campanha de D&D 5e.';
    end if;
  elsif new.campaign_id <> old.campaign_id then
    raise exception 'O campo campaign_id não pode ser alterado.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists dnd_settings_guard on public.dnd_campaign_settings;
create trigger dnd_settings_guard
  before insert or update on public.dnd_campaign_settings
  for each row execute function public.dnd_settings_guard();

alter table public.dnd_campaign_settings enable row level security;

drop policy if exists "dnd_settings: membros leem" on public.dnd_campaign_settings;
create policy "dnd_settings: membros leem" on public.dnd_campaign_settings
  for select to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()) or public.is_campaign_master(campaign_id, auth.uid()));

drop policy if exists "dnd_settings: so o mestre cria" on public.dnd_campaign_settings;
create policy "dnd_settings: so o mestre cria" on public.dnd_campaign_settings
  for insert to authenticated
  with check (public.is_campaign_master(campaign_id, auth.uid()));

drop policy if exists "dnd_settings: so o mestre altera" on public.dnd_campaign_settings;
create policy "dnd_settings: so o mestre altera" on public.dnd_campaign_settings
  for update to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()))
  with check (public.is_campaign_master(campaign_id, auth.uid()));

drop policy if exists "dnd: so quando liberado" on public.dnd_campaign_settings;
create policy "dnd: so quando liberado" on public.dnd_campaign_settings
  as restrictive for all to authenticated
  using (public.dnd_open()) with check (public.dnd_open());


-- ── 2. Homebrew ─────────────────────────────────────────

create table if not exists public.dnd_homebrew_entries (
  id          uuid        primary key default gen_random_uuid(),
  campaign_id uuid        not null references public.campaigns(id) on delete cascade,
  created_by  uuid        references public.profiles(id) on delete set null default auth.uid(),
  category    text        not null check (category in (
    'race', 'subrace', 'class', 'subclass', 'background', 'feat',
    'weapon', 'armor', 'item', 'tool', 'spell', 'condition'
  )),
  entry_key   text        not null check (entry_key ~ '^[a-z0-9_]{2,60}$'),
  name        text        not null check (char_length(trim(name)) between 1 and 120),
  data        jsonb       not null default '{}'::jsonb
                          check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 32768),
  status      text        not null default 'personal' check (status in ('personal', 'pending', 'approved')),
  review_note text        check (review_note is null or char_length(review_note) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (campaign_id, category, entry_key)
);

create index if not exists dnd_homebrew_campaign_status_idx
  on public.dnd_homebrew_entries (campaign_id, status);
create index if not exists dnd_homebrew_author_idx
  on public.dnd_homebrew_entries (created_by);

-- Regras do fluxo (o banco confere, não só a tela).
create or replace function public.dnd_homebrew_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_master boolean := public.is_campaign_master(new.campaign_id, auth.uid());
  v_count  integer;
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.campaigns where id = new.campaign_id and system = 'dnd5e') then
      raise exception 'Homebrew de D&D só existe em campanha de D&D 5e.';
    end if;
    new.created_by := auth.uid();
    if not v_master then
      if new.status = 'approved' then
        raise exception 'Só o mestre aprova homebrew.';
      end if;
      new.review_note := null;
      select count(*) into v_count from public.dnd_homebrew_entries
        where campaign_id = new.campaign_id and created_by = auth.uid();
      if v_count >= 300 then
        raise exception 'Limite de 300 itens de homebrew por pessoa na campanha.';
      end if;
    end if;
  else
    if new.campaign_id <> old.campaign_id
       or new.created_by is distinct from old.created_by
       or new.category <> old.category
       or new.entry_key <> old.entry_key then
      raise exception 'Campanha, autor, categoria e chave do homebrew não mudam.';
    end if;
    if not v_master then
      if old.status = 'approved' then
        raise exception 'Só o mestre altera um homebrew já aprovado.';
      end if;
      if new.status = 'approved' then
        raise exception 'Só o mestre aprova homebrew.';
      end if;
      new.review_note := old.review_note;   -- o recado é do mestre
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
revoke all on function public.dnd_homebrew_guard() from public, anon, authenticated;

drop trigger if exists dnd_homebrew_guard on public.dnd_homebrew_entries;
create trigger dnd_homebrew_guard
  before insert or update on public.dnd_homebrew_entries
  for each row execute function public.dnd_homebrew_guard();

alter table public.dnd_homebrew_entries enable row level security;

-- Ver: o mestre vê tudo; cada um vê o que criou; todos da campanha veem o aprovado.
drop policy if exists "dnd_homebrew: select" on public.dnd_homebrew_entries;
create policy "dnd_homebrew: select" on public.dnd_homebrew_entries
  for select to authenticated
  using (
    public.is_campaign_master(campaign_id, auth.uid())
    or (created_by = auth.uid() and public.is_campaign_member(campaign_id, auth.uid()))
    or (status = 'approved' and public.is_campaign_member(campaign_id, auth.uid()))
  );

-- Criar: qualquer membro (o gatilho impõe as regras de status).
drop policy if exists "dnd_homebrew: insert" on public.dnd_homebrew_entries;
create policy "dnd_homebrew: insert" on public.dnd_homebrew_entries
  for insert to authenticated
  with check (public.is_campaign_member(campaign_id, auth.uid()) or public.is_campaign_master(campaign_id, auth.uid()));

-- Alterar e apagar: o mestre em tudo; o autor só no que ainda não foi aprovado.
drop policy if exists "dnd_homebrew: update" on public.dnd_homebrew_entries;
create policy "dnd_homebrew: update" on public.dnd_homebrew_entries
  for update to authenticated
  using (
    public.is_campaign_master(campaign_id, auth.uid())
    or (created_by = auth.uid() and status <> 'approved' and public.is_campaign_member(campaign_id, auth.uid()))
  )
  with check (
    public.is_campaign_master(campaign_id, auth.uid())
    or (created_by = auth.uid() and status <> 'approved' and public.is_campaign_member(campaign_id, auth.uid()))
  );

drop policy if exists "dnd_homebrew: delete" on public.dnd_homebrew_entries;
create policy "dnd_homebrew: delete" on public.dnd_homebrew_entries
  for delete to authenticated
  using (
    public.is_campaign_master(campaign_id, auth.uid())
    or (created_by = auth.uid() and status <> 'approved' and public.is_campaign_member(campaign_id, auth.uid()))
  );

drop policy if exists "dnd: so quando liberado" on public.dnd_homebrew_entries;
create policy "dnd: so quando liberado" on public.dnd_homebrew_entries
  as restrictive for all to authenticated
  using (public.dnd_open()) with check (public.dnd_open());


-- ── 3. Rótulo da rolagem ────────────────────────────────

alter table public.dice_rolls
  add column if not exists roll_label text;

alter table public.dice_rolls drop constraint if exists dice_rolls_roll_label_length;
alter table public.dice_rolls add constraint dice_rolls_roll_label_length
  check (roll_label is null or char_length(roll_label) <= 80);
