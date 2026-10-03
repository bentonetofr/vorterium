# O Crime de Caatedrum (guardado)

Jogo de tabuleiro de dedução para 4 jogadores, tirado do site a pedido em
03/10/2026. Nada nesta pasta vai pro ar: o build só compila `src/` e as
migrations saíram de `supabase/migrations/`.

**Atenção ao banco:** se as migrations 20240177 e 20240178 já rodaram no
Supabase, as tabelas `caat_rooms` e `caat_state` e as funções `caat_*`
continuam lá (inofensivas: sem a aba ninguém chama). Pra apagar de vez:
`drop table caat_state, caat_rooms cascade; drop function caat_open, caat_lobby, caat_gm, caat_play, caat_view, caat_content, caat__ms, caat__log, caat__name, caat__who, caat__shift, caat__save;`
(confira os argumentos de cada função antes). Pra religar, rodar as
migrations de novo não quebra nada.

## O que está pronto (marco 1 de 9)
- Aba **Caatedrum** na Sessão e aviso "A mesa de Caatedrum está posta" (com
  Sentar). Recurso `caatedrum` do Painel de controle (nasce guardado).
- Lobby: mesa com 4 lugares (você sempre embaixo, vez no sentido
  anti-horário), estandarte com cor + emblema por lugar, apelido, nível 1–5,
  aviso das interferências do Mestre.
- Mestre: tira alguém, começa (4 sentados e aceitos), pausa/retoma, encerra,
  linha do tempo. Qualquer jogador pausa. Reconexão pelo banco.
- Teste do dono do site: senta mesmo sendo o mestre e completa a mesa com
  robôs (por enquanto só ocupam o lugar; jogariam a partir do marco 2).
- Regras do jogo físico em `conteudo/regras.config.json` (`original`) e
  extras da sessão em `sessao`/`niveis`; Caso 1 em `conteudo/caso1.json`.
- Faltavam: motor de regras (M2), baralho de 70 cartas com resolvedor (M3),
  mesa 16:9 com tabuleiro e cartas (M4), trocas (M5), caderno (M6),
  solução e pontos (M7), painel do Mestre/interferências (M8), acabamento (M9).

## Arquivos
| Aqui                       | Volta para                                       |
|----------------------------|--------------------------------------------------|
| `src/`                     | `src/features/caatedrum/`                        |
| `conteudo/*.json`          | `jogos/caatedrum/` (raiz do projeto)             |
| `caatedrum-conteudo.mjs`   | `scripts/caatedrum-conteudo.mjs`                 |
| `migrations/*.sql`         | `supabase/migrations/`                           |
| `_ligacao.diff`            | trechos em 5 arquivos do site (abaixo)           |

## Pra religar
1. Copie os arquivos de volta pros lugares da tabela.
2. `git apply guardado/caatedrum/_ligacao.diff`: aba na Sessão
   (SessionTablePanel + campaignSections), aviso no PrivateLayout, recurso no
   Painel de controle (siteFeatures) e as migrations no
   `scripts/verify-migrations.mjs`. Se os números das migrations mudarem,
   renomeie os arquivos e ajuste a lista.
3. `node scripts/caatedrum-conteudo.mjs` confere o caso e regera a migration
   do conteúdo.
4. Rode as migrations no Supabase (a do jogo antes da de conteúdo).
5. `npm run verify`.
