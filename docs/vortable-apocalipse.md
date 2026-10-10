# Vortable: pacote Apocalipse

Arte original (CC0) de pós-apocalipse com natureza retomando as cidades, desenhada por código e
encaixada nos catálogos do motor do Vortable.

## O que tem

| Pacote | Conteúdo |
|---|---|
| Objetos | ruínas, veículos abandonados, mobiliário urbano, quarentena e barricadas, acampamento, infecção (fungo, casulos, bulbos e nuvens de esporos), natureza invasora, sobrevivência |
| Personagem | 14 cores novas de roupa e cabelo; máscara de gás; fungo e veias de infectado; roupas xadrez, camufladas, sujas e colete tático; sujeira e lama; armas no boneco (mão, costas e bolso), ligadas ao inventário da ficha adaptada (`tdaWeaponLook.ts`, `weaponLookService.ts`) |
| Ruas (EUA) | asfalto/calçada/concreto no estilo limpo (`terrains.py`); faixas pintadas de chão, placas de trânsito e peças americanas em `objects_roads.py` (folha `tlou-estrada`) |
| Mundo Nova York | `NOVA YORK: ZONA MORTA` (`public/vortable/maps/nova-york.mundo.json`, 37 zonas, 18 NPCs): `world_nyc.py` monta o mundo, com `nyc_kit.py` (ruas, fachadas, fileiras de móveis), `nyc_buildings.py` (interiores), `nyc_surface.py` (zonas de fora), `nyc_inner.py` (delegacia, escola, metrô, restaurante) e a folha `tlou-cidade` (`objects_city.py`) |
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
