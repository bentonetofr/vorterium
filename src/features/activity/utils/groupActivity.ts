// ────────────────────────────────────────────────────────
// Junta o que se repete num bloco só. Dez "Rolagem registrada" uma atrás
// da outra, da mesma pessoa na mesma campanha, viram uma linha ("10
// rolagens seguidas") que abre pra mostrar cada uma. Vale também pra
// triunfos usados e ficha atualizada. O resto continua aparecendo sozinho.
// ────────────────────────────────────────────────────────

export interface GroupableActivity {
  id:          string
  campaign_id: string
  actor_id:    string | null
  type:        string
  created_at:  string
}

export type ActivityEntry<T> =
  | { kind: 'single'; item: T }
  | { kind: 'group'; key: string; items: T[] }

/** Tipos que se juntam quando vêm em sequência (cada tipo só com ele mesmo). */
const GROUPED_TYPES = new Set(['dice_rolled', 'triumph_used', 'sheet_updated'])

/** Título do bloco: "8 rolagens seguidas". */
export function groupTitle(type: string, count: number): string {
  if (type === 'triumph_used') return `${count} triunfos usados em sequência`
  if (type === 'sheet_updated') return `Ficha atualizada ${count} vezes`
  return `${count} rolagens seguidas`
}
/** Rolagens com mais do que isto de distância são de momentos diferentes. */
const MAX_GAP_MS = 20 * 60 * 1000
/** A partir de quantas seguidas vale a pena juntar. */
const MIN_GROUP = 3

function sameRun<T extends GroupableActivity>(a: T, b: T): boolean {
  return GROUPED_TYPES.has(a.type)
    && a.type === b.type
    && a.campaign_id === b.campaign_id
    && a.actor_id === b.actor_id
    && Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) <= MAX_GAP_MS
}

/** Recebe a lista na ordem em que aparece (mais nova primeiro) e devolve na mesma ordem. */
export function groupActivity<T extends GroupableActivity>(items: T[]): ActivityEntry<T>[] {
  const out: ActivityEntry<T>[] = []
  let run: T[] = []

  const flush = () => {
    if (run.length >= MIN_GROUP) out.push({ kind: 'group', key: `g:${run[0].id}`, items: run })
    else for (const item of run) out.push({ kind: 'single', item })
    run = []
  }

  for (const item of items) {
    if (run.length > 0 && !sameRun(run[run.length - 1], item)) flush()
    if (GROUPED_TYPES.has(item.type)) run.push(item)
    else { flush(); out.push({ kind: 'single', item }) }
  }
  flush()
  return out
}
