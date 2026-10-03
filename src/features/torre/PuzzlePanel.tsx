import { useCallback, useEffect, useRef, useState } from 'react'
import { play, type TorreView } from './torreService'
import type { Floor, TorrePanel } from './torreNet'
import { TelescopioPanel } from './puzzles/TelescopioPanel'
import { MapaPanel } from './puzzles/MapaPanel'
import { EspelhosPanel } from './puzzles/EspelhosPanel'
import { ManivelaPanel } from './puzzles/ManivelaPanel'
import { PenduloPanel } from './puzzles/PenduloPanel'
import { AstrarioPanel } from './puzzles/AstrarioPanel'
import { sfx, type SoundName } from './sound'
import { HintBanner } from './HintBanner'

/** O som na hora da jogada (antes da resposta do banco). */
const ACTION_SOUND: Partial<Record<string, SoundName>> = {
  mirror: 'mirror', dome: 'crank', latch: 'latch', push: 'push',
  marker: 'tap', ast_seq: 'tap', ast_star: 'tap', go: 'gear',
}
/** Jogadas cujo "deu certo" já tem som próprio. */
const OK_SOUND: Partial<Record<string, SoundName>> = { pull: 'unlock', ast_key: 'unlock' }

// ────────────────────────────────────────────────────────
// A janela de um objeto: aparece no centro da tela, o fundo desfoca e o
// boneco fica parado. Dentro, o enigma daquele objeto (puzzles/). Cada
// jogada vai pro banco, que responde o que aconteceu — vira uma faixa
// curta embaixo. Fecha com Esc, ✕ ou clicando fora.
// O pêndulo e o Astrário existem nos dois andares: a janela mostra o lado
// de quem abriu. Quem assiste (e o mestre) vê a mesma janela, só olhando.
// ────────────────────────────────────────────────────────

const TITLES: Record<TorrePanel, string> = {
  telescopio: 'O Telescópio',
  mapa:       'O Mapa Estelar',
  espelhos:   'Os Espelhos',
  manivela:   'A Manivela',
  pendulo:    'O Pêndulo',
  astrario:   'O Astrário',
}

interface Props {
  id:        TorrePanel
  floor:     Floor
  view:      TorreView
  /** hora do banco ≈ Date.now() + offset */
  offset:    number
  onClose:   () => void
  watching?: string | null
}

export function PuzzlePanel({ id, floor, view, offset, onClose, watching }: Props) {
  const [flash, setFlash] = useState<{ ok: boolean; msg: string; n: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const ro = !!watching || view.me.slot === null
  const g = view.game
  const offRef = useRef(offset)
  offRef.current = offset
  const clock = useCallback(() => Date.now() + offRef.current, [])

  const act = useCallback(async (action: Record<string, unknown>) => {
    const a = String(action.a)
    const before = ACTION_SOUND[a]
    if (before) sfx(before)
    try {
      const r = await play(view.room.id, action)
      if (!r.ok) sfx('bad')
      else if (r.msg && OK_SOUND[a]) sfx(OK_SOUND[a]!)
      else if (r.msg && a !== 'push' && a !== 'go') sfx('ok')
      if (r.msg) setFlash((f) => ({ ok: r.ok, msg: r.msg!, n: (f?.n ?? 0) + 1 }))
    } catch (e) {
      sfx('bad')
      setFlash((f) => ({ ok: false, msg: e instanceof Error ? e.message : 'Não deu certo.', n: (f?.n ?? 0) + 1 }))
    }
  }, [view.room.id])

  // abrir e fechar a janela
  useEffect(() => { sfx('open'); return () => sfx('close') }, [])

  // a faixa some sozinha
  useEffect(() => {
    if (!flash) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setFlash(null), 4200)
    return () => window.clearTimeout(timer.current)
  }, [flash])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  let body: JSX.Element
  if (!g) body = <p className="lb-panel__text">O jogo ainda não começou.</p>
  else {
    const p = { g, act, ro, view, clock }
    switch (id) {
      case 'telescopio': body = g.tele ? <TelescopioPanel {...p} /> : <Far />; break
      case 'mapa':       body = g.map ? <MapaPanel {...p} /> : <Far />; break
      case 'espelhos':   body = g.mir ? <EspelhosPanel {...p} /> : <Far />; break
      case 'manivela':   body = g.crank ? <ManivelaPanel {...p} /> : <Far />; break
      case 'pendulo':    body = <PenduloPanel {...p} floor={floor} />; break
      case 'astrario':   body = <AstrarioPanel {...p} floor={floor} />; break
    }
  }

  return (
    <div className="lb-panel-wrap" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <section className="lb-panel lb-frame" role="dialog" aria-label={TITLES[id]}>
        <button type="button" className="lb-x" onClick={onClose} aria-label="Fechar">✕</button>
        {watching && <p className="lb-panel__watch">Assistindo {watching}</p>}
        <h2 className="lb-panel__title">{TITLES[id]}</h2>
        <HintBanner hint={view.hint ?? null} offset={offset} inline />
        {body}
        {flash && <p key={flash.n} className={`lb-toast${flash.ok ? '' : ' is-bad'}`} role="status">{flash.msg}</p>}
      </section>
    </div>
  )
}

function Far() {
  return <p className="lb-panel__text">Isso fica no outro andar.</p>
}
