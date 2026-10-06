-- ============================================================
-- Vorterium — Vampiro: A Máscara (5ª edição), a base da ficha
-- Migration: 20240187000000_vampiro_base.sql
-- Aplicar após: 20240186000000_raiz_mestre_recusa.sql
-- ============================================================
--
-- O sistema novo nas campanhas ('vampiro') e a ficha dele:
--   • identidade (nome, conceito, crônica, senhor, ambição, desejo, clã,
--     geração, tipo de predador);
--   • os 9 atributos (1 a 5) e as 27 perícias (0 a 5, num jsonb chave →
--     pontos) com especializações;
--   • Vitalidade e Força de Vontade: o MÁXIMO não é coluna (sai dos
--     atributos, calculado no site, mais um ajuste manual); a tabela guarda
--     só o dano superficial e o agravado de cada uma;
--   • Fome, Humanidade (com manchas) e Potência de Sangue;
--   • retrato (bucket vtm-portraits, como o de Altherium).
--
-- Nasce GUARDADO: só dá pra criar campanha de Vampiro com o recurso
-- 'vampiro' ligado no Painel de controle (ou sendo o dono do site).
-- ============================================================

-- ── 1. Sistema permitido nas campanhas ────────────────────

alter table public.campaigns
  drop constraint if exists campaigns_system_valid;

alter table public.campaigns
  add constraint campaigns_system_valid
    check (system in ('generic', 'dnd5e', 'altherium', 'terra_devastada', 'vampiro'));

-- Mesma função de 20240157000000, com o sistema novo (guardado).
create or replace function public.create_campaign(
  campaign_name        text,
  campaign_system      text default 'generic',
  campaign_description text default null
)
returns public.campaigns as $$
declare
  v_campaign public.campaigns;
  v_user_id  uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if trim(campaign_name) = '' then
    raise exception 'O nome da campanha não pode ser vazio.';
  end if;

  if char_length(trim(campaign_name)) > 120 then
    raise exception 'O nome da campanha deve ter no máximo 120 caracteres.';
  end if;

  if campaign_system not in ('generic', 'dnd5e', 'altherium', 'terra_devastada', 'vampiro') then
    raise exception 'Sistema inválido: %', campaign_system;
  end if;

  -- Vampiro ainda guardado: só com o recurso ligado (ou o dono do site, testando).
  if campaign_system = 'vampiro'
     and not exists (select 1 from public.site_features where key = 'vampiro' and enabled)
     and not public.is_site_owner() then
    raise exception 'Vampiro: A Máscara ainda não está liberado.';
  end if;

  if campaign_description is not null
     and char_length(campaign_description) > 1000 then
    raise exception 'A descrição deve ter no máximo 1000 caracteres.';
  end if;

  insert into public.campaigns (name, system, master_id, description, status)
  values (
    trim(campaign_name),
    campaign_system,
    v_user_id,
    nullif(trim(coalesce(campaign_description, '')), ''),
    'active'
  )
  returning * into v_campaign;

  insert into public.campaign_members (campaign_id, user_id, role)
  values (v_campaign.id, v_user_id, 'master');

  return v_campaign;
end;
$$ language plpgsql security definer set search_path = public;


-- ── 2. Ficha de Vampiro ───────────────────────────────────

create table if not exists public.vtm_character_sheets (
  id               uuid        primary key default gen_random_uuid(),
  campaign_id      uuid        not null references public.campaigns(id) on delete cascade,
  user_id          uuid        not null references public.profiles(id) on delete cascade,

  -- Identidade
  character_name   text        check (character_name is null or char_length(character_name) <= 80),
  concept          text        check (concept        is null or char_length(concept)        <= 160),
  chronicle        text        check (chronicle      is null or char_length(chronicle)      <= 120),
  sire             text        check (sire           is null or char_length(sire)           <= 80),
  ambition         text        check (ambition       is null or char_length(ambition)       <= 300),
  desire           text        check (desire         is null or char_length(desire)         <= 300),
  clan             text        check (clan           is null or char_length(clan)           <= 40),
  predator_type    text        check (predator_type  is null or char_length(predator_type)  <= 40),
  generation       integer     not null default 13 check (generation between 4 and 16),
  portrait_url     text        check (portrait_url   is null or char_length(portrait_url)   <= 2048),

  -- Atributos (1 a 5)
  attr_strength     integer not null default 1 check (attr_strength     between 1 and 5),
  attr_dexterity    integer not null default 1 check (attr_dexterity    between 1 and 5),
  attr_stamina      integer not null default 1 check (attr_stamina      between 1 and 5),
  attr_charisma     integer not null default 1 check (attr_charisma     between 1 and 5),
  attr_manipulation integer not null default 1 check (attr_manipulation between 1 and 5),
  attr_composure    integer not null default 1 check (attr_composure    between 1 and 5),
  attr_intelligence integer not null default 1 check (attr_intelligence between 1 and 5),
  attr_wits         integer not null default 1 check (attr_wits         between 1 and 5),
  attr_resolve      integer not null default 1 check (attr_resolve      between 1 and 5),

  -- Perícias: { "athletics": 2, ... } (0 a 5; ausente = 0) e especializações
  skills           jsonb       not null default '{}'::jsonb,
  specialties      jsonb       not null default '[]'::jsonb,

  -- Vitalidade e Força de Vontade: o dano marcado (o máximo é calculado)
  health_superficial    integer not null default 0 check (health_superficial    between 0 and 30),
  health_aggravated     integer not null default 0 check (health_aggravated     between 0 and 30),
  health_bonus          integer not null default 0 check (health_bonus          between -5 and 10),
  willpower_superficial integer not null default 0 check (willpower_superficial between 0 and 30),
  willpower_aggravated  integer not null default 0 check (willpower_aggravated  between 0 and 30),
  willpower_bonus       integer not null default 0 check (willpower_bonus       between -5 and 10),

  -- Sangue e Besta
  hunger           integer     not null default 1 check (hunger         between 0 and 5),
  humanity         integer     not null default 7 check (humanity       between 0 and 10),
  stains           integer     not null default 0 check (stains         between 0 and 10),
  blood_potency    integer     not null default 1 check (blood_potency  between 0 and 10),

  -- Texto livre
  history          text        check (history is null or char_length(history) <= 6000),
  notes            text        check (notes   is null or char_length(notes)   <= 4000),

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (campaign_id, user_id),

  constraint vtm_skills_object      check (jsonb_typeof(skills) = 'object'),
  constraint vtm_specialties_array  check (jsonb_typeof(specialties) = 'array' and jsonb_array_length(specialties) <= 60),
  constraint vtm_lists_size         check (pg_column_size(skills) + pg_column_size(specialties) <= 40000)
);

drop trigger if exists set_vtm_sheets_updated_at on public.vtm_character_sheets;
create trigger set_vtm_sheets_updated_at
  before update on public.vtm_character_sheets
  for each row execute function public.set_updated_at();

create index if not exists idx_vtm_sheets_campaign_id on public.vtm_character_sheets(campaign_id);
create index if not exists idx_vtm_sheets_user_id     on public.vtm_character_sheets(user_id);

alter table public.vtm_character_sheets enable row level security;

drop policy if exists "vtm_sheets: dono ou mestre pode ver" on public.vtm_character_sheets;
create policy "vtm_sheets: dono ou mestre pode ver"
  on public.vtm_character_sheets for select
  to authenticated
  using (user_id = auth.uid() or public.is_campaign_master(campaign_id, auth.uid()));

-- Só cria ficha de Vampiro em campanha de Vampiro (e sendo membro dela).
drop policy if exists "vtm_sheets: membro cria propria ficha" on public.vtm_character_sheets;
create policy "vtm_sheets: membro cria propria ficha"
  on public.vtm_character_sheets for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_campaign_member(campaign_id, auth.uid())
    and exists (select 1 from public.campaigns c where c.id = campaign_id and c.system = 'vampiro')
  );

drop policy if exists "vtm_sheets: dono ou mestre pode atualizar" on public.vtm_character_sheets;
create policy "vtm_sheets: dono ou mestre pode atualizar"
  on public.vtm_character_sheets for update
  to authenticated
  using (user_id = auth.uid() or public.is_campaign_master(campaign_id, auth.uid()))
  with check (user_id = auth.uid() or public.is_campaign_master(campaign_id, auth.uid()));

-- Sem policy de DELETE — ficha não é apagada pelo app.

-- Painel do desenvolvedor lê tudo (como nas outras tabelas, 20240161).
drop policy if exists "dev: le tudo" on public.vtm_character_sheets;
create policy "dev: le tudo" on public.vtm_character_sheets for select to authenticated using (public.is_developer());

-- Campanha e dono não mudam depois de criada.
create or replace function public.prevent_vtm_sheet_structural_change()
returns trigger as $$
begin
  if new.campaign_id <> old.campaign_id then
    raise exception 'Não é permitido alterar campaign_id de uma ficha após criação.';
  end if;
  if new.user_id <> old.user_id then
    raise exception 'Não é permitido alterar user_id de uma ficha após criação.';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists enforce_vtm_sheet_immutable_fields on public.vtm_character_sheets;
create trigger enforce_vtm_sheet_immutable_fields
  before update on public.vtm_character_sheets
  for each row execute function public.prevent_vtm_sheet_structural_change();

-- Tempo real: os cards do mestre acompanham a ficha.
do $$
begin
  alter publication supabase_realtime add table public.vtm_character_sheets;
exception when others then null;
end $$;


-- ── 3. Retrato (bucket vtm-portraits) ─────────────────────
-- O caminho é "<id da ficha>/portrait"; quem pode é o dono da ficha ou o
-- mestre da campanha (igual ao de Altherium, 20240141000000).

insert into storage.buckets (id, name, public)
values ('vtm-portraits', 'vtm-portraits', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "vtm-portraits: dono ou mestre pode visualizar" on storage.objects;
create policy "vtm-portraits: dono ou mestre pode visualizar"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'vtm-portraits'
    and exists (
      select 1 from public.vtm_character_sheets s
      where s.id::text = split_part(name, '/', 1)
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );

drop policy if exists "vtm-portraits: dono ou mestre pode enviar" on storage.objects;
create policy "vtm-portraits: dono ou mestre pode enviar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'vtm-portraits'
    and exists (
      select 1 from public.vtm_character_sheets s
      where s.id::text = split_part(name, '/', 1)
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );

drop policy if exists "vtm-portraits: dono ou mestre pode atualizar" on storage.objects;
create policy "vtm-portraits: dono ou mestre pode atualizar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'vtm-portraits'
    and exists (
      select 1 from public.vtm_character_sheets s
      where s.id::text = split_part(name, '/', 1)
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  )
  with check (
    bucket_id = 'vtm-portraits'
    and exists (
      select 1 from public.vtm_character_sheets s
      where s.id::text = split_part(name, '/', 1)
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );

drop policy if exists "vtm-portraits: dono ou mestre pode remover" on storage.objects;
create policy "vtm-portraits: dono ou mestre pode remover"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'vtm-portraits'
    and exists (
      select 1 from public.vtm_character_sheets s
      where s.id::text = split_part(name, '/', 1)
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );


-- ── 4. Painel do desenvolvedor: conta as fichas novas ─────
-- (igual à de 20240161000000, com a tabela de Vampiro na soma)

create or replace function public.dev_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_developer() then
    raise exception 'Acesso restrito ao desenvolvedor.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'users',          (select count(*) from public.profiles),
    'users_7d',       (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'active_24h',     (select count(distinct user_id) from public.campaign_presence where last_seen_at > now() - interval '24 hours'),
    'online_now',     (select count(distinct user_id) from public.campaign_presence where last_seen_at > now() - interval '3 minutes'),
    'campaigns',      (select count(*) from public.campaigns),
    'campaigns_by_system', (
      select coalesce(jsonb_object_agg(system, n), '{}'::jsonb)
      from (select system, count(*) as n from public.campaigns group by system) s
    ),
    'sheets',         (select count(*) from public.character_sheets)
                    + (select count(*) from public.altherium_character_sheets)
                    + (select count(*) from public.td_character_sheets)
                    + (select count(*) from public.vtm_character_sheets),
    'messages',       (select count(*) from public.campaign_messages),
    'messages_24h',   (select count(*) from public.campaign_messages where created_at > now() - interval '24 hours'),
    'rolls',          (select count(*) from public.dice_rolls),
    'rolls_24h',      (select count(*) from public.dice_rolls where created_at > now() - interval '24 hours'),
    'documents',      (select count(*) from public.campaign_documents),
    'feedback_new',   (select count(*) from public.site_feedback where status = 'novo')
  );
end;
$$;

revoke all on function public.dev_overview() from public;
grant execute on function public.dev_overview() to authenticated;
