# Coleção de dados (skins por conquistas): anotação

Pedido do usuário em 22/10/2026. **Só anotado: o sistema de coleção ainda NÃO foi criado.** O que existe hoje são os três primeiros dados detalhados (ver "Já feito").

## O que o usuário quer

- Cada jogador tem a **sua própria coleção** de skins de dados, valendo em **todas as campanhas de D&D** (é da conta, não da campanha).
- **Conquistas específicas desbloqueiam novas skins.** O jogador usa qualquer skin que já ganhou em qualquer campanha de D&D.
- **Todo mundo começa com a mesma skin, bem simples: um dado de madeira velha e quebrada, com os números riscados a faca, todos tortos.**
- Como as skins passam a ter importância (são prêmio), elas precisam ser **muito detalhadas, muito bonitas e diferentes umas das outras**, não só uma troca de cor.

## Já feito (22/10)

Os três primeiros conjuntos com superfície pintada de verdade (`src/features/dice3d/dieSurfaces.ts`, ligado em `dieMesh.ts`, definidos em `skins.ts` com o campo `surface`):

| id | Nome | O que tem |
|---|---|---|
| `madeira` | Madeira Velha | **O dado inicial.** Veios e poros, nó, sujeira e manchas, rachaduras com ramificação, cantos lascados mostrando a madeira crua, quina gasta, números riscados a faca (traços retos tortos, fundos no meio e lascados na borda, a faca passa do ponto). Sem brilho. |
| `granito` | Granito | Quartzo, biotita e feldspato, manchas de mineral, brilho de mica (liso e metálico no mapa de brilho), veios de quartzo, furos, quinas lascadas, números entalhados com cinzel (fio de luz embaixo). |
| `plastico` | Plástico Marmorizado | Marmorizado em fitas macias, purpurina, bolhas de ar, chanfro claro nas quinas, verniz forte, números de tinta branca num sulco raso. |

Como funciona: cada face é pintada em canvas com sorteio de semente (`mulberry32(hash(skin:dado:face))`, então o mesmo dado sai igual em qualquer aparelho) em **três mapas**: cor, **relevo** (`bumpMap`, novo: rachaduras e entalhes afundam de verdade na luz) e rugosidade/metal. O atlas é maior nesses conjuntos (d20 em 2048, d10/d12/d100 em 1536). Custo: o granito leva uns 200 ms no d20 e 800 ms para todos os dados (uma vez por tipo de dado; madeira e plástico são bem mais rápidos).

**Disponíveis agora: só esses três** (decisão do usuário em 22/10: madeira, granito e plástico são os únicos iniciais; o resto não está disponível e nem aparece). As 7 skins antigas (vortice, obsidiana, vinho, osso, cristal, ouro, jade) ficam guardadas em `ALL_SKINS` com `hidden: true`: não aparecem na janela "Meus dados" e não podem ser escolhidas. `DICE_SKINS` é só a lista visível e `getSkin` de um id guardado (perfil ou rolagem antiga) cai no padrão. **O padrão (`DEFAULT_SKIN`) agora é `madeira`.** Ainda não há trava por conquista: os três iniciais ficam livres para todos.

## A fazer (não iniciado)

1. **Iniciais.** Madeira, granito e plástico são as únicas iniciais (já valendo). Quem tinha escolhido uma das 7 antigas passou a usar a madeira. Decidir se essas 7 voltam como prêmio de conquista (e para quem já as usava).
2. **Banco.** Algo como `user_dice_skins (user_id, skin_id, unlocked_at, achievement_id)` + catálogo de conquistas (`dice_achievements`) + rpc que concede. `profiles.dice_skin` só pode apontar para uma skin da coleção da pessoa (trava no banco, não só na tela). Tudo guardado atrás do recurso `dnd5e`, como o resto do D&D.
3. **Conquistas.** Cada skin tem uma conquista própria e específica. Ideias para decidir com o usuário: primeiro 20 natural; primeiro 1 natural; N rolagens; N testes de perícia; acerto crítico; sobreviver a uma salvaguarda contra a morte; ficar com 1 PV; causar X de dano num golpe só; jogar N sessões; terminar uma campanha; a "vitória" certa contra um chefe. As conquistas se medem pelas rolagens gravadas (`dice_rolls.roll_context` já tem `natural`, `crit`, `kind`, `outcome`) e por eventos da ficha.
4. **Tela da coleção.** A vitrine de hoje (janela "Meus dados") vira a coleção: skins ganhas giram como agora; as que faltam aparecem travadas (silhueta ou dado escurecido) com o nome da conquista e o progresso. Aviso ao desbloquear uma skin.
5. **Refazer as 7 skins antigas** (hoje guardadas, `hidden`) no mesmo nível de detalhe (osso entalhado, obsidiana, vinho, ouro, cristal, jade, pedra do Vórtice) e criar novas bem diferentes entre si (ideias: marfim, osso de dragão, ferro enferrujado, gelo, lava/magma, meteorito, cobre oxidado, vidro fumê).
6. **Mais realismo (opcional):** geometria com chanfro (bisel) nas arestas, em vez de faces totalmente planas; dá muito mais "cara de dado de verdade".
7. **Desempenho:** atlas grandes custam memória em celular fraco. Se for problema, voltar a 1024/1536 nos conjuntos detalhados em telas pequenas, ou gerar o d20 uma vez e reaproveitar.

## Perguntas em aberto

- Quantas skins ao todo, e quais conquistas desbloqueiam quais?
- As conquistas valem só em campanhas de D&D (sim, pelo pedido) ou também em testes?
- Quem já tem skins antigas ganha de graça?
- Conquista é por conta (some se a pessoa sair de uma campanha?) ou fica para sempre? (sugestão: fica para sempre, é da conta)
