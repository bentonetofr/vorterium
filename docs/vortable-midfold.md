# Vortable: mundo pronto MIDFOLD

Planícies de grama clara e viva, com pastos enormes e muito planos, trilhas de terra, uma estrada de lajotas cinzas de pedra no meio de uma faixa de terra que se desfaz na grama e árvores
imensas. É um mundo do Vortable (formato `vortable-world`) gerado por código com **só o que já existe nos catálogos** do motor.
Não há objetos soltos de enfeite: só as árvores (e pinheirinhos lá longe, como na referência), os caminhos e o acampamento do fim.

- Arquivo: `public/vortable/maps/midfold.mundo.json`. Importar à mão: Mundos → **Importar mundo** → escolher o arquivo.
- Não está na lista “Novo mundo” (`WorldsPanel.tsx`) de propósito; é só incluir em `TEMPLATES` se um dia quiser.
- Céu do mundo: meio-dia fixo, tempo limpo (o mestre muda ao vivo no Controle).
- Regerar: `python scripts/make-midfold-world.py` (gera e confere que dá pra andar de uma saída a outra; `--check` só confere).
  Código em `scripts/midfold/` (`world.py` monta as zonas, `trees.py` as árvores, `camp.py` o acampamento), usando
  `scripts/saltmore/lib.py` e `kit.py`. Edite o gerador, não o JSON.

## O percurso

| # | Zona | Tamanho | O que tem |
|---|---|---|---|
| 1 | Campos: a trilha começa | 112×72 | Início do mundo, à esquerda. Trilha de terra de esquerda a direita, com curvas |
| 2 | Campos: pasto aberto | 112×72 | A trilha segue da esquerda pra direita. Uma cabana abandonada à beira dela (ramal de terra até a porta); a porta leva à zona da cabana |
| 3 | Campos: as árvores imensas | 112×72 | Idem |
| 4 | A estrada | 112×72 | A trilha vem da esquerda e vira pra baixo, desembocando na estrada de lajotas que corta a zona de cima a baixo |
| 5 | A descida | 112×88 | A estrada desce, com curvas. Do lado direito, um grande pasto plano de campo de batalha: soldados tombados de dois exércitos (vermelho e azul), espadas cravadas e caídas, escudos, elmos, flechas, lanças, manchas de sangue e um estandarte caído de cada lado, mais cheio perto da linha de choque |
| 6 | O acampamento | 112×88 | A estrada continua pro sul (sem saída), com um ramal de terra até o acampamento: três tendas, fogueira, lenha, tronco e banco |
| – | Cabana abandonada (interior) | 24×19 | Uma sala só, saída pela porta de baixo de volta à zona 2: lareira apagada, mobília quebrada, teias e musgo (o mesmo cômodo da cabana do Saltmore, sem o sótão) |

As saídas ligam as zonas nos dois sentidos, no mesmo ponto de uma pra outra. Cada árvore imensa é uma massa de cinco “árvores
colossais” do catálogo, de troncos colados e copas fundidas (o motor não escala objetos).

## Arte nova: pacote "Campo de batalha"

O campo da zona 5 usa o pacote de objetos `batalha` (`batalha@...`), desenhado por código em `scripts/battle_art/` e encaixado no
catálogo do site por `python scripts/make-battle-art.py` (idempotente, como o do Apocalipse: rode de novo se o `npm run vorterium` do
motor sobrescrever `public/vortable/assets/catalog/objects.json`). O mundo precisa desse pacote no catálogo pra mostrar o campo.
O código do campo está em `scripts/midfold/battle.py` e o da cabana em `scripts/midfold/cabana.py`.
