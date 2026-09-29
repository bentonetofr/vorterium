-- ════════════════════════════════════════════════════════
-- Biblioteca da campanha — livros e documentos que o mestre guarda pra
-- mesa (PDF, imagem ou texto). Tabela campaign_documents + bucket
-- privado "campaign-documents" (pasta = campanha).
--
--  • O mestre envia, renomeia, esconde e exclui.
--  • Os jogadores leem os arquivos com visibility = 'all'; os marcados
--    'master' ficam só pro mestre (anotações, mapas secretos…).
-- ════════════════════════════════════════════════════════

create table public.campaign_documents (
  id           uuid         primary key default gen_random_uuid(),
  campaign_id  uuid         not null references public.campaigns(id) on delete cascade,
  name         text         not null,
  path         text         not null unique,
  mime_type    text         not null,
  size_bytes   bigint       not null default 0,
  visibility   text         not null default 'all',
  uploaded_by  uuid         references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz  not null default now(),

  constraint campaign_documents_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint campaign_documents_path_folder check (path like campaign_id::text || '/%'),
  constraint campaign_documents_visibility  check (visibility in ('all', 'master')),
  constraint campaign_documents_mime_type   check (mime_type in (
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'text/plain', 'text/markdown'
  )),
  constraint campaign_documents_size check (size_bytes between 0 and 26214400)
);

create index idx_campaign_documents_campaign_id on public.campaign_documents(campaign_id);

alter table public.campaign_documents enable row level security;

create policy "campaign_documents: membros veem"
  on public.campaign_documents for select
  to authenticated
  using (
    public.is_campaign_master(campaign_id, auth.uid())
    or (visibility = 'all' and public.is_campaign_member(campaign_id, auth.uid()))
  );

create policy "campaign_documents: mestre adiciona"
  on public.campaign_documents for insert
  to authenticated
  with check (public.is_campaign_master(campaign_id, auth.uid()));

create policy "campaign_documents: mestre altera"
  on public.campaign_documents for update
  to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()))
  with check (public.is_campaign_master(campaign_id, auth.uid()));

create policy "campaign_documents: mestre remove"
  on public.campaign_documents for delete
  to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()));

-- Depois de enviado, só o nome e a visibilidade mudam.
revoke update on public.campaign_documents from authenticated;
grant update (name, visibility) on public.campaign_documents to authenticated;

-- Bucket privado, até 25 MB por arquivo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'campaign-documents', 'campaign-documents', false, 26214400,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'text/plain', 'text/markdown']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Arquivo "<campanha>/<arquivo>" → o usuário atual é mestre dessa campanha?
create or replace function public.is_campaign_document_master(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  campaign uuid;
begin
  begin
    campaign := split_part(object_name, '/', 1)::uuid;
  exception when others then
    return false;
  end;
  return public.is_campaign_master(campaign, auth.uid());
end;
$$;

-- O usuário atual pode ler esse arquivo? Mestre sempre; jogador só se o
-- documento está registrado e aberto pra mesa.
create or replace function public.can_read_campaign_document(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.is_campaign_document_master(object_name) then
    return true;
  end if;
  return exists (
    select 1
    from   public.campaign_documents d
    where  d.path = object_name
      and  d.visibility = 'all'
      and  public.is_campaign_member(d.campaign_id, auth.uid())
  );
end;
$$;

revoke all on function public.is_campaign_document_master(text) from public;
revoke all on function public.can_read_campaign_document(text) from public;
grant execute on function public.is_campaign_document_master(text) to authenticated;
grant execute on function public.can_read_campaign_document(text) to authenticated;

drop policy if exists "campaign-documents: membros leem" on storage.objects;
create policy "campaign-documents: membros leem"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'campaign-documents' and public.can_read_campaign_document(name));

drop policy if exists "campaign-documents: mestre envia" on storage.objects;
create policy "campaign-documents: mestre envia"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'campaign-documents' and public.is_campaign_document_master(name));

drop policy if exists "campaign-documents: mestre remove" on storage.objects;
create policy "campaign-documents: mestre remove"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'campaign-documents' and public.is_campaign_document_master(name));
