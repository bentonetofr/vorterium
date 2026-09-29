-- ════════════════════════════════════════════════════════
-- Perfil de desenvolvedor — uma conta (a do dono do site) que VÊ tudo:
-- campanhas, fichas, mensagens (inclusive privadas), rolagens (inclusive
-- ocultas), atividade, documentos e imagens. NÃO altera nada dos
-- jogadores: a única escrita liberada é o status do feedback.
--
-- Quem é desenvolvedor fica na tabela app_developers, que o site não
-- consegue ler nem alterar — só o SQL Editor do Supabase. Pra se
-- adicionar (depois de criar a conta pelo cadastro normal do site):
--
--   insert into public.app_developers (user_id)
--   select id from auth.users where email = 'SEU-EMAIL-DEV@exemplo.com';
-- ════════════════════════════════════════════════════════

-- ── 1. Quem é desenvolvedor ─────────────────────────────

create table if not exists public.app_developers (
  user_id     uuid         primary key references auth.users(id) on delete cascade,
  created_at  timestamptz  not null default now()
);

alter table public.app_developers enable row level security;
-- Sem policies: pelo site ninguém lê nem mexe nessa tabela.
revoke all on public.app_developers from anon, authenticated;

create or replace function public.is_developer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_developers where user_id = auth.uid());
$$;

revoke all on function public.is_developer() from public;
grant execute on function public.is_developer() to authenticated;


-- ── 2. Leitura de tudo ──────────────────────────────────
-- Uma policy de SELECT a mais em cada tabela do app. Policies se somam
-- (OU), então as regras de membros/mestres continuam exatamente iguais;
-- só o desenvolvedor passa a enxergar o resto. Nenhuma policy de
-- INSERT/UPDATE/DELETE é criada aqui (fora o status do feedback).

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
      and  c.relname <> 'app_developers'
  loop
    execute format('drop policy if exists "dev: le tudo" on public.%I', t.relname);
    execute format(
      'create policy "dev: le tudo" on public.%I for select to authenticated using (public.is_developer())',
      t.relname
    );
  end loop;
end;
$$;

-- Arquivos de todos os buckets (retratos, documentos, prints do feedback…).
drop policy if exists "dev: le todos os arquivos" on storage.objects;
create policy "dev: le todos os arquivos"
  on storage.objects for select
  to authenticated
  using (public.is_developer());


-- ── 3. Única escrita: status do feedback ────────────────

drop policy if exists "site_feedback: dev muda o status" on public.site_feedback;
create policy "site_feedback: dev muda o status"
  on public.site_feedback for update
  to authenticated
  using (public.is_developer())
  with check (public.is_developer());

-- Só a coluna status pode mudar (nem o dev reescreve o que a pessoa mandou).
revoke update on public.site_feedback from authenticated;
grant update (status) on public.site_feedback to authenticated;


-- ── 4. Painel: números gerais e lista de usuários ───────

create or replace function public.dev_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_developer() then
    raise exception 'Acesso restrito ao desenvolvedor.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'users',          (select count(*) from public.profiles),
    'users_7d',       (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'active_24h',     (select count(distinct user_id) from public.campaign_presence where last_seen_at > now() - interval '24 hours'),
    'online_now',     (select count(distinct user_id) from public.campaign_presence where last_seen_at > now() - interval '3 minutes'),
    'campaigns',      (select count(*) from public.campaigns),
    'campaigns_by_system', (
      select coalesce(jsonb_object_agg(system, n), '{}'::jsonb)
      from (select system, count(*) as n from public.campaigns group by system) s
    ),
    'sheets',         (select count(*) from public.character_sheets)
                    + (select count(*) from public.altherium_character_sheets)
                    + (select count(*) from public.td_character_sheets),
    'messages',       (select count(*) from public.campaign_messages),
    'messages_24h',   (select count(*) from public.campaign_messages where created_at > now() - interval '24 hours'),
    'rolls',          (select count(*) from public.dice_rolls),
    'rolls_24h',      (select count(*) from public.dice_rolls where created_at > now() - interval '24 hours'),
    'documents',      (select count(*) from public.campaign_documents),
    'feedback_new',   (select count(*) from public.site_feedback where status = 'novo')
  );
end;
$$;

-- Usuários com dados de login (que só existem em auth.users).
create or replace function public.dev_list_users()
returns table (
  id               uuid,
  display_name     text,
  email            text,
  avatar_url       text,
  provider         text,
  created_at       timestamptz,
  last_sign_in_at  timestamptz,
  campaigns        bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_developer() then
    raise exception 'Acesso restrito ao desenvolvedor.' using errcode = '42501';
  end if;

  return query
    select p.id, p.display_name, p.email, p.avatar_url,
           coalesce(u.raw_app_meta_data->>'provider', p.main_provider),
           p.created_at, u.last_sign_in_at,
           (select count(*) from public.campaign_members m where m.user_id = p.id)
    from   public.profiles p
    left join auth.users u on u.id = p.id
    order  by p.created_at desc;
end;
$$;

revoke all on function public.dev_overview() from public;
revoke all on function public.dev_list_users() from public;
grant execute on function public.dev_overview() to authenticated;
grant execute on function public.dev_list_users() to authenticated;
