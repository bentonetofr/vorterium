import { useCallback, useEffect, useRef, useState } from 'react'
import { pressKey, releaseAllKeys, releaseKey } from '../touch/virtualKeys'
import { useTouchMode } from '../touch/useTouchMode'
import { getPlayZoom, savePlayZoom, ZOOM_MAX, ZOOM_MIN } from '../touch/playZoom'
import './TouchControls.css'

/** Centro do joystick onde o boneco fica parado (fração do raio) e a folga entre as direções (cos de 67,5°). */
const DEAD_ZONE = 0.28
const AXIS_THRESHOLD = 0.38

interface TouchLayerProps {
  /** Muda o zoom da câmera do jogo (o motor aceita no modo jogo). */
  onZoom: (zoom: number) => void
  /** Mostra o botão de interagir (liga a tecla E do motor). Desligado até existir a mecânica. */
  interact?: boolean
  /** Esconde tudo (cena do mestre por cima do jogo). */
  hidden?: boolean
}

/** Os controles na tela, se o aparelho for de toque (ou a pessoa ligou): o que o jogo (e o Testar do mestre) põe por cima do palco. */
export function TouchLayer({ onZoom, interact, hidden }: TouchLayerProps) {
  const { touch, canShow, setTouch } = useTouchMode()
  if (!canShow || hidden) return null
  return touch
    ? <TouchControls onZoom={onZoom} interact={interact} onToggle={() => setTouch(false)} />
    : <TouchControlsShow onClick={() => setTouch(true)} />
}

interface TouchControlsProps {
  /** Muda o zoom da câmera do jogo (o motor aceita no modo jogo). */
  onZoom: (zoom: number) => void
  /** Mostra o botão de interagir (liga a tecla E do motor). Desligado até existir a mecânica. */
  interact?: boolean
  /** Liga e desliga os controles (um tablet com teclado dispensa o joystick). */
  onToggle: () => void
}

/**
 * Controles do Vortable no celular e no tablet: joystick à esquerda (8 direções), botões à direita
 * (correr e, quando houver, interagir) e zoom. Tudo vira tecla virtual (ver touch/virtualKeys).
 */
export function TouchControls({ onZoom, interact = false, onToggle }: TouchControlsProps) {
  const [running, setRunning] = useState(false)
  const [zoom, setZoom] = useState(getPlayZoom)

  // o boneco não pode ficar andando sozinho se a aba for pro fundo ou os controles saírem
  useEffect(() => {
    const stop = () => { releaseAllKeys(); setRunning(false) }
    const onHide = () => { if (document.visibilityState !== 'visible') stop() }
    window.addEventListener('blur', stop)
    document.addEventListener('visibilitychange', onHide)
    return () => { window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', onHide); releaseAllKeys() }
  }, [])

  const toggleRun = () => {
    setRunning((on) => {
      if (on) releaseKey('run'); else pressKey('run')
      return !on
    })
    navigator.vibrate?.(8)
  }

  const changeZoom = (step: number) => {
    const next = savePlayZoom(zoom + step)
    setZoom(next)
    onZoom(next)
  }

  return (
    <div className="touch" onContextMenu={(e) => e.preventDefault()}>
      <Joystick />

      <div className="touch__actions">
        {interact && <InteractButton />}
        <button
          type="button"
          className={`touch__btn touch__btn--run${running ? ' touch__btn--on' : ''}`}
          onClick={toggleRun}
          aria-pressed={running}
          aria-label="Correr"
        >
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 6l6 6-6 6" />
            <path d="M13 6l6 6-6 6" />
          </svg>
          <span>Correr</span>
        </button>
      </div>

      <div className="touch__zoom" role="group" aria-label="Zoom e controles">
        <button type="button" className="touch__mini" onClick={() => changeZoom(-0.25)} disabled={zoom <= ZOOM_MIN} aria-label="Afastar a câmera">−</button>
        <button type="button" className="touch__mini" onClick={() => changeZoom(0.25)} disabled={zoom >= ZOOM_MAX} aria-label="Aproximar a câmera">+</button>
        <button type="button" className="touch__mini touch__mini--hide" onClick={onToggle} aria-label="Esconder os controles na tela" title="Esconder os controles">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
            <path d="M4 4l16 16" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/** Botão que volta a mostrar os controles depois de escondidos. */
export function TouchControlsShow({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="touch__show" onClick={onClick} aria-label="Mostrar os controles na tela" title="Mostrar os controles">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="8" cy="12" r="4.5" />
        <circle cx="17.5" cy="9" r="1.6" />
        <circle cx="17.5" cy="15" r="1.6" />
      </svg>
    </button>
  )
}

/** Quanto o dedo tem de afastar do centro pra contar como direção, e as 8 direções que saem disso. */
function directions(dx: number, dy: number, reach: number) {
  const dist = Math.hypot(dx, dy)
  if (dist < reach * DEAD_ZONE) return { up: false, down: false, left: false, right: false }
  const ax = dx / dist
  const ay = dy / dist
  return { up: ay < -AXIS_THRESHOLD, down: ay > AXIS_THRESHOLD, left: ax < -AXIS_THRESHOLD, right: ax > AXIS_THRESHOLD }
}

function Joystick() {
  const base = useRef<HTMLDivElement>(null)
  const knob = useRef<HTMLDivElement>(null)
  const pointer = useRef<number | null>(null)

  const apply = useCallback((clientX: number, clientY: number) => {
    const el = base.current
    const nub = knob.current
    if (!el || !nub) return
    const rect = el.getBoundingClientRect()
    const reach = rect.width / 2 - nub.offsetWidth / 2
    let dx = clientX - (rect.left + rect.width / 2)
    let dy = clientY - (rect.top + rect.height / 2)
    const dist = Math.hypot(dx, dy)
    if (dist > reach) { dx = (dx / dist) * reach; dy = (dy / dist) * reach }
    nub.style.transform = `translate(${dx}px, ${dy}px)`
    const dir = directions(dx, dy, reach)
    for (const name of ['up', 'down', 'left', 'right'] as const) {
      if (dir[name]) pressKey(name); else releaseKey(name)
    }
  }, [])

  const release = useCallback(() => {
    pointer.current = null
    if (knob.current) knob.current.style.transform = ''
    for (const name of ['up', 'down', 'left', 'right'] as const) releaseKey(name)
    base.current?.classList.remove('touch__stick--active')
  }, [])

  // sai da tela com o dedo no joystick: solta
  useEffect(() => release, [release])

  return (
    <div
      ref={base}
      className="touch__stick"
      role="application"
      aria-label="Joystick: arraste pra andar"
      onPointerDown={(e) => {
        if (pointer.current !== null) return
        pointer.current = e.pointerId
        e.currentTarget.setPointerCapture(e.pointerId)
        e.currentTarget.classList.add('touch__stick--active')
        apply(e.clientX, e.clientY)
      }}
      onPointerMove={(e) => { if (e.pointerId === pointer.current) apply(e.clientX, e.clientY) }}
      onPointerUp={(e) => { if (e.pointerId === pointer.current) release() }}
      onPointerCancel={(e) => { if (e.pointerId === pointer.current) release() }}
      onLostPointerCapture={(e) => { if (e.pointerId === pointer.current) release() }}
    >
      <div className="touch__ring" />
      <div ref={knob} className="touch__knob" />
    </div>
  )
}

function InteractButton() {
  return (
    <button
      type="button"
      className="touch__btn touch__btn--act"
      aria-label="Interagir"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); pressKey('interact'); navigator.vibrate?.(8) }}
      onPointerUp={() => releaseKey('interact')}
      onPointerCancel={() => releaseKey('interact')}
    >
      <span className="touch__act-key">E</span>
      <span>Interagir</span>
    </button>
  )
}
