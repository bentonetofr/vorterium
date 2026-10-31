-- ============================================================
-- Vorterium — Ocultar uma arte dos jogadores (Artes recentes)
-- Migration: 20240220000000_mesa_arts_hidden.sql
-- Aplicar após: 20240219000000_altherium_pedidos.sql
-- ============================================================
--
-- O mestre pode ocultar uma arte das "Artes recentes": os jogadores não
-- veem a imagem na lista. Ao pôr a arte na mesa, todos veem na Transmissão
-- (o link assinado que o mestre gera vale pra qualquer um), e ela continua
-- oculta da lista depois de tirada. O mestre sempre vê tudo (regras de 20240154).

alter table public.campaign_mesa_images
  add column if not exists hidden boolean not null default false;

-- Lista: membros veem as artes não ocultas (o mestre tem a regra própria de 20240154).
drop policy if exists "mesa_images: membros veem" on public.campaign_mesa_images;
create policy "mesa_images: membros veem"
  on public.campaign_mesa_images for select
  to authenticated
  using (
    public.is_campaign_member(campaign_id, auth.uid())
    and path not like '%/quadro-mestre/%'
    and not hidden
  );

-- Só o mestre muda a marca de oculta.
drop policy if exists "mesa_images: mestre oculta" on public.campaign_mesa_images;
create policy "mesa_images: mestre oculta"
  on public.campaign_mesa_images for update
  to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()))
  with check (public.is_campaign_master(campaign_id, auth.uid()));

-- O arquivo também: membro não lê a imagem oculta direto do Storage
-- (o mestre lê tudo pela regra "mesa-images: mestre pode ver").
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
  if exists (select 1 from public.campaign_mesa_images i where i.path = object_name and i.hidden) then
    return false;
  end if;
  return public.is_campaign_member(campaign, auth.uid());
end;
$$;

revoke all on function public.is_mesa_image_member(text) from public;
grant execute on function public.is_mesa_image_member(text) to authenticated;
