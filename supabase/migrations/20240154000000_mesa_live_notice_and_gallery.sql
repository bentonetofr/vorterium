-- ============================================================
-- Vorterium — Mesa: aviso de "ao vivo" e galeria de imagens
-- Migration: 20240154000000_mesa_live_notice_and_gallery.sql
-- Aplicar após: 20240153000000_mesa_screen_share_realtime.sql
-- ============================================================
--
-- 1. Canal "mesa-aviso:<campanha>": o mestre avisa ali quando começa a
--    transmitir, e os jogadores escutam esse canal de TODAS as campanhas
--    deles — é o que faz o aviso aparecer em qualquer página do site.
--    Mesma regra do canal "mesa:": só membros da campanha.
-- 2. Galeria da Mesa: imagens que o mestre guarda pra mostrar à mesa
--    (mapas, NPCs, cartas). Bucket PRIVADO e tabela só do mestre — o
--    jogador não lista nem abre a galeria; recebe só um link temporário
--    (assinado) da imagem que o mestre colocar na mesa.


-- ── 1. Canal de aviso ───────────────────────────────────────

create or replace function public.can_access_mesa_topic(topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  campaign uuid;
begin
  if split_part(topic, ':', 1) not in ('mesa', 'mesa-aviso') then
    return false;
  end if;
  begin
    campaign := split_part(topic, ':', 2)::uuid;
  exception when others then
    return false;
  end;
  return public.is_campaign_member(campaign, auth.uid());
end;
$$;


-- ── 2. Galeria ──────────────────────────────────────────────

create table public.campaign_mesa_images (
  id           uuid         primary key default gen_random_uuid(),
  campaign_id  uuid         not null references public.campaigns(id) on delete cascade,
  name         text         not null,
  path         text         not null unique,
  created_at   timestamptz  not null default now(),

  constraint campaign_mesa_images_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint campaign_mesa_images_path_folder check (path like campaign_id::text || '/%')
);

create index idx_campaign_mesa_images_campaign_id on public.campaign_mesa_images(campaign_id);

alter table public.campaign_mesa_images enable row level security;

create policy "mesa_images: mestre pode ver"
  on public.campaign_mesa_images for select
  to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()));

create policy "mesa_images: mestre pode adicionar"
  on public.campaign_mesa_images for insert
  to authenticated
  with check (public.is_campaign_master(campaign_id, auth.uid()));

create policy "mesa_images: mestre pode remover"
  on public.campaign_mesa_images for delete
  to authenticated
  using (public.is_campaign_master(campaign_id, auth.uid()));

-- Bucket privado, até 10 MB por imagem.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mesa-images', 'mesa-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Arquivo "<campanha>/<arquivo>" → o usuário atual é mestre dessa campanha?
create or replace function public.is_mesa_image_master(object_name text)
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
  return public.is_campaign_master(campaign, auth.uid());
end;
$$;

revoke all on function public.is_mesa_image_master(text) from public;
grant execute on function public.is_mesa_image_master(text) to authenticated;

drop policy if exists "mesa-images: mestre pode ver" on storage.objects;
create policy "mesa-images: mestre pode ver"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'mesa-images' and public.is_mesa_image_master(name));

drop policy if exists "mesa-images: mestre pode enviar" on storage.objects;
create policy "mesa-images: mestre pode enviar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'mesa-images' and public.is_mesa_image_master(name));

drop policy if exists "mesa-images: mestre pode remover" on storage.objects;
create policy "mesa-images: mestre pode remover"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'mesa-images' and public.is_mesa_image_master(name));
