import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useFloatingStore, useFloatingWin, useIsFront } from './FloatingProvider'
import { BAR_H, BOTTOM_GAP, MIN_H, MIN_W, TOP_GAP } from './floatingStore'

// ────────────────────────────────────────────────────────
// Uma janela flutuante: barra de título que se arrasta (duplo clique recolhe), botões de fixar, recolher, minimizar e fechar,
// e um canto para puxar o tamanho. Quem usa desenha a janela (com o conteúdo vivo) enquanto o id estiver aberto na loja;
// a posição, o tamanho e o que está recolhido ou minimizado ficam na loja e são lembrados.
//
// Arrastar e redimensionar mexem direto no elemento e só avisam a loja ao soltar: a ficha lá dentro não redesenha a cada pixel.
// Minimizada continua montada (escondida): a aba da ficha e o que foi digitado não se perdem.
// No celular a janela da frente ocupa a tela toda (CSS), e as outras ficam na barra de baixo.
// ────────────────────────────────────────────────────────

interface Props {
  id: string
  title: string
  subtitle?: string
  /** Letra ou imagem do avatar. */
  avatar?: ReactNode
  /** Resumo mostrado na barra quando a janela está recolhida (ex.: PV e Fadiga). */
  mini?: ReactNode
  /** Resumo curtinho para a etiqueta da barra de baixo. */
  badge?: string
  children: ReactNode
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), Math.max(lo, hi))
const isPhone = () => window.matchMedia('(max-width: 768px)').matches

function Ico({ d, fill }: { d: string; fill?: boolean }) {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
}

export function FloatingWindow({ id, title, subtitle, avatar, mini, badge, children }: Props) {
  const store = useFloatingStore()
  const win = useFloatingWin(id)
  const front = useIsFront(id)
  const ref = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const winRef = useRef(win)
  winRef.current = win
  const [snapping, setSnapping] = useState(false)
  const lastSnap = useRef(win?.snap ?? 0)
  const wasFront = useRef(front)

  // o título e a etiqueta para a barra de baixo
  useEffect(() => { store.setMeta(id, { title, badge }) }, [store, id, title, badge])

  // organizar / caber na tela: anima só nesses casos (arrastar e puxar não animam)
  const snapTimer = useRef(0)
  useEffect(() => {
    if (win === undefined || win.snap === lastSnap.current) return
    lastSnap.current = win.snap
    setSnapping(true)
    window.clearTimeout(snapTimer.current)
    snapTimer.current = window.setTimeout(() => setSnapping(false), 340)
  }, [win?.snap]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => window.clearTimeout(snapTimer.current), [])

  // ao passar para a frente (clique no cartão ou na barra), o foco do teclado acompanha
  useEffect(() => {
    if (front && !wasFront.current && ref.current && !ref.current.contains(document.activeElement)) ref.current.focus({ preventScroll: true })
    wasFront.current = front
  }, [front])

  // o layout da ficha lá dentro segue a largura da janela (as faixas de largura do CSS da ficha)
  useEffect(() => {
    const body = bodyRef.current
    if (!body || typeof ResizeObserver === 'undefined') return
    const apply = (w: number) => {
      body.classList.toggle('fw-w860', w <= 860)
      body.classList.toggle('fw-w640', w <= 640)
      body.classList.toggle('fw-w560', w <= 560)
    }
    apply(body.clientWidth)
    const ro = new ResizeObserver((entries) => apply(entries[0].contentRect.width))
    ro.observe(body)
    return () => ro.disconnect()
  }, [win !== undefined])

  if (!win) return null

  function startDrag(e: ReactPointerEvent<HTMLElement>) {
    const cur = winRef.current
    const el = ref.current
    if (!cur || !el || e.button !== 0 || (e.target as HTMLElement).closest('button') || isPhone()) return
    const bar = e.currentTarget
    const sx = e.clientX, sy = e.clientY
    let nx = cur.x, ny = cur.y
    el.classList.add('is-drag')
    bar.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      nx = clamp(cur.x + ev.clientX - sx, 4, window.innerWidth - el.offsetWidth - 4)
      ny = clamp(cur.y + ev.clientY - sy, TOP_GAP, window.innerHeight - BOTTOM_GAP - BAR_H)
      el.style.left = `${nx}px`
      el.style.top = `${ny}px`
    }
    const end = () => {
      bar.removeEventListener('pointermove', move)
      bar.removeEventListener('pointerup', end)
      bar.removeEventListener('pointercancel', end)
      el.classList.remove('is-drag')
      store.dispatch({ type: 'move', id, x: nx, y: ny })
    }
    bar.addEventListener('pointermove', move)
    bar.addEventListener('pointerup', end)
    bar.addEventListener('pointercancel', end)
  }

  function startResize(e: ReactPointerEvent<HTMLElement>) {
    const cur = winRef.current
    const el = ref.current
    if (!cur || !el || e.button !== 0 || isPhone()) return
    e.stopPropagation()
    const grip = e.currentTarget
    const sx = e.clientX, sy = e.clientY
    let nw = cur.w, nh = cur.h
    el.classList.add('is-drag')
    grip.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      nw = clamp(cur.w + ev.clientX - sx, MIN_W, window.innerWidth - cur.x - 4)
      nh = clamp(cur.h + ev.clientY - sy, MIN_H, window.innerHeight - cur.y - BOTTOM_GAP + 20)
      el.style.width = `${nw}px`
      el.style.height = `${nh}px`
    }
    const end = () => {
      grip.removeEventListener('pointermove', move)
      grip.removeEventListener('pointerup', end)
      grip.removeEventListener('pointercancel', end)
      el.classList.remove('is-drag')
      store.dispatch({ type: 'resize', id, w: nw, h: nh })
    }
    grip.addEventListener('pointermove', move)
    grip.addEventListener('pointerup', end)
    grip.addEventListener('pointercancel', end)
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    // Esc fecha a janela em foco, mas só se o Esc nasceu dentro dela (um aviso ou janela modal aberta por ela cuida do seu próprio Esc)
    if (e.key === 'Escape' && !e.defaultPrevented && ref.current?.contains(e.target as Node)) store.close(id)
  }

  const cls = ['fw', front && !win.min ? 'is-front' : '', win.col ? 'is-col' : '', win.min ? 'is-min' : '', win.pin ? 'is-pin' : '', snapping ? 'is-snap' : ''].filter(Boolean).join(' ')

  return createPortal(
    <div ref={ref} className={cls} role="dialog" aria-label={title} aria-hidden={win.min || undefined} tabIndex={-1} data-fw={id}
      style={{ left: win.x, top: win.y, width: win.w, height: win.col ? BAR_H : win.h, zIndex: (win.pin ? 760 : 600) + win.z }}
      onPointerDownCapture={() => store.focus(id)} onKeyDown={onKeyDown}>
      <header className="fw__bar" onPointerDown={startDrag} onDoubleClick={(e) => { if (!(e.target as HTMLElement).closest('button')) store.dispatch({ type: 'col', id }) }}>
        <span className="fw__grip" aria-hidden="true" />
        {avatar != null && <span className="fw__av" aria-hidden="true">{avatar}</span>}
        <span className="fw__title"><b>{title}</b>{subtitle && !win.col && <small>{subtitle}</small>}</span>
        {win.col && mini && <span className="fw__mini">{mini}</span>}
        <span className="fw__ctl">
          <button type="button" className={win.pin ? 'is-on' : ''} aria-pressed={win.pin} aria-label={win.pin ? 'Desafixar a janela' : 'Fixar a janela por cima das outras'} title={win.pin ? 'Desafixar' : 'Fixar por cima das outras'}
            onClick={() => store.dispatch({ type: 'pin', id })}><Ico d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6z" fill={win.pin} /></button>
          <button type="button" aria-expanded={!win.col} aria-label={win.col ? 'Abrir a ficha' : 'Recolher: só a barra do título'} title={win.col ? 'Abrir' : 'Recolher'}
            onClick={() => store.dispatch({ type: 'col', id })}><Ico d={win.col ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6'} /></button>
          <button type="button" aria-label="Minimizar para a barra de baixo" title="Minimizar" onClick={() => store.dispatch({ type: 'min', id, value: true })}><Ico d="M5 12h14" /></button>
          <button type="button" className="fw__close" aria-label="Fechar a janela" title="Fechar (Esc)" onClick={() => store.close(id)}><Ico d="M6 6l12 12M18 6L6 18" /></button>
        </span>
      </header>
      <div ref={bodyRef} className="fw__body">{children}</div>
      <span className="fw__rs" onPointerDown={startResize} aria-hidden="true" />
    </div>,
    document.body,
  )
}
