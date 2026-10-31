-- Altherium 2.0, combate: o estado de combate de cada ficha — Reação usada,
-- Defender Total, Mirar, condições com turnos e armas com Recarga já
-- disparadas. Um jsonb só, lido e gravado pela ficha.

alter table public.altherium_character_sheets
  add column if not exists combat_state jsonb not null default '{}'::jsonb;
