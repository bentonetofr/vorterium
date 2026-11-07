-- Altherium 2.0: Companheiro animal.
--   • a ficha guarda o companheiro (nome, espécie, foto, feridas, defesa, ataque, dano, estado e habilidades)
--     numa coluna jsonb; tudo é editável pelo jogador. A foto do bicho vai pro mesmo bucket do retrato
--     (altherium-portraits), no caminho <sheet_id>/companion, que as policies do retrato já cobrem.

alter table public.altherium_character_sheets
  add column if not exists companion jsonb not null default '{}'::jsonb;
