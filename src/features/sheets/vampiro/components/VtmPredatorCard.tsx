import { useEffect, useState } from 'react'
import { VTM_DISCIPLINES, VTM_SKILLS, getClan } from '../constants/vampiro'
import { VTM_ADV_BY_KEY } from '../constants/vtmAdvantages'
import { VTM_BOOKS } from '../constants/vtmPowers'
import { getPredator } from '../constants/vtmPredators'
import {
  applyPredator, appliedPredator, defaultChoices, predatorDisciplineOk, predatorWarnings, revertPredator, type PredatorChoices,
} from '../utils/vtmProgress'
import type { VtmForm, VtmUpdate } from './vtmForm'

// ────────────────────────────────────────────────────────
// Tipo de predador na aba Clã e Sangue: como caça, as paradas de caça e o
// que dá na criação. As escolhas (qual disciplina, qual especialização,
// qual vantagem quando há opção, como dividir os pontos) ficam aqui; o
// botão aplica tudo na ficha e lembra o que pôs, pra desfazer se trocar
// de predador.
// ────────────────────────────────────────────────────────

const skillLabel = (k: string) => VTM_SKILLS.find((s) => s.key === k)?.label ?? k
const advLabel = (k: string) => VTM_ADV_BY_KEY.get(k)?.name ?? k

export function VtmPredatorCard({ form, update }: { form: VtmForm; update: VtmUpdate }) {
  const predator = getPredator(form.predator_type)
  const applied = appliedPredator(form)
  const [choices, setChoices] = useState<PredatorChoices | null>(null)

  // Trocou o predador no alto da ficha: as escolhas voltam pro padrão dele.
  useEffect(() => {
    setChoices(predator ? defaultChoices(predator, form) : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predator?.id])

  if (!predator) {
    return (
      <section className="vtm-card">
        <div className="vtm-card__header"><h4 className="vtm-card__title">Tipo de predador</h4></div>
        <p className="vtm-muted">Escolha o tipo de predador no alto da ficha: o que ele dá na criação aparece aqui.</p>
        {applied && (
          <div className="vtm-confirm">
            <p>O {applied.label} ainda está aplicado na ficha (disciplina, especialização, vantagens).</p>
            <button type="button" className="vtm-chip" onClick={() => update((p) => revertPredator(p))}>Desfazer o {applied.label}</button>
          </div>
        )}
      </section>
    )
  }

  const c = choices ?? defaultChoices(predator, form)
  const isApplied = applied?.id === predator.id
  const warnings = predatorWarnings(predator, form)
  const splitsOk = predator.grants.every((g, i) => g.t !== 'split'
    || Object.values(c.splits[i] ?? {}).reduce((n, v) => n + v, 0) === g.total)

  function set(p: Partial<PredatorChoices>) { setChoices({ ...c, ...p }) }

  return (
    <section className="vtm-card vtm-predator">
      <div className="vtm-card__header">
        <h4 className="vtm-card__title">{predator.label} <span className="vtm-faint">{predator.en}</span></h4>
        <span className="vtm-book" title={predator.books.map((b) => VTM_BOOKS[b]).join(', ')}>{VTM_BOOKS[predator.books[0]]}</span>
      </div>
      <p className="vtm-lead">{predator.summary}</p>
      <dl className="vtm-facts">
        <dt>Caça</dt>
        <dd>{predator.pools.map((p) => <span key={p} className="vtm-pool">🎲 {p}</span>)}</dd>
      </dl>
      {warnings.map((w) => <p key={w} className="vtm-warn">{w}</p>)}

      <div className="vtm-pred-choice">
        <span className="vtm-label">Disciplina (+1 ponto)</span>
        <div className="vtm-picker__chips">
          {predator.disciplines.map((d) => {
            const ok = predatorDisciplineOk(predator, d, form)
            const clans = predator.disciplineClans?.[d]
            return (
              <button key={d} type="button" disabled={!ok || isApplied}
                className={`vtm-pick vtm-pick--chip${c.discipline === d ? ' is-on' : ''}`} onClick={() => set({ discipline: d })}
                title={clans ? `Só ${clans.map((x) => getClan(x)?.label ?? x).join(' ou ')}` : undefined}>
                {VTM_DISCIPLINES[d]}{clans ? ' *' : ''}
              </button>
            )
          })}
        </div>
      </div>

      <div className="vtm-pred-choice">
        <span className="vtm-label">Especialização</span>
        <div className="vtm-picker__chips">
          {predator.specialties.map(([skill, name], i) => (
            <button key={`${skill}-${name}`} type="button" disabled={isApplied}
              className={`vtm-pick vtm-pick--chip${c.specialty === i ? ' is-on' : ''}`} onClick={() => set({ specialty: i })}>
              {skillLabel(skill)} ({name})
            </button>
          ))}
        </div>
      </div>

      <div className="vtm-pred-choice">
        <span className="vtm-label">Vantagens e defeitos</span>
        <ul className="vtm-pred-grants">
          {predator.grants.map((g, i) => (
            <li key={i}>
              {g.t === 'adv' && <span>{advLabel(g.key)} {'●'.repeat(g.dots)}{g.note ? ` (${g.note})` : ''}</span>}
              {g.t === 'pick' && (
                <div className="vtm-picker__chips">
                  {g.options.map((o, j) => (
                    <button key={j} type="button" disabled={isApplied}
                      className={`vtm-pick vtm-pick--chip${(c.picks[i] ?? 0) === j ? ' is-on' : ''}`}
                      onClick={() => set({ picks: { ...c.picks, [i]: j } })}>
                      {advLabel(o.key)} {'●'.repeat(o.dots)}{o.note ? ` (${o.note})` : ''}
                    </button>
                  ))}
                </div>
              )}
              {g.t === 'split' && (
                <SplitEditor
                  keys={g.keys} total={g.total} note={g.note} disabled={isApplied}
                  value={c.splits[i] ?? {}} onChange={(v) => set({ splits: { ...c.splits, [i]: v } })}
                />
              )}
            </li>
          ))}
          {predator.humanity !== 0 && <li>Humanidade {predator.humanity > 0 ? '+1' : '−1'}</li>}
          {predator.bloodPotency !== 0 && <li>Potência de Sangue +{predator.bloodPotency}</li>}
        </ul>
      </div>

      <div className="vtm-track__btns">
        {isApplied ? (
          <>
            <span className="vtm-badge vtm-badge--ok">✓ Aplicado na ficha</span>
            <button type="button" className="vtm-chip" onClick={() => update((p) => revertPredator(p))}>Desfazer</button>
          </>
        ) : (
          <>
            <button type="button" className="vtm-chip vtm-chip--primary" disabled={!splitsOk || !c.discipline}
              onClick={() => update((p) => applyPredator(p, predator, c))}>
              {applied ? `Aplicar ${predator.label} (desfaz o ${applied.label})` : 'Aplicar na ficha'}
            </button>
            {!splitsOk && <span className="vtm-muted">Distribua todos os pontos.</span>}
          </>
        )}
      </div>
      {!isApplied && (
        <p className="vtm-muted">
          Aplicar põe na ficha: +1 na disciplina escolhida, a especialização, as vantagens e defeitos (marcados como "predador",
          fora do limite da criação){predator.humanity || predator.bloodPotency ? ', e a mudança de Humanidade ou Potência' : ''}.
        </p>
      )}
    </section>
  )
}

function SplitEditor({ keys, total, note, value, onChange, disabled }: {
  keys: string[]; total: number; note?: string; value: Record<string, number>
  onChange: (v: Record<string, number>) => void; disabled: boolean
}) {
  const used = keys.reduce((n, k) => n + (value[k] ?? 0), 0)
  return (
    <div className="vtm-split">
      <span className="vtm-muted">Divida {total} pontos{note ? ` (${note})` : ''}: {used}/{total}</span>
      {keys.map((k) => (
        <span key={k} className="vtm-split__row">
          {advLabel(k)}
          <button type="button" className="vtm-mini" disabled={disabled || (value[k] ?? 0) <= 0}
            onClick={() => onChange({ ...value, [k]: (value[k] ?? 0) - 1 })} aria-label={`Menos ${advLabel(k)}`}>−</button>
          <strong>{value[k] ?? 0}</strong>
          <button type="button" className="vtm-mini" disabled={disabled || used >= total}
            onClick={() => onChange({ ...value, [k]: (value[k] ?? 0) + 1 })} aria-label={`Mais ${advLabel(k)}`}>+</button>
        </span>
      ))}
    </div>
  )
}

