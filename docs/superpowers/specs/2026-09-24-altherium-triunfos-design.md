# Ficha Altherium — Triunfos (Berserker e Pilar)

Data: 2026-09-24 · Status: aprovado pelo autor

Substitui o placeholder da aba **Triunfos** da ficha Altherium. Cada raiz tem
uma mecânica própria; nesta etapa entram **Berserker** e **Pilar**. Runaskin
(descoberta de runas) fica para depois — a aba mostra um aviso.

## Regras (confirmadas com o autor)

**Berserker** — escolhe triunfos de uma lista fixa (24). Cada um custa FV.
Limite de triunfos:

```
⌊ (2 + domínios com pelo menos 1 ponto) ÷ 2 ⌋
```

Ex.: 4 domínios com ponto → 3 triunfos. O limite é recalculado sempre que os
domínios mudam.

**Pilar** — tem **todos** os triunfos (26) disponíveis. Para usar, gasta um
número de cartas (custo do triunfo). O naipe não é fixo por triunfo — o
jogador escolhe na hora, na mesa; a ficha só desconta a quantidade.
Cartas especiais (lembrete na aba): Coringa vale qualquer carta; Ás do seu
naipe vale 2 cartas; Ás de espadas é sucesso instantâneo.

## Dados

- **Catálogo** — constantes em `constants/altheriumTriumphs.ts` (mesmo padrão
  de `altheriumItems.ts`, `RAIZES`, `DOMAINS`): `BERSERKER_TRIUMPHS` (nome,
  descrição, ação, custo em FV, alcance, teste) e `PILAR_TRIUMPHS` (nome,
  descrição, custo em cartas — todos são Ação Bônus). Texto transcrito do
  livro como está (inclusive "Cogumelo Berserkr" e "por 1d4 turno").
- **Escolhas do Berserker** — nova coluna na ficha, salva junto com
  "Salvar ficha" (como Raiz, FV etc.):

```sql
alter table public.altherium_character_sheets
  add column if not exists berserker_triumphs text[] not null default '{}';
```

Sem FK (o catálogo não é tabela). O limite é regra de UI, não constraint —
se o personagem perder domínios, a ficha avisa mas não remove nada.

## UI — aba Triunfos

**Berserker**
- Cabeçalho com contador `Triunfos: N / limite`.
- "Seus triunfos": cards com nome, descrição e chips (ação, custo FV,
  alcance, teste). Botões **Usar** (desconta o custo do FV; desabilitado se o
  FV atual não cobre) e **Remover**.
- "Disponíveis": o resto da lista com **Adicionar** (desabilitado no limite).
- Acima do limite: aviso "Você tem mais triunfos do que o limite atual".

**Pilar**
- Lembrete das cartas especiais.
- Todos os triunfos com custo em cartas e **Usar** (desconta de Cartas;
  desabilitado se não há cartas suficientes).

**Runaskin / sem raiz** — aviso (runas chegam depois / escolha uma raiz).

**Usar** altera o valor de FV/Cartas no formulário — o mesmo que digitar no
campo. Persiste com "Salvar ficha", como qualquer outra edição da ficha.

## Arquivos

- `supabase/migrations/20240144000000_altherium_berserker_triumphs.sql` (+
  `scripts/verify-migrations.mjs`).
- `shared/types` — `berserker_triumphs: string[]` em `AltheriumSheet`.
- `constants/altheriumTriumphs.ts` — catálogo.
- `utils/altheriumCalculations.ts` — `berserkerTriumphLimit(domains)`.
- `components/AltheriumTriumphsPanel.tsx` — a aba.
- `AltheriumSheetForm.tsx` — campo `berserker_triumphs` no form/payload,
  painel no lugar do placeholder.
- `AltheriumSheet.css` — estilos `.alth-triumph*`.
