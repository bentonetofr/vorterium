# D&D 5e no Vorterium — planejamento geral

Plano para ligar o sistema D&D 5e ao site, da ficha ao criador de personagem
e às rolagens. Escrito em 13/10/2026 depois de ler o que já existe no código.
Nada aqui foi implementado ainda.

## 1. Decisões já tomadas (13/10/2026)

| Tema | Decisão |
|---|---|
| Edição | **5e 2014 primeiro.** O banco já assume `dnd5e_2014`. A 2024 vira um segundo conjunto de regras, depois. |
| Conteúdo | **SRD 5.1 + homebrew.** O SRD 5.1 é CC-BY-4.0 e pode ser embutido com atribuição. O que não está no SRD o mestre cadastra como homebrew. |
| Ficha atual | **Reaproveitar a lógica, refazer a casca.** Cálculos, AUTO/MANUAL e tabelas úteis ficam. A ficha é refeita no molde do Vampiro/Altherium. |
| Alcance inicial | **Ficha completa + criador de personagem** e **rolagens integradas.** Bestiário/encontros e compêndio de regras ficam para uma segunda grande entrega. |

## 2. O que já existe (auditoria)

### 2.1 Código escrito e desligado

`src/features/sheets/dnd/`, cerca de 4,8 mil linhas:

- `DndCharacterSheetPanel.tsx` (1171 linhas): ficha editável, rascunho em strings, validação, salvamento, abas
  Resumo/Combate/Perícias/Magias/Inventário/Traços/Anotações.
- `DndDetailsEditors.tsx`, `services/dndSheetService.ts`, `utils/dndCalculations.ts` (modificador, proficiência,
  CD de magia, bônus de ataque mágico), `DndCharacterSheet.css` (1789 linhas), `mockCharacter.ts`, `DndCharacterSheetPreview.tsx`.
- Modo **AUTO/MANUAL** por campo derivado (`proficiency_bonus`, `initiative_bonus`, `spell_save_dc`, `spell_attack_bonus`),
  guardado em `dnd_character_overrides`.
- `CampaignSheetPanel.tsx` mostra só `DndComingSoon` para `dnd5e`; `NewCampaignPage.tsx` bloqueia criar campanha D&D
  ("ainda em desenvolvimento"). O status em `systems.ts` é `coming-soon`.

### 2.2 Banco (migrations 22 a 27 do contrato)

`20240123` base `dnd_character_sheets` (RLS: mestre vê/edita tudo, jogador a própria, INSERT só em campanha `dnd5e`),
`20240125` atributos e salvaguardas, `20240127` detalhes (`dnd_character_skills`, `_attacks`, `_inventory`, `_spells`),
`20240128` motor de regras (`ruleset`, `race_key`, `class_key`, `subclass_key`, `background_key`, `dnd_rule_catalog_entries`,
`dnd_character_proficiencies`, `dnd_character_overrides`), `20240129` catálogo de equipamentos (36 armas, 13 armaduras,
26 itens, 8 ferramentas).

O catálogo **não tem** classes, raças, antecedentes, talentos nem magias. Só equipamento.

### 2.3 O que falta em relação às fichas modernas (Vampiro, Altherium, Terra Devastada)

| Recurso | Vampiro/Altherium | D&D hoje |
|---|---|---|
| Ficha de NPC (`is_npc`, `NpcSection`) | sim | não |
| Retrato (bucket + upload) | sim | não |
| Cards ao vivo da mesa para o mestre | sim | não |
| Flag no Painel de controle (`SITE_FEATURES`) | sim (Vampiro) | não |
| Resumo na Visão Geral da campanha (`loadSheetsSummary`) | sim | não |
| Listagem em "Minhas fichas" | sim | não |
| Rolagem a partir da ficha, no chat e na Atividade | em andamento (Vampiro, marco 3) | só `rollDice` solto |
| Ficha dentro do Vortable (`SheetFab`) | automático via `CampaignSheetPanel` | automático quando ligar |

### 2.4 Pontos do resto do site que precisam saber de D&D

1. **`rollParsedFormula` aplica `total = Math.max(1, total)`** ([diceService.ts:216](src/features/dice/services/diceService.ts:216)).
   Em D&D um teste `1d20-1` com 1 natural dá 0, e `1d20-5` com 3 dá -2. Hoje o site mostraria 1. Precisa de uma opção
   "sem piso" para rolagens de D&D (e conferir a coluna `result` do banco, que pode ter `check (result >= 1)`).
2. **`critical.ts` (`fullRollKind`)** só marca crítico se *todos* os dados caírem no máximo. Com vantagem (`2#d20`) um 20 e
   um 5 não é crítico para ele, mas em D&D o dado mantido é o que vale. Precisa de uma regra "dado mantido" para d20 de ataque.
3. **Iniciativa:** `rollInitiative` ([initiativeService.ts:148](src/features/initiative/services/initiativeService.ts:148))
   rola `1d20` sem modificador. D&D precisa somar o bônus da ficha (Destreza + extras) e aceitar vantagem.
4. **Atividade:** `activityService.ts` tem textos por sistema (`isAdaptedSystem`). Rolagens de D&D com contexto
   ("Ataque com Espada Longa: 17") precisam de texto próprio.
5. **Tipo `RollBreakdownItem` / `dice_rolls`:** não há campo de *rótulo* da rolagem ("Furtividade", "Salvaguarda de Des").
   Precisa de uma coluna (por exemplo `roll_label text`) para o chat/histórico mostrarem o motivo do dado.
6. **Bestiário** (`SessionTablePanel`: só Altherium e Terra Devastada Adaptada) e **Livro** (`RulebookPanel`: só Altherium)
   ficam de fora desta entrega, mas o plano deixa ganchos.
7. **`verify-migrations.mjs`** tem a lista de migrations fixa: toda migration nova entra na lista do script e no README.

## 3. Princípios

- Segue o contrato de [ARQUITETURA-E-ROADMAP.md](ARQUITETURA-E-ROADMAP.md): RLS explícita, triggers para campos estruturais,
  dados repetíveis em tabelas, não em JSONB.
- **Nasce guardado**, como o Vampiro: recurso `dnd5e` no Painel de controle, só o dono do site cria campanha e vê a ficha
  até o último marco. Fora das Novidades até liberar.
- **Regras puras em TypeScript, sem React e sem Supabase** (`src/features/sheets/dnd/rules/`). A tela só chama o motor.
  Isso torna o cálculo testável e deixa a 2024 entrar depois como outro conjunto.
- **Dado calculado nunca é gravado como verdade**, a não ser como override MANUAL consciente do jogador/mestre.
- **Conteúdo do livro tem proveniência.** Cada entrada do catálogo marca a origem (`srd51`, `homebrew`) e a atribuição
  é exibida no site.
- Português (Brasil) em tudo que o usuário lê. Nomes oficiais da tradução brasileira quando existirem; chave em inglês
  (`fireball`) como identificador estável.
- Cada marco termina com `npm run verify`, migration colada no chat e commit+push (regra do repo).

## 4. Arquitetura proposta

### 4.1 Camadas

```
src/features/sheets/dnd/
  rules/            motor puro (sem React, sem Supabase)
    abilities.ts    modificadores, proficiência, perícias, salvaguardas
    combat.ts       CA, iniciativa, ataque/dano, PV máximo, dados de vida
    spellcasting.ts espaços por nível, multiclasse, CD, preparadas/conhecidas
    progression.ts  XP -> nível, ganhos por nível, ASI, subclasse
    derive.ts       computeDerived(ficha, catálogo) -> tudo que a tela mostra
  catalog/          conteúdo (SRD + tipos) carregado sob demanda
    classes/ races/ backgrounds/ spells/ equipment/ conditions/ ...
    index.ts        getEntry(category, key), search(category, texto)
  services/         dndSheetService (Supabase)
  components/       Ficha, abas, criador, subida de nível
  hooks/            useDndSheet, useDerived
```

### 4.2 Onde mora o conteúdo do livro

**Recomendação: arquivos TypeScript versionados no repo, não tabela no Supabase.**

- Prós: sem migration a cada correção de texto; tipagem forte; funciona offline; revisão por commit; carregamento por
  `import()` dinâmico (magias, por exemplo, só baixam quando o jogador abre a aba); mesmo caminho do Vampiro (`vtmPowers.ts`).
- Contras: não dá para consultar por SQL; o mestre não edita o oficial (e nem deve).
- A tabela `dnd_rule_catalog_entries` e o seed de equipamentos viram **legado**: os dados migram para `catalog/equipment/`,
  e a tabela fica sem uso até uma migration de limpeza no fim do projeto.
- **Homebrew** (do mestre e dos jogadores) é a exceção que precisa de banco: tabela por campanha (`dnd_homebrew_entries`), lida junto
  com o catálogo oficial pelo mesmo `getEntry`.

Chave de referência: a ficha guarda `class_key`, `race_key` etc. (já existem). O motor resolve a chave no catálogo
(oficial primeiro, depois homebrew da campanha).

### 4.3 Modelo de dados (migrations novas, a partir de `20240201000000`)

Reaproveita `dnd_character_sheets` e as tabelas de detalhe. Acrescenta:

| Mudança | Motivo |
|---|---|
| `dnd_character_sheets`: `is_npc`, `portrait_url`, `hit_dice_used`, `currency` (pp/po/pe/pc/pl), `conditions text[]`, `exhaustion smallint`, `concentrating_on text`, `choices jsonb` (escolhas do criador: perícias de classe, idiomas, truques, etc.), `build_version` | NPC, retrato, estado de jogo, snapshot das escolhas |
| `dnd_character_classes` (sheet_id, class_key, level, subclass_key, ordem, `hp_rolls int[]`) | Multiclasse e HP por nível. Mesmo que a tela só use uma classe no começo, o modelo já é correto. |
| `dnd_character_resources` (sheet_id, key, label, current, max, recharge `short/long/dawn/manual`) | Espaços de magia, Fúria, Ki, Inspiração de Bardo, Surto de Ação etc. |
| `dnd_character_features` (sheet_id, source, key, level, notes, uses) | Características de classe/raça/talento aplicadas e anotações |
| `dnd_homebrew_entries` (campaign_id, category, key, name, data jsonb, created_by, `status` `pessoal/pendente/aprovado`) | Homebrew de mestre e jogadores. O jogador cria como `pessoal` (só a ficha dele usa) e pode propor à campanha (`pendente`); o mestre aprova (`aprovado`, vale para todos) ou recusa. Entradas do mestre nascem `aprovado`. |
| `dnd_character_overrides.field_key`: ampliar a lista permitida | Hoje só 7 campos; D&D real precisa de mais (deslocamento por tipo, bônus de perícia, etc.) |
| `dice_rolls.roll_label text null` | Rótulo da rolagem (seção 4.5) |

Regras de segurança (padrão do Vampiro):

- Política de NPC como em `20240189_fichas_de_npc.sql`: só o mestre cria/edita ficha com `is_npc`, e jogador não vê NPC.
- Enquanto guardado: política "só o dono do site" como em `20240188_vampiro_so_dono.sql`.
- Trigger de campos estruturais (`campaign_id`, `user_id`, `is_npc` imutáveis).
- A tabela de detalhe continua checando `sheet_id` por trigger de proteção (já existe nas atuais).
- **Antes de qualquer migration:** conferir no Supabase real se existem linhas em `dnd_character_sheets`. Como o D&D nunca
  foi liberado, o esperado é zero, mas a migration não deve assumir isso sem olhar.

### 4.4 Motor de regras (o coração)

`computeDerived(sheet, classes, features, equipment, overrides)` devolve um objeto único, usado pela ficha, pela
rolagem e pelo card do mestre, para os números nunca divergirem:

- modificadores e bônus de proficiência (por nível total);
- salvaguardas e 18 perícias (proficiência, **especialização**, Ladino/Bardo, "metade" do Bardo `Jack of All Trades`);
- percepção passiva, iniciativa, deslocamento;
- **CA:** armadura + escudo + limite de Des, Defesa sem Armadura (Bárbaro/Monge), Armadura Natural, itens mágicos;
- **PV máximo:** dado de vida (média ou rolado, por nível) + Con por nível, bônus de raça (Anão da Colina);
- dados de vida restantes e descansos curto/longo;
- ataques: bônus (Força/Destreza por acuidade, proficiência de arma), dano, versátil, alcance;
- conjuração: atributo, CD, bônus de ataque, espaços por nível (conjurador completo, meio, terço, Bruxo/Pacto, multiclasse),
  truques/magias conhecidas/preparadas, ritual, concentração;
- carga (Força x 15), moedas;
- progressão: tabela de XP, bônus por nível, aumento de atributo (níveis 4, 8, 12, 16, 19), escolha de subclasse.

Cada saída aceita override (AUTO/MANUAL), reaproveitando o mecanismo que já existe.

Testes: o repo não tem runner. Proposta: **Vitest só como devDependency, só para `rules/`.** É a única parte em que erro
silencioso (CA errada, espaço de magia errado) estraga uma mesa. Decisão aberta na seção 8.

### 4.5 Rolagens integradas

Tudo passa pelo `diceService`, então aparece no chat, na Atividade e no histórico como qualquer rolagem.

| Ação na ficha | Fórmula | Observação |
|---|---|---|
| Teste de atributo / perícia | `1d20+N` | Vantagem = `2#d20+N`, desvantagem = `2@d20+N` (já suportado pelo parser) |
| Salvaguarda | `1d20+N` | |
| Ataque | `1d20+N` | Crítico = d20 mantido em 20; falha crítica = 1 |
| Dano | `XdY+N` | Em crítico dobra os dados (não o modificador) |
| Iniciativa | `1d20+bônus` | Também alimenta o rastreador de iniciativa |
| Salvaguarda de morte | `1d20` | Atualiza sucessos/falhas na ficha; 20 = 1 PV; 1 = duas falhas |
| Dado de vida (descanso curto) | `1dX+Con` | Subtrai de `hit_dice_used`, soma PV |

Mudanças técnicas necessárias:

1. `roll_label` na tabela e no tipo `DiceRoll`; chat e histórico mostram "Furtividade: 17".
2. `rollDice(campaignId, formula, { label, isPrivate, floor })` com `floor` opcional (sem piso para D&D).
3. `critical.ts`: regra "dado mantido" para d20 com vantagem/desvantagem.
4. Mensagens de atividade de D&D (sem vazar nome de NPC, como já é feito).
5. Rolagem **privada** do mestre continua valendo (já existe `is_private`).

### 4.6 Interface

**Ficha (molde do Vampiro):** cabeçalho com retrato, nome, classe/nível, raça; barras de PV (com PV temporário), CA,
iniciativa, deslocamento, inspiração; atributos e salvaguardas clicáveis (clique rola); abas:

1. Resumo (o que se usa na mesa),
2. Combate (ataques, ações, condições, salvaguardas de morte),
3. Perícias,
4. Magias (espaços clicáveis, preparadas, concentração),
5. Inventário (peso, moedas, equipado),
6. Características (classe, raça, talentos, com usos e recarga),
7. História (traços, ideais, vínculos, defeitos),
8. Anotações.

Botões **Descanso curto** e **Descanso longo** aplicam as recargas. Cabe no `SheetFab` do Vortable (que já faz zoom
para caber).

**Criador de personagem (assistente em passos):**
1. Conceito (nome, retrato),
2. Raça e sub-raça,
3. Classe (nível 1; ou nível inicial maior para mesa que começa mais alta),
4. Atributos (matriz padrão 15/14/13/12/10/8, compra de 27 pontos, 4d6 descartando o menor com a rolagem no site, ou manual),
5. Antecedente (Acólito do SRD **ou** antecedente personalizado: 2 perícias, 2 de ferramenta/idioma, equipamento),
6. Perícias, truques e magias iniciais,
7. Equipamento inicial (pacote da classe ou ouro),
8. Revisão e criação.

O assistente grava a ficha normal. Depois que ela existe, o jogador edita por cima (nada fica preso no assistente).

**Subida de nível:** assistente que mostra o que muda (PV, características, magias novas, ASI/talento, subclasse).

**Mestre:** na aba Fichas, cards ao vivo (PV, CA, percepção passiva, espaços de magia, condições) e abertura da ficha
completa, como no Vampiro. Seção de NPCs com `NpcSection`.

### 4.7 Integrações menores (uma vez só, no marco da ficha)

- `CampaignSheetPanel`: trocar `DndComingSoon` pelo painel novo, atrás da flag.
- `NewCampaignPage`: mostrar o cartão D&D só para quem pode ver; tirar o bloqueio e o `DndComingSoon` no fim.
- `CampaignOverviewPanel.loadSheetsSummary`: ramo `dnd5e`.
- `MySheetsPage` / `sheetService`: listar fichas D&D em "Minhas fichas".
- `systems.ts`: `status` vira `available` só no último marco; descrição nova.
- `SITE_FEATURES` e `VAMPIRO_FEATURE`-like `DND_FEATURE = 'dnd5e'`.
- README e ARQUITETURA: contagem de migrations e estado da ficha D&D (hoje o README diz "escrita, mas NÃO conectada").

## 5. Conteúdo: SRD 5.1 e seus limites

O que o SRD 5.1 oferece (conferido em 13/10/2026 contra o PDF oficial `SRD_CC_v5.1.pdf`: atribuição, antecedente Acólito único,
talento Agarrador único, subclasses por classe e cerca de 310 entradas de magia; o restante da tabela segue o esperado e é
conferido de novo a cada marco de catálogo):

| Categoria | No SRD 5.1 | Consequência |
|---|---|---|
| Classes | 12, cada uma com **uma** subclasse | Outras subclasses entram como homebrew |
| Raças | 9 (Anão, Elfo, Halfling, Humano, Draconato, Gnomo, Meio-elfo, Meio-orc, Tiefling), com 1 sub-raça onde há | Sub-raças extras, homebrew |
| Antecedentes | só **Acólito** | Antecedente personalizado (regra oficial do Livro do Jogador) cobre o resto |
| Talentos | só **Agarrador** | Subida de nível usa mais Aumento de Atributo; talentos extras, homebrew |
| Magias | cerca de 300+ | Completo para o SRD |
| Equipamento | armas, armaduras, itens, ferramentas, pacotes | O seed atual já cobre boa parte |
| Condições, regras de descanso, combate | sim | Alimenta o compêndio futuro |
| Monstros | cerca de 300 | Segunda grande entrega |

Obrigações:

- **Atribuição CC-BY-4.0** visível no site (rodapé ou página "Sobre/Créditos" e na tela de criação de personagem):
  o texto exato exigido pelo SRD 5.1 (conferido no PDF oficial em 13/10/2026) fica em um único arquivo de constante
  (`sheets/dnd/constants/dnd.ts`). O SRD pede que nenhuma outra atribuição à Wizards seja incluída; pode-se dizer "compatível com a quinta edição".
- Não copiar texto de livros fora do SRD (PHB além do SRD, Xanathar, Tasha etc.).
- A tradução é nossa: nome em PT-BR + nome original em inglês + texto traduzido por nós. Para consistência, um
  glossário (`catalog/glossary.ts`) fixa os termos (Saving Throw = Salvaguarda, Spell Slot = Espaço de magia, ...).

## 6. Marcos

Tamanho: P (um dia de trabalho), M (alguns dias), G (uma semana ou mais). Cada marco é entregável e testável sozinho.

### Marco 0: fundação (P) — feito em 13/10/2026
- Este documento revisado e aprovado.
- Flag `dnd5e` em `SITE_FEATURES`; cartão D&D visível só para o dono em `NewCampaignPage`.
- Conferir no banco real se há fichas em `dnd_character_sheets` (feito: 0 linhas em 13/10/2026, a migration pode evoluir a tabela sem migrar dados).
- Adicionar Vitest (decidido na seção 8) com o script `npm test`.
- Texto de atribuição CC-BY conferido.
- **Sem mudança visível para os jogadores.**

### Marco 1: motor de regras e catálogo núcleo (G) — FEITO em 13/10/2026

**Motor** (`sheets/dnd/rules/`, `computeDerived`): nível total, proficiência, salvaguardas, 18 perícias (meia proficiência e
especialização), iniciativa, percepção passiva, **CA** (leve/média/pesada, escudo, Defesa sem Armadura de Bárbaro e Monge),
**PV** (dado cheio no nível 1, média ou rolado depois, mínimo 1 por nível, bônus por nível), dados de vida e descanso longo,
**conjuração** (espaços por classe, multiclasse, Magia de Pacto do Bruxo separada, CD, ataque, truques, magias conhecidas e
preparadas, grimório), **progressão** (tabela de XP, Aumentos de Atributo por classe, pré-requisitos de multiclasse),
sobrescritas manuais (AUTO/MANUAL).

**Catálogo** (`sheets/dnd/catalog/`, tudo do SRD 5.1, tabelas conferidas contra o PDF oficial): 12 classes com tabela de
progressão, características por nível, proficiências, equipamento inicial e multiclasse; a subclasse do SRD de cada uma
(12); 9 raças e 4 sub-raças (mais os 10 ancestrais dracônicos); antecedente Acólito e o personalizado; 37 armas, 12
armaduras e escudo, 26 itens, 35 ferramentas; 14 condições e a Exaustão; 6 estilos de luta; glossário PT-BR. Busca por nome
(sem acento) e ligação classe -> motor (`toClassLevels`).

**Qualidade:** 181 testes (`npm test`), incluindo conferência nível a nível das características de classe com as tabelas do
SRD, tabelas de espaços de magia, exemplos do próprio SRD (Patrulheiro 4 / Mago 3) e integridade das referências.

**Correções feitas no seed antigo de equipamento** (o catálogo da migration 27 não tinha sido conferido): peso da alabarda e do
arco longo, zarabatana que faltava, dano da rede, e a lista de ferramentas completa (o seed tinha 8, o SRD tem 35).
Unidades da edição brasileira: peso em kg, alcances em metros; deslocamento do motor em pés (a tela converte, 30 pés = 9 m).

**Ficou para os próximos marcos:** magias (310 do SRD, Marco 5), Metamagia e Invocações Místicas (opções individuais, Marco 5),
talento Agarrador, e o catálogo de itens mágicos.

### Marco 2: banco (M)
- Migrations novas (seção 4.3), políticas de NPC e "só o dono", lista de migrations no `verify-migrations.mjs` e README.
- Serviços: classes, recursos, características, homebrew, retrato (bucket `dnd-portraits`).
- Migration colada no chat; avisar quais precisam rodar antes do deploy.

### Marco 3: ficha nova, no molde das outras (G)
- Painel, cabeçalho, abas, salvamento automático, AUTO/MANUAL, retrato, NPCs, cards do mestre ao vivo.
- Ligação em `CampaignSheetPanel`, Visão Geral, Minhas fichas, SheetFab (testar no Vortable e no celular).
- Reaproveita o CSS atual onde servir; o que é incompatível com o tema Medieval Dark v2 é refeito.
- Edição livre ainda: o jogador digita classe e raça; o assistente vem no marco seguinte.

### Marco 4: criador de personagem (G)
- Assistente em oito passos (seção 4.6) escrevendo na ficha.
- Compra de pontos, matriz padrão, 4d6.
- Magias iniciais por classe e pacote de equipamento.

### Marco 5: magias e recursos (G)
- Catálogo de magias do SRD em lotes por nível (truques e 1º primeiro; depois 2º-3º, 4º-6º, 7º-9º), tradução nossa.
- Aba Magias: buscar, filtrar por classe/escola/nível, preparar, ritual, concentração, espaços clicáveis.
- Recursos de classe (Fúria, Ki, Inspiração de Bardo, Canalizar Divindade, Forma Selvagem, Pontos de Feitiçaria, Surto
  de Ação...) e descansos.

### Marco 6: rolagens integradas (M)
- Coluna `roll_label`, `floor`, crítico por dado mantido, mensagens de atividade (seção 4.5).
- Cliques na ficha rolam: perícia, salvaguarda, ataque, dano, iniciativa, morte, dado de vida; vantagem/desvantagem.
- Rastreador de iniciativa usa o bônus da ficha em campanhas D&D.
- O chat e o botão flutuante de dados (`DiceFab`) passam a mostrar o rótulo.

### Marco 7: subida de nível e homebrew (G)
- Assistente de subida de nível (PV, características, magias, ASI/talento, subclasse, multiclasse).
- Tela de homebrew para mestre **e jogadores**: itens, magias, talentos, antecedentes e raças simples (`dnd_homebrew_entries`).
  Jogador cria como pessoal e pode propor à campanha; o mestre aprova ou recusa numa fila.
- Subclasses e classes homebrew só se der: dependem de um editor de progressão.

### Marco 8: acabamento e liberação (M)
- Revisão de todos os textos traduzidos, mesa real de teste (uma sessão), celular, impressão/PDF da ficha (opcional).
- Página de créditos com a atribuição CC-BY e remoção do `DndComingSoon` e do bloqueio em `NewCampaignPage`.
- `status: 'available'`, ligar no Painel de controle, entrada nas Novidades, README/ARQUITETURA atualizados.

### Depois (fora do alcance atual, com ganchos deixados)
- **Bestiário e encontros:** monstros do SRD, ficha de monstro no Bestiário do mestre, iniciativa e Vortable
  (PV no token). `SessionTablePanel.showBestiary` já tem o ponto de entrada.
- **Compêndio de regras e magias** como aba Livro (`RulebookPanel` hoje só renderiza PDF).
- **Regras 2024** como segundo `ruleset`.
- Importar/exportar ficha em JSON.

## 7. Riscos

| Risco | Mitigação |
|---|---|
| Volume de tradução (magias, características) | Lotes por marco; glossário fixo; revisão no Marco 8 |
| Erro silencioso de regra (CA, espaços, PV) | Motor puro + testes; override MANUAL para casos fora das regras |
| SRD tem pouco conteúdo de antecedente, talento e subclasse | Antecedente personalizado + homebrew; comunicar a limitação |
| Ficha pesada para o `SheetFab` e o celular | Abas, listas virtualizadas só se medir problema; catálogo por `import()` dinâmico |
| Dados de teste antigos em `dnd_character_sheets` | Conferir no Marco 0 antes de qualquer migration |
| Piso de 1 em rolagens quebrar D&D | Opção `floor` no Marco 6, com teste |
| Tamanho do bundle com catálogo grande | Catálogo carregado sob demanda; medir antes e depois |
| Termos jurídicos da licença | Texto de atribuição conferido na fonte do SRD no Marco 0; nada de conteúdo fora do SRD |

## 8. Decisões de produto (respondidas em 13/10/2026)

| # | Tema | Decisão |
|---|---|---|
| 1 | Testes | **Vitest**, só para `rules/`. |
| 2 | Multiclasse | **Já no criador** (não só na subida de nível). O assistente aceita mais de uma classe com níveis distribuídos. |
| 3 | PV por nível | **Configurável por campanha** (média ou rolagem), em `CampaignSettingsPanel`. A escolha vale para criador e subida de nível. |
| 4 | Método de atributos | **O jogador escolhe livre** (matriz padrão, compra de 27, 4d6 ou manual). Sem restrição do mestre. |
| 5 | Nível inicial | **Qualquer, de 1 a 20.** O criador monta o personagem direto no nível pedido (PV, magias, características acumulados). |
| 6 | Homebrew | **Jogadores também criam.** Pessoal por padrão; proposta à campanha com aprovação do mestre (seção 4.3). |
| 7 | Arte do criador | **Sim**, cartões com arte para classes e raças, no estilo da escolha de clã do Vampiro. Gerada por script próprio, como `make-system-art.py`. |

### Efeitos nos marcos

- **Marco 2 (banco):** `dnd_character_classes` já recebe várias linhas por ficha; `dnd_homebrew_entries` ganha `status`;
  configuração de PV por campanha precisa de uma coluna (ou tabela de configuração D&D da campanha) na migration.
- **Marco 4 (criador):** passo de classe vira "classes e níveis"; motor precisa resolver pré-requisitos de multiclasse
  (atributo mínimo 13), espaços de magia combinados e proficiências parciais de multiclasse. Níveis altos exigem
  escolhas acumuladas (ASI/talentos, subclasse, magias) num passo só, então o assistente ganha um passo de "escolhas por nível".
  Arte de classes e raças (12 + 9) é preparada junto, antes ou durante este marco.
- **Marco 7 (subida de nível e homebrew):** a subida de nível passa a reaproveitar as mesmas telas de escolhas do criador.
  A fila de aprovação de homebrew do mestre entra aqui.
- **Marco 0:** Vitest entra como devDependency e um script `npm test`.

## 9. Próximo passo sugerido

Marco 0 inteiro (com o Vitest), mais o **esqueleto do Marco 1** (tipos do catálogo e a função `computeDerived` com um personagem de
exemplo e testes). É a parte que decide se o resto fica fácil: se o motor estiver certo, a ficha, o criador e as
rolagens só o chamam.
