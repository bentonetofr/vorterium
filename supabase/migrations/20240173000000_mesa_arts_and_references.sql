-- ============================================================
-- Vorterium — Artes e referências na aba Mesa
-- Migration: 20240173000000_mesa_arts_and_references.sql
-- Aplicar após: 20240172000000_gallery_for_everyone.sql
-- ============================================================
--
-- A galeria da aba Mesa vira "Artes e referências": mestre e jogadores
-- enviam imagens pra mostrar como referência. Ficam na mesma tabela da
-- Galeria (campaign_mesa_images), numa pasta própria por campanha:
--
--   "<campanha>/arte/"  → qualquer membro envia; todos os membros veem
--                         (a leitura já vem de 20240172).
--
-- Nada vai sozinho pra transmissão: só o mestre põe uma imagem na mesa
-- (isso já é do mestre). Cada um pode excluir o que enviou; o mestre
-- continua podendo excluir qualquer imagem (regras de 20240154).

-- Quem enviou (pra mostrar o nome e deixar a pessoa excluir o que é dela).
alter table public.campaign_mesa_images
  add column if not exists uploaded_by uuid references public.profiles(id) on delete set null default auth.uid();

-- Lista: membro registra arte/referência na pasta "arte/", em nome próprio.
drop policy if exists "mesa_images: membros enviam artes" on public.campaign_mesa_images;
create policy "mesa_images: membros enviam artes"
  on public.campaign_mesa_images for insert
  to authenticated
  with check (
    public.is_campaign_member(campaign_id, auth.uid())
    and path like campaign_id::text || '/arte/%'
    and uploaded_by = auth.uid()
  );

drop policy if exists "mesa_images: autor remove a própria arte" on public.campaign_mesa_images;
create policy "mesa_images: autor remove a própria arte"
  on public.campaign_mesa_images for delete
  to authenticated
  using (uploaded_by = auth.uid() and path like campaign_id::text || '/arte/%');

-- Arquivo "<campanha>/arte/<arquivo>" de uma campanha da qual o usuário é membro?
create or replace function public.is_mesa_art_file(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  campaign uuid;
begin
  if split_part(object_name, '/', 2) <> 'arte' then
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

revoke all on function public.is_mesa_art_file(text) from public;
grant execute on function public.is_mesa_art_file(text) to authenticated;

drop policy if exists "mesa-images: membros enviam artes" on storage.objects;
create policy "mesa-images: membros enviam artes"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'mesa-images' and public.is_mesa_art_file(name));

drop policy if exists "mesa-images: autor apaga a própria arte" on storage.objects;
create policy "mesa-images: autor apaga a própria arte"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'mesa-images' and public.is_mesa_art_file(name)
    and (owner_id = auth.uid()::text or owner = auth.uid())
  );

-- Tempo real: a arte que um jogador envia aparece na hora pro mestre.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'campaign_mesa_images'
  ) then
    alter publication supabase_realtime add table public.campaign_mesa_images;
  end if;
end $$;
