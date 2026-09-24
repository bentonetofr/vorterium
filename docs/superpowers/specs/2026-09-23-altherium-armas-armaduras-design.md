# Ficha Altherium — Armas, Armaduras e Inventário (Fase 2)

## Contexto

A ficha Altherium foi dividida em abas na Fase 1 (ver
`2026-09-23-ficha-altherium-abas-fase1-design.md`), que deixou a aba
**Combate** só com a Anatomia & Armadura (diagrama do corpo + campos
manuais de DB por zona) e um aviso de "chega numa próxima atualização"
para o catálogo de armas/armaduras. Esta spec implementa essa parte,
usando as tabelas oficiais do livro de regras (armas, proteções,
consumíveis e utilitários) fornecidas pelo autor nesta sessão.

## Fora desta etapa

- Triunfos (Fase 3, mecânica própria por raiz).
- Rolagem de dados/ataque automatizada a partir da ficha.
- Desconto automático de Hacksilvers ao adicionar item ao inventário
  (confirmado com o autor: só soma o item, o jogador ajusta ₴ na mão).
- Itens customizados fora do catálogo oficial (o catálogo é fixo,
  baseado no livro — sem criação de item livre nesta etapa).
- Sincronização automática ao desequipar (equipar só *soma* DB uma vez;
  desequipar não subtrai — ver mecânica abaixo).

## Catálogo — constante TypeScript

Assim como `RAIZES`/`GENESIS`/`DOMAINS` hoje, o catálogo é dado fixo do
livro, sem edição em runtime — não precisa de tabela no banco. Novo
arquivo `src/features/sheets/altherium/constants/altheriumItems.ts`:

```ts
export type WeaponCategory = 'pesada' | 'leve' | 'arremesso' | 'alcance'
export type DamageType     = 'corte' | 'impacto' | 'perfurante'
export type WeaponAttribute = 'furia' | 'impulso' | 'furia_impulso'
export type WeaponRange = 'toque' | 'toque_curto' | 'curto' | 'curto_medio' | 'medio' | 'longo'

export interface WeaponDef {
  id: string
  name: string
  category: WeaponCategory
  damageDice: string        // ex: "2d8", "1d12+2" — texto, exibido como está
  damageType: DamageType
  attribute: WeaponAttribute
  range: WeaponRange
  price: number
  berserkerOnly?: boolean   // true só para as "armas pesadas"
}

export type ArmorCoverage = 'escolhida' | 'todas'  // ver mecânica de equipar

export interface ArmorDef {
  id: string
  name: string
  description: string
  db: number
  price: number
  kind: 'armadura' | 'escudo'
  coverage: ArmorCoverage
}

export interface ItemDef {   // consumíveis e utilitários — mesmo formato
  id: string
  name: string
  effect: string
  price: number
  notes: string
  kind: 'consumivel' | 'utilitario'
}
```

### Dados (transcritos do livro)

**Armas pesadas** (`berserkerOnly: true`, `category: 'pesada'`):

| id | nome | dano | tipo | atributo | alcance | preço |
|---|---|---|---|---|---|---|
| machado_duas_laminas | Machado de duas lâminas | 2d8 | corte | furia | toque | 1000 |
| martelo_impacto | Martelo de Impacto | 2d10 | impacto | furia | toque | 2000 |
| lanca_pesada | Lança Pesada | 2d10 | perfurante | furia_impulso | toque | 2000 |
| maca_ossos | Maça de ossos | 2d12 | impacto | furia | toque | 2400 |
| espada_extremamente_pesada | Espada Extremamente pesada | 3d12 | corte | furia | toque | 4000 |
| tridente_batalha | Tridente de batalha | 2d12 | perfurante | furia_impulso | toque | 2400 |
| sabre | Sabre | 2d10 | corte | impulso | toque | 2000 |

**Armas leves** (`category: 'leve'`):

| id | nome | dano | tipo | atributo | alcance | preço |
|---|---|---|---|---|---|---|
| adaga_serrilhada | Adaga serrilhada | 1d10 | corte | impulso | toque | 400 |
| espada_curta_reta | Espada curta reta | 1d12 | corte | furia | toque | 600 |
| adaga_gancho | Adaga de Gancho | 1d6 | perfurante | impulso | toque | 400 |
| clava_espinosa | Clava espinosa | 1d10 | impacto | furia | toque | 400 |
| porrete_pedra | Porrete de pedra | 1d10 | impacto | furia_impulso | toque | 400 |
| laminas_gemeas | Lâminas Gêmeas | 1d10 | corte | impulso | toque | 400 |
| espada_punho_circular | Espada de Punho Circular | 1d12 | corte | impulso | toque | 600 |

**Armas de arremesso** (`category: 'arremesso'`):

| id | nome | dano | tipo | atributo | alcance | preço |
|---|---|---|---|---|---|---|
| lanca_arremesso | Lança | 1d12 | perfurante | impulso | toque_curto | 600 |
| adaga_arremesso | Adaga de arremesso | 1d8 | perfurante | impulso | toque_curto | 200 |
| faca_arremesso | Faca de Arremesso | 1d10 | perfurante | impulso | toque_curto | 400 |
| machado_arremesso | Machado de Arremesso | 1d12 | perfurante | furia | toque_curto | 600 |
| bola_ferro_corrente | Bola de Ferro com corrente | 1d8 | impacto | impulso | toque_curto | 200 |
| boomerangue_aflado | Boomerangue aflado | 1d8 | corte | impulso | curto | 200 |

**Armas de alcance** (`category: 'alcance'`):

| id | nome | dano | tipo | atributo | alcance | preço |
|---|---|---|---|---|---|---|
| arco_curto | Arco Curto | 1d10 | perfurante | impulso | medio | 400 |
| arco_longo | Arco Longo | 1d12 | perfurante | furia | longo | 600 |
| besta_leve | Besta Leve | 1d10+2 | perfurante | impulso | medio | 600 |
| besta_pesada | Besta Pesada | 1d12+2 | perfurante | furia | longo | 800 |
| dardo_envenenado | Dardo Envenenado | 1d6 | perfurante | impulso | curto_medio | 200 |

**Proteções**:

| id | nome | descrição | DB | preço | kind | coverage |
|---|---|---|---|---|---|---|
| tunica_couro_runico | Túnica de Couro Rúnico | Uma armadura simples feita de couro de Svarland | 4 | 400 | armadura | escolhida |
| cota_malha_norte | Cota de Malha do Norte | Malha usada pelos maiores guerreiros Skalds | 8 | 500 | armadura | escolhida |
| couraca_placas_torvalenn | Couraça de Placas de Torvalenn | Armadura usada pelos guardas e guerreiros nobres de Torvalenn | 12 | 3000 | armadura | escolhida |
| armadura_guardiao_eryndor | Armadura do guardião de Eryndor | Armadura rara feita com partes de Eryndor | 16 | 5000 | armadura | escolhida |
| escudo_leve | Escudo Leve | Um escudo de madeira com detalhes em aço | 2 | 1000 | escudo | todas |
| escudo_pesado | Escudo Pesado | Um escudo de aço com detalhes em madeira | 6 | 4000 | escudo | todas |

**Consumíveis** (`kind: 'consumivel'`):

| id | nome | efeito | preço | notas |
|---|---|---|---|---|
| elixir_eir | Elixir de Eir | Cura 1d8 de vida do usuário | 100 | Básica, mas essencial. |
| soro_idunn | Soro de Idunn | Cura 1d8 de Equilíbrio | 300 | Para emergências graves. |
| cogumelo_berserkr | Cogumelo Berserkr | +2 de Fúria por 1 cena | 150 | Exclusivo para Berserkers. |
| tinta_isafis | Tinta de Isafis | Recupera 1d4 de PR | 200 | Para Runaskins. |

**Utilitários** (`kind: 'utilitario'`):

| id | nome | efeito | preço | notas |
|---|---|---|---|---|
| kit_cura | Kit de Cura | +1D em Medicina | 100 | Para curar ferimentos. |
| kit_saqueador | Kit de Saqueador | +1D em Crime | 100 | Para roubar. |
| amuleto_protecao | Amuleto de Proteção | +2 de Espírito por 1 cena | 200 | Proteção espiritual. |
| po_fumaca | Pó de Fumaça | +1D em Furtividade por 1 cena | 150 | Para fugas ou ataques furtivos. |

## Inventário do personagem — tabela nova

Mesmo padrão de `altherium_character_domains`: uma linha por item que o
personagem possui, referenciando o catálogo fixo pelo `item_id`.

```sql
create table public.altherium_character_inventory (
  id             uuid        primary key default gen_random_uuid(),
  sheet_id       uuid        not null references public.altherium_character_sheets(id) on delete cascade,
  item_type      text        not null check (item_type in ('arma', 'armadura', 'escudo', 'consumivel', 'utilitario')),
  item_id        text        not null,   -- id do catálogo (altheriumItems.ts), não é FK (catálogo não é tabela)
  quantity       integer     not null default 1 check (quantity >= 1),
  equipped       boolean     not null default false,          -- só relevante para armadura/escudo
  equipped_zone  text        check (equipped_zone in ('db_cabeca', 'db_bracos', 'db_tronco', 'db_pernas')),
  created_at     timestamptz not null default now(),

  unique (sheet_id, item_type, item_id)
);
```

RLS: dono ou mestre da campanha da ficha pode ver/inserir/atualizar/
remover — idêntico às policies de `altherium_character_domains`
(exists check via `altherium_character_sheets`).

`equipped_zone` usa os mesmos valores de `BodyZone`
(`AltheriumBodyDiagram.tsx`), para bater direto com as chaves de DB da
ficha (`db_pernas` etc.) sem tradução.

## Mecânica de equipar armadura/escudo

Confirmado com o autor a partir da página "Equipamentos" do livro: o
DB de uma armadura não é fixo por zona no livro — **o jogador escolhe**
em qual zona colocar cada armadura. Escudo é exceção: cobre "o corpo
todo".

- **Armadura** (`coverage: 'escolhida'`): ativar o toggle "Equipada"
  pede pro jogador escolher 1 zona (select com as 4 opções). Ao
  confirmar: soma o `db` do item ao valor **atual** do campo daquela
  zona na ficha (`vitality`-style, não substitui), marca
  `equipped: true` e guarda `equipped_zone`.
- **Escudo** (`coverage: 'todas'`): ativar o toggle soma o `db` do
  item às 4 zonas de uma vez (`equipped_zone` fica `null`).
- **Desequipar**: só marca `equipped: false`. Não subtrai o DB dos
  campos — eles continuam sendo campos manuais normais depois disso
  (mesmo espírito de "sem automação forçada" já aplicado no resto da
  ficha nesta sessão). Um texto de apoio no botão deixa isso explícito
  ("Desequipar não ajusta o DB — edite o campo se remover a peça.").
- Reequipar um item já equipado (ex.: trocar de zona) primeiro exige
  desequipar.

Armas, consumíveis e utilitários não têm conceito de "equipado" —
`equipped` fica sempre `false` e `equipped_zone` sempre `null` pra
esses tipos.

## Serviço (`altheriumSheetService.ts`)

Novas funções, seguindo o padrão de `getAltheriumDomains`/
`setAltheriumDomainPoints`:

- `getAltheriumInventory(sheetId): Promise<AltheriumInventoryItem[]>`
- `addAltheriumInventoryItem(sheetId, itemType, itemId): Promise<AltheriumInventoryItem>` — insere com
  `quantity: 1`; se o item já existir na ficha (a constraint `unique (sheet_id, item_type, item_id)`
  barra o insert), incrementa a `quantity` da linha existente em vez de duplicar.
- `updateAltheriumInventoryItem(id, data: { quantity?, equipped?, equipped_zone? }): Promise<AltheriumInventoryItem>`
- `removeAltheriumInventoryItem(id): Promise<void>` — remove a linha inteira (não decrementa; decrementar até 0 na UI chama remove)

O ato de "somar DB ao equipar" acontece no componente (lê o valor atual
do form, soma, chama `set()` local — mesmo fluxo que os outros campos
de DB já usam), não no serviço.

## Tipos (`shared/types/index.ts`)

```ts
export interface AltheriumInventoryItem {
  id:            string
  sheet_id:      string
  item_type:     'arma' | 'armadura' | 'escudo' | 'consumivel' | 'utilitario'
  item_id:       string
  quantity:      number
  equipped:      boolean
  equipped_zone: BodyZone | null
  created_at:    string
}
```

## UI — aba Combate

Novo card "Inventário" abaixo de "Anatomia & Armadura" (que não muda),
dentro do mesmo `AltheriumSheetForm.tsx` / aba `combate`. Novo
componente `AltheriumInventoryCard.tsx` pra não inchar mais o form
principal, recebendo `sheetId`, `inventory`, `onChange` callbacks e o
`form` (só leitura, pra somar DB) + `set` (pra escrever DB).

Duas colunas (empilham em telas estreitas, mesmo breakpoint de 640px
já usado no resto da ficha):

**Catálogo** — busca por nome (mesmo padrão de `domainFilter` em
Domínios) + lista agrupada por categoria (Armas Pesadas, Leves,
Arremesso, Alcance, Proteções, Consumíveis, Utilitários), cada linha
mostrando nome + estatísticas resumidas + preço + botão "+" pra
adicionar ao inventário. Armas pesadas mostram uma tag "Somente
Berserker" mas não bloqueiam adição (a ficha não impede combinações
fora da raiz em nenhum outro lugar hoje).

**Meus itens** — lista do que já foi adicionado, agrupada do mesmo
jeito, cada linha com nome, quantidade (+/-, mínimo 1), preço de
referência, botão remover, e — só para armadura/escudo — o toggle
"Equipada" com o select de zona quando aplicável.

Sem alteração no aviso "próxima atualização" de Triunfos (fica como
está, Fase 3 continua fora de escopo).

## Testes

`npm run verify` (migrations + tsc + build). Verificação visual: montar
`AltheriumInventoryCard` com dados falsos na `LandingPage` temporária
(mesma técnica já usada nesta sessão), testar adicionar/remover item,
mudar quantidade, equipar armadura (escolher zona, conferir soma no
campo de DB) e equipar escudo (conferir soma nas 4 zonas), depois
reverter a `LandingPage` por completo. Teste dentro de uma campanha
real (persistência no Supabase) fica por conta do autor, já que a
sessão não consegue autenticar.
