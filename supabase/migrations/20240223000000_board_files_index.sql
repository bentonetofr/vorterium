-- ============================================================
-- Vorterium — Leitura dos arquivos do Quadro mais rápida
-- Migration: 20240223000000_board_files_index.sql
-- Aplicar após: 20240222000000_board_files_readable.sql
-- ============================================================
--
-- A regra de 20240222 procurava o arquivo entre os itens do Quadro sem
-- índice. Com um índice no caminho do arquivo, ela consulta direto (e
-- confere o membro só depois de achar o item).

create index if not exists idx_campaign_board_items_path
  on public.campaign_board_items ((data->>'path'))
  where board = 'geral';

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
  return exists (
    select 1
    from   public.campaign_board_items b
    where  b.board = 'geral'
      and  b.data->>'path' = object_name
      and  b.campaign_id = campaign
  ) and public.is_campaign_member(campaign, auth.uid());
end;
$$;

revoke all on function public.can_read_board_file(text) from public;
grant execute on function public.can_read_board_file(text) to authenticated;
