# Ficha Altherium em abas — Fase 1 (estrutura + conteúdo existente)

## Contexto

A ficha Altherium (`AltheriumSheetForm.tsx`) hoje é uma coluna vertical
única: cabeçalho → vitais adicionais → grade de atributos/anatomia →
domínios → crônicas. O usuário não gosta da rolagem vertical longa e
pediu para dividir em abas: **Visão Geral**, **Combate**, **Domínios**,
**Triunfos**.

O pedido completo (Combate com catálogo de armas/armaduras com
estatísticas do livro, e Triunfos com a mecânica completa por raiz —
trilhas do Runaskin, naipes do Pilar) foi decomposto em 3 fases, cada
uma com sua própria spec:

- **Fase 1 (esta spec)**: estrutura de abas + move o conteúdo que já
  existe pro lugar certo. Sem pesquisa nova no livro de regras.
- **Fase 2 (futura)**: catálogo de armas e armaduras com estatísticas,
  dentro da aba Combate.
- **Fase 3 (futura)**: sistema de Triunfos completo, com mecânica
  própria por raiz, dentro da aba Triunfos.

## Objetivo (Fase 1)

Reorganizar o conteúdo já existente da ficha em 4 abas, mantendo um
cabeçalho fixo acima delas. Nenhuma lógica de cálculo, nenhum campo,
nenhuma validação muda — só a organização visual.

## Mapeamento de conteúdo

**Sempre visível, acima das abas** (não muda de lugar):
- `alth-hero`: nome, raiz, gênesis, nível, hacksilvers, PV e PE
  (barras compactas) — informação que faz sentido ver em qualquer aba.
- Alerta de estado crítico (Vitalidade em 0) — já é condicional, continua
  aparecendo logo abaixo do cabeçalho não importa a aba ativa.

**Aba Visão Geral** (padrão, abre nela):
- Tabela de Atributos (`alth-card` "Atributos").
- Faixa de vitais adicionais — FV/PR/Cartas, o que a raiz usar
  (`alth-vitals-strip`, hoje já filtrado por `usesFv`/`usesPr`/`usesCards`).
- Crônicas (notas) — `alth-journal`.

**Aba Combate**:
- Anatomia & Armadura (`alth-card` "Anatomia & Armadura": diagrama do
  corpo + campos de DB por zona) — é o que já existe hoje ligado a
  defesa/combate.
- Um aviso discreto (mesmo estilo do "em breve" de Triunfos, texto
  diferente) avisando que o catálogo de armas chega numa próxima
  atualização — pra aba não parecer incompleta sem explicação.

**Aba Domínios**:
- A seção de Domínios inteira (busca, lista, pontos) — sem mudanças.

**Aba Triunfos**:
- Placeholder "em breve" simples: ícone, título, uma frase — visual
  próprio da paleta Altherium, não uma reaproveitação do
  `DndComingSoon` (esse é específico do sistema D&D, com imagem e
  piada hardcoded, não serve pra generalizar).

## Componentes e arquivos

- `AltheriumSheetForm.tsx`: ganha um `useState<AltheriumTabId>('visao-geral')`
  local (mesmo padrão de `SessionTablePanel.tsx` — sem URL, reseta
  sozinho quando o `key={sheet.id}` troca de ficha). O JSX que hoje
  renderiza tudo em sequência passa a renderizar a barra de abas seguida
  do conteúdo condicional por aba.
- Barra de abas reaproveita as classes `.campaign-tabs`/`.campaign-tab`
  já usadas em `SessionTablePanel.tsx` — mesmo visual, sem CSS novo pra
  isso.
- Novo pequeno componente `AltheriumComingSoon` (título + frase,
  reaproveitando os tokens de cor da própria ficha) pro placeholder de
  Triunfos e o aviso de Combate.
- Nenhuma mudança em `altheriumSheetService.ts`, tipos, ou migrations —
  Fase 1 é puramente de apresentação.

## Testes

`npm run verify` (tsc + build). Verificação visual: montar o formulário
com dados falsos numa página pública temporária (mesma técnica usada
nas últimas mudanças de UI desta sessão), navegar entre as 4 abas,
conferir que nada quebrou e que o cabeçalho continua visível em todas.
Teste interativo completo (dentro de uma campanha real, salvando dados)
fica por sua conta, já que não consigo logar nesse ambiente.
