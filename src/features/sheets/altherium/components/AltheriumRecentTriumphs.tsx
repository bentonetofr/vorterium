import type { ReactNode } from 'react'

// ────────────────────────────────────────────────────────
// "Recentes" — faixa no topo dos triunfos com os últimos usados (mais
// recente primeiro), pra achar rápido o que a pessoa mais usa sem perder
// a lista completa logo abaixo. Usada pelas três raízes.
// ────────────────────────────────────────────────────────

/** Quantos triunfos ficam em "Recentes". */
export const RECENT_TRIUMPHS_MAX = 4

/** Põe o id no topo da lista de recentes (sem repetir). */
export function pushRecent(list: string[], id: string): string[] {
  return [id, ...list.filter((x) => x !== id)].slice(0, RECENT_TRIUMPHS_MAX)
}

export function AltheriumRecentTriumphs({ children, count }: { children: ReactNode; count: number }) {
  if (count === 0) return null
  return (
    <div className="alth-recent">
      <div className="alth-recent__head">
        <span className="alth-recent__icon" aria-hidden="true">↺</span>
        <h5 className="alth-recent__title">Recentes</h5>
        <span className="alth-recent__hint">os últimos que você usou</span>
      </div>
      <div className="alth-triumphs__grid">{children}</div>
    </div>
  )
}
