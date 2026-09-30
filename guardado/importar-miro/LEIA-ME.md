# Importar do Miro (guardado)

Recurso pronto e testado com um Miro de mentira (a API de verdade ainda não foi
usada), tirado do site a pedido em 30/09/2026 pra entrar depois. Nada nesta
pasta vai pro ar: o build só compila `src/` e a Vercel só publica `api/`.

## O que faz
Botão "Importar do Miro" no cabeçalho do Quadro. A pessoa cola o link do board e
uma chave de acesso do Miro (`boards:read`); o site lê o board pela API REST v2 e
recria no Quadro, no mesmo lugar, dentro de uma moldura "Miro: <nome>":
post-its, textos, formas, molduras (com os filhos), setas (legenda, tracejado,
pontas), cards, links de embeds e imagens/PDFs (que vão pra Biblioteca).
Desenho à mão não vem (a API do Miro não entrega). A chave é usada só no pedido
e não fica salva.

## Arquivos
| Aqui                   | Volta para                                           |
|------------------------|------------------------------------------------------|
| `api/miro.ts`          | `api/miro.ts` (raiz do projeto — função da Vercel)   |
| `miroImport.ts`        | `src/features/board/services/miroImport.ts`          |
| `MiroImportDialog.tsx` | `src/features/board/components/MiroImportDialog.tsx` |
| `miro.css`             | fim de `src/features/board/components/Board.css`     |
| `vite.config.ts`       | `vite.config.ts` (raiz) — plugin /api no `npm run dev` |
| `vercel.json`          | `vercel.json` (raiz) — `/api` fora do rewrite do SPA |
| `_trechos.txt`         | trechos pra colar no BoardPanel, Novidades, Ajuda e Privacidade |

## Pra religar
1. Copie os arquivos de volta pros lugares da tabela.
2. Cole os trechos de `_trechos.txt` (BoardPanel: import, estado, botão e janela;
   uma linha nas Novidades; uma na Ajuda; a seção 5.1 na Privacidade).
3. Reinicie o `npm run dev` (o plugin do vite.config só entra ao reiniciar).
4. `npm run verify`.

A função usa as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY que já
existem na Vercel. Não precisa de migration nova.

## Pendência conhecida
O passo a passo da chave (na janela) foi conferido com a documentação do Miro,
mas não deu pra confirmar se "Install app and get OAuth token" lista os times
normais ou só o time de desenvolvedor. Conferir na primeira importação real.
