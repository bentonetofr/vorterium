// ────────────────────────────────────────────────────────
// Janelas flutuantes da mesa (o mestre abre fichas de jogadores, NPCs e adversários em janelinhas que arrastam, recolhem,
// minimizam e ficam lembradas). Este arquivo é só o estado: um redutor puro (testável) e uma "loja" pequena que a tela assina.
// A tela está em FloatingProvider.tsx e FloatingWindow.tsx.
// ────────────────────────────────────────────────────────

export interface WinState {
  id: string
  x: number
  y: number
  w: number
  h: number
  /** Ordem de empilhamento (1 = mais ao fundo). */
  z: number
  /** Minimizada: some da tela e fica só na barra de baixo (a ficha continua viva). */
  min: boolean
  /** Recolhida: só a barra do título (mostra a Vida e a Fadiga). */
  col: boolean
  /** Fixada: fica por cima das outras. */
  pin: boolean
  /** Muda quando a janela é reposicionada por um comando (organizar, caber na tela): a tela anima só nesses casos. */
  snap: number
}

export interface FloatingState {
  wins: WinState[]
}

export interface Viewport { vw: number; vh: number }

export type FloatingAction =
  | ({ type: 'open'; id: string; size?: { w: number; h: number } } & Viewport)
  | { type: 'focus'; id: string }
  | { type: 'close'; id: string }
  | { type: 'closeAll' }
  | { type: 'move'; id: string; x: number; y: number }
  | { type: 'resize'; id: string; w: number; h: number }
  | { type: 'min'; id: string; value: boolean }
  | { type: 'col'; id: string; value?: boolean }
  | { type: 'pin'; id: string }
  | ({ type: 'arrange'; mode: 'cascade' | 'tile' } & Viewport)
  | ({ type: 'fit' } & Viewport)
  | { type: 'load'; state: FloatingState }

/** Quantas janelas cabem abertas ao mesmo tempo. */
export const MAX_WINDOWS = 10
export const MIN_W = 300
export const MIN_H = 200
/** Altura da barra do título (a janela recolhida). */
export const BAR_H = 40
/** Espaço que o app ocupa em cima (cabeçalho) e embaixo (a barra de janelas). */
export const TOP_GAP = 60
export const BOTTOM_GAP = 56

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), Math.max(lo, hi))
const finite = (n: unknown, fallback: number) => (typeof n === 'number' && Number.isFinite(n) ? n : fallback)

/** Tamanho de uma janela nova: grande o bastante para uma ficha, sem passar da tela. */
export function defaultSize({ vw, vh }: Viewport): { w: number; h: number } {
  return {
    w: Math.round(clamp(vw * 0.62, 520, Math.min(900, vw - 24))),
    h: Math.round(clamp(vh * 0.78, 360, Math.min(760, vh - TOP_GAP - BOTTOM_GAP))),
  }
}

/** Mantém a janela dentro da tela: o título sempre alcançável e o tamanho dentro dos limites. */
export function fitWindow(win: WinState, { vw, vh }: Viewport): WinState {
  const w = Math.round(clamp(win.w, Math.min(MIN_W, vw - 8), Math.max(MIN_W, vw - 8)))
  const h = Math.round(clamp(win.h, Math.min(MIN_H, vh - TOP_GAP - BOTTOM_GAP), Math.max(MIN_H, vh - TOP_GAP - BOTTOM_GAP)))
  const x = Math.round(clamp(win.x, 4, vw - w - 4))
  const y = Math.round(clamp(win.y, TOP_GAP, vh - BOTTOM_GAP - BAR_H))
  return x === win.x && y === win.y && w === win.w && h === win.h ? win : { ...win, x, y, w, h }
}

/** Onde nasce a próxima janela: em cascata, para não cobrir a anterior por completo. */
export function cascadeSpot(index: number, size: { w: number; h: number }, { vw, vh }: Viewport): { x: number; y: number } {
  const step = index % 6
  return {
    x: Math.round(clamp((vw - size.w) / 2 - 70 + step * 36, 4, vw - size.w - 4)),
    y: Math.round(clamp(TOP_GAP + 8 + step * 32, TOP_GAP, vh - BOTTOM_GAP - BAR_H)),
  }
}

/** Reatribui a ordem de empilhamento como 1..n sem mudar quem está na frente. */
function ranked(wins: WinState[]): WinState[] {
  const order = [...wins].sort((a, b) => a.z - b.z).map((w) => w.id)
  return wins.map((w) => { const z = order.indexOf(w.id) + 1; return z === w.z ? w : { ...w, z } })
}

function patch(state: FloatingState, id: string, fn: (w: WinState) => WinState): FloatingState {
  let changed = false
  const wins = state.wins.map((w) => { if (w.id !== id) return w; const n = fn(w); if (n !== w) changed = true; return n })
  return changed ? { wins } : state
}

function toFront(state: FloatingState, id: string): FloatingState {
  const win = state.wins.find((w) => w.id === id)
  if (!win) return state
  const top = Math.max(0, ...state.wins.map((w) => w.z))
  if (win.z === top && state.wins.filter((w) => w.z === top).length === 1) return state
  return { wins: ranked(state.wins.map((w) => (w.id === id ? { ...w, z: top + 1 } : w))) }
}

export const EMPTY_STATE: FloatingState = { wins: [] }

export function floatingReducer(state: FloatingState, action: FloatingAction): FloatingState {
  switch (action.type) {
    case 'open': {
      const existing = state.wins.find((w) => w.id === action.id)
      if (existing) {
        // já aberta: traz para a frente (e desminimiza)
        const next = existing.min ? patch(state, action.id, (w) => ({ ...fitWindow(w, action), min: false, snap: w.snap + 1 })) : state
        return toFront(next, action.id)
      }
      let wins = state.wins
      if (wins.length >= MAX_WINDOWS) {
        // passou do limite: sai a mais antiga que não esteja fixada (as minimizadas primeiro)
        const victim = [...wins].sort((a, b) => Number(b.min) - Number(a.min) || a.z - b.z).find((w) => !w.pin) ?? wins[0]
        wins = wins.filter((w) => w.id !== victim.id)
      }
      const size = action.size ?? defaultSize(action)
      const spot = cascadeSpot(wins.filter((w) => !w.min).length, size, action)
      const top = Math.max(0, ...wins.map((w) => w.z))
      const win: WinState = { id: action.id, ...spot, ...size, z: top + 1, min: false, col: false, pin: false, snap: 0 }
      return { wins: ranked([...wins, win]) }
    }
    case 'focus':
      return toFront(state, action.id)
    case 'close': {
      if (!state.wins.some((w) => w.id === action.id)) return state
      return { wins: ranked(state.wins.filter((w) => w.id !== action.id)) }
    }
    case 'closeAll':
      return state.wins.length ? EMPTY_STATE : state
    case 'move':
      return patch(state, action.id, (w) => (w.x === Math.round(action.x) && w.y === Math.round(action.y) ? w : { ...w, x: Math.round(action.x), y: Math.round(action.y) }))
    case 'resize':
      return patch(state, action.id, (w) => {
        const nw = Math.round(clamp(action.w, MIN_W, 4000)), nh = Math.round(clamp(action.h, MIN_H, 4000))
        return w.w === nw && w.h === nh ? w : { ...w, w: nw, h: nh }
      })
    case 'min': {
      const next = patch(state, action.id, (w) => (w.min === action.value ? w : { ...w, min: action.value }))
      // minimizar leva o foco para a próxima janela de cima
      return action.value ? next : toFront(next, action.id)
    }
    case 'col':
      return patch(state, action.id, (w) => { const v = action.value ?? !w.col; return v === w.col ? w : { ...w, col: v } })
    case 'pin':
      return patch(state, action.id, (w) => ({ ...w, pin: !w.pin }))
    case 'arrange': {
      const open = state.wins.filter((w) => !w.min).sort((a, b) => a.z - b.z)
      if (!open.length) return state
      const place = new Map<string, { x: number; y: number; w: number; h: number }>()
      if (action.mode === 'cascade') {
        const size = defaultSize(action)
        open.forEach((w, i) => place.set(w.id, { ...cascadeSpot(i, size, action), ...size }))
      } else {
        const gap = 10
        const cols = open.length <= 1 ? 1 : open.length <= 4 ? 2 : 3
        const rows = Math.ceil(open.length / cols)
        const areaW = action.vw - gap * 2, areaH = action.vh - TOP_GAP - BOTTOM_GAP - gap
        const w = Math.floor((areaW - gap * (cols - 1)) / cols), h = Math.floor((areaH - gap * (rows - 1)) / rows)
        open.forEach((win, i) => place.set(win.id, { x: gap + (i % cols) * (w + gap), y: TOP_GAP + Math.floor(i / cols) * (h + gap), w, h }))
      }
      return { wins: state.wins.map((w) => { const p = place.get(w.id); return p ? { ...w, ...p, col: false, snap: w.snap + 1 } : w }) }
    }
    case 'fit': {
      let changed = false
      const wins = state.wins.map((w) => { const f = fitWindow(w, action); if (f !== w) { changed = true; return { ...f, snap: w.snap + 1 } } return w })
      return changed ? { wins } : state
    }
    case 'load':
      return action.state
  }
}

// ── salvar e abrir (localStorage) ──────────────────────────

/** Lê o que foi salvo (de qualquer jeito que tenha vindo do navegador). */
export function parseSaved(raw: unknown, vp: Viewport): FloatingState {
  const list = raw && typeof raw === 'object' && Array.isArray((raw as { wins?: unknown }).wins) ? (raw as { wins: unknown[] }).wins : []
  const seen = new Set<string>()
  const wins: WinState[] = []
  for (const item of list.slice(0, MAX_WINDOWS)) {
    const x = (item && typeof item === 'object' ? item : null) as Record<string, unknown> | null
    if (!x || typeof x.id !== 'string' || !x.id || x.id.length > 120 || seen.has(x.id)) continue
    seen.add(x.id)
    const size = defaultSize(vp)
    const win: WinState = {
      id: x.id, x: finite(x.x, 40), y: finite(x.y, TOP_GAP), w: finite(x.w, size.w), h: finite(x.h, size.h), z: finite(x.z, wins.length + 1),
      min: x.min === true, col: x.col === true, pin: x.pin === true, snap: 0,
    }
    wins.push(fitWindow(win, vp))
  }
  return { wins: ranked(wins) }
}

export function serialize(state: FloatingState): string {
  return JSON.stringify({ v: 1, wins: state.wins.map(({ snap: _snap, ...w }) => w) })
}

// ── a loja ─────────────────────────────────────────────────

export interface WinMeta { title: string; badge?: string }

/**
 * Uma loja por mesa: guarda o estado, avisa quem assina e salva sozinha. Fora do React de propósito: quem arrasta uma janela
 * mexe no elemento direto e só avisa a loja ao soltar, então uma ficha grande não redesenha a cada pixel.
 */
export class FloatingStore {
  private state: FloatingState = EMPTY_STATE
  private meta: Record<string, WinMeta> = {}
  private metaVersion = 0
  private listeners = new Set<() => void>()
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly storageKey: string | null, private readonly viewport: () => Viewport) {
    if (storageKey) {
      try {
        const raw = window.localStorage.getItem(storageKey)
        if (raw) this.state = parseSaved(JSON.parse(raw), viewport())
      } catch { /* sem armazenamento (janela privativa): segue sem lembrar */ }
    }
  }

  getState = (): FloatingState => this.state
  getMetaVersion = (): number => this.metaVersion
  getMeta = (id: string): WinMeta | undefined => this.meta[id]
  subscribe = (fn: () => void): (() => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }

  private emit() { this.listeners.forEach((l) => l()) }

  dispatch = (action: FloatingAction): void => {
    const next = floatingReducer(this.state, action)
    if (next === this.state) return
    this.state = next
    this.emit()
    this.scheduleSave()
  }

  private scheduleSave() {
    if (!this.storageKey) return
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      try { window.localStorage.setItem(this.storageKey!, serialize(this.state)) } catch { /* sem espaço ou bloqueado */ }
    }, 250)
  }

  setMeta = (id: string, meta: WinMeta): void => {
    const cur = this.meta[id]
    if (cur && cur.title === meta.title && cur.badge === meta.badge) return
    this.meta = { ...this.meta, [id]: meta }
    this.metaVersion++
    this.emit()
  }

  // atalhos que já sabem o tamanho da tela
  open = (id: string, size?: { w: number; h: number }) => this.dispatch({ type: 'open', id, size, ...this.viewport() })
  close = (id: string) => this.dispatch({ type: 'close', id })
  closeAll = () => this.dispatch({ type: 'closeAll' })
  focus = (id: string) => this.dispatch({ type: 'focus', id })
  arrange = (mode: 'cascade' | 'tile') => this.dispatch({ type: 'arrange', mode, ...this.viewport() })
  fit = () => this.dispatch({ type: 'fit', ...this.viewport() })
  isOpen = (id: string) => this.state.wins.some((w) => w.id === id)

  /** Guarda já (ao sair da tela), sem esperar o atraso. */
  flush = (): void => {
    if (!this.storageKey) return
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null }
    try { window.localStorage.setItem(this.storageKey, serialize(this.state)) } catch { /* ignora */ }
  }

  /** Ids abertos que começam com o prefixo (a ordem em que foram abertos não importa; é por id). */
  idsWithPrefix = (prefix: string): string[] => this.state.wins.filter((w) => w.id.startsWith(prefix)).map((w) => w.id).sort()
}
