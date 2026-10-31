-- Altherium 2.0, Ofício e Integridade:
--   • cada item do inventário guarda a Integridade (0 a 100%), os Reforços
--     aplicados e, nos itens feitos com receita, os materiais usados (para
--     desmontar e devolver a metade);
--   • a ficha guarda os recursos (Ferro-velho, Couro... e as Rações) em
--     porcentagem por qualidade;
--   • a campanha guarda as Sagas de Ofício que o grupo já encontrou — uma Saga
--     destrava as receitas para todo o grupo, então qualquer membro pode marcar.

alter table public.altherium_character_inventory
  add column if not exists integrity      integer not null default 100 check (integrity between 0 and 100),
  add column if not exists reinforcements jsonb   not null default '[]'::jsonb,
  add column if not exists crafted        jsonb;

alter table public.altherium_character_sheets
  add column if not exists resources jsonb not null default '{}'::jsonb;

create table if not exists public.altherium_campaign_sagas (
  campaign_id uuid        primary key references public.campaigns(id) on delete cascade,
  sagas       text[]      not null default '{}',
  updated_at  timestamptz not null default now()
);

alter table public.altherium_campaign_sagas enable row level security;

create policy "altherium_sagas: membros veem"
  on public.altherium_campaign_sagas for select
  using (public.is_campaign_member(campaign_id, auth.uid()));

create policy "altherium_sagas: membros marcam"
  on public.altherium_campaign_sagas for insert
  with check (public.is_campaign_member(campaign_id, auth.uid()));

create policy "altherium_sagas: membros atualizam"
  on public.altherium_campaign_sagas for update
  using (public.is_campaign_member(campaign_id, auth.uid()))
  with check (public.is_campaign_member(campaign_id, auth.uid()));
