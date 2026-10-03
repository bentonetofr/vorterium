import type { EnigmaDupla, PhaseView } from './enigmaService'
import { A1Testemunhas } from './phases/A1Testemunhas'
import { B1Baile } from './phases/B1Baile'
import { Delivery, type Act } from './phases/common'

// ────────────────────────────────────────────────────────
// Uma fase de uma dupla, do ponto de vista de quem olha (o papel dela,
// espectador ou mestre): a cena do puzzle, e a Entrega no fim.
// ────────────────────────────────────────────────────────

interface Props {
  dupla:   'A' | 'B'
  info:    EnigmaDupla
  v:       PhaseView | null | undefined
  act:     Act
  /** Espectador e mestre só olham (o mestre age pelo painel dele). */
  readOnly: boolean
  now:     number
}

export function EnigmaPhase({ dupla, info, v, act, readOnly, now }: Props) {
  if (!v) return null
  const spectator = v.role === 'espectador'
  const next = info.fases[v.phase] ?? null

  if (v.stage === 'banca') {
    return <p className="en-card en-wait">As três fases terminaram. Agora é esperar a Banca.</p>
  }
  if (v.stage === 'em-breve') {
    return (
      <div className="en-card en-wait">
        <p className="en-delivery__kicker">Fase {v.phase} · {v.tipo}</p>
        <h3 className="en-h3">{v.titulo}</h3>
        <p className="en-muted">Esta fase abre em breve.</p>
      </div>
    )
  }
  if (v.stage === 'entrega') {
    return <Delivery v={v} act={readOnly ? null : act} spectator={spectator} nextTitle={next ? `Fase ${next.n} · ${next.titulo}` : 'a Banca'} />
  }

  // A fase em jogo é uma cena no quadro 1920×1080 (história, dicas e
  // acusação ficam nos botões do canto do quadro).
  return (
    <div className="en-phase">
      {dupla === 'A' && v.phase === 1 && <A1Testemunhas v={v} act={act} readOnly={readOnly} />}
      {dupla === 'B' && v.phase === 1 && <B1Baile v={v} act={act} readOnly={readOnly} now={now} />}
    </div>
  )
}
