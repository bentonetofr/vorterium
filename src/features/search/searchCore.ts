// ────────────────────────────────────────────────────────
// Miolo da busca geral (Ctrl+K): o que é um resultado e como a consulta
// casa com ele. Sem React e sem banco, pra poder ser testado sozinho.
// ────────────────────────────────────────────────────────

export type SearchKind = 'page' | 'campaign' | 'section' | 'sheet' | 'episode' | 'note' | 'creature'

export interface SearchItem {
  /** Único na lista (tipo + id). */
  key:       string
  kind:      SearchKind
  title:     string
  /** Linha de baixo: de onde é ("Altherium · Episódio"). */
  subtitle?: string
  /** Pra onde leva. */
  to:        string
  /** Palavras a mais que também acham o item (não aparecem). */
  keywords?: string
}

export const KIND_LABEL: Record<SearchKind, string> = {
  page:     'Página',
  campaign: 'Campanha',
  section:  'Seção',
  sheet:    'Ficha',
  episode:  'Episódio',
  note:     'Nota',
  creature: 'Criatura',
}

/** Ordem de desempate: o que a pessoa mais provavelmente quer vem antes. */
const KIND_RANK: Record<SearchKind, number> = {
  campaign: 0, sheet: 1, section: 2, page: 3, episode: 4, note: 5, creature: 6,
}

/** Minúsculas e sem acento: "Sessão" e "sessao" são a mesma busca. */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

/**
 * Nota de um item pra consulta (maior = melhor), ou -1 se não casa. Todas
 * as palavras da consulta têm que aparecer em algum lugar do item; título
 * que começa com a consulta vale mais que palavra no meio.
 */
export function scoreItem(item: SearchItem, query: string): number {
  const q = normalize(query)
  if (!q) return 0
  const title = normalize(item.title)
  const rest = normalize(`${item.subtitle ?? ''} ${item.keywords ?? ''}`)
  const words = q.split(/\s+/)

  let score = 0
  for (const word of words) {
    const inTitle = title.indexOf(word)
    if (inTitle === 0) score += 60
    else if (inTitle > 0 && /\s/.test(title[inTitle - 1])) score += 40
    else if (inTitle > 0) score += 22
    else if (rest.includes(word)) score += 8
    else return -1
  }
  if (title === q) score += 50
  else if (title.startsWith(q)) score += 25
  return score
}

/** Os melhores resultados pra consulta, já em ordem. Consulta vazia: nada. */
export function searchItems(items: SearchItem[], query: string, limit = 12): SearchItem[] {
  if (!normalize(query)) return []
  return items
    .map((item) => ({ item, score: scoreItem(item, query) }))
    .filter((r) => r.score >= 0)
    .sort((a, b) =>
      b.score - a.score
      || KIND_RANK[a.item.kind] - KIND_RANK[b.item.kind]
      || a.item.title.localeCompare(b.item.title, 'pt-BR'))
    .slice(0, limit)
    .map((r) => r.item)
}
