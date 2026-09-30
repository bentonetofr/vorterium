-- ============================================================
-- Vorterium — Fotos do Quadro vão pra Galeria
-- Migration: 20240167000000_board_images_gallery.sql
-- Aplicar após: 20240166000000_board_master_shield.sql
-- ============================================================
--
-- Imagens postas no Quadro (coladas, arrastadas ou enviadas) passam a ir
-- pra Galeria da campanha (bucket "mesa-images" + campaign_mesa_images)
-- em vez da Biblioteca. A Galeria continua sendo do mestre, com duas
-- pastas novas por campanha:
--
--   "<campanha>/quadro/"         → fotos do quadro geral: qualquer membro
--                                  envia e todos os membros veem (senão a
--                                  foto não aparece no quadro de todo mundo).
--   "<campanha>/quadro-mestre/"  → fotos do Escudo do mestre: só o mestre
--                                  (já coberto pelas regras do 20240154).
--
-- PDFs e textos postos no Quadro continuam indo pra Biblioteca.

-- Arquivo "<campanha>/quadro/<arquivo>" de uma campanha da qual o usuário é membro?
create or replace function public.is_board_gallery_image(object_name text)
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

revoke all on function public.is_board_gallery_image(text) from public;
grant execute on function public.is_board_gallery_image(text) to authenticated;

drop policy if exists "mesa-images: membros veem fotos do quadro" on storage.objects;
create policy "mesa-images: membros veem fotos do quadro"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'mesa-images' and public.is_board_gallery_image(name));

drop policy if exists "mesa-images: membros enviam fotos do quadro" on storage.objects;
create policy "mesa-images: membros enviam fotos do quadro"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'mesa-images' and public.is_board_gallery_image(name));

-- Se o registro na Galeria falhar logo depois do envio, quem enviou desfaz.
drop policy if exists "mesa-images: autor desfaz foto do quadro" on storage.objects;
create policy "mesa-images: autor desfaz foto do quadro"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'mesa-images' and public.is_board_gallery_image(name)
    and (owner_id = auth.uid()::text or owner = auth.uid())
  );

drop policy if exists "mesa_images: membros adicionam fotos do quadro" on public.campaign_mesa_images;
create policy "mesa_images: membros adicionam fotos do quadro"
  on public.campaign_mesa_images for insert
  to authenticated
  with check (
    public.is_campaign_member(campaign_id, auth.uid())
    and path like campaign_id::text || '/quadro/%'
  );
