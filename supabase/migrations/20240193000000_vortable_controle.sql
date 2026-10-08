-- ============================================================
-- Vorterium — Vortable: quem controla cada boneco
-- Migration: 20240193000000_vortable_controle.sql
-- Aplicar após: 20240192000000_vortable_base.sql
-- Aplicar em: Supabase Dashboard → SQL Editor
-- ============================================================
--
-- user_id passa a ser só quem CRIOU o boneco. Quem JOGA com ele é o
-- controller_id (um boneco por pessoa por campanha). O mestre troca o
-- boneco de cada jogador (inclusive por um que ele mesmo criou) e apaga
-- qualquer boneco; sem boneco, o jogador cria o dele de novo.
-- ============================================================

alter table public.vortable_characters
  add column if not exists controller_id uuid references public.profiles(id) on delete set null;

-- Quem tinha um boneco "em uso" continua com ele.
update public.vortable_characters set controller_id = user_id where active;

drop index if exists public.vortable_characters_one_active;
alter table public.vortable_characters drop column if exists active;

create unique index if not exists vortable_characters_one_controller
  on public.vortable_characters (campaign_id, controller_id) where controller_id is not null;

-- O mestre aponta o boneco só pelo id: ele precisa ser único na campanha.
create unique index if not exists vortable_characters_campaign_id
  on public.vortable_characters (campaign_id, id);


-- ── Regras que a policy sozinha não cobre ─────────────────

create or replace function public.vortable_character_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_master boolean := public.is_campaign_master(new.campaign_id, auth.uid());
begin
  if tg_op = 'UPDATE' then
    if new.campaign_id <> old.campaign_id or new.user_id <> old.user_id or new.id <> old.id then
      raise exception 'Campos estruturais do boneco não podem ser alterados.';
    end if;
    -- Só o mestre (ou quem criou o boneco) muda quem controla.
    if new.controller_id is distinct from old.controller_id and not v_master and old.user_id <> auth.uid() then
      raise exception 'Só o mestre troca quem controla este boneco.';
    end if;
  end if;

  -- Quem controla precisa ser da campanha.
  if new.controller_id is not null and not public.is_campaign_member(new.campaign_id, new.controller_id) then
    raise exception 'Quem controla o boneco precisa ser membro da campanha.';
  end if;

  -- Jogador só se coloca como controlador (ou deixa sem ninguém).
  if not v_master and new.controller_id is not null and new.controller_id <> auth.uid() then
    raise exception 'Só o mestre entrega um boneco a outro jogador.';
  end if;

  return new;
end;
$$;

drop trigger if exists vortable_character_guard on public.vortable_characters;
create trigger vortable_character_guard
  before insert or update on public.vortable_characters
  for each row execute function public.vortable_character_guard();


-- ── Policies: dono, quem controla e o mestre ──────────────

drop policy if exists "vortable_characters: dono cria"   on public.vortable_characters;
drop policy if exists "vortable_characters: dono altera" on public.vortable_characters;
drop policy if exists "vortable_characters: dono apaga"  on public.vortable_characters;

create policy "vortable_characters: criar"
  on public.vortable_characters for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_campaign_member(campaign_id, auth.uid())
  );

create policy "vortable_characters: alterar"
  on public.vortable_characters for update to authenticated
  using (
    user_id = auth.uid()
    or controller_id = auth.uid()
    or public.is_campaign_master(campaign_id, auth.uid())
  )
  with check (public.is_campaign_member(campaign_id, auth.uid()));

create policy "vortable_characters: apagar"
  on public.vortable_characters for delete to authenticated
  using (
    user_id = auth.uid()
    or public.is_campaign_master(campaign_id, auth.uid())
  );


-- ── Tempo real: o jogador vê na hora quando o mestre troca o boneco ──

do $$
begin
  alter publication supabase_realtime add table public.vortable_characters;
exception when others then
  null;
end;
$$;
