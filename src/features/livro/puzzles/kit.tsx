import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { GameView, LivroView } from '../livroService'
import { makeCanvas, type Ctx } from '../game/art'
import { bitsCanvas, SYMBOL_BITS, GLYPH_BITS, type Sym } from './glyphs'

// ────────────────────────────────────────────────────────
// Peças comuns das janelas dos enigmas:
//   • PixelScene — uma cena desenhada em pixels nativos e ampliada sem
//     suavizar; o mouse chega já em coordenadas da cena.
//   • Dial — o seletor de 8 marcas (o "ângulo" de onde se olha).
//   • SymbolIcon / GlyphIcon — os símbolos e glifos em tamanho de botão.
// ────────────────────────────────────────────────────────

export type Act = (action: Record<string, unknown>) => Promise<void>

/**
 * O que só existe na tela de quem joga (mouse, símbolo escolhido, o que
 * está digitando): quem joga manda (`share`), quem assiste recebe (`remote`).
 */
export interface UiLink {
  share:  (state: Record<string, unknown>) => void
  remote: Record<string, unknown> | null
}

export interface PuzzleProps {
  g:    GameView
  act:  Act
  /** Só olhando (quem assiste, ou o mestre). */
  ro:   boolean
  view: LivroView
  ui?:  UiLink
}

/**
 * Pra cada janela: `put` junta um pedaço do estado e manda pra quem
 * assiste; `remote` é o estado de quem eu assisto (null se sou eu que jogo).
 */
export function useUiShare(ui: UiLink | undefined, ro: boolean) {
  const state = useRef<Record<string, unknown>>({})
  const put = (patch: Record<string, unknown>) => {
    if (ro || !ui) return
    state.current = { ...state.current, ...patch }
    ui.share(state.current)
  }
  return { put, remote: ro ? ui?.remote ?? null : null }
}

export interface Pt { x: number; y: number }

interface SceneProps {
  w: number
  h: number
  /** O mouse de outra pessoa (quem assiste vê a lupa e os destaques dela). */
  remoteMouse?: Pt | null
  /** Avisa onde está o meu mouse na cena (null = saiu). */
  onMouse?: (p: Pt | null) => void
  /** Altura máxima na tela (px CSS). */
  maxH?: number
  draw: (ctx: Ctx, t: number, mouse: Pt | null) => void
  onDown?: (p: Pt) => void
  onMove?: (p: Pt) => void
  onUp?: (p: Pt) => void
  /** Onde o cursor vira "mãozinha". */
  hot?: (p: Pt) => boolean
  label: string
}

export function PixelScene({ w, h, maxH = 420, draw, onDown, onMove, onUp, hot, label, remoteMouse, onMouse }: SceneProps) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const props = useRef({ draw, onDown, onMove, onUp, hot, remoteMouse, onMouse })
  props.current = { draw, onDown, onMove, onUp, hot, remoteMouse, onMouse }
  const [scale, setScale] = useState(3)
  const mouse = useRef<Pt | null>(null)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const fit = () => {
      const avail = el.clientWidth
      const hMax = Math.min(maxH, window.innerHeight * 0.64)
      setScale(Math.max(1, Math.floor(Math.min(avail / w, hMax / h))))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [w, h, maxH])

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const [native, nctx] = makeCanvas(w, h)
    const ctx = c.getContext('2d')!
    let raf = 0
    const loop = (t: number) => {
      nctx.clearRect(0, 0, w, h)
      const m = props.current.remoteMouse !== undefined ? props.current.remoteMouse : mouse.current
      props.current.draw(nctx, t / 1000, m)
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, c.width, c.height)
      ctx.drawImage(native, 0, 0, c.width, c.height)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [w, h])

  const toPt = (e: React.PointerEvent): Pt => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * w, y: ((e.clientY - r.top) / r.height) * h }
  }

  return (
    <div ref={wrap} className="lb-scene">
      <canvas
        ref={canvas}
        width={w * scale}
        height={h * scale}
        className="lb-scene__canvas"
        aria-label={label}
        onPointerMove={(e) => {
          const p = toPt(e)
          mouse.current = p
          canvas.current!.style.cursor = props.current.hot?.(p) ? 'pointer' : 'default'
          props.current.onMove?.(p)
          props.current.onMouse?.({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 })
        }}
        onPointerLeave={() => { mouse.current = null; props.current.onMouse?.(null) }}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
          props.current.onDown?.(toPt(e))
        }}
        onPointerUp={(e) => props.current.onUp?.(toPt(e))}
      />
    </div>
  )
}

/** As 8 marcas, no sentido do relógio a partir do alto (marca 1 em cima). */
export function markXY(cx: number, cy: number, r: number, mark: number): [number, number] {
  const a = ((mark - 1) / 8) * Math.PI * 2 - Math.PI / 2
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
}

/** O seletor de marca: um mostrador com 8 entalhes, setas dos lados. */
export function Dial({ value, onChange, disabled, label, glow }: { value: number; onChange: (v: number) => void; disabled?: boolean; label: string; glow?: number | null }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const k = 3
    const S = 21
    c.width = S * k
    c.height = S * k
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, c.width, c.height)
    const px = (col: string, x: number, y: number, w = 1, h = 1) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x) * k, Math.round(y) * k, w * k, h * k) }
    // disco de bronze
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - 10, y - 10)
      if (d <= 9.6) px(d > 8.4 ? '#7a5a1e' : '#3a2c14', x, y)
    }
    for (let m = 1; m <= 8; m++) {
      const [x, y] = markXY(10, 10, 8, m)
      px(m === value ? '#ffe7a3' : m === glow ? '#ecc66a' : '#b8892f', x, y)
    }
    const [hx, hy] = markXY(10, 10, 5.5, value)
    for (let i = 0; i <= 5; i++) px('#ffe7a3', 10 + ((hx - 10) * i) / 5, 10 + ((hy - 10) * i) / 5)
    px('#ecc66a', 10, 10)
  }, [value, glow])
  return (
    <div className="lb-dial" role="group" aria-label={label}>
      <button type="button" className="lb-dial__arrow" disabled={disabled} onClick={() => onChange(value === 1 ? 8 : value - 1)} aria-label="Marca anterior">◀</button>
      <canvas ref={ref} className="lb-dial__face" aria-label={`Marca ${value} de 8`} />
      <button type="button" className="lb-dial__arrow" disabled={disabled} onClick={() => onChange(value === 8 ? 1 : value + 1)} aria-label="Próxima marca">▶</button>
      <span className="lb-dial__label">{label}</span>
    </div>
  )
}

function useBitsCanvas(bits: string[], color: string, k: number) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const src = bitsCanvas(bits, color, k)
    c.width = src.width
    c.height = src.height
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.drawImage(src, 0, 0)
  }, [bits, color, k])
  return ref
}

export function SymbolIcon({ sym, k = 3, color = '#ecc66a' }: { sym: Sym; k?: number; color?: string }) {
  const ref = useBitsCanvas(SYMBOL_BITS[sym], color, k)
  return <canvas ref={ref} className="lb-bits" aria-hidden="true" />
}

export function GlyphIcon({ g, k = 4, color = '#ecc66a' }: { g: number; k?: number; color?: string }) {
  const ref = useBitsCanvas(GLYPH_BITS[g] ?? GLYPH_BITS[0], color, k)
  return <canvas ref={ref} className="lb-bits" aria-hidden="true" />
}

/** Uma linha discreta de instrução, embaixo da cena. */
export function Hint({ children }: { children: ReactNode }) {
  return <p className="lb-hint-line">{children}</p>
}
