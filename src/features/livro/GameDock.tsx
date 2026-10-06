import { useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { enterFullscreen } from './LivroOverlay'
import './GameDock.css'

// ────────────────────────────────────────────────────────
// Os ícones dos joguinhos na coluna de botões do canto (em cima do Painel
// de controle e do sino): um por jogo liberado, pra quem saiu do jogo
// ("Voltar ao site") voltar de onde parou. O clique já religa a tela cheia
// (o navegador só deixa entrar nela num clique).
//
// O lugar (GameDockSlot) fica no layout; cada jogo (LivroHost, TorreHost)
// põe o seu ícone lá dentro, com createPortal.
// ────────────────────────────────────────────────────────

/**
 * Os ícones estão no canto? (escondidos por enquanto, a pedido). Escondidos,
 * quem saiu de um jogo volta pela pílula no alto da tela, como era antes.
 */
export const GAME_DOCK_ON = false

let slotEl: HTMLElement | null = null
const listeners = new Set<() => void>()
function setSlot(el: HTMLElement | null) {
  if (slotEl === el) return
  slotEl = el
  listeners.forEach((l) => l())
}
function subscribe(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

/** O lugar dos ícones, na coluna do canto. */
export function GameDockSlot() {
  if (!GAME_DOCK_ON) return null
  return <div ref={setSlot} className="game-dock" />
}

export type DockGame = 'livro' | 'torre'

/**
 * O ícone de um jogo. `live` = o jogo está rolando e eu saí dele (ganha o
 * pontinho piscando); sem `live`, é o mestre podendo trazer o jogo pra tela.
 */
export function GameFab({ game, label, live, confirm, onOpen }: {
  game: DockGame
  label: string
  live: boolean
  /** Pergunta antes (ex.: abrir um jogo novo cobre a tela de todos). */
  confirm?: string
  onOpen: () => void | Promise<void>
}) {
  const slot = useSyncExternalStore(subscribe, () => slotEl)
  const [busy, setBusy] = useState(false)
  // Sem os ícones: só a pílula de voltar pro jogo que está rolando.
  if (!GAME_DOCK_ON) {
    if (!live) return null
    return createPortal(
      <button type="button" className="game-pill" onClick={() => { enterFullscreen(); void onOpen() }}>
        <span className="game-pill__dot" aria-hidden="true" /> {label}
      </button>,
      document.body,
    )
  }
  if (!slot) return null
  const click = () => {
    if (busy) return
    if (confirm && !window.confirm(confirm)) return
    enterFullscreen()
    const r = onOpen()
    if (r instanceof Promise) {
      setBusy(true)
      r.catch((e) => window.alert(e instanceof Error ? e.message : 'Não deu certo.')).finally(() => setBusy(false))
    }
  }
  return createPortal(
    <button
      type="button"
      className={`game-fab game-fab--${game}${live ? ' game-fab--live' : ''}`}
      onClick={click}
      disabled={busy}
      aria-label={label}
      title={label}
    >
      {game === 'livro' ? <LivroIcon /> : <TorreIcon />}
      {live && <span className="game-fab__dot" aria-hidden="true" />}
    </button>,
    slot,
  )
}

/** O livro com o cadeado. */
function LivroIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <rect x="9.5" y="9" width="7" height="5" rx="1" />
      <path d="M11 9V7.5a2 2 0 0 1 4 0V9" />
    </svg>
  )
}

/** A torre com a cúpula e o telescópio. */
function TorreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 22V11h10v11" />
      <path d="M6 11a6 6 0 0 1 12 0" />
      <path d="M13 7l5-4" />
      <path d="M10 22v-4h4v4" />
      <path d="M4 22h16" />
    </svg>
  )
}
