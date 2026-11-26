import { useMemo, useState } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import { DONT_KNOW, answered, recommend, visibleQuestions, type NQuestion, type NarrativeAnswers } from '../model/narrative'
import type { QuickAnswers } from '../model/quick'

// ────────────────────────────────────────────────────────
// Ficha por narrativa: muitas perguntas sobre a história, a personalidade e o jeito de jogar que a pessoa imagina, uma por vez.
// No fim o site escolhe a melhor montagem (model/narrative.ts) e mostra o porquê de cada escolha. Dali a pessoa confere no
// formulário rápido (ou ajusta passo a passo) e cria a ficha; tudo continua editável nela.
// ────────────────────────────────────────────────────────

interface Props {
  onCancel: () => void
  /** Entrega as respostas já montadas para o formulário rápido terminar (conferir ou ajustar). */
  onDone: (answers: QuickAnswers, startAt: 'classe' | 'resumo') => void
}

function Question({ q, value, onChange, onEnter }: { q: NQuestion; value: string[]; onChange: (v: string[]) => void; onEnter: () => void }) {
  if (q.kind === 'text') {
    return (
      <>
        <input autoFocus className="dh-q__input" value={value[0] ?? ''} maxLength={q.id === 'nome' ? 120 : 200} placeholder={q.placeholder}
          onChange={(e) => onChange([e.target.value])} onKeyDown={(e) => { if (e.key === 'Enter') onEnter() }} />
        {q.examples && <div className="dh-chips">{q.examples.map((x) => <button key={x} type="button" onClick={() => onChange([x])}>{x}</button>)}</div>}
      </>
    )
  }
  const many = q.kind === 'many'
  const max = q.max ?? 1
  const unsure = value.includes(DONT_KNOW)
  return (
    <div className={`dh-q__choices dh-q__choices--${(q.options?.length ?? 0) > 7 ? 2 : 1}`} role={many ? 'group' : 'radiogroup'}>
      {(q.options ?? []).map((o) => {
        const on = value.includes(o.id)
        return (
          <button key={o.id} type="button" role={many ? undefined : 'radio'} aria-checked={many ? undefined : on} aria-pressed={many ? on : undefined} className={`dh-q__choice${on ? ' is-on' : ''}`}
            onClick={() => {
              if (!many) { onChange([o.id]); return }
              const mine = value.filter((x) => x !== DONT_KNOW)
              if (on) onChange(mine.filter((x) => x !== o.id))
              else if (mine.length < max) onChange([...mine, o.id])
              else onChange([...mine.slice(1), o.id])
            }}>
            <b>{o.label}</b>
            {o.sub && <small>{o.sub}</small>}
          </button>
        )
      })}
      {q.id !== 'nivel' && (
        <button type="button" role={many ? undefined : 'radio'} aria-checked={many ? undefined : unsure} aria-pressed={many ? unsure : undefined} className={`dh-q__choice dh-nar__unsure${unsure ? ' is-on' : ''}`} onClick={() => onChange([DONT_KNOW])}>
          <b>Não sei: escolha por mim</b>
          <small>O site decide pelo conjunto das suas outras respostas.</small>
        </button>
      )}
    </div>
  )
}

export function DhNarrativeForm({ onCancel, onDone }: Props) {
  const [answers, setAnswers] = useState<NarrativeAnswers>({})
  const [i, setI] = useState(0)
  const list = useMemo(() => visibleQuestions(answers), [answers])
  const total = list.length + 1
  const isResult = i >= list.length
  const q = isResult ? null : list[i]
  const rec = useMemo(() => (isResult ? recommend(answers) : null), [isResult, answers])

  const ok = q ? answered(q, answers) : true
  const next = () => { if (ok) setI((x) => Math.min(total - 1, x + 1)) }
  const back = () => { if (i === 0) onCancel(); else setI(i - 1) }
  const pct = Math.round((i / (total - 1)) * 100)

  return (
    <ModalOverlay onClose={onCancel}>
      <div className="dh-dialog dh-q dh-nar" role="dialog" aria-modal="true" aria-label="Ficha por narrativa">
        <div className="dh-q__progress" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
        <p className="dh-q__count">{q ? `${q.group} · Pergunta ${i + 1} de ${total - 1}` : 'Resultado'}</p>
        <h3 className="dh-q__title">{q ? q.title : `Montei a ficha${rec?.answers.name ? ` de ${rec.answers.name}` : ''}`}</h3>
        {q?.hint && <p className="dh-hint">{q.hint}</p>}
        {isResult && <p className="dh-hint">Com base no que você contou, esta é a combinação que mais se encaixa. Dá para ajustar tudo antes de criar, e depois na própria ficha.</p>}
        <div className="dh-q__body">
          {q && <Question q={q} value={answers[q.id] ?? []} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} onEnter={next} />}
          {rec && (
            <>
              <ul className="dh-q__sum dh-nar__sum">
                {rec.reasons.map((r) => (
                  <li key={r.label}>
                    <b>{r.label}:</b> {r.value}
                    <small className="dh-nar__why">{r.why}</small>
                  </li>
                ))}
              </ul>
              {rec.storyPrompts.length > 0 && <p className="dh-hint">Para quem ainda está imaginando o personagem: as anotações da ficha trazem seu resumo e perguntas do guia da classe, por exemplo “{rec.storyPrompts[0]}”. Responda quando quiser.</p>}
              {rec.alternatives.length > 0 && <p className="dh-hint">Outras classes que também combinam: {rec.alternatives.join(' e ')}. Para trocar, use “Ajustar passo a passo”.</p>}
            </>
          )}
        </div>
        <footer className="dh-dialog__foot">
          <button type="button" className="btn" onClick={back}>{i === 0 ? 'Cancelar' : 'Voltar'}</button>
          {!isResult && <button type="button" className="btn btn-primary" disabled={!ok} onClick={next}>{q?.optional && !(answers[q.id]?.[0] ?? '').trim() ? 'Pular' : 'Continuar'}</button>}
          {rec && (
            <>
              <button type="button" className="btn" onClick={() => onDone(rec.answers, 'classe')}>Ajustar passo a passo</button>
              <button type="button" className="btn btn-primary" onClick={() => onDone(rec.answers, 'resumo')}>{rec.answers.level > 1 ? 'Continuar para as subidas' : 'Revisar e criar'}</button>
            </>
          )}
        </footer>
      </div>
    </ModalOverlay>
  )
}
