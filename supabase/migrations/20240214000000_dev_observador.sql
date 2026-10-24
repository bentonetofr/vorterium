-- ============================================================
-- Vorterium — Conta dev como observadora (só leitura, ao vivo)
-- Migration: 20240214000000_dev_observador.sql
-- Aplicar após: 20240213000000_dado_betinha.sql
-- ============================================================
--
-- A conta de desenvolvedor (app_developers, migration 20240161) já lê tudo
-- pelas policies "dev: le tudo". Agora ela também entra em QUALQUER campanha,
-- pelo próprio site, com a visão do mestre e em tempo real (rolagens, chat,
-- fichas...), sem poder alterar nada: o site barra toda escrita no navegador
-- (shared/lib/observer.ts) e, no banco, o dev só tem policy de SELECT.
--
-- Esta migration só garante o que o tempo real e as telas do mestre precisam:
--   1. a policy de leitura em TODA tabela do app (inclusive as criadas depois
--      da 20240161: D&D, dados, painel de controle...), sem tocar em nenhuma
--      regra de membros/mestres (policies se somam);
--   2. a leitura dos arquivos;
--   3. a conta bentonetofh@gmail.com como desenvolvedora (precisa existir:
--      crie pelo cadastro normal do site e rode esta migration, ou rode só o
--      insert do fim depois).
-- Nenhuma policy de INSERT/UPDATE/DELETE é criada.
-- ============================================================

do $$
declare
  t record;
begin
  for t in
    select c.relname
    from   pg_class c
    join   pg_namespace n on n.oid = c.relnamespace
    where  n.nspname = 'public'
      and  c.relkind = 'r'
      and  c.relrowsecurity
      and  c.relname not in ('app_developers', 'app_owners', 'site_feature_access')
  loop
    execute format('drop policy if exists "dev: le tudo" on public.%I', t.relname);
    execute format(
      'create policy "dev: le tudo" on public.%I for select to authenticated using (public.is_developer())',
      t.relname
    );
  end loop;
end;
$$;

drop policy if exists "dev: le todos os arquivos" on storage.objects;
create policy "dev: le todos os arquivos"
  on storage.objects for select
  to authenticated
  using (public.is_developer());

-- A conta dev. Sem conta com esse e-mail ainda, não insere nada (rode de novo depois de criá-la).
insert into public.app_developers (user_id)
select id from auth.users where email = 'bentonetofh@gmail.com'
on conflict do nothing;
