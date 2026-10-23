import { useState } from 'react'
import type { Answer, Question } from './types'

// ────────────────────────────────────────────────────────
// Um card de pergunta do questionário de importação. Escolha: clicar na
// opção já responde. Lista, número e texto: botão Continuar (ou Enter).
// ────────────────────────────────────────────────────────

interface Props { q: Question; onAnswer: (a: Answer) => void }

export function ImportQuestionCard({ q, onAnswer }: Props) {
  return (
    <div className="dimp__card">
      <span className="dimp__section">{q.section}</span>
      <h3 className="dimp__title">{q.title}</h3>
      {q.body && <p className="dimp__body">{q.body}</p>}
      {q.error && <p className="dimp__error" role="alert">{q.error}</p>}
      {q.kind === 'choice' && (
        <ul className="dimp__options" role="list">
          {q.options.map((o) => (
            <li key={o.value}>
              <button type="button" className={`dimp__opt${q.recommended === o.value ? ' is-rec' : ''}`} onClick={() => onAnswer(o.value)}>
                <span className="dimp__opt-label">{o.label}{q.recommended === o.value && <em>Recomendado</em>}</span>
                {o.hint && <span className="dimp__opt-hint">{o.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.kind === 'multi' && <MultiBody q={q} onAnswer={onAnswer} />}
      {q.kind === 'number' && <NumberBody q={q} onAnswer={onAnswer} />}
      {q.kind === 'text' && <TextBody q={q} onAnswer={onAnswer} />}
    </div>
  )
}

function MultiBody({ q, onAnswer }: { q: Extract<Question, { kind: 'multi' }>; onAnswer: (a: Answer) => void }) {
  const [on, setOn] = useState(() => new Set(q.options.filter((o) => o.checked).map((o) => o.value)))
  const toggle = (v: string) => setOn((s) => { const n = new Set(s); if (n.has(v)) n.delete(v); else n.add(v); return n })
  return (
    <>
      <div className="dimp__bulk">
        <button type="button" className="dimp__link" onClick={() => setOn(new Set(q.options.map((o) => o.value)))}>Marcar todos</button>
        <button type="button" className="dimp__link" onClick={() => setOn(new Set())}>Desmarcar todos</button>
        <span className="dimp__count">{on.size} de {q.options.length}</span>
      </div>
      <ul className="dimp__options dimp__options--multi" role="list">
        {q.options.map((o) => (
          <li key={o.value}>
            <label className={`dimp__opt dimp__check${on.has(o.value) ? ' is-on' : ''}`}>
              <input type="checkbox" checked={on.has(o.value)} onChange={() => toggle(o.value)} />
              <span className="dimp__opt-label">{o.label}</span>
              {o.hint && <span className="dimp__opt-hint">{o.hint}</span>}
            </label>
          </li>
        ))}
      </ul>
      <div className="dimp__actions"><button type="button" className="dimp__go" onClick={() => onAnswer(q.options.filter((o) => on.has(o.value)).map((o) => o.value))}>Continuar</button></div>
    </>
  )
}

function NumberBody({ q, onAnswer }: { q: Extract<Question, { kind: 'number' }>; onAnswer: (a: Answer) => void }) {
  const [text, setText] = useState(q.defaultValue != null ? String(q.defaultValue) : '')
  const [local, setLocal] = useState<string | null>(null)
  const submit = () => {
    const n = Number(text.replace(',', '.'))
    if (text.trim() === '' || !Number.isFinite(n) || n < q.min || n > q.max) { setLocal(`Digite um número de ${q.min} a ${q.max}.`); return }
    onAnswer(Math.round(n))
  }
  return (
    <>
      <div className="dimp__field">
        <input type="number" inputMode="numeric" className="dimp__input" value={text} min={q.min} max={q.max} autoFocus
          onChange={(e) => { setText(e.target.value); setLocal(null) }} onKeyDown={(e) => { if (e.key === 'Enter') submit() }} aria-label={q.title} />
        {q.unit && <span className="dimp__unit">{q.unit}</span>}
      </div>
      {local && <p className="dimp__error" role="alert">{local}</p>}
      <div className="dimp__actions"><button type="button" className="dimp__go" onClick={submit}>Continuar</button></div>
    </>
  )
}

function TextBody({ q, onAnswer }: { q: Extract<Question, { kind: 'text' }>; onAnswer: (a: Answer) => void }) {
  const [text, setText] = useState(q.defaultValue ?? '')
  return (
    <>
      <div className="dimp__field">
        {q.multiline
          ? <textarea className="dimp__input dimp__input--area" value={text} placeholder={q.placeholder} autoFocus onChange={(e) => setText(e.target.value)} aria-label={q.title} />
          : <input type="text" className="dimp__input" value={text} placeholder={q.placeholder} autoFocus maxLength={200}
              onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onAnswer(text) }} aria-label={q.title} />}
      </div>
      <div className="dimp__actions"><button type="button" className="dimp__go" onClick={() => onAnswer(text)}>Continuar</button></div>
    </>
  )
}
