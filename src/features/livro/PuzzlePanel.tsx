import { useCallback, useEffect, useRef, useState } from 'react'
import { play, type LivroView } from './livroService'
import type { PanelId } from './livroNet'
import { CastPanel } from './puzzles/CastPanel'
import { RetPanel } from './puzzles/RetPanel'
import { AstroPanel } from './puzzles/AstroPanel'
import { EstPanel } from './puzzles/EstPanel'
import { PedPanel } from './puzzles/PedPanel'
import type { PuzzleProps, UiLink } from './puzzles/kit'
import { sfx, type SoundName } from './game/sound'
import { HintBanner } from './HintBanner'

/** O som na hora da jogada (antes da resposta do banco). */
const ACTION_SOUND: Partial<Record<string, SoundName>> = {
  light: 'candle', cast_view: 'latch', ret_view: 'latch', spin: 'latch', slot: 'tap', books: 'slide', pull: 'slide',
}

/** O som da resposta: deu certo (com mensagem) ou não. */
function resultSound(a: string, ok: boolean, msg: string | null): SoundName | null {
  if (!ok) return a === 'chain' ? 'tighten' : a === 'pull' ? 'tumble' : a === 'light' ? 'wax' : 'bad'
  if (!msg) return null
  if (a === 'light') return 'wax'
  if (a === 'lid') return 'unlock'
  if (a === 'medal') return 'medal'
  if (a === 'chain') return 'chain'
  if (a === 'slot') return 'spin'
  if (/gaveta/i.test(msg) && (a === 'word' || a === 'drawer')) return 'drawer'
  return 'ok'
}

// ────────────────────────────────────────────────────────
// A janela de um objeto: aparece no centro da tela, o fundo desfoca e o
// boneco fica parado. Dentro, o enigma daquele objeto (puzzles/). Cada
// jogada vai pro banco, que responde o que aconteceu — vira uma faixa
// curta embaixo. Fecha com Esc, ✕ ou clicando fora.
// Quem assiste (e o mestre) vê a mesma janela, só olhando.
// ────────────────────────────────────────────────────────

const TITLES: Record<PanelId, string> = {
  castical:   'O Castiçal',
  retrato:    'O Retrato',
  astrolabio: 'O Astrolábio',
  estante:    'A Estante',
  pedestal:   'O Livro Bloqueado',
}

const PUZZLES: Record<PanelId, (p: PuzzleProps) => JSX.Element> = {
  castical: CastPanel,
  retrato: RetPanel,
  astrolabio: AstroPanel,
  estante: EstPanel,
  pedestal: PedPanel,
}

export function PuzzlePanel({ id, view, onClose, watching, ui }: { id: PanelId; view: LivroView; onClose: () => void; watching?: string | null; ui?: UiLink }) {
  const [flash, setFlash] = useState<{ ok: boolean; msg: string; n: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const ro = !!watching || view.me.slot === null
  const g = view.game
  const Puzzle = PUZZLES[id]

  const act = useCallback(async (action: Record<string, unknown>) => {
    const a = String(action.a)
    const before = ACTION_SOUND[a]
    if (before) sfx(before)
    try {
      const r = await play(view.room.id, action)
      const after = resultSound(a, r.ok, r.msg)
      if (after) sfx(after)
      if (r.msg) setFlash((f) => ({ ok: r.ok, msg: r.msg!, n: (f?.n ?? 0) + 1 }))
    } catch (e) {
      sfx('bad')
      setFlash((f) => ({ ok: false, msg: e instanceof Error ? e.message : 'Não deu certo.', n: (f?.n ?? 0) + 1 }))
    }
  }, [view.room.id])

  // a faixa some sozinha
  useEffect(() => {
    if (!flash) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setFlash(null), 4200)
    return () => window.clearTimeout(timer.current)
  }, [flash])

  useEffect(() => { sfx('open'); return () => sfx('close') }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="lb-panel-wrap" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <section className="lb-panel lb-frame" role="dialog" aria-label={TITLES[id]}>
        <button type="button" className="lb-x" onClick={onClose} aria-label="Fechar">✕</button>
        {watching && <p className="lb-panel__watch">Assistindo {watching}</p>}
        <h2 className="lb-panel__title">{TITLES[id]}</h2>
        <HintBanner hint={view.hint ?? null} offset={view.now - Date.now()} inline kicker="Um sussurro na biblioteca" />
        {g ? <Puzzle g={g} act={act} ro={ro} view={view} ui={ui} /> : <p className="lb-panel__text">O jogo ainda não começou.</p>}
        {flash && <p key={flash.n} className={`lb-toast${flash.ok ? '' : ' is-bad'}`} role="status">{flash.msg}</p>}
      </section>
    </div>
  )
}
