# Ficha Altherium — Dano por zona do corpo

## Contexto

O card "Anatomia & Armadura" (aba Combate) já tem um manequim SVG
articulado e arrastável (`AltheriumBodyDiagram.tsx`) que muda de cor por
zona (pernas/braços/tronco/cabeça) conforme o DB (dano bloqueado por
armadura) daquela zona — de um tom escuro neutro até dourado. O usuário
pediu uma segunda visualização, no espaço vazio ao lado dos textos de
zona: um segundo manequim, vermelho, mostrando **dano/ferimento sofrido**
por zona — um conceito novo, que a ficha não guarda em lugar nenhum hoje
(só existe Vitalidade geral current/max, sem quebra por zona).

Confirmado com o usuário: dano por zona é um número livre editado à mão,
sem limite ou fórmula — mesmo padrão simples que o DB já usa.

## Dados — migration nova

Mesmo padrão das colunas de DB já existentes:

```sql
alter table public.altherium_character_sheets
  add column if not exists dano_pernas  integer not null default 0 check (dano_pernas  >= 0);
alter table public.altherium_character_sheets
  add column if not exists dano_bracos  integer not null default 0 check (dano_bracos  >= 0);
alter table public.altherium_character_sheets
  add column if not exists dano_tronco  integer not null default 0 check (dano_tronco  >= 0);
alter table public.altherium_character_sheets
  add column if not exists dano_cabeca  integer not null default 0 check (dano_cabeca  >= 0);
```

`AltheriumSheet` (shared/types) ganha os 4 campos. `AltheriumSheetUpdate`
já é derivado automaticamente do tipo da ficha, sem mudança manual.

## Componente `AltheriumBodyDiagram` — reaproveitado, não duplicado

O componente já recebe os valores por zona como prop genérica
(`values: Record<BodyZone, number>`) — nenhuma mudança estrutural no SVG
ou na física de arrasto das juntas. Só adiciona:

```ts
variant?: 'protecao' | 'dano'   // default 'protecao', mantém comportamento atual
```

Internamente, a cor-alvo do gradiente passa a depender da variante
(`ARMORED_RGB` dourado pra 'protecao', um `WOUND_RGB` vermelho — reaproveita
o token `--danger`/`--danger-bright` já usado no resto do app — pra
'dano'). A cor neutra de base (escuro) continua igual pras duas. A relação
membro/articulação continua a mesma lógica que já existe hoje (articulação
é o inverso do membro — brilha forte quando a zona está intacta, escurece
conforme acumula o valor), só trocando a cor de destino.

**Referência de "100% vermelho":** hoje o dourado usa `DB_VISUAL_MAX = 16`
(maior DB de armadura única do catálogo) como teto fixo. Pra dano, esse
teto passa a ser a **Vitalidade máxima do personagem** (`vitality_max`),
passada como prop nova (`visualMax`) — assim o vermelho representa
"quanto da vida total do personagem foi perdida naquela zona", proporcional
a cada ficha, e não um número fixo igual pra todo mundo. O parâmetro
`visualMax` fica genérico (a variante 'protecao' continua passando 16,
a 'dano' passa `vitality_max || 1` pra nunca dividir por zero).

## UI — `AltheriumSheetForm.tsx`, aba Combate

O card "Anatomia & Armadura" passa a ter 3 colunas (empilham em telas
estreitas, mesmo breakpoint de 640px já usado no resto da ficha):

1. Manequim de proteção (existente, sem mudança de posição/comportamento).
2. Manequim de dano (novo) — mesmo componente, `variant="dano"`,
   `values` lendo os 4 campos novos, `visualMax={form.vitality_max}`.
3. Lista de zonas (existente, reaproveitada) — cada linha ganha um
   segundo campo ao lado do DB: "DB: [_] Dano: [_]", mesmo estilo de
   input numérico já usado.

Clicar numa zona do manequim de proteção continua focando o campo de DB
dela (comportamento atual, sem mudança). Clicar numa zona do manequim de
dano foca o novo campo de dano dela — mesmo padrão (`onZoneClick` +
`ref` no input), duplicado pro novo conjunto de campos.

O hint abaixo do card ganha uma segunda frase explicando o manequim novo.

## Testes

`npm run verify` (migrations + tsc + build). Verificação visual: montar
o formulário com dados falsos na `LandingPage` temporária (mesma técnica
já usada nesta sessão) — conferir os dois manequins lado a lado, o
gradiente vermelho variando com o campo de dano, clique em zona focando
o campo certo em cada manequim, depois reverter a `LandingPage` por
completo. Teste dentro de campanha real fica por conta do autor.
