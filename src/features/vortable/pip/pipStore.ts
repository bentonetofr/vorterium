import { useSyncExternalStore } from 'react'
import type { CampaignWithRole } from '../../../shared/types'
import type { MesaStage } from '../../mesa/mesaSession'

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

/**
 * Passagem da sessão do mestre entre a página do Vortable e a telinha (e de volta): a sessão ao
 * vivo continua a mesma, só muda quem a mantém. Enquanto a passagem vale (alguns segundos), quem
 * larga a sessão não avisa os jogadores que ela acabou, e quem pega começa do estado dela.
 */
let handoff: { campaignId: string; stage: MesaStage; until: number } | null = null
const HANDOFF_MS = 10_000

export function setHandoff(campaignId: string, stage: MesaStage) {
  handoff = { campaignId, stage, until: Date.now() + HANDOFF_MS }
}

/** O estado da sessão que está passando de mão (null = nenhuma passagem valendo). */
export function peekHandoff(campaignId: string): MesaStage | null {
  return handoff && handoff.campaignId === campaignId && Date.now() < handoff.until ? handoff.stage : null
}

export const getPip = () => current

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
