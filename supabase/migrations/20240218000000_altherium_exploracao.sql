-- Altherium 2.0 (6ª edição do livro): Exploração, Descanso, Fome e Furtividade.
--   • a ficha guarda a sobrevivência (Fichas de Exploração, nível de Fome,
--     Descansos Curtos já feitos, Rito do dia, Traumas) numa coluna jsonb;
--   • a campanha guarda a cena: o estado dos inimigos na Furtividade (com as
--     três DTs, que o livro deixa em aberto) e o Local, a Escassez e o clima
--     da Exploração. Todos da campanha leem; o mestre define a cena e os
--     jogadores mexem no estado dos inimigos quando um teste de Furtividade
--     falha (o estado sobe sozinho).

alter table public.altherium_character_sheets
  add column if not exists survival jsonb not null default '{}'::jsonb;

create table if not exists public.altherium_scene (
  campaign_id  uuid        primary key references public.campaigns(id) on delete cascade,
  enemy_state  text        not null default 'desatento' check (enemy_state in ('desatento', 'atento', 'alerta')),
  dt_desatento integer     not null default 6  check (dt_desatento between 1 and 30),
  dt_atento    integer     not null default 8  check (dt_atento between 1 and 30),
  dt_alerta    integer     not null default 10 check (dt_alerta between 1 and 30),
  -- Esfriar: um inimigo que já foi Alerta nunca volta a Desatento na mesma cena.
  was_alert    boolean     not null default false,
  location     text        not null default 'floresta',
  scarcity     text        not null default 'normal' check (scarcity in ('abundante', 'normal', 'escasso', 'devastado')),
  -- 'limpo', 'noite', 'chuva', 'tempestade' (separados por vírgula quando juntam).
  weather      text        not null default '',
  updated_at   timestamptz not null default now()
);

drop trigger if exists set_altherium_scene_updated_at on public.altherium_scene;
create trigger set_altherium_scene_updated_at
  before update on public.altherium_scene
  for each row execute function public.set_updated_at();

alter table public.altherium_scene enable row level security;

drop policy if exists "altherium_scene: membro ve" on public.altherium_scene;
create policy "altherium_scene: membro ve" on public.altherium_scene
  for select to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()));

drop policy if exists "altherium_scene: membro cria" on public.altherium_scene;
create policy "altherium_scene: membro cria" on public.altherium_scene
  for insert to authenticated
  with check (public.is_campaign_member(campaign_id, auth.uid()));

drop policy if exists "altherium_scene: membro altera" on public.altherium_scene;
create policy "altherium_scene: membro altera" on public.altherium_scene
  for update to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()))
  with check (public.is_campaign_member(campaign_id, auth.uid()));

grant select, insert, update on public.altherium_scene to authenticated;

-- Painel do desenvolvedor lê tudo (como nas outras tabelas, 20240161).
drop policy if exists "dev: le tudo" on public.altherium_scene;
create policy "dev: le tudo" on public.altherium_scene
  for select to authenticated using (public.is_developer());

-- Tempo real: a cena muda na ficha de todo mundo na hora.
do $$
begin
  alter publication supabase_realtime add table public.altherium_scene;
exception when others then
  null;
end;
$$;
