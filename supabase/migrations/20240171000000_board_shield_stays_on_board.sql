-- ============================================================
-- Vorterium — O que vai pro Escudo do mestre fica só no Escudo
-- Migration: 20240171000000_board_shield_stays_on_board.sql
-- Aplicar após: 20240170000000_altherium_domain_disadvantage_override.sql
-- ============================================================
--
-- A Biblioteca passa a ser de todos da campanha (o site não esconde mais
-- arquivos dos jogadores). Por isso, o que é posto no Escudo do mestre
-- (fotos, PDFs e textos) não vai mais pra Galeria nem pra Biblioteca: o
-- arquivo fica guardado na pasta da campanha, sem registro, e só o mestre
-- consegue abrir (as regras de 20240154 e 20240160 já deixam o mestre ler
-- tudo da pasta da campanha; jogador só lê documento registrado e aberto).
--
-- Aqui só arrumamos o que já existe:
--   1. Fotos do Escudo saem da lista da Galeria (o arquivo continua no
--      Escudo, só some da Galeria).
--   2. PDFs/textos enviados pelo Escudo saem da Biblioteca: o item do
--      Escudo passa a apontar direto pro arquivo (store = 'shield').
--      Só os que estão apenas no Escudo; se o mesmo documento também está
--      no quadro Geral, ele fica na Biblioteca.
--
-- Documentos que o mestre escondeu à mão na Biblioteca continuam
-- escondidos (o mestre pode mostrar pela própria Biblioteca).

-- 1. Galeria
delete from public.campaign_mesa_images
where path like '%/quadro-mestre/%';

-- 2. Biblioteca
with shield_docs as (
  select d.id
  from   public.campaign_documents d
  where  d.visibility = 'master'
    and  d.path like d.campaign_id::text || '/quadro/%'
    and  exists (
           select 1 from public.campaign_board_items b
           where b.board = 'mestre' and b.data->>'docId' = d.id::text
         )
    and  not exists (
           select 1 from public.campaign_board_items b
           where b.board <> 'mestre' and b.data->>'docId' = d.id::text
         )
),
moved as (
  update public.campaign_board_items b
  set    data = (b.data - 'docId') || jsonb_build_object('store', 'shield')
  from   shield_docs s
  where  b.board = 'mestre' and b.data->>'docId' = s.id::text
  returning b.id
)
delete from public.campaign_documents d
using  shield_docs s
where  d.id = s.id;
