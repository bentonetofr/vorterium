import { useEffect, useState } from 'react'

// ────────────────────────────────────────────────────────
// O catálogo de magias do SRD (319 magias, cerca de 400 KB) é carregado sob
// demanda, só quando a ficha abre a aba Magias, para não pesar no pacote
// principal. Depois de carregado, fica em memória para as outras fichas.
// ────────────────────────────────────────────────────────

export type SpellCatalogModule = typeof import('../catalog/spells')

let loaded: SpellCatalogModule | null = null
let loading: Promise<SpellCatalogModule> | null = null

/** Entrega o catálogo já carregado (usado pelos testes, que renderizam sem efeitos). */
export function primeSpellCatalog(mod: SpellCatalogModule): void {
  loaded = mod
}

export function loadSpellCatalog(): Promise<SpellCatalogModule> {
  if (loaded) return Promise.resolve(loaded)
  loading ??= import('../catalog/spells').then((m) => { loaded = m; return m })
  return loading
}

/** O catálogo de magias, ou null enquanto carrega (ou se o carregamento falhar). */
export function useSpellCatalog(): SpellCatalogModule | null {
  const [mod, setMod] = useState<SpellCatalogModule | null>(loaded)
  useEffect(() => {
    if (loaded) { setMod(loaded); return }
    let cancelled = false
    loadSpellCatalog().then((m) => { if (!cancelled) setMod(m) }).catch(() => { loading = null })
    return () => { cancelled = true }
  }, [])
  return mod
}
