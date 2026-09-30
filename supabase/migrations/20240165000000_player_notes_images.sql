-- ============================================================
-- Vorterium — Imagens no caderno do jogador ("Anotações da Bruna")
-- Migration: 20240165000000_player_notes_images.sql
-- Aplicar após: 20240164000000_campaign_board.sql
-- ============================================================
--
-- As anotações ganham imagens (coladas com Ctrl+V, arrastadas ou pelo
-- botão). Ficam num bucket PRIVADO próprio, "player-notes", na pasta
-- "<campanha>/<autora>/": como as anotações, só a autora e os mestres da
-- campanha veem — nem os outros jogadores, nem o painel do desenvolvedor.

-- ── 1. Coluna com as imagens de cada anotação ───────────

alter table public.player_session_notes
  add column if not exists images jsonb not null default '[]'::jsonb;

do $$
begin
  alter table public.player_session_notes
    add constraint player_session_notes_images
    check (jsonb_typeof(images) = 'array' and jsonb_array_length(images) <= 30);
exception when duplicate_object then null;
end;
$$;


-- ── 2. Bucket privado ───────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('player-notes', 'player-notes', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- "<campanha>/<autora>/<arquivo>" → quem pode ler / enviar / apagar.
create or replace function public.player_note_file_access(object_name text, mode text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  campaign uuid;
  author   uuid;
begin
  begin
    campaign := split_part(object_name, '/', 1)::uuid;
    author   := split_part(object_name, '/', 2)::uuid;
  exception when others then
    return false;
  end;
  if mode = 'read' then
    return author = auth.uid() or public.is_campaign_master(campaign, auth.uid());
  elsif mode = 'write' then
    return author = auth.uid()
       and public.has_notebook(auth.uid())
       and public.is_campaign_member(campaign, auth.uid());
  elsif mode = 'delete' then
    return author = auth.uid();
  end if;
  return false;
end;
$$;

revoke all on function public.player_note_file_access(text, text) from public;
grant execute on function public.player_note_file_access(text, text) to authenticated;

drop policy if exists "player-notes: autora e mestres leem" on storage.objects;
create policy "player-notes: autora e mestres leem"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'player-notes' and public.player_note_file_access(name, 'read'));

drop policy if exists "player-notes: autora envia" on storage.objects;
create policy "player-notes: autora envia"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'player-notes' and public.player_note_file_access(name, 'write'));

drop policy if exists "player-notes: autora apaga" on storage.objects;
create policy "player-notes: autora apaga"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'player-notes' and public.player_note_file_access(name, 'delete'));

-- O painel do desenvolvedor lê os arquivos de todos os buckets (20240161),
-- menos os do caderno — o caderno é privado.
drop policy if exists "dev: le todos os arquivos" on storage.objects;
create policy "dev: le todos os arquivos"
  on storage.objects for select
  to authenticated
  using (public.is_developer() and bucket_id <> 'player-notes');
