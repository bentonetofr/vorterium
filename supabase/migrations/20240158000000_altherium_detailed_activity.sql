-- ============================================================
-- Vorterium — Atividade detalhada das fichas Altherium (pro mestre)
-- Migration: 20240158000000_altherium_detailed_activity.sql
-- Aplicar após: 20240157000000_terra_devastada.sql
-- ============================================================
--
-- Toda mudança numa ficha Altherium vira atividade "sheet_changed", com
-- o que mudou, de quanto pra quanto: campos da ficha, domínios,
-- inventário e runas. Quem registra são gatilhos no banco, então nada
-- escapa (nem o que o mestre edita na ficha de alguém).
--
-- Só o mestre vê essas entradas (coluna nova `audience`). Mudanças
-- seguidas da mesma pessoa na mesma ficha, com menos de 60 s entre uma e
-- outra, se juntam na mesma entrada (até 10 min): o salvamento automático
-- salva a cada pausa na digitação e isso viraria dezenas de linhas. Na
-- junção, cada campo guarda o valor de antes da 1ª mudança e o mais novo;
-- se voltar ao que era, some da lista.
--
-- metadata = {
--   "sheet_id", "owner_id", "character_name", "first_at", "last_at",
--   "changes": [{ "k": chave única, "f": campo/categoria,
--                 "from": valor antes, "to": valor depois, "meta": {...} }]
-- }
-- O registro nunca atrapalha o salvamento: qualquer erro aqui é engolido.


-- ── 1. Quem vê cada atividade ─────────────────────────────

alter table public.campaign_activity
  add column if not exists audience text not null default 'all';

alter table public.campaign_activity
  drop constraint if exists campaign_activity_audience_valid;
alter table public.campaign_activity
  add constraint campaign_activity_audience_valid check (audience in ('all', 'master'));

drop policy if exists "activity: membro pode ver" on public.campaign_activity;
create policy "activity: membro pode ver"
  on public.campaign_activity for select
  to authenticated
  using (
    public.is_campaign_member(campaign_id, auth.uid())
    and (audience = 'all' or public.is_campaign_master(campaign_id, auth.uid()))
  );

create index if not exists idx_campaign_activity_campaign_created
  on public.campaign_activity(campaign_id, created_at desc);


-- ── 2. Tipo novo ──────────────────────────────────────────
--
-- 'sheet_changed' só entra pelos gatilhos abaixo — a RPC
-- create_campaign_activity continua sem aceitá-lo.

alter table public.campaign_activity
  drop constraint campaign_activity_type_valid;

alter table public.campaign_activity
  add constraint campaign_activity_type_valid
    check (type in (
      'campaign_created',   'campaign_updated',
      'member_joined',      'member_left',        'member_removed',
      'invite_created',     'invite_deactivated',
      'session_created',    'session_updated',    'session_deleted',
      'sheet_updated',      'dice_rolled',
      'note_created',       'note_updated',       'note_deleted',
      'triumph_used',       'sheet_changed'
    ));


-- ── 3. Registrar (e juntar) mudanças ─────────────────────

create or replace function public.alth_log_sheet_changes(p_sheet_id uuid, p_changes jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor    uuid := auth.uid();
  v_sheet    record;
  v_last     public.campaign_activity%rowtype;
  v_merged   jsonb;
  v_change   jsonb;
  v_idx      integer;
  v_existing jsonb;
  v_out      jsonb;
  v_count    integer;
  v_who      text;
begin
  if p_changes is null or jsonb_array_length(p_changes) = 0 then
    return;
  end if;

  select id, campaign_id, user_id, character_name
    into v_sheet
    from public.altherium_character_sheets
   where id = p_sheet_id;
  if not found then
    return;  -- ficha sendo apagada (cascata): nada a registrar
  end if;

  v_who := coalesce(nullif(btrim(v_sheet.character_name), ''), 'sem nome');

  -- Última entrada dessa ficha, da mesma pessoa, ainda "aberta".
  select * into v_last
    from public.campaign_activity
   where campaign_id = v_sheet.campaign_id
     and type = 'sheet_changed'
     and metadata->>'sheet_id' = p_sheet_id::text
   order by created_at desc
   limit 1;

  if found
     and v_last.actor_id is not distinct from v_actor
     and (v_last.metadata->>'last_at')::timestamptz > now() - interval '60 seconds'
     and (v_last.metadata->>'first_at')::timestamptz > now() - interval '10 minutes' then

    v_merged := coalesce(v_last.metadata->'changes', '[]'::jsonb);
    for v_change in select * from jsonb_array_elements(p_changes)
    loop
      v_idx := null;
      select (ord - 1)::integer into v_idx
        from jsonb_array_elements(v_merged) with ordinality as e(val, ord)
       where e.val->>'k' = v_change->>'k'
       limit 1;
      if v_idx is null then
        v_merged := v_merged || jsonb_build_array(v_change);
      else
        v_existing := v_merged->v_idx;
        v_merged := jsonb_set(
          v_merged, array[v_idx::text],
          v_existing || jsonb_build_object('to', v_change->'to', 'meta', coalesce(v_change->'meta', v_existing->'meta'))
        );
      end if;
    end loop;

    -- Voltou ao que era? Sai da lista.
    select coalesce(jsonb_agg(e.val), '[]'::jsonb) into v_out
      from jsonb_array_elements(v_merged) as e(val)
     where (e.val->'from') is distinct from (e.val->'to');

    v_count := jsonb_array_length(v_out);
    if v_count = 0 then
      delete from public.campaign_activity where id = v_last.id;
      return;
    end if;

    update public.campaign_activity
       set metadata   = v_last.metadata
                        || jsonb_build_object('changes', v_out, 'last_at', now(), 'character_name', v_sheet.character_name),
           message    = format('Ficha de %s: %s %s.', v_who, v_count, case when v_count = 1 then 'alteração' else 'alterações' end),
           created_at = now()
     where id = v_last.id;
    return;
  end if;

  v_count := jsonb_array_length(p_changes);
  insert into public.campaign_activity (campaign_id, actor_id, type, message, metadata, audience)
  values (
    v_sheet.campaign_id,
    v_actor,
    'sheet_changed',
    format('Ficha de %s: %s %s.', v_who, v_count, case when v_count = 1 then 'alteração' else 'alterações' end),
    jsonb_build_object(
      'sheet_id',       p_sheet_id,
      'owner_id',       v_sheet.user_id,
      'character_name', v_sheet.character_name,
      'first_at',       now(),
      'last_at',        now(),
      'changes',        p_changes
    ),
    'master'
  );
exception when others then
  -- Registro é extra: nunca derruba o salvamento da ficha.
  null;
end;
$$;

revoke all on function public.alth_log_sheet_changes(uuid, jsonb) from public;


-- ── 4. Gatilho: campos da ficha ───────────────────────────
--
-- Compara linha antiga e nova coluna a coluna. Fora: ids, datas e o
-- baralho do Pilar (muda a cada carta puxada — as Cartas já aparecem).

create or replace function public.alth_sheet_activity_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old     jsonb := to_jsonb(old);
  v_new     jsonb := to_jsonb(new);
  v_key     text;
  v_changes jsonb := '[]'::jsonb;
begin
  for v_key in select jsonb_object_keys(v_new)
  loop
    continue when v_key in ('id', 'campaign_id', 'user_id', 'created_at', 'updated_at', 'pilar_deck');
    if (v_old->v_key) is distinct from (v_new->v_key) then
      v_changes := v_changes || jsonb_build_array(jsonb_build_object(
        'k', 'f:' || v_key, 'f', v_key, 'from', v_old->v_key, 'to', v_new->v_key
      ));
    end if;
  end loop;

  perform public.alth_log_sheet_changes(new.id, v_changes);
  return null;
exception when others then
  return null;
end;
$$;

drop trigger if exists alth_sheet_activity on public.altherium_character_sheets;
create trigger alth_sheet_activity
  after update on public.altherium_character_sheets
  for each row execute function public.alth_sheet_activity_trigger();


-- ── 5. Gatilho: domínios ──────────────────────────────────

create or replace function public.alth_domain_activity_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sheet  uuid    := coalesce(new.sheet_id, old.sheet_id);
  v_domain text    := coalesce(new.domain, old.domain);
  v_from   integer := case when tg_op = 'INSERT' then 0 else old.points end;
  v_to     integer := case when tg_op = 'DELETE' then 0 else new.points end;
begin
  if v_from is distinct from v_to then
    perform public.alth_log_sheet_changes(v_sheet, jsonb_build_array(jsonb_build_object(
      'k', 'domain:' || v_domain, 'f', 'domain', 'from', v_from, 'to', v_to,
      'meta', jsonb_build_object('domain', v_domain)
    )));
  end if;
  return null;
exception when others then
  return null;
end;
$$;

drop trigger if exists alth_domain_activity on public.altherium_character_domains;
create trigger alth_domain_activity
  after insert or update or delete on public.altherium_character_domains
  for each row execute function public.alth_domain_activity_trigger();


-- ── 6. Gatilho: inventário ────────────────────────────────
--
-- Item entrando/saindo (from/to nulos), quantidade, equipar e edição de
-- item personalizado. `meta` leva o id do catálogo e o nome próprio pra
-- tela mostrar o nome certo.

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
        'k', 'equip:' || old.id, 'f', 'equip', 'from', coalesce(old.equipped_zone, 'sim'), 'to', null, 'meta', v_meta));
    end if;
  else
    if old.quantity is distinct from new.quantity then
      v_changes := v_changes || jsonb_build_array(jsonb_build_object(
        'k', 'item:' || new.id, 'f', 'item', 'from', old.quantity, 'to', new.quantity, 'meta', v_meta));
    end if;
    if old.equipped is distinct from new.equipped or old.equipped_zone is distinct from new.equipped_zone then
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

drop trigger if exists alth_inventory_activity on public.altherium_character_inventory;
create trigger alth_inventory_activity
  after insert or update or delete on public.altherium_character_inventory
  for each row execute function public.alth_inventory_activity_trigger();


-- ── 7. Gatilho: runas do Runaskin ─────────────────────────

create or replace function public.alth_rune_activity_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row   record;
  v_old_c jsonb;
  v_new_c jsonb;
begin
  if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;

  if tg_op <> 'INSERT' then
    v_old_c := jsonb_build_object('nome', old.name, 'custo', old.pr_cost, 'teste', old.test,
      'acao', old.action, 'alcance', old.range, 'descricao', old.description,
      'imagem', old.image_url is not null);
  end if;
  if tg_op <> 'DELETE' then
    v_new_c := jsonb_build_object('nome', new.name, 'custo', new.pr_cost, 'teste', new.test,
      'acao', new.action, 'alcance', new.range, 'descricao', new.description,
      'imagem', new.image_url is not null);
  end if;

  if v_old_c is distinct from v_new_c then
    perform public.alth_log_sheet_changes(v_row.sheet_id, jsonb_build_array(jsonb_build_object(
      'k', 'rune:' || v_row.id, 'f', 'rune', 'from', v_old_c, 'to', v_new_c,
      'meta', jsonb_build_object('name', v_row.name)
    )));
  end if;
  return null;
exception when others then
  return null;
end;
$$;

drop trigger if exists alth_rune_activity on public.altherium_runaskin_runes;
create trigger alth_rune_activity
  after insert or update or delete on public.altherium_runaskin_runes
  for each row execute function public.alth_rune_activity_trigger();


-- ── 8. Aba Atividade ao vivo ──────────────────────────────
--
-- O Realtime respeita a RLS: entradas do mestre só chegam pro mestre.

do $$
begin
  alter publication supabase_realtime add table public.campaign_activity;
exception when others then
  null;
end;
$$;
