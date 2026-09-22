# Vorterium

Plataforma web para gerenciamento de campanhas de RPG de mesa.

## Visão geral

Vorterium permite que mestres criem campanhas, adicionem jogadores, gerenciem fichas simples de personagem e registrem rolagens de dados — tudo persistido em banco de dados real via Supabase.

> **Nota sobre tempo real:** o MVP evita Supabase Realtime pra economizar recursos — a maioria das listas e painéis usa polling. Três exceções, onde o atraso do polling era perceptível demais: o **chat da campanha** (mensagens aparecem na hora), o **pop-up de notificação de rolagem de dado** e o **histórico "Recentes" no painel de dados** (ambos disparam na hora, sem esperar o próximo ciclo de polling).

---

## Stack

| Tecnologia | Uso |
|---|---|
| React 18 + TypeScript | Interface |
| Vite | Bundler e dev server |
| Supabase | Auth, banco de dados, RLS |
| React Router v6 | Roteamento client-side |
| CSS puro (design system próprio) | Estilo — Medieval Dark v2 |

---

## Pré-requisitos

- Node.js 18+
- npm 9+
- Conta no [Supabase](https://supabase.com) com um projeto criado

---

## Instalação

```bash
git clone <url-do-repositório>
cd campaign-lab
npm install
```

---

## Configuração

### 1. Configurar `.env`

```bash
cp .env.example .env
```

Edite `.env` com os dados do seu projeto Supabase:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key_aqui
```

Valores em: **Supabase Dashboard → Settings → API**

---

### 2. Configurar Supabase Auth

#### Login com e-mail e senha

```
Authentication → Providers → Email
```

- Mantenha **Enable Email provider** ativado
- **Confirm email**: ative para exigir verificação antes do primeiro login

#### Login com Google (OAuth)

```
Authentication → Providers → Google
```

1. Ative o provider Google no Supabase
2. Copie a **Callback URL** exibida (`https://...supabase.co/auth/v1/callback`)
3. No [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → Credentials → OAuth 2.0 Client ID**:
   - Tipo: **Web application**
   - Adicione a Callback URL em **Authorized redirect URIs**
   - Copie **Client ID** e **Client Secret**
4. Cole no Supabase e salve

#### URL de callback da aplicação

```
Authentication → URL Configuration
```

- **Site URL**: `http://localhost:5173`
- **Redirect URLs**: adicione `http://localhost:5173/auth/callback`

> Em produção, substitua `localhost:5173` pelo domínio real.

---

### 3. Aplicar as migrations SQL

As migrations devem ser aplicadas **em ordem**, uma por vez, no **Supabase Dashboard → SQL Editor → New query**.

O repositório contém **37 migrations SQL**. A lista abaixo é o contrato canônico da
ordem de aplicação; não existe uma migration `20240121000000_my_sheets.sql` neste
repositório e ela não deve ser criada ou aplicada sem uma decisão explícita de
schema.

| # | Arquivo | O que faz |
|---|---|---|
| 1  | `20240101000000_initial_schema.sql` | Tabelas `profiles`, `campaigns`, `campaign_members`; triggers; RLS; RPCs `create_campaign`, `is_campaign_member`, `is_campaign_master` |
| 2 | `20240102000000_campaign_members.sql` | Policy de perfis entre co-membros; RPCs `find_profile_by_email`, `add_campaign_player`, `remove_campaign_player` |
| 3 | `20240103000000_harden_campaign_members_insert.sql` | Remove policy de insert direto em `campaign_members` — toda inserção passa a ser via RPC |
| 4 | `20240104000000_character_sheets.sql` | Tabela `character_sheets`; RLS por dono e mestre |
| 5 | `20240105000000_dice_rolls.sql` | Tabela `dice_rolls`; RLS por membro da campanha |
| 6 | `20240106000000_harden_character_sheets_and_dice.sql` | Trigger que impede alteração de `campaign_id`/`user_id` em fichas; constraint de resultado máximo por tipo de dado; remove `dice_rolls` do Realtime |
| 7 | `20240107000000_allow_profile_self_insert.sql` | Policy de INSERT em `profiles` para o próprio usuário — permite que `ensureProfile()` sincronize perfis ausentes com segurança |
| 8 | `20240108000000_campaign_invites.sql` | Tabela `campaign_invites`; RLS; RPCs `create_campaign_invite`, `accept_campaign_invite`, `deactivate_campaign_invite` |
| 9 | `20240109000000_improve_campaign_invites.sql` | RPC pública `get_campaign_invite_public` — retorna dados do convite sem autenticação (nome da campanha, status, expiração) |
| 10 | `20240110000000_campaign_management.sql` | RPCs `update_campaign_name`, `delete_campaign`, `leave_campaign` — gerenciamento seguro de campanha |
| 11 | `20240111000000_improve_dice_rolls.sql` | Adiciona campos `quantity`, `modifier`, `individual_results`, `total_result`, `roll_mode`, `kept_result`, `formula` em `dice_rolls`; trigger de validação |
| 12 | `20240112000000_custom_dice_rolls.sql` | Adiciona `roll_breakdown jsonb`; ajusta limites de `quantity` (100) e `modifier` (±999); substitui trigger com validação matemática completa do breakdown |
| 13 | `20240113000000_campaign_sessions.sql` | Tabela `campaign_sessions` (título, data, resumo, created_by); RLS — membros visualizam, mestre cria/edita/exclui; trigger `updated_at` |
| 14 | `20240114000000_harden_campaign_sessions.sql` | Trigger `enforce_session_immutable_fields` — impede alteração de `campaign_id`, `created_by` e `created_at` após criação |
| 15 | `20240115000000_campaign_description_status.sql` | Adiciona descrição e status à campanha; recria as RPCs de criação e atualização com validações |
| 16 | `20240116000000_harden_campaign_structural_fields.sql` | Endurece `create_campaign` com validação de `char_length`; trigger imutável para `campaign_id`/`user_id` em várias tabelas |
| 17 | `20240117000000_campaign_activity_presence.sql` | Tabelas `campaign_activity` e `campaign_presence`; RPCs para registrar atividade e heartbeat de presença |
| 18 | `20240118000000_harden_campaign_activity_rpc.sql` | Endurece `create_campaign_activity` para impedir que jogadores forjem eventos administrativos |
| 19 | `20240119000000_session_status.sql` | Adiciona status `planned`, `completed` e `canceled` às sessões |
| 20 | `20240120000000_campaign_notes.sql` | Tabela `campaign_notes`; RLS — membros leem e criam, autor e mestre editam/excluem; tipos de atividade de notas |
| 21 | `20240122000000_remove_custom_campaign_system.sql` | Remove sistema `custom` das campanhas; recria RPC `create_campaign` com sistemas válidos: `generic`, `dnd5e`, `altherium` |
| 22 | `20240123000000_dnd_character_sheets_base.sql` | Tabela `dnd_character_sheets` — ficha D&D 5e base; RLS; triggers de `updated_at` e campos estruturais imutáveis |
| 23 | `20240125000000_dnd_abilities_saves.sql` | Idempotente: garante `player_name`, atributos (integer 1–30) e colunas `strength_save_proficient` etc. em `dnd_character_sheets` |
| 24 | `20240126000000_profile_preferences_and_media.sql` | Preferência de tema, URL de capa da campanha, buckets `avatars`/`campaign-covers` e policies de Storage |
| 25 | `20240127000000_dnd_sheet_details.sql` | Perícias, ataques, inventário e magias da ficha D&D 5e, com índices, triggers e RLS |
| 26 | `20240128000000_dnd_rules_engine.sql` | Catálogo D&D 5e 2014, escolhas oficiais, proficiências adicionais e sobrescritas manuais de campos calculados |
| 27 | `20240129000000_dnd_equipment_catalog.sql` | Catálogo estruturado de armas, armaduras, itens de aventura e ferramentas para a ficha D&D 5e |
| 28 | `20240130000000_dice_keep_lowest.sql` | Adiciona `keep_lowest` (`roll_mode` e validação do `roll_breakdown`) — suporta o operador `@` (manter o menor) na fórmula de rolagem |
| 29 | `20240131000000_dice_private_rolls.sql` | Adiciona `dice_rolls.is_private` e substitui a policy de SELECT — rolagens privadas só ficam visíveis para quem rolou e para o mestre da campanha |
| 30 | `20240132000000_notification_seen_at.sql` | Adiciona `profiles.activity_seen_at` — marca quando o usuário viu notificações pela última vez |
| 31 | `20240133000000_campaign_chat.sql` | Adiciona `campaign_messages` (com Realtime habilitado) e `campaign_chat_reads` + RPC `mark_campaign_chat_read` — chat da campanha em tempo real |
| 32 | `20240134000000_campaign_messages_replica_identity.sql` | `REPLICA IDENTITY FULL` em `campaign_messages` — sem isso, o evento de DELETE em tempo real não chega (o filtro por `campaign_id` não bate com o payload reduzido padrão) |
| 33 | `20240135000000_private_messages.sql` | Adiciona `campaign_messages.recipient_id` (mensagem privada) com policies atualizadas — só mestre⇄jogador, nunca jogador⇄jogador — e `campaign_private_message_reads` + RPCs `mark_private_thread_read`/`get_private_message_unread_counts` |
| 34 | `20240136000000_dice_rolls_realtime.sql` | Adiciona `dice_rolls` de volta à publicação Realtime — só para o pop-up global de notificação disparar na hora, sem esperar o polling de 20s |
| 35 | `20240137000000_leave_campaign_atomic_activity.sql` | Move o registro de atividade "saiu da campanha" pra dentro da própria RPC `leave_campaign`, atomicamente com a remoção — antes podia ficar um registro falso se a saída falhasse depois de já ter sido registrada |
| 36 | `20240138000000_campaign_initiative.sql` | Adiciona `campaign_initiative_participants` e `campaign_initiative_state` + RPCs `start_initiative_encounter`/`advance_initiative_turn`/`end_initiative_encounter`, com Realtime — rastreador de iniciativa compartilhado da Mesa da Sessão |
| 37 | `20240139000000_altherium_character_sheets.sql` | Adiciona `altherium_character_sheets` (identidade, atributos, recursos, hacksilvers, DB por parte do corpo) e `altherium_character_domains` (0-2 pontos por domínio) — base da ficha do sistema Altherium |

> **Usuários criados antes da migration 1:** o trigger `handle_new_user` cria perfis apenas para novos cadastros. Para sincronizar usuários já existentes, rode o script de backfill comentado na seção 9 da migration 1.

---

### 4. Rodar localmente

```bash
npm run dev
# http://localhost:5173
```

### Build de produção

```bash
npm run build
npm run preview
```

### Verificação local do contrato

Antes de abrir um deploy ou adicionar uma migration, execute:

```bash
npm run verify
```

O comando valida as 37 migrations registradas e depois executa o build de produção.

---

## Sistemas disponíveis

Os sistemas são internos do Vorterium — usuários não criam sistemas personalizados. Novos sistemas são adicionados por atualizações da plataforma.

| Sistema | ID | Ficha | Status |
|---|---|---|---|
| **Genérico** | `generic` | Ficha simples (atributos, PV, notas) | Disponível |
| **D&D 5e** | `dnd5e` | Ficha completa com persistência real no banco | Prévia |
| **Altherium** | `altherium` | Sistema futuro do universo Altherium | Em breve |

- **Genérico:** usa a ficha simples atual. Ideal para testes, one-shots ou sistemas caseiros.
- **D&D 5e:** ficha D&D 5e persistida no banco, com edição direta em linha (sem modo "editar" global). Inclui cabeçalho, atributos, salvaguardas, CA / iniciativa / deslocamento / proficiência, PV, salvaguardas mortais, inspiração e listas persistentes de perícias, ataques, inventário e magias. O banner "Alterações não salvas" controla os campos principais; listas são salvas individualmente para evitar perda de alterações.
- **Altherium:** a ficha própria do sistema Altherium será desenvolvida em atualização futura. Campanhas Altherium já podem ser criadas para validar a estrutura.

O sistema de uma campanha é escolhido no momento da criação e **não pode ser alterado depois**.

---

## O que está implementado no MVP

| Feature | Status |
|---|---|
| Cadastro com e-mail e senha | ✅ |
| Login com e-mail e senha | ✅ |
| Login com Google (OAuth) | ✅ |
| Logout | ✅ |
| Perfis de usuário (profiles) | ✅ |
| Criar campanha com seleção de sistema (Genérico / D&D 5e / Altherium) | ✅ |
| Listar campanhas como mestre e jogador | ✅ |
| Área da campanha por abas com aba "Visão geral" como padrão | ✅ |
| Aba Membros com seções separadas (Mestre / Jogadores) | ✅ |
| Adicionar jogador por e-mail | ✅ |
| Remover jogador (com confirmação inline) | ✅ |
| Convite por link — gerar, copiar e desativar | ✅ |
| Status de ficha por membro na aba Membros (preenchida / não preenchida / não criada) | ✅ |
| Ficha simples de personagem (identificação, PV, atributos, anotações) | ✅ |
| Indicador "Preenchida / Não preenchida" na ficha | ✅ |
| Barra de HP visual na ficha | ✅ |
| Mestre vê todas as fichas com status de preenchimento | ✅ |
| Rolagem rápida de dados (d4–d100) | ✅ |
| Rolagem personalizada por fórmula (`2d6+3`, `2#d20`, `2@d20`…) | ✅ |
| Histórico de rolagens com breakdown detalhado | ✅ |
| Botão flutuante de rolagem, acessível de qualquer aba dentro de uma campanha | ✅ |
| Rolagem privada / dano oculto | ✅ |
| Sino de notificações — selo global de eventos novos em todas as campanhas | ✅ |
| Pop-up ao vivo (5s) para rolagem pública, nova nota, nova sessão e novo membro | ✅ |
| Chat da campanha em tempo real (Realtime), com selo de não lidas na aba | ✅ |
| Mensagens privadas no chat — mestre com cada jogador, individualmente | ✅ |
| Mesa da Sessão — Chat / Ficha / Atividade / Iniciativa agrupados numa aba só | ✅ |
| Rastreador de iniciativa compartilhado (rolar, editar, avançar turno/rodada) | ✅ |
| Área da campanha por abas (Visão geral / Membros / Sessões / Notas / Mesa da Sessão / Configurações) | ✅ |
| Sessões da campanha — criar, editar e excluir pelo mestre | ✅ |
| Sessões — visualização com título, data e resumo para jogadores | ✅ |
| Sessões na Visão Geral — contagem e última sessão com ação rápida | ✅ |
| Proteção de rotas (RLS + front-end) | ✅ |
| Design Medieval Dark v2 | ✅ |
| Convite por link — aceitar com dados públicos antes do login | ✅ |
| Mestre edita nome da campanha | ✅ |
| Mestre exclui campanha (com cascata) | ✅ |
| Jogador sai da campanha | ✅ |
| Página de perfil (`/perfil`) — editar nome público | ✅ |
| Preferência de tema, avatar com ajuste e capa de campanha com recorte | ✅ |
| Ficha D&D 5e — perícias, ataques, inventário e magias persistentes | ✅ |
| Ficha Altherium (base) — raízes, atributos, domínios, recursos, hacksilvers e DB | ✅ |

## O que está fora do MVP (futuras features)

- Ficha Altherium: triunfos (trilhas de Runaskin, baralho do Pilar), catálogo de armas/armaduras e inventário
- Explorar campanhas públicas
- Configurações de conta
- Plano premium / monetização

---

## Rolagem de dados

A rolagem é acessível pelo **botão flutuante** (⬡) fixo no canto inferior
direito da tela, em qualquer aba dentro de uma campanha. Fora do contexto de
uma campanha o botão aparece travado (🔒), com uma dica ao passar o cursor —
a rolagem pertence à campanha ativa, já que cada campanha pode usar um
sistema de RPG diferente.

### Rolagem rápida

Botões de um clique: **1d4 · 1d6 · 1d8 · 1d10 · 1d12 · 1d20 · 1d100**

Clique → rola imediatamente → salva no histórico → exibe resultado, com uma
breve animação de "giro" antes de assentar no valor final.

### Rolagem personalizada por fórmula

Campo de texto que aceita uma gramática controlada (sem eval, sem funções):

| Fórmula | Significado |
|---|---|
| `1d20` | 1 dado de 20 lados |
| `d20` | equivalente a `1d20` |
| `2d6+3` | soma 2d6 e adiciona 3 |
| `3d4-1` | soma 3d4 e subtrai 1 |
| `2#d20` | rola 2d20, **mantém o maior resultado** |
| `2@d20` | rola 2d20, **mantém o menor resultado** |
| `1#d3+4` | rola 1d3, mantém o maior resultado, adiciona 4 |
| `3#d6+2` | rola 3d6, mantém o maior resultado, adiciona 2 |
| `2#d20+1d4+3` | keep-highest 2d20 + soma 1d4 + modificador 3 |

O operador `#` significa "rolar N dados e manter o maior resultado"; `@` é o
complemento — "rolar N dados e manter o menor resultado". O resultado
detalhado sempre exibe os dados individuais e qual foi mantido.

**Limites aceitos:** quantidade por termo 1–100 · lados 2–1000 · modificador ±999 · até 10 termos · fórmula até 80 caracteres.

### Histórico

- Últimas 3 rolagens da campanha, direto no popover do botão flutuante
- Exibe fórmula, resultados individuais, kept result (quando `#` ou `@`), modificador e resultado final
- Botão **"Atualizar"** recarrega manualmente (sem Realtime / sem polling)
- Histórico completo além das últimas 3 fica registrado na aba **Atividade** da campanha

### Rolagem privada

O popover tem um toggle **"🔒 Rolagem privada"**, desmarcado por padrão toda
vez que reabre. Enquanto marcado, vale tanto pra rolagem rápida quanto pra
fórmula personalizada.

- Quem rolou sempre vê o próprio resultado.
- O mestre da campanha sempre vê qualquer rolagem, privada ou não.
- Os demais jogadores não veem nada de uma rolagem privada de outra pessoa
  — nem o valor, nem indício de que ela aconteceu. A regra é aplicada por
  RLS no banco, não por filtro na tela.
- Rolagens privadas não geram registro na aba Atividade — nem pra quem
  rolou, nem pro mestre. Ficam visíveis só pelo próprio popover (notificação
  e histórico recente), marcadas com 🔒.

## Notificações

Um sino fica sempre visível no canto inferior direito, junto do botão de
rolagem de dados — dentro ou fora do contexto de campanha. Conta eventos
novos em **todas** as campanhas do usuário, não só a que está aberta.

Eventos que contam: entrada/saída de membro, sessão criada/editada/
cancelada, nova nota, e rolagem de dados (pública conta pra toda a mesa;
oculta conta só pro mestre — mesma regra de visibilidade da rolagem
privada). Convites, atualização de campanha e de ficha não notificam,
continuam só na aba Atividade.

O painel do sino também lista mensagens de chat recentes (só como
histórico — continuam fora da contagem do selo). Clicar no sino abre um
painel com as últimas 3 notificações (mesmo estilo
do popover de rolagem de dados) e marca tudo como visto. Sem Realtime —
verifica a cada ~75s enquanto o app está aberto.

### Pop-up ao vivo

Além do sino, um pop-up aparece automaticamente por 5 segundos quando
acontece: rolagem pública nova, nova nota, nova sessão criada, nova
mensagem de chat (com prévia do conteúdo), ou você ser adicionado a uma
campanha. Rolagem oculta nunca vira pop-up (só conta no sino, mesmo pro
mestre) — fica discreta de propósito. Mensagem de chat vira pop-up mas
**não** conta no selo do sino global — o "não lido" de chat mora só na
própria aba (ver seção "Chat da campanha").

Checa a cada 20s, também sem Realtime — exceto mensagem de chat e
rolagem de dados, que usam Realtime de verdade (assinam
`campaign_messages`/`dice_rolls` em todas as campanhas do usuário, sem
filtro de campanha; funciona porque o Realtime do Supabase já respeita
RLS) e por isso aparecem na hora, sem esperar o próximo ciclo.
O relógio de "já visto" desse pop-up é separado do sino e só existe na
memória do navegador — recarregar a página zera e passa a valer só dali
pra frente, pra não disparar uma enxurrada de pop-ups de coisa antiga a
cada F5. Vários eventos no mesmo intervalo aparecem um de cada vez, nunca
empilhados.

Mensagem de chat **não** vira pop-up se o usuário já estiver dentro
daquela conversa (aba Chat da mesma campanha aberta) — um contexto leve
(`ActiveChatProvider`) avisa globalmente qual chat está em tela.

---

## Chat da campanha

Aba **"Chat"** dentro de qualquer campanha, entre Atividade e
Configurações. É a primeira funcionalidade do projeto com **Supabase
Realtime de verdade** — mensagem aparece pros outros membros na hora, via
subscription (`postgres_changes`), sem polling.

- Uma conversa por campanha (a "Mesa"), compartilhada entre todos os membros.
- Autor apaga a própria mensagem; o mestre pode apagar qualquer mensagem
  da campanha. Clicar em apagar pede confirmação inline ("Apagar esta
  mensagem?") antes de excluir de verdade.
- Sem edição de mensagem, sem menções, sem anexos.
- Histórico paginado: carrega as últimas ~30 mensagens ao abrir, e rolar
  até o topo busca mensagens mais antigas mantendo a posição de leitura.
- **Selo de não lidas** na própria aba (não no sino global — é por
  campanha, não cruza para outras campanhas). Some ao abrir a aba.
- **Indicador de "digitando..."** — via Realtime Broadcast (efêmero, não
  grava no banco), some sozinho se parar de chegar aviso por ~3,5s.
- Som próprio (diferente do som de notificação) toca quando chega mensagem
  de outra pessoa **enquanto a aba de chat já está aberta** — o pop-up
  global fica suprimido nesse caso, então esse som é o único aviso.

### Mensagens privadas

Uma barra lateral dentro da aba Chat lista, além de "Mesa", as conversas
privadas possíveis: o mestre vê um item por jogador; o jogador vê só
"Mestre". Clicar troca a conversa exibida — mensagens, "digitando..." e
envio passam a valer só para aquela conversa.

- **Só mestre⇄jogador.** Não existe conversa privada entre dois
  jogadores — travado na policy de INSERT do banco, não só na interface.
- **Selo separado**, com cor própria (dourado, diferente do selo
  vermelho da mesa), somando as não lidas de todas as conversas privadas.
  Só abaixa conforme cada conversa é aberta — não zera com um clique
  genérico na aba Chat, que abre na "Mesa" por padrão.
- Reaproveita toda a infraestrutura do chat (Realtime, paginação, exclusão
  com confirmação, digitando, som) — uma mensagem privada é uma linha de
  `campaign_messages` com `recipient_id` preenchido, em vez de uma tabela
  separada.
- O pop-up global e o histórico do sino mostram "Mensagem privada de
  Fulano" (sem preview do conteúdo) quando aplicável.

**Migrations necessárias:** `20240133000000_campaign_chat.sql` (base do
chat — também habilita a publicação Realtime para `campaign_messages` via
`alter publication supabase_realtime add table`) e
`20240135000000_private_messages.sql` (mensagens privadas).

---

## Ficha Altherium

Sistema próprio, baseado no *Livro de regras básicas de ALTHERIUM 1.0*. Campanhas
com sistema **Altherium** abrem a ficha real na sub-aba Ficha da Mesa da Sessão.

**Estrutura do personagem**

- **Raiz**: Berserker, Runaskin ou Pilar — define bases de recurso e de domínios
- **Atributos**: Fúria, Destino, Espírito, Impulso, Estratégia e Rúnico
  (exclusivo de Runaskin, que começa com +2 fora dos 16 pontos da criação).
  O teto de 6 vale na criação — subir de nível dá +2 pontos e passa disso.
  Atributo em 0 sinaliza 1d de desvantagem
- **Gênesis**: 12 origens, cada uma com seu efeito descrito na ficha
- **24 Domínios**, cada um ligado a um atributo, 0 a 2 pontos — cada ponto vale
  +1d10 no teste daquele domínio (a ficha mostra os dados resultantes)

**Recursos derivados** — a ficha guarda só o d10 rolado na criação e o valor
atual; o máximo é recalculado a partir da raiz e do atributo, então acompanha
mudanças de atributo sozinho:

| Raiz | Vitalidade | Recurso próprio | Equilíbrio | Domínios |
|---|---|---|---|---|
| Berserker | 20 + d10 + Espírito | FV 14 + d10 + Impulso | 10 + d10 + Destino | 4 + Estratégia |
| Runaskin | 10 + d10 + Espírito | PR 20 + d10 + Rúnico | 20 + d10 + Destino | 6 + Estratégia |
| Pilar | 15 + d10 + Espírito | Cartas = 13 × nível | 15 + d10 + Destino | 8 + Estratégia |

Além disso: Hacksilvers (₴2000 na criação), DB por parte do corpo (Pernas 1-3,
Braços 4-6, Tronco 7-9, Cabeça 10 no d10 de localização) e movimento derivado do
Impulso (5m até 8, 10m de 9 em diante).

Contadores de criação (16 pontos de atributo, limite de domínios da raiz) aparecem
como aviso, sem travar o salvamento — o mestre pode liberar exceções. Jogador edita
a própria ficha; mestre vê os cards de resumo de todos e edita qualquer uma.

**Migration necessária:** `20240139000000_altherium_character_sheets.sql`.

---

## Mesa da Sessão

Aba **"Mesa da Sessão"**, no lugar onde antes existiam abas separadas de
Chat, Ficha e Atividade — as três continuam existindo, agora como
sub-abas dentro dela, junto com a nova sub-aba **Iniciativa**. A barra
principal da campanha fica: Visão geral / Membros / Sessões / Notas / Mesa
da Sessão / Configurações. O selo de mensagem não lida (mesa + privada)
aparece na própria aba "Mesa da Sessão".

### Iniciativa

Rastreador de combate compartilhado em tempo real — todo mundo na mesa vê a
mesma ordem, rolagem e turno atual.

- **Iniciar combate** (mestre) popula a lista com os membros atuais da
  campanha, iniciativa em branco.
- Cada participante rola pelo botão **"Rolar"** — reaproveita o rolador de
  dados já existente (`1d20`, aparece no histórico/notificação de dado
  normalmente) — ou tem o valor digitado direto clicando nele. Jogador rola
  ou edita a própria linha; mestre controla qualquer uma, inclusive NPCs.
- **Adicionar NPC/monstro** (mestre): nome à mão, sem vínculo com membro.
- Lista reordena sozinha, maior iniciativa primeiro.
- **Linha de valores**: barra horizontal abaixo da lista com um marcador
  por participante já rolado, posicionado proporcionalmente entre o menor e
  o maior valor da mesa.
- **Avançar turno** (mestre) marca a vez atual (linha destacada) e soma uma
  rodada ao voltar pro primeiro da lista.
- **Encerrar combate** (mestre) limpa participantes e estado.
- Sem modificador de atributo automático (a ficha D&D ainda não está
  conectada) e sem histórico de combates encerrados — só existe "o combate
  atual" por campanha.

**Migration necessária:** `20240138000000_campaign_initiative.sql` — cria
`campaign_initiative_participants`/`campaign_initiative_state`, as RPCs de
iniciar/avançar/encerrar e habilita Realtime nas duas tabelas.

---

## Sessões de campanha

A aba **"Sessões"** fica acessível dentro de qualquer campanha.

### Para o mestre

- **Criar sessão**: botão "+ Nova sessão" abre um formulário inline com título (obrigatório), data e resumo.
- **Editar sessão**: botão "Editar" em cada card reabre o formulário preenchido.
- **Excluir sessão**: botão "Excluir" exibe confirmação inline — sem diálogos nativos do browser.

### Para o jogador

- Visualiza todas as sessões registradas: título, data formatada e resumo completo.
- Não vê os botões de criar, editar ou excluir.

### Campos

| Campo | Tipo | Obrigatório | Limite |
|---|---|---|---|
| Título | texto | sim | 120 caracteres |
| Data da sessão | date | não | — |
| Resumo | texto longo | não | 5000 caracteres |

### Segurança

- RLS garante que usuários fora da campanha não acessam sessões.
- INSERT e UPDATE e DELETE são restritos ao mestre da campanha via `is_campaign_master`.
- `created_by` é sempre o `auth.uid()` do usuário autenticado (verificado no banco).

### Visão Geral

A aba **"Visão Geral"** mostra um card de Sessões com a contagem total, o título e a data da sessão mais recente, além do botão "Ver sessões →" para navegar direto à aba.

---

## Observações importantes

**Supabase Realtime parcial no MVP**
`dice_rolls` está na publicação Realtime (migration 34) para dois consumidores: o pop-up global de notificação (`subscribeToNewRollsGlobally`, um canal sem filtro de campanha) e o histórico "Recentes" do painel de dados (`subscribeToRolls`, um canal por campanha — mesmo padrão do chat). Rolagem de qualquer jogador ou do mestre aparece na hora nos dois lugares, sem precisar reabrir o painel ou clicar em "Atualizar".

**Segurança no banco**
Toda inserção em `campaign_members` acontece via RPC (`add_campaign_player`, `create_campaign`) — insert direto está bloqueado pelo RLS. Fichas têm trigger que impede alteração de `campaign_id` e `user_id`. Rolagens têm constraint que valida o intervalo por tipo de dado.

---

## Estrutura do projeto

```
supabase/
└── migrations/             ← 37 migrations em ordem

src/
├── app/
│   ├── router/             # Rotas + GuestRoute + ProtectedRoute
│   ├── providers/          # AppProviders
│   └── layouts/            # PublicLayout (auth) e PrivateLayout (sidebar)
│
├── features/
│   ├── auth/               # AuthProvider, GuestRoute, ProtectedRoute, páginas de auth
│   ├── campaigns/          # Listagem, criação, área da campanha, SessionTablePanel (Mesa da Sessão) + campaignService
│   ├── members/            # CampaignMembersPanel + memberService
│   ├── sheets/
│   │   ├── components/     # SimpleSheetPanel, CampaignSheetPanel (roteador de sistemas)
│   │   ├── dnd/            # Ficha D&D 5e completa — escrita, mas NÃO conectada ainda
│   │   │   │                 (CampaignSheetPanel mostra DndComingSoon pra campanhas dnd5e)
│   │   │   ├── services/   # dndSheetService (getMyDndSheet, ensureMyDndSheet, updateDndSheet)
│   │   │   ├── DndCharacterSheetPanel.tsx  # Painel real, pronto pra ligar
│   │   │   ├── DndCharacterSheetPreview.tsx # Prévia visual com dados mock (referência)
│   │   │   ├── DndCharacterSheet.css
│   │   │   ├── mockCharacter.ts
│   │   │   └── tabs/       # Componentes de aba (mock — referência)
│   │   ├── altherium/      # Ficha Altherium (base): painel, formulário, cálculos, constantes
│   │   └── services/       # sheetService (ficha genérica)
│   ├── dice/               # DiceRollerProvider, DiceFab, DiceRollerPanel + diceService
│   ├── notes/              # CampaignNotesPanel + noteService
│   ├── sessions/           # CampaignSessionsPanel + sessionService
│   ├── activity/           # CampaignActivityPanel, GlobalActivityPage, NotificationBell + activityService
│   ├── chat/               # CampaignChatPanel (mesa + mensagens privadas) + chatService (Realtime)
│   ├── initiative/         # InitiativeTrackerPanel + initiativeService (Realtime)
│   ├── invites/            # InvitePage + inviteService
│   └── users/              # profileService
│
└── shared/
    ├── constants/systems.ts # Catálogo de sistemas (generic / dnd5e / altherium)
    ├── lib/supabase.ts      # Cliente Supabase
    ├── utils/authErrors.ts  # Tradução de erros de auth
    ├── utils/campaign.ts    # formatRole, getCampaignStatusLabel
    └── types/index.ts       # Tipos: Campaign, CharacterSheet, DndCharacterSheet, DiceRoll…
```

---

## Rotas

| Rota | Acesso | Descrição |
|---|---|---|
| `/login` | Guest | Login |
| `/cadastro` | Guest | Cadastro |
| `/auth/callback` | Público | Callback OAuth |
| `/campanhas` | Autenticado | Lista de campanhas |
| `/campanhas/nova` | Autenticado | Criar campanha |
| `/campanhas/:campaignId` | Autenticado + membro | Área da campanha |
| `/perfil` | Autenticado | Perfil do usuário — editar nome público |
| `/` | Público | Página inicial |
| `/sobre` | Público | Sobre o Vorterium |
| `/termos` | Público | Termos de uso |
| `/privacidade` | Público | Política de privacidade |
| `/convite/:token` | Público | Aceitar convite de campanha |

---

## Tema claro/escuro

O Vorterium suporta alternância entre **modo escuro** (padrão) e **modo claro** (pergaminho medieval).

- O **tema padrão é escuro** (Medieval Dark v2).
- O botão de alternância aparece em **todas as páginas** — canto superior direito nas telas públicas e na barra lateral/topbar nas telas privadas.
- **Modo escuro:** o botão exibe ☀ (clicar para ir para modo claro).
- **Modo claro:** o botão exibe ☾ (clicar para ir para modo escuro).
- A troca de ícone tem animação de rotação.
- A **preferência fica salva no navegador** via `localStorage` com a chave `campaign-lab-theme`.
- O tema é aplicado antes do React montar (script no `<head>`) para evitar flash de tema errado.
- A tela de login possui **animação de partículas douradas** subindo ao fundo, reforçando a atmosfera medieval/fantasia.


---

## Convites de campanha

O mestre de uma campanha pode gerar um **link de convite** para compartilhar com jogadores.

- Na seção **Membros** da campanha, o mestre vê o botão **"Gerar link de convite"**.
- O link gerado tem o formato `/convite/:token`.
- O jogador abre o link:
  - Se **autenticado**: é adicionado como jogador e redirecionado para a campanha.
  - Se **não autenticado**: o token é salvo e o usuário é levado para `/login`; após autenticar, o convite é processado automaticamente.
- Convites **nunca concedem papel de mestre** — sempre adicionam como jogador.
- O mestre pode **desativar** um convite ativo pelo botão correspondente.
- Convites desativados deixam de funcionar imediatamente.

> **Migration necessária:** `20240108000000_campaign_invites.sql` deve ser aplicada antes de usar esta funcionalidade.


---

## Deploy de teste na Vercel

### Pré-requisitos

Antes de fazer o deploy, certifique-se de que:

- Conta no [GitHub](https://github.com)
- Conta na [Vercel](https://vercel.com)
- Projeto no Supabase criado e configurado
- Todas as migrations aplicadas no Supabase (ver seção acima)
- Supabase Auth configurado (e-mail/senha e Google OAuth)

---

### Passo 1 — Subir para o GitHub

```bash
# Na raiz do projeto
git init
git add .
git commit -m "feat: Vorterium MVP"

# Crie um repositório no GitHub e depois:
git remote add origin https://github.com/seu-usuario/campaign-lab.git
git push -u origin main
```

> **Importante:** confirme que `.env` **não** está no commit. Ele deve estar no `.gitignore`.

---

### Passo 2 — Importar na Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login
2. Clique em **Add New → Project**
3. Importe o repositório do GitHub
4. Configure o projeto:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. **Não clique em Deploy ainda** — configure as variáveis de ambiente primeiro

---

### Passo 3 — Variáveis de ambiente na Vercel

Na tela de configuração do projeto (ou em **Settings → Environment Variables** depois):

| Nome | Valor |
|---|---|
| `VITE_SUPABASE_URL` | `https://seu-projeto.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | sua anon key do Supabase |

Após adicionar as variáveis, clique em **Deploy**.

A Vercel irá gerar uma URL no formato:
```
https://campaign-lab-xxxx.vercel.app
```

---

### Passo 4 — Atualizar Supabase Auth

Com a URL da Vercel em mãos, acesse o Supabase Dashboard:

```
Authentication → URL Configuration
```

**Site URL:**
```
https://campaign-lab-xxxx.vercel.app
```

**Redirect URLs** (adicione os dois — mantenha localhost para desenvolvimento):
```
http://localhost:5173/auth/callback
https://campaign-lab-xxxx.vercel.app/auth/callback
```

Salve as alterações.

---

### Passo 5 — Revisar Google OAuth

No [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → Credentials → seu OAuth 2.0 Client**:

**Authorized JavaScript origins** — adicione:
```
https://campaign-lab-xxxx.vercel.app
```

**Authorized redirect URIs** — a URI de callback do Supabase não muda:
```
https://SEU-PROJETO.supabase.co/auth/v1/callback
```

> Se essa URI já estava configurada antes, não é necessário alterar. O redirect vai para o Supabase, não para a Vercel diretamente.

---

### Passo 6 — Testar online

Após o deploy, valide os fluxos principais:

1. Abra a URL da Vercel
2. Crie uma conta (`/cadastro`)
3. Faça login (`/login`)
4. Teste login com Google
5. Crie uma campanha
6. Adicione um segundo usuário como jogador
7. Edite a ficha de personagem
8. Role dados e verifique o histórico
9. Faça logout e confirme redirecionamento para `/login`

---

### Checklist de deploy

- [ ] `npm run build` passou localmente
- [ ] `.env` não está no repositório (está no `.gitignore`)
- [ ] Projeto subido para o GitHub
- [ ] Projeto importado na Vercel com framework Vite
- [ ] `VITE_SUPABASE_URL` configurada na Vercel
- [ ] `VITE_SUPABASE_ANON_KEY` configurada na Vercel
- [ ] Deploy realizado com sucesso na Vercel
- [ ] Supabase **Site URL** atualizado para a URL da Vercel
- [ ] Supabase **Redirect URLs** atualizadas (localhost + Vercel)
- [ ] Google OAuth revisado (JavaScript origins + redirect URIs)
- [ ] Login com e-mail/senha testado na URL de produção
- [ ] Login com Google testado na URL de produção
- [ ] Logout testado
- [ ] Criação de campanha testada
- [ ] Adição de membros testada
- [ ] Ficha de personagem testada
- [ ] Rolagem de dados testada

---

## Checklist de teste manual

Execute na ordem para validar o MVP completo:

- [ ] **Criar conta** — acessar `/cadastro`, preencher nome, e-mail, senha e confirmar. Verificar e-mail se confirmação estiver ativada.
- [ ] **Entrar com e-mail/senha** — acessar `/login`, entrar com as credenciais criadas. Confirmar redirecionamento para `/campanhas`.
- [ ] **Entrar com Google** — clicar em "Entrar com Google". Confirmar que o callback funciona e redireciona para `/campanhas`.
- [ ] **Sair da conta** — clicar em "Sair" na sidebar. Confirmar redirecionamento para `/login`.
- [ ] **Criar campanha** — clicar em "+ Criar campanha", preencher nome, clicar em "Criar Campanha". Confirmar redirecionamento para a área da campanha.
- [ ] **Ver campanha como mestre** — confirmar que o papel exibido é "Mestre" e que o formulário de adicionar jogador aparece.
- [ ] **Criar segundo usuário** — abrir aba anônima/outro navegador e criar uma segunda conta.
- [ ] **Adicionar segundo usuário como jogador** — como mestre, usar o formulário de adicionar jogador com o e-mail do segundo usuário.
- [ ] **Entrar como jogador** — logar com o segundo usuário. Confirmar que a campanha aparece em "Como jogador".
- [ ] **Ver campanha como jogador** — confirmar que o papel exibido é "Jogador" e que o formulário de adicionar jogador **não** aparece.
- [ ] **Jogador editar própria ficha** — preencher nome do personagem, atributos e salvar. Confirmar mensagem de sucesso.
- [ ] **Mestre visualizar ficha** — como mestre, abrir a campanha e ver a ficha do jogador na lista de fichas.
- [ ] **Rolar dados** — selecionar um dado (ex: d20), clicar em "Rolar d20". Confirmar que o resultado aparece e entra no histórico.
- [ ] **Ver histórico** — confirmar que o histórico mostra jogador, dado, resultado e horário.
- [ ] **Testar bloqueio de rota privada** — deslogar e acessar `/campanhas` diretamente. Confirmar redirecionamento para `/login`.
