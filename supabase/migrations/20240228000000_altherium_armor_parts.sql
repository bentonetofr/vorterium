-- ============================================================
-- Altherium — armadura por parte do corpo
-- Migration: 20240228000000_altherium_armor_parts.sql
-- Aplicar após: 20240227000000_vortable_npc_library.sql
-- ============================================================
--
-- Livro 2.0 ("Integridade"): toda parte de armadura tem Integridade, e a
-- peça da parte atingida é a que se desgasta. Antes o DB de cada parte
-- (db_pernas, db_bracos, db_tronco, db_cabeca) era um número digitado
-- junto com o DB das peças, e a Integridade era uma só por item.
--
-- Agora:
--   • a linha do inventário guarda `worn`, as peças da armadura que estão no
--     corpo: [{ "zone": "db_tronco", "integrity": 70 }, ...]. Uma armadura
--     de quantidade N pode vestir N partes, cada uma com o seu desgaste;
--   • os campos db_* da ficha passam a ser só o BÔNUS de DB (Robusto etc.).
--     O DB de cada parte é calculado: bônus + peça vestida + escudos.
--
-- Fichas existentes não mudam de DB: a conta abaixo tira da ficha o DB das
-- armaduras e escudos que já estavam equipados e o que sobrar vira o bônus.

-- ── 1. Coluna nova ────────────────────────────────────────

alter table public.altherium_character_inventory
  add column if not exists worn jsonb not null default '[]'::jsonb;

-- ── 2. Migrar os dados (sem encher o histórico das fichas) ─

alter table public.altherium_character_inventory disable trigger alth_inventory_activity;
alter table public.altherium_character_sheets    disable trigger alth_sheet_activity;

-- Armadura equipada numa parte vira uma peça vestida, com a Integridade que tinha.
update public.altherium_character_inventory
   set worn = jsonb_build_array(jsonb_build_object('zone', equipped_zone, 'integrity', integrity))
 where item_type = 'armadura'
   and equipped
   and equipped_zone is not null
   and worn = '[]'::jsonb;

-- O DB digitado na ficha incluía o das peças equipadas (armadura na parte
-- escolhida, escudo nas quatro): tira isso, o que sobra é o bônus.
update public.altherium_character_sheets s
   set db_pernas = greatest(0, s.db_pernas - g.pernas - g.escudo),
       db_bracos = greatest(0, s.db_bracos - g.bracos - g.escudo),
       db_tronco = greatest(0, s.db_tronco - g.tronco - g.escudo),
       db_cabeca = greatest(0, s.db_cabeca - g.cabeca - g.escudo)
  from (
    select p.sheet_id,
           sum(case when p.item_type = 'armadura' and p.equipped_zone = 'db_pernas' then p.pdb else 0 end) as pernas,
           sum(case when p.item_type = 'armadura' and p.equipped_zone = 'db_bracos' then p.pdb else 0 end) as bracos,
           sum(case when p.item_type = 'armadura' and p.equipped_zone = 'db_tronco' then p.pdb else 0 end) as tronco,
           sum(case when p.item_type = 'armadura' and p.equipped_zone = 'db_cabeca' then p.pdb else 0 end) as cabeca,
           sum(case when p.item_type = 'escudo' then p.pdb else 0 end) as escudo
      from (
        select i.sheet_id, i.item_type, i.equipped_zone,
               case
                 when i.custom_name is not null then coalesce(i.custom_db, 0)
                 else case i.item_id
                   when 'tunica_couro_runico'        then 4
                   when 'cota_malha_norte'           then 8
                   when 'couraca_placas_torvalenn'   then 12
                   when 'armadura_guardiao_eryndor'  then 16
                   when 'escudo_leve'                then 2
                   when 'escudo_pesado'              then 6
                   else 0
                 end
               end as pdb
          from public.altherium_character_inventory i
         where i.equipped and i.item_type in ('armadura', 'escudo')
      ) p
     group by p.sheet_id
  ) g
 where g.sheet_id = s.id;

alter table public.altherium_character_inventory enable trigger alth_inventory_activity;
alter table public.altherium_character_sheets    enable trigger alth_sheet_activity;

-- ── 3. Histórico: o equipar de armadura mostra as partes ──
--
-- Mesmo gatilho de antes, mas pra armadura o "de/para" do equipar traz as
-- partes vestidas separadas por vírgula (a tela do mestre já mostra os nomes).

create or replace function public.alth_worn_zones(p_worn jsonb)
returns text
language sql
immutable
as $$
  select coalesce(string_agg(e ->> 'zone', ',' order by e ->> 'zone'), '')
    from jsonb_array_elements(case when jsonb_typeof(p_worn) = 'array' then p_worn else '[]'::jsonb end) e
$$;

create or replace function public.alth_inventory_activity_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row     record;
  v_meta    jsonb;
  v_changes jsonb := '[]'::jsonb;
  v_old_c   jsonb;
  v_new_c   jsonb;
  v_old_z   text;
  v_new_z   text;
begin
  if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;
  v_meta := jsonb_build_object('item_id', v_row.item_id, 'item_type', v_row.item_type, 'custom_name', v_row.custom_name);

  if tg_op = 'INSERT' then
    v_changes := jsonb_build_array(jsonb_build_object(
      'k', 'item:' || new.id, 'f', 'item', 'from', null, 'to', new.quantity, 'meta', v_meta));
  elsif tg_op = 'DELETE' then
    v_changes := jsonb_build_array(jsonb_build_object(
      'k', 'item:' || old.id, 'f', 'item', 'from', old.quantity, 'to', null, 'meta', v_meta));
    -- Saiu equipado: desequipa junto (se tinha sido equipado agora, as duas se anulam).
    if old.equipped then
      v_changes := v_changes || jsonb_build_array(jsonb_build_object(
        'k', 'equip:' || old.id, 'f', 'equip',
        'from', coalesce(nullif(public.alth_worn_zones(old.worn), ''), old.equipped_zone, 'sim'),
        'to', null, 'meta', v_meta));
    end if;
  else
    if old.quantity is distinct from new.quantity then
      v_changes := v_changes || jsonb_build_array(jsonb_build_object(
        'k', 'item:' || new.id, 'f', 'item', 'from', old.quantity, 'to', new.quantity, 'meta', v_meta));
    end if;

    if new.item_type = 'armadura' then
      -- Armadura: vale a lista de partes vestidas (a Integridade de cada peça não entra aqui).
      v_old_z := public.alth_worn_zones(old.worn);
      v_new_z := public.alth_worn_zones(new.worn);
      if v_old_z is distinct from v_new_z then
        v_changes := v_changes || jsonb_build_array(jsonb_build_object(
          'k', 'equip:' || new.id, 'f', 'equip',
          'from', nullif(v_old_z, ''), 'to', nullif(v_new_z, ''), 'meta', v_meta));
      end if;
    elsif old.equipped is distinct from new.equipped or old.equipped_zone is distinct from new.equipped_zone then
      v_changes := v_changes || jsonb_build_array(jsonb_build_object(
        'k', 'equip:' || new.id, 'f', 'equip',
        'from', case when old.equipped then coalesce(old.equipped_zone, 'sim') end,
        'to',   case when new.equipped then coalesce(new.equipped_zone, 'sim') end,
        'meta', v_meta));
    end if;

    v_old_c := jsonb_build_object('nome', old.custom_name, 'detalhe', old.custom_detail, 'db', old.custom_db,
      'dano', old.custom_damage_dice, 'tipo', old.custom_damage_type, 'atributo', old.custom_attribute, 'alcance', old.custom_range);
    v_new_c := jsonb_build_object('nome', new.custom_name, 'detalhe', new.custom_detail, 'db', new.custom_db,
      'dano', new.custom_damage_dice, 'tipo', new.custom_damage_type, 'atributo', new.custom_attribute, 'alcance', new.custom_range);
    if v_old_c is distinct from v_new_c then
      v_changes := v_changes || jsonb_build_array(jsonb_build_object(
        'k', 'itemedit:' || new.id, 'f', 'itemedit', 'from', v_old_c, 'to', v_new_c, 'meta', v_meta));
    end if;
  end if;

  perform public.alth_log_sheet_changes(v_row.sheet_id, v_changes);
  return null;
exception when others then
  return null;
end;
$$;
