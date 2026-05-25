# Campaign Lab

Plataforma web para gerenciamento de campanhas de RPG de mesa.

## Visão geral

Campaign Lab permite que mestres criem campanhas, adicionem jogadores, gerenciem fichas simples de personagem e registrem rolagens de dados — tudo persistido em banco de dados real via Supabase.

> **Nota sobre tempo real:** o MVP não usa Supabase Realtime para economizar recursos. O histórico de rolagens atualiza para o próprio usuário após cada rolagem. Outros membros veem as novas rolagens ao recarregar a página. Realtime pode ser reativado futuramente.

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

| # | Arquivo | O que faz |
|---|---|---|
| 1 | `20240101000000_initial_schema.sql` | Tabelas `profiles`, `campaigns`, `campaign_members`; triggers; RLS; RPCs `create_campaign`, `is_campaign_member`, `is_campaign_master` |
| 2 | `20240102000000_campaign_members.sql` | Policy de perfis entre co-membros; RPCs `find_profile_by_email`, `add_campaign_player`, `remove_campaign_player` |
| 3 | `20240103000000_harden_campaign_members_insert.sql` | Remove policy de insert direto em `campaign_members` — toda inserção passa a ser via RPC |
| 4 | `20240104000000_character_sheets.sql` | Tabela `character_sheets`; RLS por dono e mestre |
| 5 | `20240105000000_dice_rolls.sql` | Tabela `dice_rolls`; RLS por membro da campanha |
| 6 | `20240106000000_harden_character_sheets_and_dice.sql` | Trigger que impede alteração de `campaign_id`/`user_id` em fichas; constraint de resultado máximo por tipo de dado; remove `dice_rolls` do Realtime |
| 7 | `20240107000000_allow_profile_self_insert.sql` | Policy de INSERT em `profiles` para o próprio usuário — permite que `ensureProfile()` sincronize perfis ausentes com segurança |

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

---

## O que está implementado no MVP

| Feature | Status |
|---|---|
| Cadastro com e-mail e senha | ✅ |
| Login com e-mail e senha | ✅ |
| Login com Google (OAuth) | ✅ |
| Logout | ✅ |
| Perfis de usuário (profiles) | ✅ |
| Criar campanha (sistema Genérico) | ✅ |
| Listar campanhas como mestre e jogador | ✅ |
| Área da campanha com nome e papel | ✅ |
| Adicionar jogador por e-mail | ✅ |
| Remover jogador | ✅ |
| Ficha simples de personagem | ✅ |
| Mestre vê todas as fichas da campanha | ✅ |
| Rolagem de dados (d4–d100) | ✅ |
| Histórico de rolagens da campanha | ✅ |
| Proteção de rotas (RLS + front-end) | ✅ |
| Design Medieval Dark v2 | ✅ |

## O que está fora do MVP (futuras features)

- Chat em tempo real
- Presença online de membros
- Upload de imagem de capa ou avatar
- Notificações
- Sistemas específicos (D&D, Altherium, Tormenta, Cthulhu etc.)
- Modificadores automáticos de atributos
- Classe de armadura / Mana / Perícias / Magias
- Explorar campanhas públicas
- Rolagem com fórmula (1d20+5), vantagem/desvantagem
- Rolagem privada / dano oculto
- Notas de sessão
- Configurações de conta
- Plano premium / monetização

---

## Observações importantes

**Supabase Realtime desativado no MVP**
O histórico de rolagens atualiza localmente após o próprio usuário rolar. Outros membros veem as novas rolagens ao recarregar a página. Isso evita uso desnecessário de conexões WebSocket no MVP.
Para reativar no futuro: adicione `dice_rolls` à publicação em **Dashboard → Database → Replication** e restaure `subscribeToRolls` em `diceService.ts` e `DiceRollerPanel.tsx`.

**Segurança no banco**
Toda inserção em `campaign_members` acontece via RPC (`add_campaign_player`, `create_campaign`) — insert direto está bloqueado pelo RLS. Fichas têm trigger que impede alteração de `campaign_id` e `user_id`. Rolagens têm constraint que valida o intervalo por tipo de dado.

---

## Estrutura do projeto

```
supabase/
└── migrations/             ← 6 migrations em ordem

src/
├── app/
│   ├── router/             # Rotas + GuestRoute + ProtectedRoute
│   ├── providers/          # AppProviders
│   └── layouts/            # PublicLayout (auth) e PrivateLayout (sidebar)
│
├── features/
│   ├── auth/               # AuthProvider, GuestRoute, ProtectedRoute, páginas de auth
│   ├── campaigns/          # Listagem, criação, área da campanha + campaignService
│   ├── members/            # CampaignMembersPanel + memberService
│   ├── sheets/             # SimpleSheetPanel, SimpleSheetForm, CampaignSheetsList + sheetService
│   ├── dice/               # DiceRollerPanel + diceService
│   └── users/              # profileService
│
└── shared/
    ├── lib/supabase.ts      # Cliente Supabase
    ├── utils/authErrors.ts  # Tradução de erros de auth
    ├── utils/campaign.ts    # formatSystem, formatRole
    └── types/index.ts       # Tipos do modelo de dados
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
#   c a m p a i g n - l a b - v 2  
 