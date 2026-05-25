-- ============================================================
-- Campaign Lab — Correção: policy de INSERT em profiles
-- Migration: 20240107000000_allow_profile_self_insert.sql
-- Aplicar após: 20240106000000_harden_character_sheets_and_dice.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
-- ============================================================
--
-- PROBLEMA:
-- A função ensureProfile() no front-end cria um registro em public.profiles
-- para usuários que existem em auth.users mas não passaram pelo trigger
-- handle_new_user (ex: usuários criados antes da migration inicial).
--
-- As migrations anteriores definem policies de SELECT e UPDATE em profiles,
-- mas não uma policy de INSERT. Sem ela, ensureProfile() falha com erro de
-- permissão ao tentar criar o perfil ausente.
--
-- SOLUÇÃO:
-- Criar policy que permite ao usuário autenticado inserir apenas o próprio
-- perfil (id = auth.uid()). Isso impede criar perfil para outro usuário.
-- ============================================================

drop policy if exists "profiles: usuário cria o próprio perfil"
  on public.profiles;

create policy "profiles: usuário cria o próprio perfil"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());
