-- ============================================================
-- Campaign Lab — Incremento 6: Rolagem de Dados
-- Migration: 20240105000000_dice_rolls.sql
-- Aplicar após: 20240104000000_character_sheets.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
-- ============================================================


-- ── 1. Tabela dice_rolls ─────────────────────────────────
--
-- Rolagens são imutáveis: sem updated_at, sem DELETE no MVP.
-- O resultado é gerado no cliente e persistido aqui para o histórico
-- compartilhado entre todos os membros da campanha.

create table public.dice_rolls (
  id          uuid        primary key default gen_random_uuid(),
  campaign_id uuid        not null references public.campaigns(id) on delete cascade,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  die_type    text        not null
                check (die_type in ('d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100')),
  result      integer     not null check (result >= 1),
  created_at  timestamptz not null default now()
);

create index idx_dice_rolls_campaign_id on public.dice_rolls(campaign_id);
create index idx_dice_rolls_created_at  on public.dice_rolls(campaign_id, created_at desc);


-- ── 2. Row Level Security ────────────────────────────────

alter table public.dice_rolls enable row level security;

-- Membros veem todas as rolagens da campanha
create policy "dice_rolls: membro pode ver rolagens da campanha"
  on public.dice_rolls for select
  to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()));

-- Membro insere apenas a própria rolagem
create policy "dice_rolls: membro insere própria rolagem"
  on public.dice_rolls for insert
  to authenticated
  with check (
    user_id = auth.uid()
    AND public.is_campaign_member(campaign_id, auth.uid())
  );

-- Nenhum DELETE ou UPDATE no MVP


-- ── 3. Realtime ──────────────────────────────────────────
--
-- Habilita replicação da tabela para permitir subscriptions
-- via Supabase Realtime (necessário para atualização ao vivo
-- do histórico de rolagens para todos os membros).
--
-- Para ativar: Supabase Dashboard → Database → Replication
-- → Selecione a tabela `dice_rolls` → Enable
--
-- Ou execute:
-- alter publication supabase_realtime add table public.dice_rolls;
--
-- Nota: em alguns projetos esta linha pode falhar se a publicação
-- ainda não existir. Use o Dashboard se preferir.

do $$
begin
  alter publication supabase_realtime add table public.dice_rolls;
exception when others then
  -- Ignora se a publication não existir ou a tabela já estiver incluída
  null;
end;
$$;
