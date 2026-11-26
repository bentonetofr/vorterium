import type { DhFeature, DhSubclass } from '../model/types'
import { RuleText } from './DhUi'

// ────────────────────────────────────────────────────────
// A subclasse como linha do tempo: Fundamental (desde o nível 1), Especialização (nível 5 em diante) e Maestria (nível 8 em diante).
// Cada degrau mostra se já está ativo, se é o próximo a liberar ou se ainda está distante, com o texto da característica.
// ────────────────────────────────────────────────────────

interface Props {
  sub: DhSubclass
  /** Quantas cartas de subclasse a pessoa tem (1, 2 ou 3). */
  stage: 1 | 2 | 3
}

interface Step {
  n: 1 | 2 | 3
  title: string
  when: string
  features: DhFeature[]
}

export function DhSubclassTimeline({ sub, stage }: Props) {
  const steps: Step[] = [
    { n: 1, title: 'Fundamental', when: 'Nível 1', features: sub.foundation },
    { n: 2, title: 'Especialização', when: 'A partir do nível 5', features: sub.specialization },
    { n: 3, title: 'Maestria', when: 'A partir do nível 8', features: sub.mastery },
  ]
  return (
    <ol className="dh-tl" aria-label={`Evolução da subclasse ${sub.name}`}>
      {steps.map((s) => {
        const state = stage >= s.n ? 'on' : stage + 1 === s.n ? 'next' : 'lock'
        const tag = state === 'on' ? 'Ativa' : state === 'next' ? 'Próxima' : 'Mais adiante'
        return (
          <li key={s.n} className={`dh-tl__step is-${state}`}>
            <span className="dh-tl__dot" aria-hidden="true">{state === 'on' ? '✓' : state === 'next' ? s.n : <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>}</span>
            <header>
              <b>{s.title}</b>
              <em>{s.when} · {tag}</em>
            </header>
            {s.features.map((f) => (
              <div key={f.name} className="dh-tl__feat">
                <h5>{f.name}</h5>
                <RuleText text={f.text} />
              </div>
            ))}
            {state !== 'on' && <p className="dh-tl__how">Libera ao subir de nível, escolhendo a carta de subclasse melhorada.</p>}
          </li>
        )
      })}
    </ol>
  )
}
