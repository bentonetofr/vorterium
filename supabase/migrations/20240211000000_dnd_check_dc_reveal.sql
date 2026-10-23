-- ============================================================
-- Vorterium — Pedido de teste: revelar (ou não) a CD oculta depois da rolagem
-- Migration: 20240211000000_dnd_check_dc_reveal.sql
-- Aplicar após: 20240210000000_dados_3d_dnd.sql
-- ============================================================
--
-- Hoje a CD oculta de um pedido de teste é revelada ao jogador depois que ele
-- rola. O mestre agora escolhe: `dc_reveal` = true (padrão, como era) revela a
-- CD a quem já respondeu; false mantém a CD escondida dos jogadores para
-- sempre (só o mestre a vê). A função dnd_check_reveal respeita a escolha.
-- ============================================================

alter table public.dnd_check_requests
  add column if not exists dc_reveal boolean not null default true;

-- O pedido só muda de situação: a escolha de revelar também não pode mudar depois.
create or replace function public.dnd_check_request_guard()
returns trigger as $$
declare v_target uuid;
begin
  if not exists (select 1 from public.campaigns where id = new.campaign_id and system = 'dnd5e') then
    raise exception 'Pedido de teste só em campanha de D&D.';
  end if;
  if tg_op = 'UPDATE' then
    if new.campaign_id <> old.campaign_id or new.master_id <> old.master_id or new.targets <> old.targets
       or new.kind <> old.kind or new.check_key is distinct from old.check_key or new.label <> old.label
       or new.dc is distinct from old.dc or new.dc_hidden <> old.dc_hidden or new.dc_reveal <> old.dc_reveal
       or new.advantage <> old.advantage or new.created_at <> old.created_at then
      raise exception 'Do pedido de teste só muda a situação.';
    end if;
    if new.status = 'closed' and old.status = 'open' then new.closed_at := now(); end if;
    return new;
  end if;
  foreach v_target in array new.targets loop
    if not public.is_campaign_member(new.campaign_id, v_target) then
      raise exception 'Todo jogador do pedido precisa ser da campanha.';
    end if;
  end loop;
  return new;
end;
$$ language plpgsql set search_path = public;

-- A CD de um pedido: aberta para todos os alvos; oculta, só para o mestre ou,
-- se o mestre deixou revelar, para quem já respondeu (rolou com o id do pedido).
create or replace function public.dnd_check_reveal(p_request uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not r.dc_hidden then r.dc
    when public.is_campaign_master(r.campaign_id, auth.uid())
      or (r.dc_reveal and exists (select 1 from public.dice_rolls d
                                  where d.campaign_id = r.campaign_id and d.user_id = auth.uid()
                                    and d.roll_context->>'request_id' = r.id::text))
      then (select dc from public.dnd_check_request_dc where request_id = r.id)
    else null
  end
  from public.dnd_check_requests r
  where r.id = p_request
    and public.dnd_open()
    and (public.is_campaign_master(r.campaign_id, auth.uid()) or auth.uid() = any(r.targets));
$$;
revoke all on function public.dnd_check_reveal(uuid) from public, anon;
grant execute on function public.dnd_check_reveal(uuid) to authenticated;
