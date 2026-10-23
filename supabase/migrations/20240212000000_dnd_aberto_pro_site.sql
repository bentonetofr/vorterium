-- ============================================================
-- D&D 5e aberto pro site de vez (patch 2.0).
--
-- Até aqui o D&D ficava GUARDADO: só o dono do site e as contas liberadas por
-- e-mail (site_feature_access) criavam campanha e usavam as fichas, e todas as
-- tabelas do D&D tinham uma política restritiva "dnd: so quando liberado" que
-- consulta dnd_open(). Agora todo mundo logado usa.
--
--   1. dnd_open() passa a devolver sempre true (as políticas e funções que a
--      chamam continuam valendo, só que liberadas pra qualquer conta logada).
--   2. O recurso "dnd5e" fica ligado na tabela site_features, para quem lê
--      pelo banco (o site também trata o D&D como permanente no código).
-- ============================================================

create or replace function public.dnd_open()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select true;
$$;

revoke all on function public.dnd_open() from public, anon;
grant execute on function public.dnd_open() to authenticated;

insert into public.site_features (key, enabled)
values ('dnd5e', true)
on conflict (key) do update set enabled = true;
