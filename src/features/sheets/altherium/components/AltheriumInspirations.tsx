import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import { Presence } from '../../../../shared/components/Presence'
import { Select } from '../../../../shared/components/Select'
import { TRIUMPH_ACTION_LABELS, TRIUMPH_RANGES, byName, type TriumphAction } from '../constants/altheriumTriumphs'
import type { AltheriumSkaldInspiration } from '../../../../shared/types'

// ────────────────────────────────────────────────────────
// Inspirações Skald — aba própria da ficha. Não há nenhuma no livro: o
// personagem ganha na história (ex.: por resistir ao Rugido do Sköll) e o
// jogador cria o card, no mesmo formato de um triunfo. "Usar" só anuncia
// pra mesa (custo em texto livre — quem desconta é o jogador). Tudo vai
// pelo salvamento automático da ficha.
// ────────────────────────────────────────────────────────

const GLYPH = 'ᛋ'

interface AltheriumInspirationsProps {
  inspirations: AltheriumSkaldInspiration[]
  disabled?:    boolean
  onChange:     (next: AltheriumSkaldInspiration[]) => void
  onUse:        (inspiration: AltheriumSkaldInspiration) => void
}

export function AltheriumInspirations({ inspirations, disabled, onChange, onUse }: AltheriumInspirationsProps) {
  const [editing, setEditing]           = useState<AltheriumSkaldInspiration | 'new' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [lastUsed, setLastUsed]         = useState<string | null>(null)
  const sorted = [...inspirations].sort(byName)

  function save(insp: AltheriumSkaldInspiration) {
    const exists = inspirations.some((i) => i.id === insp.id)
    onChange(exists ? inspirations.map((i) => (i.id === insp.id ? insp : i)) : [...inspirations, insp])
    setEditing(null)
  }

  return (
    <section className="alth-card alth-triumphs">
      <div className="alth-card__header">
        <h4 className="alth-card__title">Inspirações Skald</h4>
        <button
          type="button" className="alth-triumph__btn alth-triumph__btn--add"
          onClick={() => setEditing('new')} disabled={disabled}
        >
          + Nova inspiração
        </button>
      </div>
      {lastUsed && <p key={lastUsed} className="alth-triumphs__used" role="status">{lastUsed}</p>}

      {sorted.length === 0
        ? <p className="alth-triumphs__empty">Nenhuma inspiração ainda.</p>
        : (
          <div className="alth-triumphs__grid">
            {sorted.map((i) => (
              <article key={i.id} className="alth-rune alth-rune--descoberta alth-inspiration">
                <div className="alth-rune__media"><span className="alth-rune__glyph" aria-hidden="true">{GLYPH}</span></div>
                <div className="alth-rune__body">
                  <header className="alth-triumph__head">
                    <h5 className="alth-triumph__name">{i.name}</h5>
                    {i.cost && <span className="alth-triumph__cost">{i.cost}</span>}
                  </header>
                  {i.test && <p className="alth-rune__test"><span>Teste:</span> {i.test}</p>}
                  {i.description && <p className="alth-triumph__desc">{i.description}</p>}
                  {(i.action || i.range) && (
                    <div className="alth-triumph__chips">
                      {i.action && <span className="alth-triumph__chip">{TRIUMPH_ACTION_LABELS[i.action]}</span>}
                      {i.range && <span className="alth-triumph__chip">{i.range}</span>}
                    </div>
                  )}
                  <div className="alth-triumph__actions">
                    {confirmDelete === i.id ? (
                      <>
                        <button type="button" className="alth-triumph__btn" onClick={() => setConfirmDelete(null)}>Cancelar</button>
                        <button
                          type="button" className="alth-triumph__btn alth-triumph__btn--remove"
                          onClick={() => { setConfirmDelete(null); onChange(inspirations.filter((x) => x.id !== i.id)) }}
                        >
                          Confirmar exclusão
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="alth-triumph__btn alth-triumph__btn--remove" onClick={() => setConfirmDelete(i.id)} disabled={disabled}>
                          Excluir
                        </button>
                        <button type="button" className="alth-triumph__btn" onClick={() => setEditing(i)} disabled={disabled}>
                          Editar
                        </button>
                        <button
                          type="button" className="alth-triumph__btn alth-triumph__btn--use" disabled={disabled}
                          onClick={() => { onUse(i); setLastUsed(`${i.name} usada. A mesa foi avisada.`) }}
                        >
                          Usar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

      <Presence show={editing !== null} exitMs={220}>
        {() => editing && (
          <InspirationEditor
            initial={editing === 'new' ? undefined : editing}
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        )}
      </Presence>
    </section>
  )
}

interface InspirationEditorProps {
  initial?: AltheriumSkaldInspiration
  onSubmit: (insp: AltheriumSkaldInspiration) => void
  onCancel: () => void
}

function InspirationEditor({ initial, onSubmit, onCancel }: InspirationEditorProps) {
  const [name, setName]               = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [cost, setCost]               = useState(initial?.cost ?? '')
  const [test, setTest]               = useState(initial?.test ?? '')
  const [action, setAction]           = useState<TriumphAction | ''>(initial?.action ?? '')
  const [range, setRange]             = useState(initial?.range ?? '')
  const [error, setError]             = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  function blockEnter(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault()
  }

  function handleSave() {
    if (!name.trim()) { setError('Dê um nome à inspiração.'); return }
    onSubmit({
      id:          initial?.id ?? crypto.randomUUID(),
      name:        name.trim(),
      description: description.trim(),
      cost:        cost.trim(),
      action:      action || null,
      range:       range || null,
      test:        test.trim() || null,
    })
  }

  return (
    <ModalOverlay onClose={onCancel}>
      <div
        className="alth-modal__window alth-rune alth-rune--descoberta alth-rune--editing alth-inspiration"
        role="dialog" aria-modal="true" aria-labelledby="alth-insp-editor-title"
        onKeyDown={blockEnter}
      >
        <header className="alth-modal__header">
          <h4 id="alth-insp-editor-title" className="alth-modal__title">{initial ? 'Editar inspiração' : 'Nova inspiração'}</h4>
          <button type="button" className="modal-close" onClick={onCancel} aria-label="Fechar">×</button>
        </header>
        <div className="alth-rune__media"><span className="alth-rune__glyph" aria-hidden="true">{GLYPH}</span></div>
        <div className="alth-rune__body">
          <input
            ref={nameRef} type="text" className="input" placeholder="Nome da inspiração" maxLength={80}
            value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome da inspiração"
          />
          <div className="alth-rune__editor-row">
            <label className="alth-rune__editor-half">
              <span className="label">Custo</span>
              <input
                type="text" className="input" maxLength={40} placeholder="ex.: 2 FV"
                value={cost} onChange={(e) => setCost(e.target.value)}
              />
            </label>
            <label className="alth-rune__editor-half">
              <span className="label">Teste</span>
              <input type="text" className="input" maxLength={80} value={test} onChange={(e) => setTest(e.target.value)} />
            </label>
          </div>
          <div className="alth-rune__editor-row">
            <label className="alth-rune__editor-half">
              <span className="label">Tipo de ação</span>
              <Select
                value={action} onChange={(v) => setAction(v as TriumphAction | '')} aria-label="Tipo de ação"
                options={[
                  { value: '', label: '-' },
                  ...(Object.keys(TRIUMPH_ACTION_LABELS) as TriumphAction[]).map((a) => ({ value: a, label: TRIUMPH_ACTION_LABELS[a] })),
                ]}
              />
            </label>
            <label className="alth-rune__editor-half">
              <span className="label">Distância</span>
              <Select
                value={range} onChange={setRange} aria-label="Distância"
                options={[
                  { value: '', label: '-' },
                  ...(range && !(TRIUMPH_RANGES as readonly string[]).includes(range) ? [{ value: range, label: range }] : []),
                  ...TRIUMPH_RANGES.map((r) => ({ value: r, label: r })),
                ]}
              />
            </label>
          </div>
          <textarea
            className="input" rows={4} placeholder="O que a inspiração faz" maxLength={1000}
            value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Descrição da inspiração"
          />
          {error && <p className="alth-triumphs__warn" role="alert">{error}</p>}
          <div className="alth-triumph__actions">
            <button type="button" className="alth-triumph__btn" onClick={onCancel}>Cancelar</button>
            <button type="button" className="alth-triumph__btn alth-triumph__btn--add" onClick={handleSave}>Salvar inspiração</button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}
