import { useSyncExternalStore } from 'react'
import type { CampaignWithRole } from '../../../shared/types'

// ────────────────────────────────────────────────────────
// Telinha do Vortable (picture-in-picture): quando o jogador sai do Vortable
// pelo botão, uma janelinha continua mostrando a sessão enquanto ele anda
// pelo site. Aqui só fica "qual campanha" (null = fechada); o resto vive no
// componente VortablePip, montado no layout do site.
// ────────────────────────────────────────────────────────

let current: CampaignWithRole | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

export function openPip(campaign: CampaignWithRole) {
  current = campaign
  emit()
}

export function closePip() {
  if (!current) return
  current = null
  emit()
}

/** A campanha da telinha aberta (null = nenhuma). */
export function usePip(): CampaignWithRole | null {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => { listeners.delete(fn) } },
    () => current,
  )
}
