# Vortable: mundo pronto SALTMORE

Floresta montanhosa e escura, de pinheiros azul-esverdeados e trilha de terra, do começo numa cabana abandonada até a ponte de uma cidade.
É um mundo pronto do Vortable (formato `vortable-world`, o mesmo do TORVALLEN e dos mundos do pacote Apocalipse), gerado por código
com **só o que já existe nos catálogos** do motor (terrenos, objetos e peças de personagem): nenhuma arte nova, então a sincronização
do motor não o quebra (os ids dos objetos são estáveis, `folha@x,y`).

- Arquivo: `public/vortable/maps/saltmore.mundo.json` (também aparece em **Mundos → Mundos prontos → SALTMORE**, `WorldsPanel.tsx`).
- Importar à mão: Mundos → **Importar mundo** e escolher o arquivo.
- Céu do mundo: fim de tarde fixo (16 h) e nublado (o mestre muda ao vivo no Controle).

## O percurso (de cima pra baixo)

| # | Zona | Tamanho | O que tem |
|---|---|---|---|
| 1 | Cabana abandonada (térreo) | 24×19 | Começo do mundo. Lareira de madeira apagada, mesa virada, cadeiras caídas, teias, tábuas soltas, fogão de ferro, escada de mão |
| 1b | Cabana abandonada (sótão) | 18×14 | Quarto bem pequeno: uma cama bagunçada, baú, cadeira quebrada, caveira, janela |
| 2 | Clareira da cabana | 72×84 | A cabana por fora (porta de verdade), horta morta de cerca quebrada, poço, lenha, carroça tombada, um túmulo solitário, a montanha nevada ao norte |
| 3 | Trilha da floresta sombria | 72×112 | Mata fechada, bifurcação com placa: santuário esquecido a oeste (menires e estátua encapuzada) e acampamento de caçadores abandonado a leste; tronco caído, brejo, anel de cogumelos, carroça tombada |
| 4 | Riacho da cascata | 72×96 | Paredão com a queda d'água, lagoa com píer e barcos, riacho e ponte de madeira com guarda-corpo |
| 5 | Encosta rochosa | 72×104 | Passo da montanha em ziguezague, torre em ruínas, mirante de madeira, emboscada (carroça, flechas, ossos), santuário do caminho |
| 6 | Vila de Pedraverde | 100×116 | Muralha de pedra com dois portões, praça com chafariz e feira, estalagem, capela com torre e cemitério, ferreiro, hortas, pomar, celeiro com curral, posto da guarda, 18 construções no total e 14 moradores |
| 6b | Estalagem do Corvo (salão) | 32×24 | Lareira acesa, balcão, mesas, cantinho do bardo e um forasteiro encapuzado |
| 7 | Estrada e ponte da cidade | 72×100 | Campos de milho, posto de pedágio, o rio largo, a ponte de pedra com lampiões, a muralha da cidade e o portão. A saída final (`cidade`) fica sem destino de propósito: é onde o mapa continua |

As saídas ligam tudo nos dois sentidos, com o caminho continuando no mesmo ponto de uma zona pra outra (x do fim de uma = x do começo
da próxima). Os NPCs (24 no total) são `ZoneNpc` comuns, com aparência montada em `scripts/saltmore/npcs.py`.

## Como regerar

```
python scripts/make-saltmore-world.py            # gera o arquivo e confere tudo
python scripts/make-saltmore-world.py --check    # só confere o arquivo do disco
python scripts/make-saltmore-world.py --gallery saida.png medieval:Vila    # folha de contato de objetos (pack:categoria)
```

O gerador é determinístico (sementes fixas): rodar de novo dá o mesmo mundo. Ele vive em `scripts/saltmore/`:

| Arquivo | Papel |
|---|---|
| `lib.py` | `Zone` (terreno por vértice, cômodos, cercas, objetos, luzes, saídas, NPCs), `Path` (trilhas suaves), ruído, `write_world` |
| `kit.py` | peças escolhidas pelo nome no catálogo: árvores (versão fria `trees-pale` + algumas verdes), moitas, pedras, `forest` (mata por ruído), `Building` (casa = telhado + fachada), `crop_field`, `cliff_line` |
| `z_*.py` | uma zona cada (`z_cabana`, `z_clareira`, `z_floresta`, `z_riacho`, `z_encosta`, `z_vila`, `z_estalagem`, `z_ponte`) |
| `npcs.py` | aparências dos moradores (confere corpo, variantes e cores contra o catálogo de personagem) |
| `world.py` | monta as zonas, valida as ligações e escreve o JSON |
| `verify.py` | refaz as regras de colisão do motor numa grade de 8 px e confere, andando, que dá pra ir de uma saída a outra, que nenhum NPC nem porta ficou preso |
| `gallery.py` | folha de contato de objetos pra escolher peças |

### Como as construções são feitas

O motor não tem telhado nem casa pronta. Uma casa (`kit.Building`) é um cômodo de altura 0 com **piso de telha** (ardósia, marrom...) por
cima, que faz o telhado visto de cima, mais uma faixa de **parede** (pedra, enxaimel, tábuas) embaixo, com porta e janelas do pacote
`wd`. Só a faixa da parede entra como cômodo (a borda de qualquer cômodo é parede sólida pro motor) e a saída pra dentro fica numa
área aberta na frente da porta. Pontes são piso de madeira/pedra pintado por cima da água, com cerca de guarda-corpo. Águas são
sólidas; a queda d'água é uma fita de água rasa descendo do paredão, com o som `waterfall`.

### Dicas

- Pra ver o mundo rodando com o motor de verdade sem entrar no site, abra o editor com uma página de teste local que monte o motor com
  `LocalWorldStorage` (carregue o JSON com `parseZone`/`parseWorld`, salve as zonas e chame `mountVortable`). O editor serve de câmera
  livre (roda do mouse = zoom).
- Os campos de trigo do catálogo (`farm-wheat`) não funcionam como terreno de preenchimento (o miolo da folha é transparente): os
  campos aqui são terra arada com fileiras de milho/batata/cenoura (`kit.crop_field`).
