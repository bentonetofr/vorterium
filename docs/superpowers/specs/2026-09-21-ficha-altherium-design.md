# Ficha Altherium (base) — design

Primeira versão da ficha do sistema próprio Altherium, hoje um placeholder
("Ficha Altherium em desenvolvimento"). Baseada no *Livro de regras básicas
de ALTHERIUM 1.0*, lido na íntegra (54 páginas).

## Regras que a ficha precisa refletir

**Raízes** (classe): `berserker`, `runaskin`, `pilar`.

**Atributos** (6): Fúria, Destino, Espírito, Impulso, Estratégia, Rúnico.
16 pontos na criação, apenas valores pares, máximo 6 por atributo. Rúnico é
exclusivo de Runaskin, que começa com +2 de graça (fora dos 16). Atributo 0
implica 1d de desvantagem nos testes ligados a ele.

**Gênesis** (12 origens): Caçador, Curandeiro, Determinado, Devoto, Filho de
mercante, Guerreiro, Guia espiritual, Corredor, Peregrino, Rastreador,
Robusto, Sem passado.

**Domínios** (24, cada um ligado a um atributo): máximo 2 pontos cada; cada
ponto adiciona +1d10 no teste daquele domínio (confirmado com o autor — a
outra redação do livro, "+1 de bônus", não vale).

| Domínio | Atributo | Domínio | Atributo |
|---|---|---|---|
| Brutalidade | Fúria | Percepção | Destino |
| Crime | Estratégia | Persuasão | Destino |
| Determinação | Espírito | Precisão | Impulso |
| Direção | Impulso | Pressentimento | Destino |
| Esconder | Estratégia | Reflexo | Impulso |
| Furtividade | Impulso | Religião | Destino |
| Iniciativa | Impulso | Resiliência | Espírito |
| Intimidação | Fúria | Runologia | Rúnico |
| Investigação | Estratégia | Saberes | Estratégia |
| Leveza | Impulso | Sobrevivência | Estratégia |
| Luta | Fúria | Tática | Estratégia |
| Medicina | Estratégia | Vontade | Espírito |

**Recursos por raiz** — o `+1d10` das fórmulas é rolado uma única vez na
criação; a ficha guarda o resultado desse d10 e recalcula o máximo sempre
que o atributo muda (decisão do autor):

| Raiz | Vitalidade | Recurso próprio | Equilíbrio | Domínios |
|---|---|---|---|---|
| Berserker | 20 + d10 + Espírito | FV 14 + d10 + Impulso | 10 + d10 + Destino | 4 + Estratégia |
| Runaskin | 10 + d10 + Espírito | PR 20 + d10 + Rúnico | 20 + d10 + Destino | 6 + Estratégia |
| Pilar | 15 + d10 + Espírito | Cartas = 13 × nível | 15 + d10 + Destino | 8 + Estratégia |

**Outros**: Hacksilvers (₴2000 na criação); DB (dano bloqueado) por parte do
corpo — Pernas (DT 1-3), Braços (4-6), Tronco (7-9), Cabeça (10);
movimento 5m (Impulso 0-8) ou 10m (9-10); Equilíbrio funciona como sanidade.

## Fora desta etapa

Triunfos (incluindo as três trilhas de Runaskin e o baralho do Pilar),
catálogo de armas/armaduras/itens, inventário, automação de subida de nível
e rolagem direto da ficha. A base guarda os números; o resto vem depois.

## Banco de dados — migration nova (37ª arquivo / `20240139000000`)

```sql
create table public.altherium_character_sheets (
  id               uuid        primary key default gen_random_uuid(),
  campaign_id      uuid        not null references public.campaigns(id) on delete cascade,
  user_id          uuid        not null references public.profiles(id) on delete cascade,
  character_name   text,
  level            integer     not null default 1 check (level between 1 and 5),
  raiz             text        check (raiz in ('berserker', 'runaskin', 'pilar')),
  genesis          text        check (genesis in (… os 12 …)),
  attr_furia       integer     not null default 0 check (attr_furia between 0 and 6),
  … destino, espirito, impulso, estrategia, runico …,
  vitality_roll    integer     check (vitality_roll between 1 and 10),
  vitality_current integer     not null default 0,
  equilibrio_roll  integer     check (equilibrio_roll between 1 and 10),
  equilibrio_current integer   not null default 0,
  fv_roll          integer     check (fv_roll between 1 and 10),
  fv_current       integer     not null default 0,
  pr_roll          integer     check (pr_roll between 1 and 10),
  pr_current       integer     not null default 0,
  cards_current    integer     not null default 0,
  hacksilvers      integer     not null default 2000,
  db_pernas/db_bracos/db_tronco/db_cabeca integer not null default 0,
  notes            text,
  created_at/updated_at timestamptz,
  unique (campaign_id, user_id)
);

create table public.altherium_character_domains (
  id        uuid primary key default gen_random_uuid(),
  sheet_id  uuid not null references public.altherium_character_sheets(id) on delete cascade,
  domain    text not null check (domain in (… os 24 …)),
  points    integer not null default 0 check (points between 0 and 2),
  unique (sheet_id, domain)
);
```

Os máximos (Vitalidade, Equilíbrio, FV, PR, Cartas) **não** são colunas —
são derivados no cliente a partir de raiz + roll + atributo, então
acompanham mudanças de atributo automaticamente.

RLS espelhando `character_sheets`: SELECT e UPDATE para dono ou mestre;
INSERT só para si mesmo e só sendo membro da campanha; sem DELETE.
`altherium_character_domains` herda o acesso via `sheet_id` (as policies
checam o dono/mestre da ficha referenciada).

## Código

- `constants/altherium.ts` — catálogos: raízes (com bases de recurso e de
  domínios), 12 gênesis, 24 domínios com seus atributos.
- `utils/altheriumCalculations.ts` — máximos derivados, domínios
  disponíveis, pontos de atributo usados, movimento, dados do teste.
- `services/altheriumSheetService.ts` — get/create/update da ficha,
  upsert de domínio, listagem da campanha (mestre).
- `AltheriumSheetPanel.tsx` — roteia por papel: jogador vê a própria ficha,
  mestre vê cards de resumo + abre a ficha escolhida (mesmo padrão do
  `SimpleSheetPanel`/`CampaignSheetsList`).
- `AltheriumSheetForm.tsx` — o formulário em si.
- `CampaignSheetPanel.tsx` — `altherium` passa a renderizar o painel real.
- `systems.ts` — Altherium sai de `coming-soon` para `available`.

Validações de criação (16 pontos, só pares, máx 6, limite de domínios)
aparecem como contadores e avisos, sem travar o salvamento — o mestre pode
liberar exceções.

## Checklist de implementação

- [ ] Migration 39: as duas tabelas + RLS + trigger de updated_at
- [ ] Constantes, cálculos e tipos
- [ ] Serviço
- [ ] Painel + formulário + lista do mestre + CSS
- [ ] Roteamento em `CampaignSheetPanel` e status em `systems.ts`
- [ ] README
- [ ] `npm run verify` passando
