# Prompt: novo jogo de puzzle no molde do "Livro Bloqueado"

> Cole tudo abaixo num chat novo do Claude Code aberto neste projeto (Vorterium).
> No fim, em **"O PUZZLE NOVO"**, cole o texto do seu puzzle.

---

Quero criar no Vorterium um **novo joguinho de puzzle**, no mesmo molde e estilo do **"O Livro Bloqueado"**, que já existe em `src/features/livro/` (migrations `20240177000000_livro_bloqueado.sql` e `20240178000000_livro_enigmas.sql`). **Leia esses arquivos antes de começar.** O jogo novo deve parecer da mesma família: mesma arquitetura, mesma interface, mesma pegada visual, com sala, objetos e enigmas próprios.

## 1. Como trabalhar comigo

- Responda sempre em **português do Brasil**.
- **Antes de programar, leia o puzzle com olho crítico.** Procure dependências circulares, passos impossíveis, números ou respostas que aparecem em dois lugares com sentidos diferentes e itens que precisam passar de um jogador para o outro.
  - Proponha correções numeradas e me pergunte o que for decisão minha. Use perguntas de múltipla escolha, com a recomendada primeiro.
  - Só comece depois que eu aprovar.
- **Entregue em marcos e pare no fim de cada um** para eu testar:
  - **Marco 1:** sala, movimento, multijogador ao vivo, espectadores e mestre, tela cheia, janelas dos objetos ainda vazias.
  - **Marco 2:** os enigmas e o objeto central.
  - **Marco 3:** acabamento, dicas e painel do mestre.
- **Nunca faça `git commit` sem eu pedir.** Deixe tudo no stage (`git add -A`). Quando eu pedir, me dê só a linha `git commit -m "..."`, sem `git add`.
- **Sempre cole no chat o SQL completo de cada migration nova ou alterada.** Eu é que rodo no Supabase.
- Verifique com `npm run verify`.
  - Registre cada migration nova em `scripts/verify-migrations.mjs`.
  - Se a migration ainda não rodou no banco, pode editar; se já rodou, crie outra com `create or replace`.
- Siga a memória do projeto:
  - **Recurso novo nasce guardado** no Painel de controle (`SITE_FEATURES` em `src/features/control/siteFeatures.tsx`).
  - **Recurso guardado não entra nas Novidades.**
  - Mensagens e comentários no estilo do código que já existe: português simples, cabeçalho explicando o arquivo.
- Não use nome de jogo comercial de referência no site.

## 2. O molde (o que o Livro Bloqueado é)

### 2.1 Experiência

- **Recurso no Painel de controle.**
  - Ligar com a página da campanha aberta abre o jogo por cima do site inteiro, em tela cheia, para todos da campanha.
  - Guardado, só o dono vê; o botão "Abrir nesta campanha" serve para testar.
  - Desligar encerra.
  - Isso usa o gancho `onToggle(enabled, ctx)` e os `actions` com `ctx.campaign` que já existem no `SiteFeature`.
- **Cartão "Clique para entrar":** o navegador só deixa entrar em tela cheia depois de um clique, então o clique do cartão já liga a tela cheia.
- **Saguão:** todo mundo da campanha aparece. O mestre toca em quem joga, de 1 a 2 pessoas (a 1ª vira a Capa Azul, a 2ª a Capa Vermelha), e aperta **Começar**. Os outros e o mestre **assistem**.
- **Partida:**
  - Sala em **pixel art, vista de cima um pouco inclinada**, como Stardew Valley ou Enigma do Medo.
  - Quem joga anda com **WASD** ou setas. O mouse destaca o objeto com contorno e nome.
  - Clicando, o boneco **anda sozinho até lá** (A*) e abre a janela. **E**, espaço ou Enter usa o objeto mais perto.
- **Janela do objeto:** aparece **no centro**, o fundo **desfoca e escurece um pouco** e o boneco para. Fecha com **Esc**, ✕ ou clicando fora. Dentro dela há uma **cena em pixel art interativa** e o mínimo de controles. Cada jogada responde com uma faixa curta ("A cera do pavio se parte.").
- **Espectadores e mestre:** veem os dois bonecos. Quem está num objeto ganha um balão "…" sobre a cabeça. Embaixo da tela fica "Kael · no Castiçal · assistir", e tocando ali se vê a mesma janela, só olhando.
- **Interface limpa:**
  - um chip do papel no canto superior esquerdo;
  - um menu **≡** no canto superior direito (tela cheia, voltar ao site, e para o mestre trocar quem joga e encerrar);
  - uma dica de controles que some sozinha;
  - o inventário da dupla no canto inferior esquerdo.
  - Mais nada de botões espalhados.
- **Fim:** cartão "O livro se abre." com o tempo, e a própria sala muda (velas acesas, livro aberto brilhando).

### 2.2 Regras de design do puzzle

- **É um enigma só, com várias portas de entrada.**
  - Cada objeto tem **camadas**: a primeira se faz sozinho; as outras dependem do estado dos outros objetos.
  - Cada volta a um objeto mostra algo novo.
- **Nenhum objeto se resolve sozinho.** Cada um depende de pelo menos dois outros.
- **Há um objeto central (o hub)** que mostra o estado da "máquina": um diagrama que **se preenche sozinho** em etapas por objeto, com ligações que aparecem quando uma dependência é descoberta. Ele recebe as respostas finais **numa ordem** que também é descoberta no jogo.
- **Errar tem consequência leve e reversível**: a ordem volta ao começo, as correntes se apertam de novo. Nada de perder a partida.
- **Toda revelação depende de uma condição verificável no estado**: luz parcial ou total, ângulo certo, item no inventário.
- **Inventário único da dupla**: nada precisa passar de mão em mão.
- **Sem círculos.**
  - Antes de programar, escreva o caminho completo do início ao fim e confira que cada passo usa só o que já foi revelado.
  - No Livro Bloqueado eu precisei corrigir: o castiçal e o retrato dependiam um do outro em círculo, e havia dois "números" diferentes com o mesmo papel.

### 2.3 Arquitetura (copie o padrão)

**Banco manda: Supabase com funções plpgsql `security definer`.**
- **Tabelas:**
  - `<px>_rooms`: `id`, `campaign_id`, `status` (`lobby` | `jogo` | `fim`), `version`. Tem índice único de sala aberta por campanha, RLS para os membros lerem e entra na publicação `supabase_realtime`.
  - `<px>_state`: `room_id`, `state jsonb`. **Sem grant nenhum**; só as funções leem.
- **Funções:**
  - `<px>_open(campaign)`: só o mestre; exige o recurso ligado ou o dono do site.
  - `<px>_close_mine()`.
  - `<px>_gm(room, action)`: `pick`, `start` (cria a partida), `reset`, `lobby`, `close`.
  - `<px>_play(room, action)`: só quem está jogando; devolve `{ok, msg}`.
  - `<px>_view(room)`: a visão filtrada.
- **O segredo da partida** (`state.game.secret`) é **sorteado em `<px>__new_game()`** e **nunca** sai do banco.
  - `<px>__game_view(secret, st)` devolve só o que a dupla já pode ver; as condições ficam no banco.
  - O mestre recebe à parte `gm: { secret, events }`.
- Cada mudança chama `<px>__save`, que grava e **sobe `version`**. O site escuta a linha da sala e pede a visão de novo.
- Cuidado: `natural` é palavra reservada no Postgres; não use como nome de variável.

**O movimento não passa pelo banco.**
- Vai pelo canal Realtime `<prefixo>:<sala>` (veja `livroNet.ts`): broadcast `pos` a cerca de 12 por segundo, mais presence para quem está online e a última posição.
- O nome do canal é **fixo**: não use `uniqueChannel` em broadcast/presence.
- Quem está longe é desenhado com 110 ms de atraso, interpolando entre duas posições.

**Front: `src/features/<nome>/`, no mesmo formato do livro.**

| Arquivo | O que faz |
|---|---|
| `<nome>Service.ts` | Chamadas RPC, tipos da visão, `subscribeRooms`, funções do painel de controle. |
| `<nome>Net.ts` | O ao vivo (broadcast + presence), com uma camada de transporte que dá para trocar em teste. |
| `use<Nome>Room.ts` | Pega a visão de novo quando `version` muda. |
| `<Nome>Host.tsx` | Fica no `PrivateLayout`, acha a sala aberta nas minhas campanhas e cobre a tela por portal (ou mostra a pílula "Voltar ao…" quando minimizado). |
| `<Nome>Overlay.tsx` | Cartão de entrada, tela cheia, conexão ao vivo, saguão ou partida, menu ≡. |
| `<Nome>Lobby.tsx` | O saguão. |
| `<Nome>GameView.tsx` | Canvas, chip, dica, barra de quem assiste, inventário, cartão final. |
| `PuzzlePanel.tsx` | A janela central, a faixa de mensagem e o Esc. |
| `game/art.ts` | Toda a arte **desenhada em código**: paleta, `px()`, `seeded()`, `makeCanvas()`, sprites de cada objeto num canvas próprio, `outlineOf()` para o contorno, chamas, e os bonecos 12×17 com capuz (frente/costas espelhadas, perfil espelhado, 2 quadros de andar). |
| `game/room.ts` | Posições (resolução nativa **384×216**), obstáculos, zona de uso e ponto de chegada de cada objeto, pontos de nascimento. |
| `game/engine.ts` | Laço, ampliação **inteira e sem suavizar**, WASD, mouse com teste de pixel opaco, A* em grade de 4 px com linha de visão, ordem de desenho pelo "pé", **luz** (escuridão por cima com furos radiais nas velas e jogadores, luar, poeira), nomes nítidos desenhados na resolução da tela, `setGame()` para a sala reagir ao estado. |
| `puzzles/kit.tsx` | `PixelScene` (cena nativa ampliada, mouse em coordenadas da cena), `Dial` (8 marcas), ícones de bits. |
| `puzzles/glyphs.ts` | Desenhos de bits: símbolos, glifos, algarismos. |
| `puzzles/<Objeto>Panel.tsx` | Um por objeto. |
| `<Nome>.css` | O visual da interface. |

- **Reaproveite por import** o que for genérico: `kit.tsx`, `glyphs.ts`, os helpers e bonecos de `art.ts`, `livroNet.ts`. Se o motor precisar receber outra sala, prefira **parametrizar** (passar o `Room`) a copiar o arquivo inteiro.

### 2.4 Estilo visual

- **Paleta:** noite roxa (`#0b0910`, `#1b1524`, `#261e33`, linhas `#4a3f5c`), ouro de vela (`#ecc66a`, `#ffe7a3`), madeira (`#3e281a`, `#5a3b27`), pergaminho (`#dacfae`), capas azul `#3b5aa8` e vermelha `#a8323a`.
- **Fonte:** **Pixelify Sans** em tudo dentro do jogo, carregada por `<link>` do Google Fonts. Force `font-family` em `h1/h2/p/span/button` dentro do overlay, porque o site tem fontes próprias.
- **Molduras de pixel:** borda dupla quadrada feita com `box-shadow` em camadas, sem cantos redondos. Animações em `steps()`.
- **Desfoque da janela:** `blur(3px) brightness(0.75)`.
- **Clima:** ambiente escuro e misterioso, com a luz vindo das velas e do luar. Cada objeto tem contorno de destaque `#ffe7a3` e uma setinha quicando quando está ao alcance.
- **Alvos de toque ≥ 44 px** e foco visível. Respeite `prefers-reduced-motion`.

### 2.5 Como testar (eu exijo prova)

- **Banco:** use um Postgres 18 descartável em `C:/Program Files/PostgreSQL/18/bin`, porta 5499. Faça `initdb` novo a cada rodada, porque roles são do cluster.
  - Simule `auth.uid()` com `current_setting('test.uid')`, crie as tabelas mínimas (`profiles`, `campaigns`, `campaign_members`, `is_campaign_member`, `is_campaign_master`) e rode a migration `20240175000000_site_features.sql`.
  - Escreva um teste com **a partida inteira resolvida** do começo ao fim, usando o segredo lido como superusuário. No meio, inclua os **erros**: ordem errada, valor errado, espectador tentando mexer.
  - Inclua as checagens de **vazamento**: a visão do jogador não pode conter nenhuma chave do segredo.
  - Rode a migration duas vezes para provar que não quebra.
- **Navegador:** use o painel do navegador com um **harness temporário**, um script Python na pasta de rascunho que remenda os arquivos.
  - Usuário falso por aba (`sessionStorage`).
  - Serviço falso (`localStorage`).
  - Transporte ao vivo trocado por `BroadcastChannel`, para testar 3 abas como Mestre, Jogador 1 e Jogador 2.
  - Visões geradas no Postgres de teste em vários momentos da partida (`\o arquivo.json`).
  - Antes de aplicar o harness, `git add -A` no código real. Depois, apague os arquivos falsos e rode `git checkout -- .`.
  - **Nunca** deixe código de teste no stage.
- Mostre capturas de cada momento: saguão, sala, cada janela em cada camada, fim.

## 3. O PUZZLE NOVO

**Nome do jogo:** _[nome]_
**Chave no painel:** _[ex.: `torre-dos-ecos`]_ · **Prefixo no banco:** _[ex.: `te_`]_
**Lugar e clima:** _[ex.: o observatório de Caatedrum à meia-noite]_
**Quem joga:** _[ex.: 2 jogadores, os outros assistem]_

_[Cole aqui o texto do puzzle: o conceito central, o objeto central (hub), cada objeto com suas camadas e o que dá e precisa, como tudo se conecta e o fluxo esperado do jogador.]_
