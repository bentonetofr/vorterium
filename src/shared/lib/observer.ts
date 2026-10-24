import { useSyncExternalStore } from 'react'

// ────────────────────────────────────────────────────────
// Modo observador: a conta de desenvolvedor entra em qualquer campanha com a
// visão do mestre, ao vivo, mas NÃO altera nada. O banco já só deixa o dev ler
// (policies "dev: le tudo"); aqui está a segunda trava, no próprio cliente:
// com o modo ligado, toda requisição que escreve (inserir, mudar, apagar,
// subir arquivo, chamar função que altera) é barrada antes de sair do
// navegador. Sem React além do hook: o pedaço que decide roda nos testes.
// ────────────────────────────────────────────────────────

let on = false
const listeners = new Set<() => void>()

export function isObserver(): boolean { return on }

export function setObserver(value: boolean): void {
  if (on === value) return
  on = value
  listeners.forEach((l) => l())
}

export function useObserver(): boolean {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l) } },
    () => on,
    () => false,
  )
}

/** /campanhas/:id e as seções dela: onde a conta dev entra como observadora (não vale /campanhas/nova nem o Vortable em tela cheia). */
export function isCampaignView(pathname: string): boolean {
  return /^\/campanhas\/(?!nova(\/|$))[^/]+(\/|$)/.test(pathname) && !/\/vortable\/?$/.test(pathname)
}

/** Funções do banco que só leem (as outras alteram algo e ficam barradas). */
const READ_ONLY_RPC = new Set([
  'is_developer', 'is_site_owner', 'my_feature_access',
  'dev_overview', 'dev_list_users',
  'get_private_message_unread_counts', 'get_campaign_invite_public',
  'dnd_check_reveal',
])

/** Pode sair do navegador no modo observador? Só leitura, o login e o status do feedback (a única escrita do painel dev). */
export function isAllowedRequest(method: string, rawUrl: string): boolean {
  const m = method.toUpperCase()
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return true
  let path: string
  try { path = new URL(rawUrl, 'http://localhost').pathname } catch { return false }
  if (path.startsWith('/auth/v1/')) return true // entrar, renovar a sessão, sair
  const rpc = path.match(/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/)
  if (rpc) return READ_ONLY_RPC.has(rpc[1])
  if (path === '/rest/v1/site_feedback' && m === 'PATCH') return true
  // link assinado de arquivo é POST, mas só lê
  if (path.startsWith('/storage/v1/object/sign/') || path.startsWith('/storage/v1/object/list/')) return true
  return false
}

// ── Aviso quando alguém tenta mexer ─────────────────────

let lastGesture = 0
let gestureWired = false
function wireGestures(): void {
  if (gestureWired || typeof window === 'undefined') return
  gestureWired = true
  const mark = () => { lastGesture = Date.now() }
  for (const ev of ['pointerdown', 'keydown', 'change', 'submit']) window.addEventListener(ev, mark, true)
}

let toastEl: HTMLElement | null = null
let toastTimer = 0
function showToast(): void {
  if (typeof document === 'undefined') return
  if (!toastEl) {
    toastEl = document.createElement('div')
    toastEl.setAttribute('role', 'status')
    toastEl.textContent = 'Modo observador: só leitura. Nada foi alterado.'
    Object.assign(toastEl.style, {
      position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)', zIndex: '3000',
      padding: '10px 18px', borderRadius: '10px', background: '#1b2238', color: '#ffe3b0',
      border: '1px solid rgba(255, 193, 116, 0.6)', boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
      font: '600 13px system-ui, sans-serif', pointerEvents: 'none',
    })
  }
  document.body.append(toastEl)
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => toastEl?.remove(), 2800)
}

/** O fetch do cliente do banco: no modo observador barra o que escreve com um 403 em vez de mandar. */
export function observerFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (on) {
    const req = typeof Request !== 'undefined' && input instanceof Request ? input : null
    const method = init?.method ?? req?.method ?? 'GET'
    const url = req ? req.url : String(input instanceof URL ? input.href : input)
    if (!isAllowedRequest(method, url)) {
      wireGestures()
      // só avisa quando a pessoa acabou de clicar ou digitar (o resto, como a batida de presença, é silencioso)
      if (Date.now() - lastGesture < 1500) showToast()
      const body = JSON.stringify({ code: 'OBSERVER_READ_ONLY', message: 'Modo observador: só leitura.', details: null, hint: null })
      return Promise.resolve(new Response(body, { status: 403, headers: { 'Content-Type': 'application/json' } }))
    }
  }
  return fetch(input, init)
}

if (typeof window !== 'undefined') wireGestures()
