import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../../../shared/lib/supabase'

// ────────────────────────────────────────────────────────
// O estado de sessão da campanha: aberta ou fechada, e por quê. Quem decide é o banco (migration 20240233): a sessão está aberta
// no horário marcado de uma sessão planejada ('scheduled') ou quando o mestre e pelo menos um jogador estão online juntos ('together').
// Aqui só se lê esse estado, guardado por campanha e dividido entre quem mostra (o selo no cabeçalho, o aviso da coleção).
// ────────────────────────────────────────────────────────

export type SessionReason = 'scheduled' | 'together'

export interface LiveSession {
  open: boolean
  reason: SessionReason | null
  /** Quando abre a próxima sessão marcada (ISO), se houver. */
  nextAt: string | null
  /** Já conferiu com o banco? (antes disso a tela não mostra nada) */
  known: boolean
}

export const UNKNOWN_SESSION: LiveSession = { open: false, reason: null, nextAt: null, known: false }

const states = new Map<string, LiveSession>()
const listeners = new Set<() => void>()
const inflight = new Map<string, Promise<void>>()

export function parseLiveSession(raw: unknown): LiveSession {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const reason = r.reason === 'scheduled' || r.reason === 'together' ? r.reason : null
  return { open: r.open === true && reason !== null, reason, nextAt: typeof r.next_at === 'string' ? r.next_at : null, known: true }
}

function publish(campaignId: string, next: LiveSession) {
  const prev = states.get(campaignId)
  if (prev && prev.open === next.open && prev.reason === next.reason && prev.nextAt === next.nextAt && prev.known) return
  states.set(campaignId, next)
  listeners.forEach((l) => l())
}

/** Pergunta ao banco como está a sessão desta campanha. Sem a migration ou sem rede, fica como "fechada" (nada conta sem confirmação). */
export function refreshLiveSession(campaignId: string): Promise<void> {
  const running = inflight.get(campaignId)
  if (running) return running
  const job = (async () => {
    try {
      const { data, error } = await supabase.rpc('campaign_session_status', { campaign_id_input: campaignId })
      publish(campaignId, error ? { ...UNKNOWN_SESSION, known: true } : parseLiveSession(data))
    } catch {
      publish(campaignId, { ...UNKNOWN_SESSION, known: true })
    } finally {
      inflight.delete(campaignId)
    }
  })()
  inflight.set(campaignId, job)
  return job
}

/** O estado da sessão da campanha, atualizado sempre que alguém chama refreshLiveSession (a tela da campanha faz isso a cada batida de presença). */
export function useLiveSession(campaignId: string | null | undefined): LiveSession {
  useEffect(() => {
    if (campaignId && !states.has(campaignId)) void refreshLiveSession(campaignId)
  }, [campaignId])
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l) } },
    () => (campaignId ? states.get(campaignId) ?? UNKNOWN_SESSION : UNKNOWN_SESSION),
  )
}

/** Só pros testes. */
export function resetLiveSessions(): void {
  states.clear()
  inflight.clear()
}

/** Define o estado de uma campanha à mão (páginas de teste). */
export function setLiveSession(campaignId: string, raw: unknown): void {
  publish(campaignId, parseLiveSession(raw))
}
