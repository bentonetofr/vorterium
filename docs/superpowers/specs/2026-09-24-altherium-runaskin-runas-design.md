# Ficha Altherium — Triunfos do Runaskin (trilhas e runas)

Data: 2026-09-24 · Status: aprovado pelo autor

Completa a aba **Triunfos** (Berserker e Pilar já existem — ver
`2026-09-24-altherium-triunfos-design.md`) com o Runaskin.

## Regras (confirmadas com o autor)

- Três **trilhas**: Regente (suporte curativo, natureza), Sentinela (suporte
  defensivo, mortos), Carniceiro (suporte ofensivo, sangue). Cada uma tem
  **3 triunfos iniciais** (todos custam 1 PR) e uma condição de uso
  (Regente: runas à mostra e sem armadura; Sentinela: corpo morto recente
  por perto; Carniceiro: sangue recente — 1d4 de dano em si — ou ao redor).
- Novos triunfos vêm de **runas descobertas** explorando Altherium. Criadas
  na ficha pelo **jogador ou pelo mestre**, como cards: foto, nome, pontos
  (custo em PR), teste, descrição.
- **Uso das Runas (NR)** — quantos triunfos por cena:
  `⌈15% do PR máximo⌉ × 2^(nível − 1)` (arredondado pra cima no nível 1,
  dobrando a cada nível). Recuperar PR exige descanso.

## Dados

Migration `20240145000000_altherium_runaskin_runes.sql`:

- `altherium_character_sheets.runaskin_trail` (`regente|sentinela|carniceiro`,
  nulo) e `runaskin_scene_uses` (inteiro ≥ 0) — salvos com "Salvar ficha".
- Tabela `altherium_runaskin_runes` (sheet_id, name 1–80, description ≤1000,
  pr_cost 0–99, test ≤80, image_url) com RLS dono-ou-mestre (mesmo padrão de
  domínios/inventário). Salva na hora, fora do "Salvar ficha".
- Bucket público `altherium-runes`, caminho `<sheet_id>/<rune_id>`, 4
  policies dono-ou-mestre (mesmo padrão de `altherium-portraits`).

Os 9 triunfos iniciais e as trilhas são constantes em
`constants/altheriumTriumphs.ts`.

## UI — aba Triunfos (Runaskin)

- Barra de PR no topo (mesmo widget da Visão Geral).
- Select de **Trilha** + **Usos na cena: N / NR** com botão **Nova cena**
  (zera o contador). Lembrete da condição da trilha.
- **Triunfos da trilha** — 3 cards com a runa da trilha no lugar de foto
  (ᛒ verde Regente, ᛉ azul Sentinela, ᚦ vermelho Carniceiro), nome, custo,
  teste, descrição, chips de ação/alcance e **Usar**.
- **Runas descobertas** — cards com foto (ou ᚱ dourado sem foto), **Usar**,
  **Editar** (editor inline no lugar do card) e **Excluir** (com
  confirmação). **+ Nova runa** abre o editor: foto (JPG/PNG/WebP, 2 MB),
  nome, PR, teste, descrição. O editor não é um `<form>` (está dentro do form
  da ficha) e barra Enter nos campos de uma linha.
- **Usar**: desconta o custo do PR e soma 1 uso na cena; desabilitado sem PR
  suficiente ou com o NR atingido. Persiste com "Salvar ficha".
