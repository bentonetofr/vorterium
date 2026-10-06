-- ============================================================
-- Vorterium — Vampiro: só o dono do site enquanto estiver guardado
-- Migration: 20240188000000_vampiro_so_dono.sql
-- Aplicar após: 20240187000000_vampiro_base.sql
-- ============================================================
--
-- Enquanto o recurso 'vampiro' estiver guardado no Painel de controle,
-- SÓ o dono do site (app_owners: bentonetofr@gmail.com) vê, cria e edita
-- fichas de Vampiro — mesmo que convide alguém pra uma campanha de
-- Vampiro. Ligando o recurso, volta a valer a regra normal (dono da ficha
-- ou mestre da campanha). A criação de campanha já era guardada (20240187).
-- ============================================================

-- Vampiro liberado pra esta pessoa? (recurso ligado, ou é o dono do site)
create or replace function public.vtm_open()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.site_features where key = 'vampiro' and enabled)
      or public.is_site_owner();
$$;
revoke all on function public.vtm_open() from public, anon;
grant execute on function public.vtm_open() to authenticated;

drop policy if exists "vtm_sheets: dono ou mestre pode ver" on public.vtm_character_sheets;
create policy "vtm_sheets: dono ou mestre pode ver"
  on public.vtm_character_sheets for select
  to authenticated
  using (
    public.vtm_open()
    and (user_id = auth.uid() or public.is_campaign_master(campaign_id, auth.uid()))
  );

drop policy if exists "vtm_sheets: membro cria propria ficha" on public.vtm_character_sheets;
create policy "vtm_sheets: membro cria propria ficha"
  on public.vtm_character_sheets for insert
  to authenticated
  with check (
    public.vtm_open()
    and user_id = auth.uid()
    and public.is_campaign_member(campaign_id, auth.uid())
    and exists (select 1 from public.campaigns c where c.id = campaign_id and c.system = 'vampiro')
  );

drop policy if exists "vtm_sheets: dono ou mestre pode atualizar" on public.vtm_character_sheets;
create policy "vtm_sheets: dono ou mestre pode atualizar"
  on public.vtm_character_sheets for update
  to authenticated
  using (
    public.vtm_open()
    and (user_id = auth.uid() or public.is_campaign_master(campaign_id, auth.uid()))
  )
  with check (
    public.vtm_open()
    and (user_id = auth.uid() or public.is_campaign_master(campaign_id, auth.uid()))
  );
