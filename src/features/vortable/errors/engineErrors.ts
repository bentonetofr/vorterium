import type { VtCode } from './catalog'
import { VortableError } from './vtCodes'
import { vtError } from './vtErrors'

// ────────────────────────────────────────────────────────
// Erros do motor do Vortable. O motor (repositório cisco-mapa-maker) só
// escreve no console ("[vortable] boneco não carregou", ...); enquanto um palco
// do Vortable está montado, essas mensagens — e os erros soltos que vêm do
// código do Vortable — viram códigos do catálogo.
// ────────────────────────────────────────────────────────

/** Mensagem do motor → código (a primeira que bater vale). */
const ENGINE_MESSAGES: [RegExp, VtCode][] = [
  [/boneco de outro jogador não carregou/i, 'VT-MOTOR-004'],
  [/boneco não carregou/i, 'VT-MOTOR-003'],
  [/NPC não carregou/i, 'VT-MOTOR-005'],
  [/não deu pra ler o mundo/i, 'VT-MOTOR-009'],
  [/não deu pra guardar (o ponto|a mudança de zona) do NPC/i, 'VT-BANCO-010'],
  [/saída leva pra uma zona que não existe/i, 'VT-MOTOR-010'],
  [/(arte|som|camada do boneco|aparência) não carregou/i, 'VT-MOTOR-011'],
]

const text = (v: unknown): string => {
  if (v instanceof Error) return v.message
  if (typeof v === 'string') return v
  try { return JSON.stringify(v) } catch { return String(v) }
}

function fromConsole(args: unknown[]) {
  const first = args[0]
  if (typeof first !== 'string' || !/^\[vortable\]/i.test(first)) return
  const msg = first.replace(/^\[vortable\]\s*/i, '')
  const rest = args.slice(1).map(text).join(' ').slice(0, 300)
  const code = ENGINE_MESSAGES.find(([re]) => re.test(msg))?.[1] ?? 'VT-MOTOR-007'
  vtError(code, { vars: { detalhe: rest || msg }, detail: `${msg}${rest ? ` — ${rest}` : ''}` })
}

const fromVortable = (s: string | undefined) => !!s && /vortable/i.test(s)

function onWindowError(e: ErrorEvent) {
  const stack = e.error instanceof Error ? e.error.stack : undefined
  if (!fromVortable(e.filename) && !fromVortable(stack)) return
  vtError('VT-MOTOR-007', { vars: { detalhe: e.message.slice(0, 120) }, detail: `${e.message} @ ${(e.filename ?? '').split('/').pop()}:${e.lineno}` })
}

function onRejection(e: PromiseRejectionEvent) {
  const r = e.reason as unknown
  if (r instanceof VortableError) return // já foi registrado com o código certo
  const stack = r instanceof Error ? r.stack : undefined
  if (!fromVortable(stack)) return
  vtError('VT-MOTOR-007', { vars: { detalhe: text(r).slice(0, 120) }, detail: `promessa: ${text(r).slice(0, 300)}` })
}

let mounted = 0
let restore: (() => void) | null = null

/** Liga a captura enquanto o palco estiver montado (devolve como desligar). */
export function captureEngineErrors(): () => void {
  mounted++
  if (mounted === 1) {
    const origError = console.error
    const origWarn = console.warn
    console.error = (...args: unknown[]) => { origError.apply(console, args); try { fromConsole(args) } catch { /* nunca quebra o console */ } }
    console.warn = (...args: unknown[]) => { origWarn.apply(console, args); try { fromConsole(args) } catch { /* idem */ } }
    window.addEventListener('error', onWindowError)
    window.addEventListener('unhandledrejection', onRejection)
    restore = () => {
      console.error = origError
      console.warn = origWarn
      window.removeEventListener('error', onWindowError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }
  let done = false
  return () => {
    if (done) return
    done = true
    mounted--
    if (mounted === 0) { restore?.(); restore = null }
  }
}
