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
| Rolagem personalizada por fórmula (`2d6+3`, `2#d20`, `1#d3+4`…) | ✅ |
| Histórico de rolagens com breakdown detalhado | ✅ |
| Área da campanha por abas (Visão geral / Membros / Sessões / Ficha / Rolagem / Configurações) | ✅ |
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

## O que está fora do MVP (futuras features)

- Chat em tempo real
- Presença online de membros
- Upload de imagem de capa ou avatar
- Notificações
- Sistemas específicos (D&D, Altherium, Tormenta, Cthulhu etc.)
- Modificadores automáticos de atributos
- Classe de armadura / Mana / Perícias / Magias
- Explorar campanhas públicas
- Rolagem privada / dano oculto
- Notas de sessão
- Configurações de conta
- Plano premium / monetização

---

## Rolagem de dados

A área de rolagem é acessível pela aba **"Rolagem"** dentro de qualquer campanha.

### Rolagem rápida

Botões de um clique: **1d4 · 1d6 · 1d8 · 1d10 · 1d12 · 1d20 · 1d100**

Clique → rola imediatamente → salva no histórico → exibe resultado.

### Rolagem personalizada por fórmula

Campo de texto que aceita uma gramática controlada (sem eval, sem funções):

| Fórmula | Significado |
|---|---|
| `1d20` | 1 dado de 20 lados |
| `d20` | equivalente a `1d20` |
| `2d6+3` | soma 2d6 e adiciona 3 |
| `3d4-1` | soma 3d4 e subtrai 1 |
| `2#d20` | rola 2d20, **mantém o maior resultado** |
| `1#d3+4` | rola 1d3, mantém o maior resultado, adiciona 4 |
| `3#d6+2` | rola 3d6, mantém o maior resultado, adiciona 2 |
| `2#d20+1d4+3` | keep-highest 2d20 + soma 1d4 + modificador 3 |

O operador `#` significa "rolar N dados e manter o maior resultado".
O resultado detalhado sempre exibe os dados individuais e qual foi mantido.

**Limites aceitos:** quantidade por termo 1–100 · lados 2–1000 · modificador ±999 · até 10 termos · fórmula até 80 caracteres.

### Histórico

- Últimas 20 rolagens, mais recentes primeiro
- Exibe fórmula, resultados individuais, kept result (quando `#`), modificador e resultado final
- Botão **"Atualizar histórico"** recarrega manualmente (sem Realtime / sem polling)

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
│   ├── campaigns/          # Listagem, criação, área da campanha, configurações + campaignService
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
| `/perfil` | Autenticado | Perfil do usuário — editar nome público |
| `/` | Público | Página inicial |
| `/sobre` | Público | Sobre o Campaign Lab |
| `/termos` | Público | Termos de uso |
| `/privacidade` | Público | Política de privacidade |
| `/convite/:token` | Público | Aceitar convite de campanha |

---

## Tema claro/escuro

O Campaign Lab suporta alternância entre **modo escuro** (padrão) e **modo claro** (pergaminho medieval).

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
git commit -m "feat: Campaign Lab MVP"

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
