-- ============================================================
-- Vorterium — Documentos da Mesa (cartas e livros)
-- Migration: 20240174000000_mesa_documents.sql
-- Aplicar após: 20240173000000_mesa_arts_and_references.sql
-- ============================================================
--
-- Na aba Mesa, o mestre escreve documentos com cara de antigos: uma folha
-- (carta, bilhete, édito) ou um livro de várias páginas. Cada documento tem
-- um estilo (textura do papel, efeitos, fonte manuscrita, cor da tinta) e
-- as páginas (texto + estilo próprio opcional). Tudo em jsonb, validado no
-- site; aqui só o formato e o tamanho.
--
-- Só o mestre cria, edita e apaga. O documento nasce escondido: os
-- jogadores só leem quando o mestre libera (visible = true) — e ele também
-- pode pôr o documento na transmissão da Mesa.

create table if not exists public.campaign_mesa_documents (
  id           uuid         primary key default gen_random_uuid(),
  campaign_id  uuid         not null references public.campaigns(id) on delete cascade,
  kind         text         not null default 'paper',
  title        text         not null default 'Documento',
  style        jsonb        not null default '{}'::jsonb,
  pages        jsonb        not null default '[]'::jsonb,
  visible      boolean      not null default false,
  created_by   uuid         references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now(),

  constraint campaign_mesa_documents_kind check (kind in ('paper', 'book')),
  constraint campaign_mesa_documents_title check (char_length(btrim(title)) between 1 and 120),
  constraint campaign_mesa_documents_style check (jsonb_typeof(style) = 'object' and pg_column_size(style) <= 8192),
  constraint campaign_mesa_documents_pages check (
    jsonb_typeof(pages) = 'array' and jsonb_array_length(pages) <= 200 and pg_column_size(pages) <= 400000
  )
);

create index if not exists idx_campaign_mesa_documents_campaign on public.campaign_mesa_documents(campaign_id, created_at);

-- Campanha e criação não mudam; atualizado_em acompanha.
create or replace function public.campaign_mesa_documents_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    new.campaign_id := old.campaign_id;
    new.created_by  := old.created_by;
    new.created_at  := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists campaign_mesa_documents_guard on public.campaign_mesa_documents;
create trigger campaign_mesa_documents_guard
  before insert or update on public.campaign_mesa_documents
  for each row execute function public.campaign_mesa_documents_guard();

alter table public.campaign_mesa_documents enable row level security;

drop policy if exists "mesa_documents: mestre vê tudo, jogador o liberado" on public.campaign_mesa_documents;
create policy "mesa_documents: mestre vê tudo, jogador o liberado"
  on public.campaign_mesa_documents for select
  to authenticated
  using (
    public.is_campaign_master(campaign_id, auth.uid())
    or (visible and public.is_campaign_member(campaign_id, auth.uid()))
  );

drop policy if exists "mesa_documents: mestre cria" on public.campaign_mesa_documents;
create policy "mesa_documents: mestre cria"
  on public.campaign_mesa_documents for insert
  to authenticated
  with check (public.is_campaign_master(campaign_id, auth.uid()));

drop policy if exists "mesa_documents: mestre edita" on public.campaign_mesa_documents;
create policy "mesa_documents: mestre edita"
  on public.campaign_mesa_documents for update
  to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()))
  with check (public.is_campaign_master(campaign_id, auth.uid()));

drop policy if exists "mesa_documents: mestre apaga" on public.campaign_mesa_documents;
create policy "mesa_documents: mestre apaga"
  on public.campaign_mesa_documents for delete
  to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()));

-- Tempo real: o documento liberado (ou editado) chega na hora pros jogadores.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'campaign_mesa_documents'
  ) then
    alter publication supabase_realtime add table public.campaign_mesa_documents;
  end if;
end $$;
