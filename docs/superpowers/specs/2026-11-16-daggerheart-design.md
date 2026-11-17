# DaggerHeart no Vorterium (Livro Básico, Darrington Press)

Refeito do zero em 16/11/2026 a partir dos dois livros (PT-BR escaneado e EN com texto). A primeira versão, baseada no SRD 1.0, tinha classes e regras inventadas.

## Conteúdo (src/features/sheets/daggerheart/catalog)
- 9 classes (Bardo, Druida, Feiticeiro, Guardião, Guerreiro, Ladino, Mago, Patrulheiro, Serafim), 2 subclasses cada (fundamental, especialização e maestria).
- 18 ancestralidades (2 habilidades; mista = a 1ª de uma, a 2ª de outra) e 9 comunidades.
- 9 domínios × 21 cartas de domínio (níveis 1 a 10): `domainCards.ts` (gerado do livro).
- Armas (principais e secundárias, patamares 1–4, cadeira de rodas) e armaduras: `weapons.ts`, `armor.ts` (gerados).
- Formas de Fera do druida, opções do companheiro animal, condições, descansos, Movimento de Morte.

## Regras (model/)
- Tudo calculado por `derive.ts`: patamar, Proficiência (1 + níveis 2/5/8 + escolhas), espaços de Vida/Fadiga, Evasão, Armadura, limiares (base da armadura + nível; sem armadura nível e 2×nível), Esperança (6 − cicatrizes).
- `levelUp.ts`: quadro de subida por patamar (atributos 3 casas, Vida 2, Fadiga 2, Experiências 1, carta 1, Evasão 1; subclasse melhorada 1, Proficiência e multiclasse ocupam as 2 escolhas); marcas de atributo limpas nos níveis 5 e 8; multiclasse com domínio novo até metade do nível.
- `dice.ts`: Dados de Dualidade (2d12), crítico em dados iguais.

## Dados
- Tabela `dh_sheets` (migration 20240238): ficha inteira em jsonb, RLS de dono e mestre, tempo real. A 237 só libera o sistema nas campanhas.
- Nasce guardado (recurso `daggerheart` no Painel de controle, como o Vampiro).

## Fontes
Livro Básico PT-BR (nomes) e EN edição 28/12/2025 (números, quando divergem).
