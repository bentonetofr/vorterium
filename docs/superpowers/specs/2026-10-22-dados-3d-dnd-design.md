# Dados 3D no estilo Baldur's Gate 3 (D&D 5e)

Data: 22/10/2026. Pedido do usuário: "uma rolagem como a do Baldur's Gate 3: o dado rolando numa superfície,
se adaptando à quantidade e ao tipo de dado", no visual do site. Substitui e amplia o Marco 6 do plano do D&D
(`2026-10-13-ficha-dnd5e-design.md`): as rolagens integradas da ficha passam a usar estes dados.

## Decisões do usuário (22/10)

| Pergunta | Decisão |
|---|---|
| Onde aparece | Tudo do D&D: painel de teste e bandeja na ficha **e** o rolador flutuante (`DiceFab`) nas campanhas de D&D. Outros sistemas ficam como estão. |
| Quem vê | Quem rolou vê o painel grande; o resto da mesa vê a mesma rolagem numa janelinha no canto. Rolagem privada: só quem rolou e o mestre. |
| CD | O mestre pede o teste (jogadores, teste, CD, CD oculta). Rolagem direto pela ficha abre sem CD. |
| Visual | Cada jogador escolhe o próprio conjunto (obsidiana, vinho, osso, cristal, ouro...); padrão = pedra escura, números dourados, brilho vermelho. A mesa vê os dados de cada um na cor dele. |
| Mecânicas | Vantagem/desvantagem (dois d20), Inspiração para rolar de novo, bônus de reação (Orientação, Bênção, Inspiração de Bardo), crítico (20 dourado) e falha crítica (1 racha em vermelho). O lobo do crítico continua. |
| Técnica | Motor próprio: Three.js (desenho) + cannon-es (física), carregado só na primeira rolagem, com modo simples de reserva. |

## 1. Peças

1. **Motor 3D** (`src/features/dice3d/`, chunk próprio, sem saber de D&D). Entrada: lista de dados (`{ sides, value }`),
   conjunto visual, modo (`stage` = um d20 em close no painel; `tray` = vários dados na bandeja). Saída: promessa que resolve
   quando todos param. Partes:
   - `geometry`: d4, d6, d8, d10, d% (dezenas), d12, d20 com faces numeradas (textura gerada em canvas) e o mapa face → número.
   - `physics`: cannon-es; lançamento com impulso e giro aleatórios, chão e paredes invisíveis; detecção de parada.
   - **Troca de face**: quando o dado para, lê a face de cima e **remapeia a numeração** (rotação do conjunto de números no
     próprio dado) para que a face de cima mostre o valor sorteado. A animação é física de verdade e o resultado é o do sistema.
   - `skins`: conjuntos visuais (material, cor do número, brilho, borda).
   - `sound`: batidas de dado geradas por Web Audio (sem arquivos), volume pelo impacto.
   - **Modo simples**: `prefers-reduced-motion`, WebGL ausente ou aparelho fraco → dado 2D que gira e mostra o número.
2. **Sorteio e registro**: o `diceService` atual. **Sorteia antes, grava em `dice_rolls`, depois anima.** Histórico, chat e o
   lobo do crítico continuam iguais; parar a animação não muda nada.
3. **Painel de teste** (ficha de D&D): CD no topo (ou "?"), d20 em close, tiles de bônus calculados da ficha (atributo,
   proficiência, especialista, itens/reações), escolha normal/vantagem/desvantagem, reações ligáveis antes de rolar,
   resultado Sucesso/Falha, efeitos de crítico, "Usar Inspiração e rolar de novo".
4. **Bandeja**: faixa larga onde caem dano e dados em quantidade (2d6+3, 8d6), soma por cima.
5. **Janelinha da mesa**: rolagens dos outros chegam pelo Realtime de `dice_rolls` e caem pequenas no canto, no conjunto de
   quem rolou, com nome do personagem, rótulo e total.
6. **Pedido de teste do mestre**: o mestre escolhe jogadores, teste e CD (pode ocultar); o painel abre na tela deles; a
   resposta volta ao mestre.

## 2. Fluxo e banco

Fluxo (pedido do mestre, Furtividade CD 15 oculta): pedido em `dnd_check_requests` → painel abre na tela do jogador com
"CD ?" e os tiles → clique → sorteio e gravação → animação → CD revelada, Sucesso/Falha → (Inspiração: rolar de novo, nova
rolagem ligada à anterior) → janelinha para a mesa e pedido marcado como respondido para o mestre. Pela ficha: o mesmo sem
pedido e sem CD.

Migration (uma, atrás de `dnd_open()` onde for do D&D):
- `dice_rolls`: `roll_label text`, `roll_context jsonb` (tipo: teste/salvaguarda/ataque/dano/iniciativa/morte/dado de vida;
  CD, CD oculta, vantagem, reações, natural, sucesso/falha, `request_id`, `rerolled_from`), `dice_skin text`. Rolagens
  antigas continuam válidas. O piso "total ≥ 1" deixa de valer quando a rolagem pede (teste do D&D pode dar 0 ou menos).
- `profiles.dice_skin text`: o conjunto de cada um, valendo em todo aparelho.
- `dnd_check_requests` (campanha, mestre, alvos, teste, CD, CD oculta, situação, criado em): só o mestre cria, cancela e lê
  a CD oculta; o jogador vê o pedido dele e recebe a CD só depois de rolar. Realtime.

## 3. Efeitos, desempenho e celular

- Estilo "palco" no painel: câmera próxima, d20 grande, luz quente, rastro leve; tiles entram um a um somando; CD revela
  com um giro. Crítico: explosão dourada, partículas, som; falha crítica: racha vermelho e tremida.
- Bandeja: dados quicam e batem entre si; soma aparece quando o último para; dados que não valem (vantagem) apagam.
- Desempenho: o motor só carrega na primeira rolagem (`import()`); um canvas reaproveitado; física com passo fixo e
  limite de tempo (se demorar, os dados "assentam" na face certa); 60 fps no computador, 30 aceitável no celular.
- Acessibilidade: o resultado também aparece em texto; "reduzir movimento" usa o modo simples.

## 4. Testes

- Puros (Vitest): mapa face → número de cada dado (toda face tem um número, sem repetir, faces opostas somam certo no d6/
  d20), troca de face (para qualquer face de cima e qualquer valor, a face de cima passa a mostrar o valor), montagem dos
  tiles de bônus a partir da ficha, vantagem/desvantagem, reações, decisão de sucesso/falha e crítico.
- Banco (PGlite): colunas novas, pedido de teste (mestre cria; jogador não vê CD oculta antes de rolar; outro jogador não
  vê o pedido).
- Visual: página `testes/dados.html` (só no `npm run dev`) para rolar cada dado, quantidades e conjuntos sem login.

## 5. Etapas

1. **Motor 3D** + página de teste `testes/dados.html` (sem banco, sem ficha).
2. **Banco e serviço**: migration, `diceService` com rótulo, contexto, conjunto e piso opcional.
3. **Painel de teste e bandeja na ficha**: cliques em perícia, salvaguarda, ataque, dano, iniciativa, morte e dado de vida;
   vantagem, reações, Inspiração, crítico.
4. **Mesa**: janelinha dos outros, `DiceFab` 3D nas campanhas de D&D, escolha do conjunto no perfil.
5. **Pedido de teste do mestre**.
6. **Acabamento**: sons, celular, modo simples, revisão.

Tudo segue guardado junto com o D&D (recurso `dnd5e`) até o Marco 8.
