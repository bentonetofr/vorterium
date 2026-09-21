# Mesa da Sessão + Iniciativa — design

Reestrutura a navegação da campanha e adiciona um rastreador de iniciativa
compartilhado em tempo real. Primeira das quatro ideias aprovadas na sessão
de brainstorm de funcionalidades (calendário, lembrete de sessão, iniciativa,
painel de HP) — as outras três ficam para depois.

## Escopo desta etapa

Fora de escopo, explicitamente:
- Puxar modificador de Destreza automaticamente da ficha (a ficha D&D ainda
  não está conectada — ver etapa separada).
- Histórico de combates encerrados — só existe "o combate atual" por campanha.
- Reordenar manualmente por arrastar — a ordem é sempre pelo valor de
  iniciativa.
- Registro de eventos de iniciativa em `campaign_activity` (rolar, avançar
  turno) — o Realtime já entrega isso ao vivo; um rastro permanente na aba
  Atividade só geraria ruído.

## Navegação — `CampaignAreaPage.tsx`

`TabId` perde `'ficha' | 'atividade' | 'chat'` e ganha `'mesa-sessao'`:

```ts
export type TabId = 'visao-geral' | 'membros' | 'sessoes' | 'notas' | 'mesa-sessao' | 'configuracoes'
export type SessionSubTabId = 'chat' | 'ficha' | 'atividade' | 'iniciativa'
```

Barra principal: `Visão geral / Membros / Sessões / Notas / Mesa da Sessão /
Configurações`. `activeSessionTab` (padrão `'chat'`) é estado do
`CampaignAreaPage`, não interno ao painel novo — assim o `onNavigate` do
`CampaignOverviewPanel` consegue pedir uma sub-aba específica (os dois
lugares que hoje chamam `onNavigate('ficha')` passam a chamar
`onNavigate('mesa-sessao', 'ficha')`).

`SessionTablePanel.tsx` (novo) recebe `{ campaign, currentUserId,
activeSubTab, onSubTabChange }` — renderiza sua própria barra de sub-abas
(mesmo estilo visual da barra principal, num nível abaixo) e monta/desmonta
`CampaignChatPanel` / `CampaignSheetPanel` / `CampaignActivityPanel` /
`InitiativeTrackerPanel` conforme a sub-aba ativa — os três primeiros são os
mesmos componentes de hoje, só realocados.

Selo de não lida: o selo de mesa (`chatUnread`) e o de privada
(`privateUnread`) somam e aparecem na aba **"Mesa da Sessão"** (a
mesa continua se autogerenciando via `markChatRead`/`markPrivateThreadRead`
internamente, como já corrigido na varredura de bugs — não precisa de
chamada duplicada em `CampaignAreaPage`). Pausa o polling do selo de mesa
quando `activeTab === 'mesa-sessao'` (a sub-aba padrão já é Chat).

## Banco de dados — migration nova (38ª)

```sql
create table public.campaign_initiative_participants (
  id               uuid        primary key default gen_random_uuid(),
  campaign_id      uuid        not null references public.campaigns(id) on delete cascade,
  user_id          uuid        references public.profiles(id) on delete cascade,
  name             text        not null check (char_length(name) between 1 and 80),
  initiative_value int         check (initiative_value between -50 and 100),
  created_at       timestamptz not null default now()
);

create unique index idx_initiative_participant_unique_member
  on public.campaign_initiative_participants(campaign_id, user_id)
  where user_id is not null;

create table public.campaign_initiative_state (
  campaign_id                 uuid primary key references public.campaigns(id) on delete cascade,
  round_number                int  not null default 1 check (round_number >= 1),
  current_turn_participant_id uuid references public.campaign_initiative_participants(id) on delete set null,
  updated_at                  timestamptz not null default now()
);
```

RLS: SELECT em ambas para qualquer membro. Em
`campaign_initiative_participants` — INSERT só mestre (com checagem de que
`user_id`, se preenchido, é membro da campanha); UPDATE por `user_id =
auth.uid() or mestre` (jogador rola/edita a própria iniciativa; mestre edita
qualquer linha, inclusive NPCs); DELETE só mestre. `campaign_initiative_state`
não tem policy de INSERT/UPDATE direta — só as RPCs abaixo escrevem nela
(SECURITY DEFINER), mesmo padrão de `campaign_chat_reads`.

RPCs:
- `start_initiative_encounter(campaign_id)` — mestre only. Insere uma linha
  por membro atual da campanha (`on conflict (campaign_id, user_id) where
  user_id is not null do nothing`, então repetir não duplica) e garante a
  linha de `campaign_initiative_state` com `round_number = 1`.
- `advance_initiative_turn(campaign_id)` — mestre only. Lê os participantes
  ordenados por `initiative_value desc nulls last, created_at`, acha a
  posição do `current_turn_participant_id` atual (ou começa do primeiro, se
  nulo), avança pro próximo, soma 1 em `round_number` ao dar a volta.
- `end_initiative_encounter(campaign_id)` — mestre only. Apaga todos os
  participantes e a linha de estado da campanha.

Realtime ligado nas duas tabelas (`alter publication supabase_realtime add
table`), mesmo padrão de `campaign_messages`/`dice_rolls`.

## Serviço — `initiativeService.ts` (novo)

```ts
export interface InitiativeParticipant {
  id: string; campaign_id: string; user_id: string | null
  name: string; initiative_value: number | null; created_at: string
}
export interface InitiativeState {
  campaign_id: string; round_number: number; current_turn_participant_id: string | null
}

export async function getInitiativeParticipants(campaignId: string): Promise<InitiativeParticipant[]>
export async function getInitiativeState(campaignId: string): Promise<InitiativeState | null>
export async function startInitiativeEncounter(campaignId: string): Promise<void>
export async function advanceInitiativeTurn(campaignId: string): Promise<void>
export async function endInitiativeEncounter(campaignId: string): Promise<void>
export async function addInitiativeParticipant(campaignId: string, name: string): Promise<void>  // NPC/monstro
export async function setInitiativeValue(participantId: string, value: number): Promise<void>
export async function removeInitiativeParticipant(participantId: string): Promise<void>
export async function rollInitiative(campaignId: string, participantId: string, modifier: number): Promise<void>
  // monta "1d20+N"/"1d20-N"/"1d20", chama rollDice(campaignId, formula) do
  // diceService já existente, e grava o total em initiative_value — sem
  // otimismo local, o Realtime ecoa de volta igual ao chat

export function subscribeToInitiative(
  campaignId: string,
  onParticipantsChange: () => void,
  onStateChange: (state: InitiativeState) => void,
): () => void
```

`rollInitiative` reaproveita o `rollDice` já existente (grava em
`dice_rolls` normalmente, aparece no histórico/notificação de dado — não é
um roll "especial") em vez de duplicar lógica de dado.

## Interface — `InitiativeTrackerPanel.tsx` (novo)

- Sem combate ativo: botão **"Iniciar combate"** (só mestre) chama
  `startInitiativeEncounter`.
- Lista de participantes ordenada por `initiative_value` (maior primeiro,
  sem valor por último), um card por linha: avatar/nome (+ etiqueta "NPC" se
  `user_id` for nulo), campo de modificador (estado local, não persiste),
  botão "Rolar" (chama `rollInitiative`) e o valor em si editável por clique
  (chama `setInitiativeValue` — mestre em qualquer linha, jogador só na
  própria). Linha da vez atual destacada
  (`current_turn_participant_id`).
- **Linha de valores**: barra horizontal abaixo da lista — só participantes
  já rolados entram; marcador posicionado em `(valor - mínimo) / (máximo -
  mínimo) * 100%` da esquerda pra direita (todos no centro se
  máximo === mínimo).
- Contador de rodada + botão **"Avançar turno"** (só mestre) chama
  `advanceInitiativeTurn`.
- **"Adicionar NPC"** (só mestre): nome + rola ou digita depois, mesma linha
  dos jogadores.
- **"Encerrar combate"** (só mestre) chama `endInitiativeEncounter`.
- Assina `subscribeToInitiative` ao montar — toda a mesa vê rolagem e troca
  de turno na hora.

## Checklist de implementação

- [ ] Migration 38: as duas tabelas + RLS + 3 RPCs + publicação Realtime
- [ ] `shared/types/index.ts`: `InitiativeParticipant`, `InitiativeState`
- [ ] `initiativeService.ts`: CRUD + RPCs + Realtime
- [ ] `InitiativeTrackerPanel.tsx` + CSS
- [ ] `SessionTablePanel.tsx` + CSS: sub-abas Chat/Ficha/Atividade/Iniciativa
- [ ] `CampaignAreaPage.tsx`: novo `TabId`, `activeSessionTab` elevado,
      selo agregado em "Mesa da Sessão"
- [ ] `CampaignOverviewPanel.tsx`: os dois `onNavigate('ficha')` viram
      `onNavigate('mesa-sessao', 'ficha')`
- [ ] README: 38 migrations, seção da Mesa da Sessão + Iniciativa
- [ ] `npm run verify` passando
