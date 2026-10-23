import { useSyncExternalStore } from 'react'

// ────────────────────────────────────────────────────────
// Avisa quando a própria pessoa está com o painel de teste aberto, para a
// rolagem dos outros jogadores esperar (não abrir um painel em cima do outro).
// ────────────────────────────────────────────────────────

let busy = 0
const listeners = new Set<() => void>()

function emit() { listeners.forEach((l) => l()) }

/** Marca "estou rolando" até chamar a função devolvida. */
export function markRollBusy(): () => void {
  busy++
  emit()
  let released = false
  return () => { if (!released) { released = true; busy--; emit() } }
}

export function useRollBusy(): boolean {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l) } },
    () => busy > 0,
    () => false,
  )
}
