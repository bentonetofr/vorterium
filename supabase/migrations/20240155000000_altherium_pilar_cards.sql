-- ============================================================
-- Vorterium — Cartas do Pilar (ficha Altherium)
-- Migration: 20240155000000_altherium_pilar_cards.sql
-- Aplicar após: 20240154000000_mesa_live_notice_and_gallery.sql
-- ============================================================
--
-- O número de um triunfo do Pilar é quantas COMBINAÇÕES DE NAIPE ele
-- precisa (livro, p. 31): o jogador escolhe um naipe e vira cartas até
-- juntar essa quantidade; toda carta virada gasta 1 carta (cards_current).
--
--   pilar_card_mode → 'virtual' (a ficha vira as cartas de um baralho na
--                     tela) ou 'fisico' (o jogador usa um baralho de
--                     verdade e informa quantas cartas gastou).
--   pilar_deck      → o que resta do baralho virtual, já embaralhado
--                     (52 cartas + 2 coringas; "AS" = Ás de espadas,
--                     "10H" = 10 de copas, "JK" = coringa). Quando acaba,
--                     a ficha reembaralha tudo. null = baralho novo.

alter table public.altherium_character_sheets
  add column if not exists pilar_card_mode text not null default 'virtual',
  add column if not exists pilar_deck      text[];

alter table public.altherium_character_sheets
  add constraint altherium_sheets_pilar_card_mode_valid
    check (pilar_card_mode in ('virtual', 'fisico')),
  add constraint altherium_sheets_pilar_deck_size
    check (pilar_deck is null or cardinality(pilar_deck) <= 54);
