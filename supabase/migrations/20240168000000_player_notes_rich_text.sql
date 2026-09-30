-- ============================================================
-- Vorterium — Formatação no caderno do jogador
-- Migration: 20240168000000_player_notes_rich_text.sql
-- Aplicar após: 20240167000000_board_images_gallery.sql
-- ============================================================
--
-- As anotações ganham formatação (negrito, itálico, cor, tamanho, listas).
-- O texto passa a ser guardado com as marcações de formatação, que ocupam
-- mais espaço: o limite sobe de 20 mil pra 100 mil caracteres.
-- (O site só mostra a formatação permitida — ver src/features/notebook/noteHtml.ts.)

alter table public.player_session_notes
  drop constraint if exists player_session_notes_content_length;

alter table public.player_session_notes
  add constraint player_session_notes_content_length check (char_length(content) <= 100000);
