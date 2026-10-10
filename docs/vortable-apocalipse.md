# Vortable: pacote Apocalipse

Arte original (CC0) de pós-apocalipse com natureza retomando as cidades, desenhada por código e
encaixada nos catálogos do motor do Vortable.

## O que tem

| Pacote | Conteúdo |
|---|---|
| Objetos | ruínas, veículos abandonados, mobiliário urbano, quarentena e barricadas, acampamento, infecção (fungo, casulos, bulbos e nuvens de esporos), natureza invasora, sobrevivência |
| Personagem | 14 cores novas de roupa e cabelo; máscara de gás; fungo e veias de infectado; roupas xadrez, camufladas, sujas e colete tático; sujeira e lama; armas no boneco (mão, costas e bolso), ligadas ao inventário da ficha adaptada (`tdaWeaponLook.ts`, `weaponLookService.ts`) |
| Ruas (EUA) | asfalto/calçada/concreto no estilo limpo (`terrains.py`); faixas pintadas de chão, placas de trânsito e peças americanas em `objects_roads.py` (folha `tlou-estrada`) |
| Inimigos | Painel do controle ao vivo (`src/features/vortable/enemies/`): `enemies.ts` (criaturas e como entram na zona como NPCs `inim-<criatura>-<código>`), `EnemiesPane.tsx` (painel), `creatureSounds.ts` (sons sintetizados em Web Audio; os jogadores recebem `sys: 'sfx'` pela rede do mestre). Peças dos bonecos em `scripts/tlou_art/creatures.py` |
| Gerador de NPCs | `src/features/vortable/people/` (`people.ts`: tipos, roupas, armas e nomes sorteados; `PeoplePane.tsx`: painel no controle ao vivo; as pessoas viram NPCs `pess-<tipo>-<código>` da zona). Chapéus em `scripts/tlou_art/hats.py` |
| Colisão de cômodo | O motor trata como PAREDE SÓLIDA a borda de todo cômodo (`rooms`): um tile com 1 a 3 cantos em cômodo é bloqueado, e os vértices de "parede" também. Por isso fachada = só a faixa de parede como cômodo (o alpendre é só terreno), e porta lateral entre salas precisa pôr os vértices da passagem no cômodo (coluna da direita começando uma linha abaixo). Conferir com o editor (tecla K mostra a colisão) |
| Remendas do motor | `scripts/patch-vortable-camera.mjs` põe `watch.worldAt(pageX, pageY)` no motor (tela -> ponto do mapa), usado pra arrastar inimigos do painel pro mapa, e o som de passos dos outros bonecos na câmera do mestre (`hookSteps`) e do NPC que o mestre controla (`stepsFor`). Também a licença de saída (`gate`): o jogo pergunta ao mestre antes de o boneco atravessar uma saída (`VortableNet.askDoor` / `answerDoor`, aviso `DoorPrompt` no mestre). Também devolve x/y em `watch.npcs()` (clicar no NPC no mapa). A sincronização do motor apaga a remenda: rode o script de novo depois de cada sincronização (junto com `python scripts/make-tlou-art.py`) |
| Mundo Nova York | `NOVA YORK: ZONA MORTA` (`public/vortable/maps/nova-york.mundo.json`, 37 zonas, 18 NPCs): `world_nyc.py` monta o mundo, com `nyc_kit.py` (ruas, fachadas, fileiras de móveis), `nyc_buildings.py` (fachadas, ligações), `nyc_surface.py` (zonas de fora), `nyc_inner.py` (metrô, túnel da escola, terraço), os interiores em planta (`nyc_floor.py` grade de salas com paredes pintadas e portas abertas, `nyc_rooms.py` móveis por tipo de sala + enchimento, `nyc_interiors.py` os prédios) e as folhas `tlou-cidade` (`objects_city.py`) e `tlou-interior` (`objects_interior.py`) |
| Mundo pronto | `CIDADE EM RUÍNAS` (`public/vortable/maps/ruinas.mundo.json`, 4 zonas, 10 NPCs), gerado por `scripts/tlou_art/worlds.py`; regerar só ele com `python scripts/make-tlou-art.py --world`; listado em `WorldsPanel.tsx` (`TEMPLATES`) |
| Terrenos | asfalto (novo, rachado, com musgo), calçada, concreto, entulho, terra, lama, grama seca, mato invasor, micélio, piso de hospital, madeira podre, carpete, folhas, cinzas, neve suja |

Os ids dos objetos são estáveis (`tlou@<apelido>`): os mundos salvos guardam esse id, então regerar a
arte nunca os quebra.

## Como regerar

```
python -m pip install pillow
python scripts/make-tlou-art.py                 # gera tudo e atualiza public/vortable/assets/catalog
python scripts/make-tlou-art.py --preview a.png # só uma folha de contato dos objetos
python scripts/make-tlou-art.py --terrain-preview t.png
```

O script é **idempotente**: tira do catálogo tudo que é do pacote `tlou` e põe de volta o que gerou agora.

## Atenção: sincronização do motor

O motor do Vortable é um bundle copiado de outro repositório (commits "Motor sincronizado"), e o
`npm run vorterium` de lá também copia `public/vortable/assets` (os catálogos JSON). **Depois de cada
sincronização, rode `python scripts/make-tlou-art.py` de novo**: a cópia sobrescreve os catálogos e apaga
as entradas do pacote Apocalipse (as imagens `tlou-*.png` continuam, mas deixam de estar listadas).
O ideal é, no futuro, levar este gerador pro repositório do motor.
