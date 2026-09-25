-- ============================================================
-- Vorterium — Canal privado da transmissão de tela (aba "Mesa")
-- Migration: 20240153000000_mesa_screen_share_realtime.sql
-- Aplicar após: 20240152000000_altherium_bestiary.sql
-- ============================================================
--
-- A tela do mestre vai direto pro navegador de cada jogador (WebRTC);
-- o Supabase só carrega a "conversa" de conexão (offer/answer/ICE) num
-- canal Realtime privado `mesa:<campaign_id>`. Sem estas policies o
-- canal privado recusa todo mundo; com elas, só membros da campanha
-- entram e mandam mensagens nele — quem não é da campanha não consegue
-- pedir a transmissão nem ver os dados de conexão.

-- Tópico "mesa:<uuid>" → o usuário atual é membro dessa campanha?
-- (plpgsql pra tratar tópico malformado sem erro de cast.)
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
  if split_part(topic, ':', 1) <> 'mesa' then
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

revoke all on function public.can_access_mesa_topic(text) from public;
grant execute on function public.can_access_mesa_topic(text) to authenticated;

drop policy if exists "mesa: membros da campanha podem ouvir" on realtime.messages;
create policy "mesa: membros da campanha podem ouvir"
  on realtime.messages for select
  to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.can_access_mesa_topic(realtime.topic())
  );

drop policy if exists "mesa: membros da campanha podem enviar" on realtime.messages;
create policy "mesa: membros da campanha podem enviar"
  on realtime.messages for insert
  to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.can_access_mesa_topic(realtime.topic())
  );
