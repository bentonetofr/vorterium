-- ============================================================
-- Vorterium — D&D 5e: soma dos níveis também funciona no upsert (Marco 3)
-- Migration: 20240206000000_dnd_classes_upsert.sql
-- Aplicar após: 20240205000000_dnd_campanha_homebrew.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
-- ============================================================
--
-- O gatilho de 20240204000000 conferia "soma dos outros níveis + este nível
-- <= 20" contando todas as linhas de classe com outro id. Só que o site muda o
-- nível de uma classe com INSERT ... ON CONFLICT (upsert): o gatilho vê a
-- linha que vai entrar (com id novo) e contava também a linha antiga da MESMA
-- classe, que está prestes a ser atualizada. Resultado: subir o nível de uma
-- classe, ou até diminuí-lo, podia ser recusado com a soma perto de 20.
-- Agora a classe da própria linha não entra na soma dos "outros".
-- ============================================================

create or replace function public.dnd_classes_check_total()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_other integer;
begin
  select coalesce(sum(level), 0) into v_other
  from public.dnd_character_classes
  where sheet_id = new.sheet_id
    and id <> new.id
    and class_key <> new.class_key;
  if v_other + new.level > 20 then
    raise exception 'O personagem não passa do nível 20 (soma dos níveis das classes).';
  end if;
  return new;
end;
$$;
