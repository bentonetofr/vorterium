-- ============================================================
-- Vorterium — Tudo o que está no Quadro geral, todos os membros veem
-- Migration: 20240222000000_board_files_readable.sql
-- Aplicar após: 20240221000000_altherium_dominio_oficio.sql
-- ============================================================
--
-- Imagens e arquivos postos no Quadro geral apareciam como "Imagem
-- indisponível" para os jogadores quando a regra de leitura do arquivo
-- (Galeria ou Biblioteca) não deixava eles lerem. Esta regra vale por
-- cima das outras: se um item do Quadro GERAL aponta para um arquivo,
-- qualquer membro da campanha pode ler esse arquivo.
--
-- O Escudo do mestre (board = 'mestre') continua fechado: os arquivos que
-- só estão nele seguem só do mestre.

create or replace function public.can_read_board_file(object_name text)
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
  if not public.is_campaign_member(campaign, auth.uid()) then
    return false;
  end if;
  return exists (
    select 1
    from   public.campaign_board_items b
    where  b.campaign_id = campaign
      and  b.board = 'geral'
      and  b.data->>'path' = object_name
  );
end;
$$;

revoke all on function public.can_read_board_file(text) from public;
grant execute on function public.can_read_board_file(text) to authenticated;

drop policy if exists "mesa-images: arquivos do quadro geral" on storage.objects;
create policy "mesa-images: arquivos do quadro geral"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'mesa-images' and public.can_read_board_file(name));

drop policy if exists "campaign-documents: arquivos do quadro geral" on storage.objects;
create policy "campaign-documents: arquivos do quadro geral"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'campaign-documents' and public.can_read_board_file(name));
