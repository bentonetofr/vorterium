# Enigmas — Caatedrum (guardado)

Jogo de enigmas em duplas tirado do site a pedido em 03/10/2026, pra voltar
depois. Nada nesta pasta vai pro ar: o build só compila `src/` e as migrations
saíram de `supabase/migrations/` (nunca rodaram no banco).

## O que está pronto (parte 1 de 3)
- Aba **Enigmas** na Sessão e aviso "A câmara de Caatedrum se abriu" pros
  jogadores, com entrada pelo aviso. Recurso `enigmas` do Painel de controle.
- Lobby: história, consentimento, memória (200 caracteres), sorteio no d20
  (duas maiores = Dupla A), troca de jogadores pelo mestre antes de começar.
- Jogo com tudo decidido no banco (funções `enigma_*`, estado secreto sem
  acesso direto); cada papel recebe só o que pode ver. Pausa pra todos,
  espectador (a outra dupla), painel do mestre (dica, pular, revelar, +tintas,
  ±1 min, linha do tempo).
- **A1 Testemunhas de Papel** e **B1 O Baile em 3 Valsas** como cenas 2D num
  quadro 1920×1080 (`src/stage/`): estante, livro aberto, tinteiro e corredor
  com as alas (arrastar as fichas); salão com relógio da torre, 8 cadeiras,
  valsas com o desenho da dança e bandeja de máscaras/pessoas (arrastar).
  No celular o quadro encolhe e pede pra virar; tem tela cheia.
- Faltavam: A2, B2, A3, B3 (parte 2), a Banca e a tela final (parte 3).

## Arquivos
| Aqui                         | Volta para                                         |
|------------------------------|----------------------------------------------------|
| `src/`                       | `src/features/enigmas/`                            |
| `conteudo/*.json`            | `enigmas/caatedrum/` (raiz do projeto)             |
| `enigma-content.mjs`         | `scripts/enigma-content.mjs`                       |
| `migrations/*.sql`           | `supabase/migrations/`                             |
| `_ligacao.diff`              | trechos em 5 arquivos do site (ver abaixo)         |

## Pra religar
1. Copie os arquivos de volta pros lugares da tabela.
2. Aplique `_ligacao.diff` (`git apply guardado/enigmas/_ligacao.diff`): aba
   na Sessão (SessionTablePanel + campaignSections), aviso no PrivateLayout,
   recurso no Painel de controle (siteFeatures) e as duas migrations no
   `scripts/verify-migrations.mjs`. Se as migrations ganharem números novos,
   renomeie os arquivos e ajuste a lista.
3. Mudou algum JSON do conteúdo? `node scripts/enigma-content.mjs` confere os
   puzzles (solução única etc.) e regera a migration do conteúdo.
4. Rode as migrations no Supabase (a de enigmas antes da de conteúdo; as do
   painel de controle e da Raiz Mestre precisam já estar rodadas).
5. `npm run verify`.
