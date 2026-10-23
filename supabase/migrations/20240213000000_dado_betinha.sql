-- ============================================================
-- Vorterium — Dado de Betinha Tester (o presente dos betas do D&D)
-- Migration: 20240213000000_dado_betinha.sql
-- Aplicar após: 20240212000000_dnd_aberto_pro_site.sql
-- ============================================================
--
-- Um conjunto de dados exclusivo (id 'betinha' em skins.ts) para quem testou
-- o D&D antes de todo mundo. Quem pode usar fica em site_feature_access, no
-- recurso 'dado-betinha' (o site lê por my_feature_access() e mostra o
-- presente e o dado só pra essas contas). Todo mundo vê o dado na mesa quando
-- um beta rola com ele; só os betas conseguem escolhê-lo.
--
-- Pra dar o dado a mais alguém (ou tirar), pelo SQL Editor:
--   insert into public.site_feature_access (feature, email)
--   values ('dado-betinha', 'fulano@exemplo.com') on conflict do nothing;
--   delete from public.site_feature_access
--   where feature = 'dado-betinha' and email = 'fulano@exemplo.com';
-- ============================================================

insert into public.site_feature_access (feature, email) values
  ('dado-betinha', 'brunaferreirapedroso@gmail.com'),
  ('dado-betinha', 'nicolas@campinas.com'),
  ('dado-betinha', 'mariacoutinho016@gmail.com'),
  ('dado-betinha', 'bentonetofr@gmail.com')
on conflict do nothing;


-- Só quem tem o acesso escolhe o dado (no perfil) ou rola com ele (na rolagem).
-- Sem login (SQL Editor, serviço) passa: é o dono do site mexendo.
create or replace function public.dice_skin_exclusive_guard()
returns trigger as $$
begin
  if new.dice_skin is distinct from 'betinha' or auth.uid() is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.dice_skin is not distinct from new.dice_skin then
    return new;
  end if;
  if not public.feature_tester('dado-betinha') then
    raise exception 'O Dado de Betinha Tester é só dos betas do D&D.';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists profiles_dice_skin_exclusive on public.profiles;
create trigger profiles_dice_skin_exclusive
  before update of dice_skin on public.profiles
  for each row execute function public.dice_skin_exclusive_guard();

drop trigger if exists dice_rolls_dice_skin_exclusive on public.dice_rolls;
create trigger dice_rolls_dice_skin_exclusive
  before insert on public.dice_rolls
  for each row execute function public.dice_skin_exclusive_guard();
