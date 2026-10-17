import { useSyncExternalStore } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import { APP_VERSION } from '../../../shared/constants/changelog'
import { fillText, vtDef, type VtCode, type VtErrorDef, type VtSeverity } from './catalog'

// ────────────────────────────────────────────────────────
// Central de erros do Vortable. Tudo que dá errado passa por `vtError(código)`:
//   1. aparece no pop-up de quem teve o erro (VtErrorPopups);
//   2. entra numa fila no navegador (sobrevive a ficar sem internet e a recarregar)
//      e vai em lotes pra tabela vortable_errors, onde o mestre da campanha e o
//      desenvolvedor veem a lista.
// Erros passageiros (ex.: "reconectando") têm uma `key`: o pop-up some sozinho
// quando `vtResolve(key)` é chamado (a conexão voltou).
// ────────────────────────────────────────────────────────

export type VtRole = 'master' | 'player' | 'spectator'

interface VtContext {
  campaignId: string | null
  userId: string | null
  role: VtRole | null
  /** Dados do momento que vão junto com cada erro (estado da conexão, quantos online, zona...). */
  extra: (() => Record<string, unknown>) | null
}

export interface VtIssue {
  id: number
  code: string
  def: VtErrorDef
  title: string
  what: string
  fix: string
  at: number
  /** Quantas vezes repetiu enquanto o pop-up estava na tela. */
  repeat: number
  key?: string
  /** Mestre: o erro é de outro jogador (vindo da lista ao vivo). */
  from?: string
}

export interface VtErrorOptions {
  /** Valores pros {campos} do texto (quem, zona, ms...). */
  vars?: Record<string, string | number | undefined>
  /** Detalhe técnico (mensagem do navegador/servidor), vai pro registro. */
  detail?: string
  /** Erro passageiro: um só pop-up por key, fecha com vtResolve(key). */
  key?: string
  /** Dados extras pro registro. */
  data?: Record<string, unknown>
  /** Campanha (quando não é a do contexto). */
  campaignId?: string | null
  popup?: boolean
  record?: boolean
}

const ctx: VtContext = { campaignId: null, userId: null, role: null, extra: null }

export function setVtContext(patch: Partial<VtContext>) {
  Object.assign(ctx, patch)
}

// ── Pop-ups ─────────────────────────────────────────────

let seq = 0
let issues: VtIssue[] = []
const listeners = new Set<() => void>()
const timers = new Map<number, number>()

function emit() {
  for (const fn of listeners) fn()
}

/** Quanto tempo o pop-up fica na tela (grave fica até fechar). */
const POPUP_MS: Record<VtSeverity, number> = { info: 5_000, aviso: 12_000, erro: 20_000, grave: 0 }
/** Passageiro (com key) que nunca foi resolvido: some depois disso. */
const TRANSIENT_MAX_MS = 120_000
/** O mesmo erro de novo dentro disso conta como repetição (não abre outro pop-up). */
const SAME_MS = 20_000

function schedule(issue: VtIssue) {
  window.clearTimeout(timers.get(issue.id))
  const ms = issue.key ? TRANSIENT_MAX_MS : POPUP_MS[issue.def.severity]
  if (!ms) return
  timers.set(issue.id, window.setTimeout(() => vtDismiss(issue.id), ms))
}

function pushIssue(code: string, def: VtErrorDef, opts: VtErrorOptions, from?: string, whatText?: string) {
  const what = whatText ?? fillText(def.what, opts.vars)
  const fix = fillText(def.fix, opts.vars)
  const now = Date.now()
  const same = issues.find((i) => (opts.key && i.key === opts.key) || (!opts.key && i.code === code && i.what === what && i.from === from && now - i.at < SAME_MS))
  if (same) {
    const next: VtIssue = { ...same, code, def, title: def.title, what, fix, at: now, repeat: same.code === code ? same.repeat + 1 : 1 }
    issues = issues.map((i) => (i === same ? next : i))
    schedule(next)
  } else {
    const issue: VtIssue = { id: ++seq, code, def, title: def.title, what, fix, at: now, repeat: 1, key: opts.key, from }
    // no máximo 4 na tela: os mais velhos (não graves) saem
    issues = [...issues, issue]
    while (issues.length > 4) {
      const old = issues.find((i) => i.def.severity !== 'grave') ?? issues[0]
      issues = issues.filter((i) => i !== old)
    }
    schedule(issue)
  }
  emit()
}

/** Registra um erro (pop-up + lista do mestre/desenvolvedor, conforme o catálogo). */
export function vtError(code: VtCode, opts: VtErrorOptions = {}) {
  const def = vtDef(code)
  const detail = (opts.detail ?? '').slice(0, 500)
  console.warn(`[VT] ${code} ${def.title}${detail ? ` — ${detail}` : ''}`)
  if (opts.popup ?? def.popup) pushIssue(code, def, opts)
  if (opts.record ?? def.record) enqueue(code, def, fillText(def.what, opts.vars), detail, opts)
}

/** Mestre: mostra o erro de um jogador (chegou pela lista ao vivo); não grava de novo. */
export function vtShowRemote(code: string, who: string, what?: string) {
  pushIssue(code, vtDef(code), { vars: { quem: who } }, who, what || undefined)
}

/** O problema passageiro passou (a conexão voltou): o pop-up dele some. */
export function vtResolve(key: string) {
  const found = issues.filter((i) => i.key === key)
  if (found.length === 0) return
  for (const i of found) window.clearTimeout(timers.get(i.id))
  issues = issues.filter((i) => i.key !== key)
  emit()
}

export function vtDismiss(id: number) {
  window.clearTimeout(timers.get(id))
  timers.delete(id)
  const next = issues.filter((i) => i.id !== id)
  if (next.length === issues.length) return
  issues = next
  emit()
}

export function useVtIssues(): VtIssue[] {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => { listeners.delete(fn) } },
    () => issues,
  )
}

// ── Registro (fila no navegador → tabela vortable_errors) ─

export interface VtErrorRow {
  campaign_id: string
  user_id: string
  role: VtRole
  code: string
  severity: VtSeverity
  detail: string
  context: Record<string, unknown>
  count: number
  occurred_at: string
}

const QUEUE_KEY = 'vt:error-queue'
const QUEUE_MAX = 200
/** O mesmo erro dentro disso vira "count + 1" na mesma linha. */
const GROUP_MS = 60_000
const FLUSH_DELAY_MS = 3_000
const BATCH = 25

function readQueue(): VtErrorRow[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    const list = raw ? (JSON.parse(raw) as VtErrorRow[]) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeQueue(list: VtErrorRow[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(list.slice(-QUEUE_MAX))) } catch { /* sem storage: fica só na memória */ }
  memoryQueue = list.slice(-QUEUE_MAX)
}

let memoryQueue: VtErrorRow[] = readQueue()

function shortAgent(): string {
  const ua = navigator.userAgent
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Outro'
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '?'
  return `${browser} · ${os}`
}

function enqueue(code: string, def: VtErrorDef, what: string, detail: string, opts: VtErrorOptions) {
  const campaignId = opts.campaignId ?? ctx.campaignId
  if (!campaignId || !ctx.userId) return
  let extra: Record<string, unknown> = {}
  try { extra = ctx.extra?.() ?? {} } catch { /* contexto é extra */ }
  const context: Record<string, unknown> = {
    texto: what,
    navegador: shortAgent(),
    versao: APP_VERSION,
    pagina: location.pathname.slice(0, 120),
    online: navigator.onLine,
    ...extra,
    ...(opts.data ?? {}),
  }
  let json = JSON.stringify(context)
  if (json.length > 3500) { json = json.slice(0, 3500); context.cortado = true }
  const now = Date.now()
  const list = memoryQueue.length ? memoryQueue : readQueue()
  const last = [...list].reverse().find((r) => r.code === code && r.campaign_id === campaignId && r.detail === detail)
  if (last && now - Date.parse(last.occurred_at) < GROUP_MS) {
    last.count = Math.min(10_000, last.count + 1)
    writeQueue(list)
  } else {
    writeQueue([...list, {
      campaign_id: campaignId, user_id: ctx.userId, role: ctx.role ?? 'player', code, severity: def.severity,
      detail, context: JSON.parse(JSON.stringify(context)) as Record<string, unknown>, count: 1, occurred_at: new Date(now).toISOString(),
    }])
  }
  scheduleFlush(FLUSH_DELAY_MS)
}

let flushTimer = 0
let flushing = false
let backoff = FLUSH_DELAY_MS
/** A tabela ainda não existe (migration não aplicada): para de tentar nesta página. */
let tableMissing = false

function scheduleFlush(ms: number) {
  if (tableMissing) return
  window.clearTimeout(flushTimer)
  flushTimer = window.setTimeout(() => { void flushVtErrors() }, ms)
}

/** Manda o que está na fila (em lotes). Chamado sozinho; exportado pra testes. */
export async function flushVtErrors(): Promise<void> {
  if (flushing || tableMissing) return
  if (!navigator.onLine) return
  flushing = true
  try {
    for (;;) {
      const list = readQueue()
      const batch = list.slice(0, BATCH)
      if (batch.length === 0) { backoff = FLUSH_DELAY_MS; return }
      const { error } = await supabase.from('vortable_errors').insert(batch)
      if (error) {
        const code = (error as { code?: string }).code ?? ''
        if (code === '42P01' || code === 'PGRST205' || /does not exist|schema cache/i.test(error.message)) {
          tableMissing = true
          console.warn('[VT] tabela vortable_errors não existe ainda (migration 20240202000000 não aplicada): os erros ficam guardados no navegador.')
          return
        }
        if (code === '42501' || code === '23503' || code === '23514' || code === '22P02') {
          // não é mais membro da campanha / campanha apagada / linha inválida: essas linhas não vão nunca
          writeQueue(list.slice(batch.length))
          continue
        }
        // rede ou servidor: tenta de novo mais tarde
        backoff = Math.min(backoff * 2, 120_000)
        scheduleFlush(backoff)
        return
      }
      const fresh = readQueue()
      // tira só o que foi mandado (pode ter chegado coisa nova no meio)
      writeQueue(fresh.filter((r) => !batch.some((b) => b.occurred_at === r.occurred_at && b.code === r.code && b.campaign_id === r.campaign_id && b.detail === r.detail)))
    }
  } finally {
    flushing = false
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => scheduleFlush(1_000))
  // o que ficou de uma visita anterior (sem internet, fechou a aba) vai agora
  if (memoryQueue.length) scheduleFlush(5_000)
}
