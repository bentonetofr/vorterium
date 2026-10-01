-- ============================================================
-- Vorterium — Galeria de todos da campanha
-- Migration: 20240172000000_gallery_for_everyone.sql
-- Aplicar após: 20240171000000_board_shield_stays_on_board.sql
-- ============================================================
--
-- A Galeria (imagens da Mesa e fotos do Quadro) deixa de ser só do mestre:
-- todos os membros da campanha veem as imagens. Guardar, excluir e copiar
-- pra outra campanha continuam com o mestre (regras de 20240154).
--
-- As fotos do Escudo do mestre ("<campanha>/quadro-mestre/") continuam
-- fechadas: ficam fora das duas regras abaixo.

-- Lista da Galeria
drop policy if exists "mesa_images: membros veem" on public.campaign_mesa_images;
create policy "mesa_images: membros veem"
  on public.campaign_mesa_images for select
  to authenticated
  using (
    public.is_campaign_member(campaign_id, auth.uid())
    and path not like '%/quadro-mestre/%'
  );

-- Arquivo "<campanha>/…" da Galeria, de uma campanha da qual o usuário é
-- membro (menos a pasta do Escudo do mestre)?
create or replace function public.is_mesa_image_member(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  campaign uuid;
begin
  if split_part(object_name, '/', 2) = 'quadro-mestre' then
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

revoke all on function public.is_mesa_image_member(text) from public;
grant execute on function public.is_mesa_image_member(text) to authenticated;

-- As imagens em si
drop policy if exists "mesa-images: membros veem a galeria" on storage.objects;
create policy "mesa-images: membros veem a galeria"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'mesa-images' and public.is_mesa_image_member(name));
