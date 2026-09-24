-- ============================================================
-- Vorterium — Realtime para as fichas Altherium
-- Migration: 20240147000000_altherium_sheets_realtime.sql
-- Aplicar após: 20240146000000_altherium_fv_pr_max.sql
-- ============================================================
--
-- Os cards de resumo do mestre (Mesa da Sessão → Fichas) mostram barras
-- de PV/PE/recurso da raiz que acompanham, sem recarregar, o que cada
-- jogador salva na própria ficha. O Realtime respeita a RLS da tabela:
-- o mestre recebe as fichas da campanha, o jogador só a dele.

do $$
begin
  alter publication supabase_realtime add table public.altherium_character_sheets;
exception when others then
  null;
end;
$$;
