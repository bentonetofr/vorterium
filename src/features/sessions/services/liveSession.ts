import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../../../shared/lib/supabase'

// ────────────────────────────────────────────────────────
// O estado de sessão da campanha: aberta ou fechada, e por quê. Quem decide é o banco (migrations 20240233 e 20240234):
//  • a sessão só abre com o MESTRE ativo (online agora); jogador nenhum abre a sessão sozinho;
//  • com o mestre ativo ela abre quando o mestre abre pelo botão ('manual'), no horário marcado ('scheduled') ou quando pelo menos
//    a metade dos jogadores está online ('together');
//  • o mestre também pode encerrar (a sessão fica fechada por 6 horas, ou até ele abrir de novo).
// Aqui só se lê esse estado, guardado por campanha e dividido entre quem mostra (o selo no cabeçalho, o aviso da coleção).
// ────────────────────────────────────────────────────────

/** 'ending': esteve aberta há pouco e espera o mestre dizer se acabou (ainda conta como aberta). */
export type SessionReason = 'manual' | 'scheduled' | 'together' | 'ending'
/** Por que perguntar ao mestre se a sessão acabou: os jogadores saíram, ou chegou o horário de término marcado. */
export type SessionAsk = 'leaving' | 'schedule'
export type SessionOverride = 'open' | 'closed'
export type SessionAction = 'open' | 'close' | 'continue' | 'auto'

export interface LiveSession {
  open: boolean
  reason: SessionReason | null
  /** Quando abre a próxima sessão marcada (ISO), se houver. */
  nextAt: string | null
  /** O mestre abriu ou encerrou à mão, e ainda vale. */
  override: SessionOverride | null
  /** O banco quer perguntar ao mestre se a sessão acabou. */
  askEnd: SessionAsk | null
  masterOnline: boolean
  playersOnline: number
  playersTotal: number
  /** Já conferiu com o banco? (antes disso a tela não mostra nada) */
  known: boolean
  /** A consulta falhou (sem a migration ou sem rede): o estado não é confiável. */
  failed: boolean
  /** O que o banco respondeu quando falhou (pra explicar o que está faltando). */
  errorText: string
}

export const UNKNOWN_SESSION: LiveSession = { open: false, reason: null, nextAt: null, override: null, askEnd: null, masterOnline: false, playersOnline: 0, playersTotal: 0, known: false, failed: false, errorText: '' }

const states = new Map<string, LiveSession>()
const listeners = new Set<() => void>()
const inflight = new Map<string, Promise<void>>()

const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0)

export function parseLiveSession(raw: unknown): LiveSession {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const reason = r.reason === 'manual' || r.reason === 'scheduled' || r.reason === 'together' || r.reason === 'ending' ? r.reason : null
  return {
    open: r.open === true && reason !== null, reason,
    nextAt: typeof r.next_at === 'string' ? r.next_at : null,
    override: r.override === 'open' || r.override === 'closed' ? r.override : null,
    askEnd: r.ask_end === 'leaving' || r.ask_end === 'schedule' ? r.ask_end : null,
    masterOnline: r.master_online === true, playersOnline: count(r.players_online), playersTotal: count(r.players_total),
    known: true, failed: false, errorText: '',
  }
}

const same = (a: LiveSession, b: LiveSession) =>
  a.open === b.open && a.reason === b.reason && a.nextAt === b.nextAt && a.override === b.override && a.askEnd === b.askEnd && a.masterOnline === b.masterOnline
  && a.playersOnline === b.playersOnline && a.playersTotal === b.playersTotal && a.known === b.known && a.failed === b.failed && a.errorText === b.errorText

function publish(campaignId: string, next: LiveSession) {
  const prev = states.get(campaignId)
  if (prev && same(prev, next)) return
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
      publish(campaignId, error ? { ...UNKNOWN_SESSION, known: true, failed: true, errorText: String(error.message ?? error.code ?? '').slice(0, 200) } : parseLiveSession(data))
    } catch (err) {
      publish(campaignId, { ...UNKNOWN_SESSION, known: true, failed: true, errorText: err instanceof Error ? err.message.slice(0, 200) : 'sem resposta' })
    } finally {
      inflight.delete(campaignId)
    }
  })()
  inflight.set(campaignId, job)
  return job
}

/** O mestre abre ('open'), encerra ('close') ou devolve pro automático ('auto'). O banco recusa quem não é o mestre. */
export async function setCampaignSession(campaignId: string, action: SessionAction): Promise<void> {
  const { error } = await supabase.rpc('set_campaign_session', { campaign_id_input: campaignId, action })
  if (error) throw new Error('Não foi possível mudar a sessão. A migration 20240234 já rodou no Supabase?')
  await refreshLiveSession(campaignId)
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

/** O estado guardado de uma campanha (fora do React). */
export const getLiveSession = (campaignId: string): LiveSession => states.get(campaignId) ?? UNKNOWN_SESSION

/** Só pros testes. */
export function resetLiveSessions(): void {
  states.clear()
  inflight.clear()
}

/** Define o estado de uma campanha à mão (páginas de teste). */
export function setLiveSession(campaignId: string, raw: unknown): void {
  publish(campaignId, parseLiveSession(raw))
}

/**
 * Por que a sessão está fechada, em poucas palavras (vazio quando não há o que dizer). O jogador que esperava a sessão aberta vê
 * aqui o que falta: o mestre online, ou mais jogadores.
 */
export function closedReason(s: LiveSession): string {
  if (s.failed) return ''
  if (s.override === 'closed') return 'encerrada pelo mestre'
  if (!s.masterOnline) return 'aguardando o mestre'
  const missing = playersNeeded(s.playersTotal) - s.playersOnline
  if (s.playersTotal > 0 && missing > 0) return `faltam ${missing} ${missing === 1 ? 'jogador' : 'jogadores'} online`
  return ''
}

/** O texto da janela que pergunta ao mestre se a sessão acabou. */
export function endPromptCopy(kind: SessionAsk): { title: string; message: string; yes: string; no: string } {
  const why = kind === 'leaving'
    ? 'Os jogadores foram saindo e a mesa já não está reunida.'
    : 'Chegou o horário de término da sessão marcada.'
  return {
    title: 'A sessão acabou?',
    message: `${why} Se acabou, a sessão é encerrada e as rolagens deixam de contar pras conquistas. Se não, ela continua aberta e eu pergunto de novo daqui a 30 minutos.`,
    yes: 'Sim, encerrar a sessão',
    no: 'Não, vamos continuar',
  }
}

/**
 * Quantos jogadores precisam estar online pra mesa contar como reunida: a metade, arredondando pra cima (4 jogadores = 2; 3 = 2; 1 = 1).
 * É a mesma conta do banco (_campaign_session_reason); aqui serve pra explicar na tela quanto falta.
 */
export function playersNeeded(total: number): number {
  return total <= 0 ? 0 : Math.ceil(total / 2)
}
