-- ============================================================
-- Vorterium — Altherium: dado extra e desvantagem nos domínios
-- Migration: 20240169000000_altherium_domain_bonus_disadvantage.sql
-- Aplicar após: 20240168000000_player_notes_rich_text.sql
-- ============================================================
--
-- Na tabela de domínios da ficha:
--  • pontos agora vão de -1 a 2 — o -1 marca DESVANTAGEM no domínio
--    ("1d de desvantagem", como no atributo zerado do livro);
--  • bonus_die — a caixinha "+": um dado a mais no teste do domínio
--    (2 pontos + "+" = 4d10). Não gasta ponto de domínio.
-- O registro de atividade da ficha passa a anotar o "+" ligando/desligando.

alter table public.altherium_character_domains
  drop constraint if exists altherium_character_domains_points_check;

alter table public.altherium_character_domains
  add constraint altherium_character_domains_points_check check (points between -1 and 2);

alter table public.altherium_character_domains
  add column if not exists bonus_die boolean not null default false;

-- Gatilho do 20240158 + o "+" (dado extra).
create or replace function public.alth_domain_activity_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sheet   uuid    := coalesce(new.sheet_id, old.sheet_id);
  v_domain  text    := coalesce(new.domain, old.domain);
  v_from    integer := case when tg_op = 'INSERT' then 0 else old.points end;
  v_to      integer := case when tg_op = 'DELETE' then 0 else new.points end;
  v_bfrom   boolean := case when tg_op = 'INSERT' then false else coalesce(old.bonus_die, false) end;
  v_bto     boolean := case when tg_op = 'DELETE' then false else coalesce(new.bonus_die, false) end;
  v_changes jsonb   := '[]'::jsonb;
begin
  if v_from is distinct from v_to then
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'k', 'domain:' || v_domain, 'f', 'domain', 'from', v_from, 'to', v_to,
      'meta', jsonb_build_object('domain', v_domain)
    ));
  end if;
  if v_bfrom is distinct from v_bto then
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'k', 'domainbonus:' || v_domain, 'f', 'domainbonus', 'from', v_bfrom, 'to', v_bto,
      'meta', jsonb_build_object('domain', v_domain)
    ));
  end if;
  if jsonb_array_length(v_changes) > 0 then
    perform public.alth_log_sheet_changes(v_sheet, v_changes);
  end if;
  return null;
exception when others then
  return null;
end;
$$;
