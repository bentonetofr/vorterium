# Submenu de campanha na barra lateral

## Contexto

Hoje, dentro de uma campanha (`/campanhas/:campaignId`), a navegação entre
seções (Visão geral, Mesa da Sessão, Membros, Sessões, Notas,
Configurações) é uma barra horizontal de abas renderizada dentro de
`CampaignAreaPage.tsx`, controlada por `useState` local — não reflete na
URL. A barra lateral esquerda (`PrivateLayout.tsx`) tem só 4 links de
topo: Campanhas, Minhas fichas, Atividade, Perfil.

Esta mudança move a navegação entre seções da campanha pra dentro da
barra lateral, como um submenu que aparece embaixo de "Campanhas"
sempre que o usuário está dentro de uma campanha específica.

## Objetivo

- Clicar numa campanha (vindo da lista) expande "Campanhas" na barra
  lateral num submenu vertical menor com as 6 seções.
- Clicar numa seção do submenu mostra o conteúdo dela na tela.
- A barra horizontal de abas atual desaparece.
- Cada seção vira uma URL própria (compartilhável, sobrevive a refresh).
- No celular (sem barra lateral), um menu suspenso na barra de topo
  cobre a mesma navegação.

## Fora de escopo

- As sub-abas *dentro* de Mesa da Sessão (Chat, Ficha, Atividade,
  Iniciativa) continuam como estão — estado local, sem URL própria.
- Nenhuma mudança de conteúdo/lógica dentro de cada painel de seção
  (`CampaignOverviewPanel`, `SessionTablePanel`, etc.) — só como se
  chega até eles.

## Arquitetura

### Rotas

`src/app/router/index.tsx` ganha rotas aninhadas onde hoje tem uma
única `<Route path="/campanhas/:campaignId" element={<CampaignAreaPage />} />`:

```
/campanhas/:campaignId                    → redireciona pra .../visao-geral
/campanhas/:campaignId/visao-geral
/campanhas/:campaignId/mesa-sessao
/campanhas/:campaignId/membros
/campanhas/:campaignId/sessoes
/campanhas/:campaignId/notas
/campanhas/:campaignId/configuracoes
```

`CampaignAreaPage.tsx` é renomeado pra `CampaignAreaLayout.tsx` e passa
a ser uma rota-casca: busca a campanha (como já faz hoje), renderiza o
cabeçalho (capa/nome/badges) e um `<Outlet />` no lugar onde hoje ficam
os painéis condicionais. Cada seção vira uma rota-filha cujo elemento é
o painel já existente (`CampaignOverviewPanel`, `SessionTablePanel`,
`CampaignMembersPanel`, `CampaignSessionsPanel`, `CampaignNotesPanel`,
`CampaignSettingsPanel`) — nenhum desses painéis muda por dentro.

### Contexto: `CurrentCampaignContext`

A barra lateral (em `PrivateLayout.tsx`) e o conteúdo roteado
(`CampaignAreaLayout` via `<Outlet />`) são **irmãos** na árvore — a
barra lateral não é descendente do Outlet, então não dá pra "ler" a
campanha de um contexto criado dentro de `CampaignAreaLayout`. O
provider precisa envolver os dois.

Novo arquivo `src/features/campaigns/CurrentCampaignContext.tsx`:

```ts
interface CurrentCampaignValue {
  campaign: CampaignWithRole | null
  setCampaign: (c: CampaignWithRole | null) => void
  chatUnread: number
  privateUnread: number
  setChatUnread: (n: number) => void
  setPrivateUnread: (n: number) => void
}
```

- `PrivateLayout.tsx` envolve `<aside>` + `<main>` (sidebar e Outlet)
  num `<CurrentCampaignProvider>` — mesmo nível de `ActiveChatProvider`/
  `DiceRollerProvider` que já existem ali.
- `CampaignAreaLayout` consome o setter: busca a campanha (efeito que
  já existe hoje) e chama `setCampaign(data)`; limpa com
  `setCampaign(null)` ao desmontar (saiu da campanha → submenu fecha
  sozinho). As duas rotinas de polling de badge (`chatUnread` a cada
  60s quando fora da Mesa da Sessão, `privateUnread` a cada 60s) saem
  de `CampaignAreaPage` e continuam existindo, só que escrevendo no
  contexto em vez de `useState` local.
- Sidebar e o dropdown mobile só *leem* do contexto — nunca escrevem.

### Barra lateral (`PrivateLayout.tsx` + CSS)

O link "Campanhas" continua sendo o mesmo `NavLink to="/campanhas"` de
hoje — clicar nele sempre leva pra lista, fechando a campanha atual
como efeito natural de sair da rota `/campanhas/:campaignId/*`. A
expansão do submenu é automática pela rota, não por clique/toggle.

Abaixo dele, quando `campaign != null`, um bloco de 6 itens (`NavLink`
pra cada rota de seção), recuado com uma linha-guia à esquerda, texto
menor que os itens de topo. O item cuja rota bate com a atual ganha a
mesma borda + glow dourado que já existe em `.campaign-tab--highlight`
(reaproveita os tokens `--gilded-bright`/`--shadow-glow`, não recria).
Os badges de não-lida (chat/privada) que hoje ficam na aba "Mesa da
Sessão" migram pro item "Mesa da Sessão" desse submenu.

O rótulo da seção de ficha usa `campaign.role` do contexto pra decidir
"Ficha" vs "Fichas", igual à lógica que já existe em
`SessionTablePanel.tsx`.

### Barra de topo mobile

Abaixo de 768px, quando `campaign != null`, a `<header className="topbar">`
ganha: o nome da campanha (truncado se precisar) e um botão que abre um
menu suspenso (mesma lista de 6 seções, mesmo destino de rota). Fora de
uma campanha, a topbar fica como está hoje.

### `CampaignOverviewPanel` → atalhos pra Mesa da Sessão/Ficha

Hoje `onNavigate('mesa-sessao', 'ficha')` seta duas peças de estado
local em `CampaignAreaPage`. Com rotas de verdade, isso vira
`navigate('/campanhas/:id/mesa-sessao', { state: { initialSessionSubTab: 'ficha' } })`.
`SessionTablePanel` lê `useLocation().state?.initialSessionSubTab` no
mount pra decidir a sub-aba inicial (senão cai no padrão `'chat'` de
hoje) — só isso muda ali, o resto do componente continua igual.

### O que é removido

- O array `TABS` e a `<nav className="campaign-tabs">` horizontal
  dentro de `CampaignAreaPage`/`CampaignAreaLayout`.
- `handleTabClick`/`activeTab` (viram desnecessários — a rota já diz
  qual seção está ativa).

As classes CSS `.campaign-tab`/`.campaign-tabs`/`.campaign-tab--highlight`
**não** são apagadas — continuam em uso por `SessionTablePanel.css`
(sub-abas internas de Chat/Ficha/Atividade/Iniciativa) e por
`.session-table__subtabs`.

## Tratamento de erro

Sem mudança de comportamento: se a campanha não existe ou o usuário não
tem acesso, `CampaignAreaLayout` mostra a mesma mensagem de erro que
`CampaignAreaPage` mostra hoje, só que agora dentro do `<Outlet />` da
rota-casca. Nesse caso `setCampaign` nunca é chamado com dado válido, o
contexto fica `null`, e a barra lateral simplesmente não mostra submenu
— sem crash, sem estado inconsistente.

## Testes

Sem suite de testes automatizados neste projeto — validação via
`npm run verify` (contrato de migrations + `tsc` + `vite build`).
Verificação interativa (clicar pelas seções, atualizar a página numa
seção específica, abrir o menu suspenso no celular) precisa de sessão
autenticada — vou pedir pra você conferir na aplicação real depois de
implementado, já que não consigo logar sozinho neste ambiente.
