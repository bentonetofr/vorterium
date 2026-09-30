-- ============================================================
-- Vorterium — Quadro da campanha (quadro infinito, estilo Miro)
-- Migration: 20240164000000_campaign_board.sql
-- Aplicar após: 20240163000000_player_notebook.sql
-- ============================================================
--
-- Cada campanha ganha um quadro infinito que a mesa monta junta: post-its,
-- textos, formas, molduras, setas ligando as coisas, desenho à mão, linhas
-- do tempo, imagens e arquivos. Cada coisa no quadro é uma linha de
-- campaign_board_items (posição/tamanho + "data" com o conteúdo).
--
--  • Todos os membros da campanha veem e editam.
--  • O mestre pode TRANCAR um item: aí só o mestre move, edita ou apaga.
--  • Imagens e arquivos colocados no quadro vão pra Biblioteca da campanha
--    (pasta "<campanha>/quadro/"), então os jogadores também passam a
--    poder enviar arquivos — só por essa pasta, e sempre abertos pra mesa.

-- ── 1. Itens do quadro ──────────────────────────────────

create table if not exists public.campaign_board_items (
  id           uuid              primary key default gen_random_uuid(),
  campaign_id  uuid              not null references public.campaigns(id) on delete cascade,
  kind         text              not null,
  x            double precision  not null default 0,
  y            double precision  not null default 0,
  w            double precision  not null default 200,
  h            double precision  not null default 200,
  -- Ordem de empilhamento (maior = por cima).
  z            double precision  not null default 0,
  data         jsonb             not null default '{}'::jsonb,
  locked       boolean           not null default false,
  created_by   uuid              default auth.uid() references public.profiles(id) on delete set null,
  updated_by   uuid              default auth.uid() references public.profiles(id) on delete set null,
  created_at   timestamptz       not null default now(),
  updated_at   timestamptz       not null default now(),

  constraint campaign_board_items_kind check (kind in (
    'note', 'text', 'shape', 'image', 'file', 'frame', 'connector', 'drawing', 'timeline'
  )),
  constraint campaign_board_items_box check (
    w between 0 and 100000 and h between 0 and 100000
    and abs(x) <= 10000000 and abs(y) <= 10000000 and abs(z) <= 1000000000
  ),
  constraint campaign_board_items_data check (
    jsonb_typeof(data) = 'object' and pg_column_size(data) <= 262144
  )
);

create index if not exists idx_campaign_board_items_campaign
  on public.campaign_board_items(campaign_id);

-- Campanha, autoria e criação não mudam; só o mestre tranca/destranca.
create or replace function public.campaign_board_items_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
    if not public.is_campaign_master(new.campaign_id, auth.uid()) then
      new.locked := false;
    end if;
  else
    new.campaign_id := old.campaign_id;
    new.created_by  := old.created_by;
    new.created_at  := old.created_at;
    if not public.is_campaign_master(old.campaign_id, auth.uid()) then
      new.locked := old.locked;
    end if;
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists campaign_board_items_guard on public.campaign_board_items;
create trigger campaign_board_items_guard
  before insert or update on public.campaign_board_items
  for each row execute function public.campaign_board_items_guard();

-- Limite de itens por quadro (só conta inserções de verdade).
create or replace function public.campaign_board_items_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.campaign_board_items where campaign_id = new.campaign_id) > 5000 then
    raise exception 'O quadro chegou ao limite de 5000 itens.' using errcode = '54000';
  end if;
  return new;
end;
$$;

drop trigger if exists campaign_board_items_limit on public.campaign_board_items;
create trigger campaign_board_items_limit
  after insert on public.campaign_board_items
  for each row execute function public.campaign_board_items_limit();

alter table public.campaign_board_items enable row level security;

drop policy if exists "board: membros veem" on public.campaign_board_items;
create policy "board: membros veem"
  on public.campaign_board_items for select
  to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()));

drop policy if exists "board: membros criam" on public.campaign_board_items;
create policy "board: membros criam"
  on public.campaign_board_items for insert
  to authenticated
  with check (public.is_campaign_member(campaign_id, auth.uid()));

drop policy if exists "board: membros editam (trancado so o mestre)" on public.campaign_board_items;
create policy "board: membros editam (trancado so o mestre)"
  on public.campaign_board_items for update
  to authenticated
  using (
    public.is_campaign_member(campaign_id, auth.uid())
    and (not locked or public.is_campaign_master(campaign_id, auth.uid()))
  )
  with check (public.is_campaign_member(campaign_id, auth.uid()));

drop policy if exists "board: membros apagam (trancado so o mestre)" on public.campaign_board_items;
create policy "board: membros apagam (trancado so o mestre)"
  on public.campaign_board_items for delete
  to authenticated
  using (
    public.is_campaign_member(campaign_id, auth.uid())
    and (not locked or public.is_campaign_master(campaign_id, auth.uid()))
  );

-- Painel do desenvolvedor lê tudo (como nas outras tabelas, 20240161).
drop policy if exists "dev: le tudo" on public.campaign_board_items;
create policy "dev: le tudo" on public.campaign_board_items for select to authenticated using (public.is_developer());

-- Tempo real: o quadro de todo mundo se atualiza na hora.
do $$
begin
  alter publication supabase_realtime add table public.campaign_board_items;
exception when duplicate_object then null;
end;
$$;


-- ── 2. Arquivos do quadro vão pra Biblioteca ────────────

-- Arquivo "<campanha>/quadro/<arquivo>" de uma campanha da qual o usuário é membro?
create or replace function public.is_campaign_board_upload(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  campaign uuid;
begin
  if split_part(object_name, '/', 2) <> 'quadro' then
    return false;
  end if;
  begin
    campaign := split_part(object_name, '/', 1)::uuid;
  exception when others then
    return false;
  end;
  return public.is_campaign_member(campaign, auth.uid());
end;
$$;

revoke all on function public.is_campaign_board_upload(text) from public;
grant execute on function public.is_campaign_board_upload(text) to authenticated;

drop policy if exists "campaign-documents: membros enviam pelo quadro" on storage.objects;
create policy "campaign-documents: membros enviam pelo quadro"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'campaign-documents' and public.is_campaign_board_upload(name));

-- Se o registro na Biblioteca falhar logo depois do envio, quem enviou
-- consegue desfazer o próprio arquivo.
drop policy if exists "campaign-documents: autor desfaz envio do quadro" on storage.objects;
create policy "campaign-documents: autor desfaz envio do quadro"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'campaign-documents' and public.is_campaign_board_upload(name)
         and (owner_id = auth.uid()::text or owner = auth.uid()));

drop policy if exists "campaign_documents: membros adicionam pelo quadro" on public.campaign_documents;
create policy "campaign_documents: membros adicionam pelo quadro"
  on public.campaign_documents for insert
  to authenticated
  with check (
    public.is_campaign_member(campaign_id, auth.uid())
    and path like campaign_id::text || '/quadro/%'
    and visibility = 'all'
    and uploaded_by = auth.uid()
  );
