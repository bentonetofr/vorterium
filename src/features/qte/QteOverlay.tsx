import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { soundVolume } from '../settings/settingsStore'
import '../mesa/components/MesaLiveNotice.css'
import { QTE_LIVES, QTE_TOTAL } from './qteEngine'
import { useQte } from './QteProvider'
import { isActive, type QteBoard, type QteGame, type QtePlayer } from './QteSession'
import './Qte.css'

// ────────────────────────────────────────────────────────
// A cena a dois na tela: o aviso de convite/assistir (canto) e a arena
// (por cima de tudo). Quem joga vê a sua arena e a do outro lado a lado,
// quem assiste vê as duas. Só a arena de quem joga recebe tecla/toque.
// ────────────────────────────────────────────────────────

const HIT_QUIPS  = ['Boa!', 'Isso!', 'Que ritmo!', 'Sem tropeço!', 'Mandou bem!', 'Afiado!']
const SLOW_QUIPS = ['Devagar demais!', 'Sumiu!', 'Dormiu no ponto!', 'Tarde!']
const WRONG_QUIPS = ['Ops, tecla errada!', 'Escorregou!', 'Foi a letra errada!', 'Ai, ai!']
const WIN_QUIPS  = ['Fôlego de campeão!', 'Nem suou!', 'Que condicionamento!', 'Ritmo impecável!']
const LOSE_QUIPS = ['Ficou sem fôlego…', 'Tropeçou nos próprios pés.', 'Faltou condicionamento!', 'Perdeu o ritmo.']

function pick<T>(list: T[], n: number): T { return list[Math.abs(n) % list.length] }
function hash(s: string): number { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h }

function Hearts({ lives }: { lives: number }) {
  return (
    <span className="qte-hearts" aria-label={`${lives} de ${QTE_LIVES} vidas`}>
      {Array.from({ length: QTE_LIVES }, (_, i) => (
        <svg key={i} className={`qte-heart${i < lives ? '' : ' qte-heart--lost'}`} width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.7 5 6 5c2.1 0 3.6 1.2 4.4 2.5h3.2C14.4 6.2 15.9 5 18 5c3.3 0 5.1 3.4 3.6 6.8C19.5 16.4 12 21 12 21z" />
        </svg>
      ))}
    </span>
  )
}

/**
 * Posição da letra: a sequência manda x/y de 0 a 1 dentro de uma faixa
 * (`from` + `span`); aqui a faixa vira 0–100% da arena MENOS uma margem do
 * tamanho da tecla (--qte-pad), para a letra e o aro nunca saírem da arena,
 * nem numa tela pequena.
 */
function padded(v: number, from: number, span: number): string {
  const n = Math.min(1, Math.max(0, (v - from) / span))
  return `calc(var(--qte-pad) + (100% - 2 * var(--qte-pad)) * ${n.toFixed(4)})`
}

function playNotifySound() {
  try {
    const gain = soundVolume('notify')
    if (gain === 0) return
    const audio = new Audio('/notify.mp3')
    audio.volume = 0.6 * gain
    void audio.play().catch(() => {})
  } catch { /* sem Audio API */ }
}

// ── Aviso do canto ───────────────────────────────────────

/** "X te chamou para uma cena" (aceitar/recusar) ou "X vai começar uma cena" (assistir). */
export function QteNotice() {
  const qte = useQte()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const game = qte.game
  const me = qte.userId

  const mine = game?.players.find((p) => p.uid === me) ?? null
  const invited = !!game && game.phase === 'inviting' && !!mine && mine.accepted === null
  const spectate = !!game && isActive(game) && !mine && game.organizer.uid !== me
  const key = game ? `${game.id}:${invited ? 'i' : 's'}` : ''
  const show = !!game && !qte.open && (invited || (spectate && !dismissed.has(key)))

  useEffect(() => { if (show) playNotifySound() }, [show, key])

  if (!show || !game) return null
  const dismiss = () => setDismissed((s) => new Set(s).add(key))

  return (
    <div className="mesa-notice qte-notice" role="status" aria-live="polite" key={key}>
      <span className="mesa-notice__live qte-notice__tag">{invited ? 'Convite' : 'Ao vivo'}</span>
      <div className="mesa-notice__body">
        <p className="mesa-notice__message">
          <strong>{game.organizer.name}</strong> {invited ? 'chamou você para uma cena a dois' : game.phase === 'lobby' ? 'está preparando uma cena a dois' : 'começou uma cena a dois'}
        </p>
        <p className="mesa-notice__campaign">{invited ? 'Aceite para começar; a campanha toda assiste.' : 'Venha assistir!'}</p>
      </div>
      <div className="mesa-notice__actions">
        {invited ? (
          <>
            <button type="button" className="btn btn-primary mesa-notice__watch" onClick={() => void qte.accept()}>Aceitar</button>
            <button type="button" className="btn btn-ghost" onClick={qte.decline}>Recusar</button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-primary mesa-notice__watch" onClick={() => qte.setOpen(true)}>Assistir</button>
            <button type="button" className="mesa-notice__close" onClick={dismiss} aria-label="Fechar aviso">✕</button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Arena de um jogador ──────────────────────────────────

function Board({ player, mine, live, onTap }: { player: QtePlayer; mine: boolean; live: boolean; onTap: (key: string) => void }) {
  const b: QteBoard = player.board
  const flash = b.flash
  const quip = flash
    ? flash.kind === 'hit' ? pick(HIT_QUIPS, flash.n * 7 + hash(player.uid)) : pick(flash.why === 'tempo' ? SLOW_QUIPS : WRONG_QUIPS, flash.n * 5 + hash(player.uid))
    : null
  return (
    <section className={`qte-board${mine ? ' qte-board--mine' : ''}${b.result === 'lost' ? ' qte-board--lost' : ''}${b.result === 'cleared' ? ' qte-board--won' : ''}`} aria-label={`Arena de ${player.name}`}>
      <header className="qte-board__head">
        <span className="qte-board__name">{player.name}{mine && <em> (você)</em>}</span>
        <Hearts lives={b.lives} />
        <span className="qte-board__score" title="Letras acertadas">{b.hits}/{QTE_TOTAL}</span>
      </header>
      <div className="qte-arena">
        <span className="qte-arena__bar" style={{ width: `${(b.index / QTE_TOTAL) * 100}%` }} />
        {live && b.prompt && !b.result && (
          <button
            key={`${b.prompt.i}`}
            type="button"
            tabIndex={mine ? 0 : -1}
            disabled={!mine}
            className="qte-key"
            style={{ left: padded(b.prompt.x, 0.1, 0.8), top: padded(b.prompt.y, 0.14, 0.72), ['--qte-ms' as string]: `${b.prompt.ms}ms` }}
            onPointerDown={(e) => { if (mine) { e.preventDefault(); onTap(b.prompt!.key) } }}
            onClick={(e) => { if (e.detail === 0 && mine) onTap(b.prompt!.key) }}
            aria-label={`Tecla ${b.prompt.key}`}
          >
            <span className="qte-key__ring" />
            <span className="qte-key__cap">{b.prompt.key}</span>
          </button>
        )}
        {flash && <span key={flash.n} className={`qte-pop qte-pop--${flash.kind}`}>{quip}</span>}
        {flash && <span key={`f${flash.n}`} className={`qte-flash qte-flash--${flash.kind}`} aria-hidden="true" />}
        {b.result && (
          <div className="qte-arena__result" aria-live="polite">
            {b.result === 'cleared' ? 'Aguentou até o fim!' : 'Sem fôlego!'}
          </div>
        )}
      </div>
    </section>
  )
}

// ── Contagem regressiva ──────────────────────────────────

function Countdown({ end }: { end: number }) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(performance.now()), 80)
    return () => window.clearInterval(t)
  }, [])
  const left = Math.max(0, end - now)
  const n = Math.ceil(left / 1000)
  return <div className="qte-countdown" key={n} aria-live="assertive">{n > 0 ? n : 'Já!'}</div>
}

// ── A tela ───────────────────────────────────────────────

function verdictText(game: QteGame, me: string | null): { title: string; sub: string } {
  const seed = hash(game.id)
  const solo = game.players.length === 1
  if (game.tie) return { title: 'Empate!', sub: 'Ninguém cede.' }
  if (solo) {
    const p = game.players[0]
    return p.board.result === 'cleared'
      ? { title: `${p.name} venceu!`, sub: pick(WIN_QUIPS, seed) }
      : { title: `${p.name} perdeu`, sub: pick(LOSE_QUIPS, seed) }
  }
  const winner = game.players.find((p) => p.uid === game.winner)
  const loser = game.players.find((p) => p.uid !== game.winner)
  const youWon = winner?.uid === me
  return {
    title: `${winner?.name ?? 'Alguém'} venceu!`,
    sub: `${youWon ? pick(WIN_QUIPS, seed) : `${loser?.name ?? 'O outro'}: ${pick(LOSE_QUIPS, seed + 1)}`}`,
  }
}

/** Aparelho de toque (sem teclado físico na mão): a dica fala em tocar. */
const TOUCH = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches

export function QteOverlay() {
  const qte = useQte()
  const { game, open } = qte
  const me = qte.userId
  const mine = game?.players.find((p) => p.uid === me && p.accepted === true) ?? null
  const playing = !!game && game.phase === 'playing' && !!mine && !mine.board.result
  const lastKeyAt = useRef(0)

  // Tela aberta: a página de trás não rola; durante a cena a tela do aparelho não apaga.
  const phase = game?.phase
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])
  useEffect(() => {
    if (!open || (phase !== 'countdown' && phase !== 'playing')) return
    let lock: { release: () => Promise<void> } | null = null
    let gone = false
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    const ask = () => { nav.wakeLock?.request('screen').then((l) => { if (gone) void l.release(); else lock = l }).catch(() => {}) }
    ask()
    const onVisible = () => { if (document.visibilityState === 'visible' && !lock) ask() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { gone = true; document.removeEventListener('visibilitychange', onVisible); void lock?.release().catch(() => {}) }
  }, [open, phase])

  // Celular: uma vibração curta quando a SUA letra falha.
  const myFlash = mine?.board.flash
  useEffect(() => {
    if (!open || !myFlash || myFlash.kind !== 'miss') return
    try { navigator.vibrate?.(70) } catch { /* sem vibração */ }
  }, [open, myFlash])

  // teclado: só a letra, sem atalhos do navegador atrapalhando
  const { press } = qte
  useEffect(() => {
    if (!open || !playing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
      if (!/^[a-z]$/i.test(e.key)) return
      e.preventDefault()
      const now = performance.now()
      if (now - lastKeyAt.current < 30) return
      lastKeyAt.current = now
      press(e.key)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, playing, press])

  // Esc fecha para quem só assiste
  const { leave } = qte
  const canClose = !!game && (!mine || game.phase === 'done' || game.phase === 'cancelled' || game.phase === 'inviting')
  useEffect(() => {
    if (!open || !canClose) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') leave() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, canClose, leave])

  if (!open || !game) return null

  const organizer = game.organizer.uid === me
  const pending = game.phase === 'inviting' && mine === null && game.players.some((p) => p.uid === me && p.accepted === null)
  const verdict = game.phase === 'done' ? verdictText(game, me) : null
  const finished = game.phase === 'done' || game.phase === 'cancelled'

  function close() {
    if (game && game.phase === 'playing' && mine && !mine.board.result) qte.forfeit()
    if (finished) leave(); else qte.setOpen(false)
  }

  return createPortal(
    <div className="qte-overlay" role="dialog" aria-modal="true" aria-label="Cena a dois">
      <div className="qte-stage">
        <header className="qte-stage__head">
          <div>
            <h2 className="qte-stage__title">Cena a dois</h2>
            <p className="qte-stage__sub">
              {mine ? 'Você está jogando' : 'Assistindo'} · {game.organizer.master ? `mestre ${game.organizer.name}` : `chamado por ${game.organizer.name}`}
            </p>
          </div>
          <div className="qte-stage__actions">
            {organizer && isActive(game) && <button type="button" className="btn btn-ghost" onClick={() => qte.cancel('A cena foi cancelada.')}>Cancelar cena</button>}
            {playing && <button type="button" className="btn btn-ghost" onClick={close}>Desistir</button>}
            {(canClose || finished) && !playing && <button type="button" className="qte-stage__close" onClick={close} aria-label="Fechar">×</button>}
          </div>
        </header>

        {game.phase === 'lobby' && (
          <div className="qte-wait">
            <p className="qte-wait__big">{game.organizer.name} está preparando a cena…</p>
            <p className="qte-wait__small">Assim que escolher quem entra e iniciar, a arena aparece aqui.</p>
          </div>
        )}

        {game.phase === 'inviting' && (
          <div className="qte-wait">
            <p className="qte-wait__big">Esperando a resposta…</p>
            <ul className="qte-wait__list">
              {game.players.map((p) => (
                <li key={p.uid} className={`qte-wait__who${p.accepted === true ? ' qte-wait__who--yes' : p.accepted === false ? ' qte-wait__who--no' : ''}`}>
                  {p.name} <span>{p.accepted === true ? 'aceitou' : p.accepted === false ? 'recusou' : 'pensando…'}</span>
                </li>
              ))}
            </ul>
            {pending && (
              <div className="qte-wait__actions">
                <button type="button" className="btn btn-primary qte-go" onClick={() => void qte.accept()}>Aceitar</button>
                <button type="button" className="btn btn-ghost" onClick={qte.decline}>Recusar</button>
              </div>
            )}
          </div>
        )}

        {(game.phase === 'countdown' || game.phase === 'playing' || game.phase === 'done') && (
          <div className={`qte-boards qte-boards--${game.players.length}`}>
            {game.players.map((p) => (
              <Board key={p.uid} player={p} mine={p.uid === mine?.uid} live={game.phase === 'playing'} onTap={qte.press} />
            ))}
            {game.phase === 'countdown' && game.countdownEnd !== null && <Countdown end={game.countdownEnd} />}
          </div>
        )}

        {game.phase === 'playing' && mine && !mine.board.result && (
          <p className="qte-stage__hint">{TOUCH ? 'Toque na letra que aparece na sua arena antes que suma' : 'Aperte a letra que aparece na sua arena (ou toque nela) antes que suma'}. {QTE_LIVES} falhas e acabou.</p>
        )}
        {game.phase === 'playing' && !mine && <p className="qte-stage__hint">Você está assistindo: as duas arenas aparecem ao vivo.</p>}

        {verdict && (
          <div className="qte-verdict" role="status">
            <p className="qte-verdict__title">{verdict.title}</p>
            <p className="qte-verdict__sub">{verdict.sub}</p>
            <button type="button" className="btn btn-primary qte-go" onClick={close}>Fechar</button>
          </div>
        )}

        {game.phase === 'cancelled' && (
          <div className="qte-verdict" role="status">
            <p className="qte-verdict__title">Cena cancelada</p>
            <p className="qte-verdict__sub">{game.note}</p>
            <button type="button" className="btn btn-primary qte-go" onClick={close}>Fechar</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
