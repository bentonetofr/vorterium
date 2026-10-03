import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import './Stage.css'

// ────────────────────────────────────────────────────────
// O palco: um quadro 1920×1080 (16:9) onde a cena do puzzle é desenhada
// em coordenadas fixas e encolhe pra caber (no celular, pede pra virar e
// oferece tela cheia). Também dá o "arrastar e soltar" das peças: arrasta
// até um alvo marcado com data-drop, ou toca pra escolher e toca no alvo.
// Os painéis (acusar, dicas, história) abrem por cima, em tamanho normal.
// ────────────────────────────────────────────────────────

export const STAGE_W = 1920
export const STAGE_H = 1080

type BeginDrag = (
  e: React.PointerEvent,
  ghost: ReactNode,
  onDrop: (target: string | null) => void,
  onTap?: () => void,
) => void

const StageContext = createContext<{ beginDrag: BeginDrag; dragging: boolean }>({ beginDrag: () => {}, dragging: false })
export const useStage = () => useContext(StageContext)

function useMedia(q: string) {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const f = () => setOn(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [q])
  return on
}

export interface StageTool { id: string; icon: ReactNode; label: string; badge?: boolean; accent?: boolean; onClick: () => void }

interface Props {
  children:      ReactNode
  /** Botões redondos do canto de baixo (a tela cheia entra sozinha no fim). */
  tools?:        StageTool[]
  /** Painel aberto por cima do palco (null = nenhum). */
  panel?:        { title: string; node: ReactNode } | null
  onClosePanel?: () => void
  label:         string
}

export function Stage({ children, tools = [], panel, onClosePanel, label }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.4)
  const [full, setFull] = useState(false)
  const [ghost, setGhost] = useState<{ node: ReactNode; x: number; y: number } | null>(null)
  const portrait = useMedia('(orientation: portrait) and (pointer: coarse)')

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const fit = () => {
      const fs = document.fullscreenElement === el
      setFull(fs)
      const w = fs ? window.innerWidth : el.clientWidth
      // Fora da tela cheia, não passa da altura da janela (sobra o topo do site).
      const h = fs ? window.innerHeight : Math.max(320, window.innerHeight - 90)
      setScale(Math.max(0.1, Math.min(w / STAGE_W, h / STAGE_H)))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    window.addEventListener('resize', fit)
    document.addEventListener('fullscreenchange', fit)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', fit)
      document.removeEventListener('fullscreenchange', fit)
    }
  }, [])

  async function toggleFull() {
    const el = wrapRef.current
    if (!el) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else {
        await el.requestFullscreen()
        const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
        await o.lock?.('landscape').catch(() => {})
      }
    } catch { /* o navegador não deixou */ }
  }

  const beginDrag = useCallback<BeginDrag>((e, node, onDrop, onTap) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    const sx = e.clientX
    const sy = e.clientY
    let moved = false
    const rect = canvas.getBoundingClientRect()
    const s = rect.width / STAGE_W
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return
      moved = true
      setGhost({ node, x: (ev.clientX - rect.left) / s, y: (ev.clientY - rect.top) / s })
    }
    const done = (ev: PointerEvent, cancelled: boolean) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      setGhost(null)
      if (cancelled) return
      if (!moved) { onTap?.(); return }
      const hit = document.elementsFromPoint(ev.clientX, ev.clientY)
        .map((el) => (el as HTMLElement).closest?.('[data-drop]') as HTMLElement | null)
        .find(Boolean)
      onDrop(hit?.dataset.drop ?? null)
    }
    const up = (ev: PointerEvent) => done(ev, false)
    const cancel = (ev: PointerEvent) => done(ev, true)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
  }, [])

  return (
    <StageContext.Provider value={{ beginDrag, dragging: !!ghost }}>
      {portrait && !full && (
        <div className="es-rotate" role="note">
          <span className="es-rotate__icon" aria-hidden="true">📱↻</span>
          <span>Vire o celular para jogar.</span>
          <button type="button" className="en-btn en-btn--gold" onClick={() => void toggleFull()}>Tela cheia</button>
        </div>
      )}
      <div ref={wrapRef} className={`es-wrap${full ? ' is-full' : ''}`} style={full ? undefined : { height: STAGE_H * scale }}>
        <div className="es-frame" style={{ width: STAGE_W * scale, height: STAGE_H * scale }}>
          <div
            ref={canvasRef}
            className={`es-canvas${ghost ? ' is-dragging' : ''}`}
            role="application"
            aria-label={label}
            style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}
          >
            {children}
            <div className="es-toolbar">
              {[...tools, { id: 'full', icon: full ? '🗗' : '⛶', label: full ? 'Sair' : 'Tela cheia', onClick: () => void toggleFull() } as StageTool].map((t) => (
                <button key={t.id} type="button" className={`es-tool${t.badge ? ' has-badge' : ''}${t.accent ? ' es-tool--accuse' : ''}`} onClick={t.onClick}>
                  <span className="es-tool__icon" aria-hidden="true">{t.icon}</span>
                  <span className="es-tool__label">{t.label}</span>
                </button>
              ))}
            </div>
            {ghost && <div className="es-ghost" style={{ left: ghost.x, top: ghost.y }} aria-hidden="true">{ghost.node}</div>}
          </div>
        </div>
        {panel && (
          <div className="es-panel" role="dialog" aria-label={panel.title} onClick={(e) => { if (e.target === e.currentTarget) onClosePanel?.() }}>
            <div className="es-panel__card">
              <div className="en-row en-row--between">
                <h3 className="en-h3">{panel.title}</h3>
                <button type="button" className="en-btn en-btn--ghost" onClick={onClosePanel} aria-label="Fechar">✕</button>
              </div>
              {panel.node}
            </div>
          </div>
        )}
      </div>
    </StageContext.Provider>
  )
}
