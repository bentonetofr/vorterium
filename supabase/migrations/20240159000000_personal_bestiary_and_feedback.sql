-- ============================================================
-- Vorterium — Meu bestiário e Enviar feedback
-- Migration: 20240159000000_personal_bestiary_and_feedback.sql
-- Aplicar após: 20240158000000_altherium_detailed_activity.sql
-- ============================================================
--
-- 1. user_bestiary: criaturas guardadas pela pessoa, fora de qualquer
--    campanha, pra copiar pro bestiário de uma campanha quando precisar.
--    Mesmas colunas do altherium_bestiary; rodadas e perigo são opcionais
--    (criatura escrita à mão não passou pela conta do grupo).
-- 2. site_feedback: problemas e sugestões enviados pela página "Enviar
--    feedback". Quem envia só cria e lê os próprios; quem administra o
--    site lê tudo pelo painel do Supabase (Table Editor → site_feedback).
-- 3. Bucket privado "feedback-images": print opcional do feedback, na
--    pasta <usuário>/.


-- ── 1. Meu bestiário ─────────────────────────────────────

create table public.user_bestiary (
  id            uuid         primary key default gen_random_uuid(),
  owner_id      uuid         not null default auth.uid() references public.profiles(id) on delete cascade,
  name          text         not null,
  hp            integer      not null,
  damage_dice   text         not null,
  rounds        integer,
  danger_pct    integer,
  party_damage  numeric(7,2),
  party_avg_hp  numeric(7,2),
  notes         text,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now(),

  constraint user_bestiary_name_length   check (char_length(btrim(name)) between 1 and 80),
  constraint user_bestiary_hp_range      check (hp between 1 and 9999),
  constraint user_bestiary_damage_format check (damage_dice ~ '^[0-9]{0,2}d[0-9]{1,3}([+-][0-9]{1,3})?$'),
  constraint user_bestiary_rounds_range  check (rounds is null or rounds between 1 and 20),
  constraint user_bestiary_danger_range  check (danger_pct is null or danger_pct between 1 and 100),
  constraint user_bestiary_notes_length  check (notes is null or char_length(notes) <= 2000)
);

create index idx_user_bestiary_owner on public.user_bestiary(owner_id);

create trigger set_user_bestiary_updated_at
  before update on public.user_bestiary
  for each row execute function public.set_updated_at();

alter table public.user_bestiary enable row level security;

create policy "user_bestiary: dono ve"
  on public.user_bestiary for select
  to authenticated
  using (owner_id = auth.uid());

create policy "user_bestiary: dono cria"
  on public.user_bestiary for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "user_bestiary: dono edita"
  on public.user_bestiary for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "user_bestiary: dono apaga"
  on public.user_bestiary for delete
  to authenticated
  using (owner_id = auth.uid());


-- ── 2. Feedback ──────────────────────────────────────────

create table public.site_feedback (
  id           uuid         primary key default gen_random_uuid(),
  user_id      uuid         default auth.uid() references public.profiles(id) on delete set null,
  kind         text         not null,
  message      text         not null,
  page         text,
  app_version  text,
  user_agent   text,
  image_path   text,
  status       text         not null default 'novo',
  created_at   timestamptz  not null default now(),

  constraint site_feedback_kind_valid     check (kind in ('problema', 'sugestao', 'outro')),
  constraint site_feedback_message_length check (char_length(btrim(message)) between 1 and 2000),
  constraint site_feedback_page_length    check (page is null or char_length(page) <= 300),
  constraint site_feedback_version_length check (app_version is null or char_length(app_version) <= 20),
  constraint site_feedback_agent_length   check (user_agent is null or char_length(user_agent) <= 400),
  constraint site_feedback_image_folder   check (image_path is null or image_path like user_id::text || '/%'),
  constraint site_feedback_status_valid   check (status in ('novo', 'lido', 'resolvido'))
);

create index idx_site_feedback_created on public.site_feedback(created_at desc);

alter table public.site_feedback enable row level security;

create policy "site_feedback: usuario envia"
  on public.site_feedback for insert
  to authenticated
  with check (user_id = auth.uid() and status = 'novo');

create policy "site_feedback: usuario ve os proprios"
  on public.site_feedback for select
  to authenticated
  using (user_id = auth.uid());

-- Sem UPDATE/DELETE pelo app: quem administra muda o status no painel.


-- ── 3. Prints do feedback ────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-images', 'feedback-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "feedback-images: usuario envia" on storage.objects;
create policy "feedback-images: usuario envia"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'feedback-images' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists "feedback-images: usuario ve os proprios" on storage.objects;
create policy "feedback-images: usuario ve os proprios"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'feedback-images' and split_part(name, '/', 1) = auth.uid()::text);
