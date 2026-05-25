-- ============================================================
-- Campaign Lab — Hardening: campaign_members insert
-- Migration: 20240103000000_harden_campaign_members_insert.sql
-- Aplicar após: 20240102000000_campaign_members.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
-- ============================================================
--
-- PROBLEMA:
-- A policy "campaign_members: mestre pode adicionar membros" permite
-- insert direto na tabela campaign_members por qualquer mestre.
-- Ela não restringe o campo `role`, então um cliente malicioso poderia
-- inserir diretamente um membro com role = 'master', criando um segundo
-- mestre na campanha — o que não é permitido no MVP.
--
-- SOLUÇÃO:
-- Remover a policy de insert direto. Toda inserção em campaign_members
-- passa a ser feita exclusivamente via RPCs SECURITY DEFINER:
--
--   - create_campaign       → insere o criador como 'master'
--   - add_campaign_player   → insere jogador com 'player' (validado no banco)
--
-- Funções SECURITY DEFINER executam com os privilégios do criador
-- (postgres/service_role) e ignoram RLS, portanto continuam funcionando
-- sem nenhuma alteração. O front-end nunca deve usar insert direto.
-- ============================================================

drop policy if exists "campaign_members: mestre pode adicionar membros"
  on public.campaign_members;

-- Nota: nenhuma policy de insert é recriada intencionalmente.
-- Toda inserção em campaign_members deve ocorrer via RPC.
