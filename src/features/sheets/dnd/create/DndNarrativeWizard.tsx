import { useEffect, useMemo, useState } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import type { DndCharacterSheet, DndCharacterSheetUpdateInput } from '../../../../shared/types'
import { getBackground, getClass, getRace, getSubrace, type SpellEntry } from '../catalog'
import type { DndSheetData } from '../hooks/useDndSheetData'
import { ImportQuestionCard } from '../import/ImportQuestionCard'
import type { Answer, Question } from '../import/types'
import { DndCreateWizard } from './DndCreateWizard'
import { explain, narrativeResult, NQUESTIONS, primeSpellCache, UNSURE, visibleQuestions, type NAnswers, type NQuestion } from './narrative'
import { runCreate } from './plan'
import '../import/DndImport.css'
import './DndCreate.css'

// ────────────────────────────────────────────────────────
// Ficha por narrativa: muitas perguntas sobre a história, a personalidade e o jeito de jogar, uma por vez (com "não sei" em
// toda escolha e cenas de aventura para quem tem pouca ideia). No fim o site mostra a ficha que montou e por quê; a pessoa
// aceita de uma vez ou ajusta passo a passo no assistente de criação, que grava a ficha.
// ────────────────────────────────────────────────────────

interface Props {
  sheet: DndCharacterSheet
  data: DndSheetData
  saveSheet: (payload: DndCharacterSheetUpdateInput) => Promise<void>
  lock: (on: boolean) => void
  onClose: () => void
  onCreated: () => void
}

function toQuestion(q: NQuestion, a: NAnswers): Question {
  const base = { id: q.id, section: q.section, title: q.title, body: q.body }
  const cur = a[q.id]
  if (q.kind === 'choice') {
    return {
      ...base, kind: 'choice',
      options: [
        ...(q.options ?? []).map((x) => ({ value: x.value, label: x.label, hint: x.hint })),
        ...(q.id === 'ideias' ? [] : [{ value: UNSURE, label: 'Não sei: escolha por mim', hint: 'O site decide pelo conjunto das suas outras respostas.' }]),
      ],
      recommended: typeof cur === 'string' ? cur : undefined,
    }
  }
  if (q.kind === 'multi') {
    const on = Array.isArray(cur) ? cur : []
    return { ...base, body: q.body, kind: 'multi', options: (q.options ?? []).map((x) => ({ value: x.value, label: x.label, hint: x.hint, checked: on.includes(x.value) })) }
  }
  if (q.kind === 'number') return { ...base, kind: 'number', min: 1, max: 20, defaultValue: typeof cur === 'number' ? cur : 1 }
  return { ...base, kind: 'text', placeholder: q.placeholder, defaultValue: typeof cur === 'string' ? cur : '', examples: q.examples }
}

type Stage = 'questions' | 'result' | 'create'

export function DndNarrativeWizard({ sheet, data, saveSheet, lock, onClose, onCreated }: Props) {
  const [answers, setAnswers] = useState<NAnswers>({})
  const [i, setI] = useState(0)
  const [stage, setStage] = useState<Stage>('questions')
  const [auto, setAuto] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<readonly SpellEntry[] | null>(null)

  // o catálogo de magias só é baixado quando a pessoa chega ao resultado
  useEffect(() => {
    if (stage === 'questions' || catalog) return
    void import('../catalog/spells').then((m) => { primeSpellCache(m.SPELLS); setCatalog(m.SPELLS) })
  }, [stage, catalog])

  const list = useMemo(() => visibleQuestions(answers), [answers])
  const q = stage === 'questions' ? list[i] : undefined
  const result = useMemo(() => narrativeResult(answers), [answers])
  const plan = useMemo(
    () => (catalog && stage !== 'questions' ? runCreate({ existing: sheet, spells: catalog, suggester: result.suggester, extras: result.extras, auto: true }, {}) : null),
    [catalog, stage, sheet, result],
  )

  function answer(a: Answer) {
    if (!q) return
    if (q.id === 'nome' && (typeof a !== 'string' || !a.trim())) { setError('Escreva um nome.'); return }
    setError(null)
    const next = { ...answers, [q.id]: a as NAnswers[string] }
    setAnswers(next)
    if (i + 1 >= visibleQuestions(next).length) setStage('result')
    else setI(i + 1)
  }

  function back() {
    setError(null)
    if (stage === 'result') { setStage('questions'); setI(Math.max(0, list.length - 1)); return }
    if (i > 0) setI(i - 1)
    else onClose()
  }

  if (stage === 'create') {
    return (
      <DndCreateWizard
        mode="narrative" sheet={sheet} data={data} saveSheet={saveSheet} lock={lock} onClose={onClose} onCreated={onCreated}
        narrative={result} autoStart={auto} onBackToNarrative={() => setStage('result')}
      />
    )
  }

  const draft = plan?.done ? plan.draft : null
  const lines = draft
    ? explain(result.profile, {
      classKey: draft.classes[0].class_key, subclassKey: draft.classes[0].subclass_key, raceKey: draft.form.race_key, subraceKey: draft.form.subrace_key, backgroundKey: draft.form.background_key,
    }, {
      cls: getClass(draft.classes[0].class_key)?.name ?? '', sub: getClass(draft.classes[0].class_key)?.subclasses.find((s) => s.key === draft.classes[0].subclass_key)?.name ?? null,
      race: `${getRace(draft.form.race_key)?.name ?? ''}${draft.form.subrace_key ? ` (${getSubrace(draft.form.race_key, draft.form.subrace_key)?.name})` : ''}`, bg: getBackground(draft.form.background_key)?.name ?? '',
    })
    : []

  return (
    <ModalOverlay onClose={onClose}>
      <div className="dsh-sheet dimp dcr" role="dialog" aria-modal="true" aria-labelledby="dcr-nar-title">
        <header className="dimp__head">
          <div>
            <span className="dimp__kicker">Ficha por narrativa</span>
            <h2 id="dcr-nar-title" className="dimp__heading">{typeof answers.nome === 'string' && answers.nome.trim() ? answers.nome : 'Nova ficha de D&D'}</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </header>

        {stage === 'questions' && q && (
          <>
            <p className="dimp__step">Pergunta {i + 1} de {list.length}</p>
            <div className="dcr__bar" aria-hidden="true"><i style={{ width: `${Math.round(((i + 1) / list.length) * 100)}%` }} /></div>
            <ImportQuestionCard key={q.id} q={{ ...toQuestion(q, answers), error: error ?? undefined }} onAnswer={answer} />
          </>
        )}

        {stage === 'result' && !plan && <div className="dimp__card dimp__card--center"><span className="spinner" /><p className="dimp__body">Montando a ficha…</p></div>}

        {stage === 'result' && plan && plan.done && (
          <div className="dimp__card">
            <span className="dimp__section">Resultado</span>
            <h3 className="dimp__title">Montei a ficha com o que você contou</h3>
            <ul className="dimp__report dcr__why">
              {lines.map((l) => <li key={l.label}><b>{l.label}:</b> {l.value}<small>{l.why}</small></li>)}
            </ul>
            <ul className="dimp__report">{plan.summary.slice(1).map((line, k) => <li key={k}>{line}</li>)}</ul>
            <div className="dimp__actions">
              <button type="button" className="dimp__go" onClick={() => { setAuto(false); setStage('create') }}>Ajustar passo a passo</button>
              <button type="button" className="dimp__go dimp__go--primary" onClick={() => { setAuto(true); setStage('create') }}>Revisar e criar</button>
            </div>
          </div>
        )}

        <footer className="dimp__foot">
          <button type="button" className="dimp__link" onClick={back}>← Voltar</button>
          <button type="button" className="dimp__link" onClick={onClose}>Cancelar</button>
        </footer>
      </div>
    </ModalOverlay>
  )
}

export const NARRATIVE_QUESTION_COUNT = NQUESTIONS.length
