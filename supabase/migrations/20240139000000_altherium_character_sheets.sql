-- ============================================================
-- Vorterium — Ficha Altherium (base)
-- Migration: 20240139000000_altherium_character_sheets.sql
-- Aplicar após: 20240138000000_campaign_initiative.sql
-- ============================================================
--
-- Sistema próprio de Altherium (Livro de regras básicas 1.0).
-- Esta é a BASE da ficha: identidade, atributos, recursos, domínios,
-- dinheiro e defesa por parte do corpo. Triunfos, catálogo de armas e
-- inventário ficam para migrations futuras.
--
-- Os MÁXIMOS de Vitalidade/Equilíbrio/FV/PR não são colunas: derivam de
-- raiz + d10 rolado na criação + atributo, calculados no cliente, para
-- acompanharem mudanças de atributo automaticamente. A tabela guarda
-- apenas o d10 rolado e o valor atual de cada recurso.


-- ── 1. Tabela altherium_character_sheets ──────────────────

create table public.altherium_character_sheets (
  id                 uuid        primary key default gen_random_uuid(),
  campaign_id        uuid        not null references public.campaigns(id) on delete cascade,
  user_id            uuid        not null references public.profiles(id) on delete cascade,

  -- Identidade
  character_name     text,
  level              integer     not null default 1 check (level between 1 and 5),
  raiz               text        check (raiz in ('berserker', 'runaskin', 'pilar')),
  genesis            text        check (genesis in (
                       'cacador', 'curandeiro', 'determinado', 'devoto',
                       'filho_de_mercante', 'guerreiro', 'guia_espiritual',
                       'corredor', 'peregrino', 'rastreador', 'robusto',
                       'sem_passado'
                     )),

  -- Atributos (16 pontos na criação, pares, máx 6 — validação de criação
  -- é orientativa no cliente; aqui só o teto absoluto do sistema)
  attr_furia         integer     not null default 0 check (attr_furia      between 0 and 6),
  attr_destino       integer     not null default 0 check (attr_destino    between 0 and 6),
  attr_espirito      integer     not null default 0 check (attr_espirito   between 0 and 6),
  attr_impulso       integer     not null default 0 check (attr_impulso    between 0 and 6),
  attr_estrategia    integer     not null default 0 check (attr_estrategia between 0 and 6),
  attr_runico        integer     not null default 0 check (attr_runico     between 0 and 6),

  -- Recursos: d10 rolado uma vez na criação + valor atual
  vitality_roll      integer     check (vitality_roll     between 1 and 10),
  vitality_current   integer     not null default 0 check (vitality_current   >= 0),
  equilibrio_roll    integer     check (equilibrio_roll   between 1 and 10),
  equilibrio_current integer     not null default 0 check (equilibrio_current >= 0),
  fv_roll            integer     check (fv_roll           between 1 and 10),
  fv_current         integer     not null default 0 check (fv_current         >= 0),
  pr_roll            integer     check (pr_roll           between 1 and 10),
  pr_current         integer     not null default 0 check (pr_current         >= 0),
  cards_current      integer     not null default 0 check (cards_current      >= 0),

  -- Hacksilvers: moeda de Altherium, ₴2000 na criação
  hacksilvers        integer     not null default 2000 check (hacksilvers >= 0),

  -- DB (dano bloqueado) por parte do corpo — Pernas 1-3, Braços 4-6,
  -- Tronco 7-9, Cabeça 10 no d10 de localização do golpe
  db_pernas          integer     not null default 0 check (db_pernas >= 0),
  db_bracos          integer     not null default 0 check (db_bracos >= 0),
  db_tronco          integer     not null default 0 check (db_tronco >= 0),
  db_cabeca          integer     not null default 0 check (db_cabeca >= 0),

  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  unique (campaign_id, user_id)
);

create trigger set_altherium_sheets_updated_at
  before update on public.altherium_character_sheets
  for each row execute function public.set_updated_at();

create index idx_altherium_sheets_campaign_id on public.altherium_character_sheets(campaign_id);
create index idx_altherium_sheets_user_id     on public.altherium_character_sheets(user_id);

alter table public.altherium_character_sheets enable row level security;

create policy "altherium_sheets: dono ou mestre pode ver"
  on public.altherium_character_sheets for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_campaign_master(campaign_id, auth.uid())
  );

create policy "altherium_sheets: membro cria propria ficha"
  on public.altherium_character_sheets for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_campaign_member(campaign_id, auth.uid())
  );

create policy "altherium_sheets: dono ou mestre pode atualizar"
  on public.altherium_character_sheets for update
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_campaign_master(campaign_id, auth.uid())
  )
  with check (
    user_id = auth.uid()
    or public.is_campaign_master(campaign_id, auth.uid())
  );

-- Sem policy de DELETE — ficha não é apagada pelo app.

-- Campos estruturais imutáveis, mesmo padrão das outras fichas
create or replace function public.prevent_altherium_sheet_structural_change()
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

create trigger enforce_altherium_sheet_immutable_fields
  before update on public.altherium_character_sheets
  for each row execute function public.prevent_altherium_sheet_structural_change();


-- ── 2. Tabela altherium_character_domains ─────────────────
--
-- Uma linha por domínio com pontos. Tabela separada (e não JSONB) porque
-- cada domínio é editado individualmente — mesmo critério das perícias
-- da ficha D&D.

create table public.altherium_character_domains (
  id       uuid    primary key default gen_random_uuid(),
  sheet_id uuid    not null references public.altherium_character_sheets(id) on delete cascade,
  domain   text    not null check (domain in (
             'brutalidade', 'crime', 'determinacao', 'direcao', 'esconder',
             'furtividade', 'iniciativa', 'intimidacao', 'investigacao',
             'leveza', 'luta', 'medicina', 'percepcao', 'persuasao',
             'precisao', 'pressentimento', 'reflexo', 'religiao',
             'resiliencia', 'runologia', 'saberes', 'sobrevivencia',
             'tatica', 'vontade'
           )),
  points   integer not null default 0 check (points between 0 and 2),

  unique (sheet_id, domain)
);

create index idx_altherium_domains_sheet_id on public.altherium_character_domains(sheet_id);

alter table public.altherium_character_domains enable row level security;

-- O acesso segue a ficha referenciada: dono ou mestre da campanha dela.

create policy "altherium_domains: dono ou mestre pode ver"
  on public.altherium_character_domains for select
  to authenticated
  using (
    exists (
      select 1 from public.altherium_character_sheets s
      where s.id = sheet_id
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );

create policy "altherium_domains: dono ou mestre pode inserir"
  on public.altherium_character_domains for insert
  to authenticated
  with check (
    exists (
      select 1 from public.altherium_character_sheets s
      where s.id = sheet_id
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );

create policy "altherium_domains: dono ou mestre pode atualizar"
  on public.altherium_character_domains for update
  to authenticated
  using (
    exists (
      select 1 from public.altherium_character_sheets s
      where s.id = sheet_id
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.altherium_character_sheets s
      where s.id = sheet_id
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );

create policy "altherium_domains: dono ou mestre pode remover"
  on public.altherium_character_domains for delete
  to authenticated
  using (
    exists (
      select 1 from public.altherium_character_sheets s
      where s.id = sheet_id
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );
