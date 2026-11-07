# Vortable: mundo pronto MIDFOLD

Planícies de grama clara e viva, com pastos enormes e muito planos, trilhas de terra, uma estrada de lajotas de pedra e árvores
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
| 2 | Campos: pasto aberto | 112×72 | A trilha segue da esquerda pra direita |
| 3 | Campos: as árvores imensas | 112×72 | Idem |
| 4 | A estrada de pedra | 112×72 | A trilha vem da esquerda e vira pra baixo, desembocando na estrada de lajotas que corta a zona de cima a baixo |
| 5 | A descida | 112×88 | A estrada de pedra desce, com curvas |
| 6 | O acampamento | 112×88 | A estrada continua pro sul (sem saída), com um ramal de terra até o acampamento: três tendas, fogueira, lenha, tronco e banco |

As saídas ligam as zonas nos dois sentidos, no mesmo ponto de uma pra outra. Cada árvore imensa é uma massa de cinco “árvores
colossais” do catálogo, de troncos colados e copas fundidas (o motor não escala objetos).
