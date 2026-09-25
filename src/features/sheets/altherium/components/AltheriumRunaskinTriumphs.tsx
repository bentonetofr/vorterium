import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import { Presence } from '../../../../shared/components/Presence'
import {
  RUNASKIN_TRAILS,
  RUNASKIN_TRIUMPHS,
  TRIUMPH_ACTION_LABELS,
  TRIUMPH_RANGES,
  type TriumphAction,
  type RunaskinTrail,
} from '../constants/altheriumTriumphs'
import {
  ALTHERIUM_PORTRAIT_MAX_BYTES,
  ALTHERIUM_PORTRAIT_TYPES,
  type AltheriumRuneInput,
} from '../services/altheriumSheetService'
import type { AltheriumRune, RunaskinTriumphOverride } from '../../../../shared/types'
import { Select } from '../../../../shared/components/Select'

// ────────────────────────────────────────────────────────
// Triunfos do Runaskin — trilha (3 iniciais do livro, editáveis na ficha)
// + runas descobertas (criadas na ficha, com foto). Cada "Usar" desconta
// o PR e conta um uso na cena, até o NR; "Nova cena" zera o contador. PR,
// contador e edições da trilha vão pelo salvamento automático da ficha;
// runas salvam na hora.
// ────────────────────────────────────────────────────────

interface AltheriumRunaskinTriumphsProps {
  trail:         RunaskinTrail | null
  onTrailChange: (trail: RunaskinTrail | null) => void
  sceneUses:     number
  usesLimit:     number | null
  onNewScene:    () => void
  prCurrent:     number
  onUse:         (cost: number, triumphName: string) => void
  runes:         AltheriumRune[]
  onRuneCreate:  (input: AltheriumRuneInput, image: File | null) => Promise<void>
  onRuneUpdate:  (rune: AltheriumRune, input: AltheriumRuneInput, image: File | null | undefined) => Promise<void>
  onRuneDelete:  (rune: AltheriumRune) => Promise<void>
  /** Ajustes da ficha nos triunfos iniciais da trilha (por id). */
  trailOverrides:   Record<string, RunaskinTriumphOverride>
  /** Salva a versão editada; null restaura a do livro. */
  onTrailOverride:  (triumphId: string, override: RunaskinTriumphOverride | null) => void
  disabled?:     boolean
}

/** Um triunfo inicial com a edição da ficha aplicada por cima do livro. */
interface TrailTriumph {
  id:          string
  trail:       RunaskinTrail
  name:        string
  description: string
  cost:        number
  test:        string | null
  action:      TriumphAction | null
  range:       string | null
  edited:      boolean
}

/** O editor de runa trabalha com AltheriumRune — adapta o triunfo da trilha. */
function trailTriumphAsRune(t: TrailTriumph): AltheriumRune {
  return {
    id: t.id, sheet_id: '', name: t.name, description: t.description, pr_cost: t.cost,
    test: t.test, action: t.action, range: t.range, image_url: null, created_at: '',
  }
}

export function AltheriumRunaskinTriumphs({
  trail, onTrailChange, sceneUses, usesLimit, onNewScene, prCurrent, onUse,
  runes, onRuneCreate, onRuneUpdate, onRuneDelete, trailOverrides, onTrailOverride, disabled = false,
}: AltheriumRunaskinTriumphsProps) {
  const [editing, setEditing]           = useState<AltheriumRune | 'new' | null>(null)
  const [editingTrail, setEditingTrail] = useState<TrailTriumph | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [lastUsed, setLastUsed]         = useState<string | null>(null)

  const trailDef   = RUNASKIN_TRAILS.find((t) => t.id === trail) ?? null
  const initial: TrailTriumph[] = RUNASKIN_TRIUMPHS.filter((t) => t.trail === trail).map((t) => {
    const o = trailOverrides[t.id]
    return o
      ? { id: t.id, trail: t.trail, name: o.name, description: o.description, cost: o.cost, test: o.test, action: o.action, range: o.range, edited: true }
      : { id: t.id, trail: t.trail, name: t.name, description: t.description, cost: t.cost, test: t.test, action: t.action, range: t.range, edited: false }
  })
  const limitHit   = usesLimit != null && sceneUses >= usesLimit

  function renderUseButton(name: string, cost: number) {
    const noPr = prCurrent < cost
    return (
      <button
        type="button" className="alth-triumph__btn alth-triumph__btn--use"
        disabled={disabled || noPr || limitHit}
        title={limitHit ? 'Limite de usos da cena (NR) atingido' : noPr ? 'PR insuficiente' : undefined}
        onClick={() => {
          onUse(cost, name)
          setLastUsed(`${name} usado — −${cost} PR.`)
        }}
      >
        Usar
      </button>
    )
  }

  return (
    <section className="alth-card alth-triumphs">
      <div className="alth-card__header">
        <h4 className="alth-card__title">Triunfos do Runaskin</h4>
      </div>

      <div className="alth-runes__top">
        <label className="alth-runes__trail">
          <span className="label">Trilha</span>
          <Select
            value={trail ?? ''}
            onChange={(v) => onTrailChange((v || null) as RunaskinTrail | null)}
            disabled={disabled}
            aria-label="Trilha"
            options={[{ value: '', label: '—' }, ...RUNASKIN_TRAILS.map((t) => ({ value: t.id, label: t.label }))]}
          />
        </label>

        <div className="alth-runes__nr">
          <span className="label">Usos na cena (NR)</span>
          <div className="alth-runes__nr-row">
            <span className={`alth-runes__nr-value${limitHit ? ' alth-runes__nr-value--full' : ''}`}>
              {sceneUses} / {usesLimit ?? '—'}
            </span>
            <button
              type="button" className="alth-triumph__btn"
              onClick={() => { onNewScene(); setLastUsed(null) }}
              disabled={disabled || sceneUses === 0}
            >
              Nova cena
            </button>
          </div>
        </div>
      </div>

      <p className="alth-hint">
        NR = 15% do PR máximo (pra cima) no nível 1, dobrando a cada nível.
      </p>

      {trailDef && (
        <p className={`alth-runes__rule alth-runes__rule--${trailDef.id}`}>
          <strong>{trailDef.label}:</strong> {trailDef.rule}
        </p>
      )}
      {lastUsed && <p key={lastUsed} className="alth-triumphs__used" role="status">{lastUsed}</p>}

      <h5 className="alth-triumphs__group">Triunfos da trilha</h5>
      {trailDef
        ? (
          <div className="alth-triumphs__grid">
            {initial.map((t) => (
              <RuneCard
                key={t.id}
                trailClass={t.trail}
                media={<span className="alth-rune__glyph" aria-hidden="true">{trailDef.glyph}</span>}
                name={t.name}
                cost={t.cost}
                test={t.test}
                description={t.description}
                chips={[
                  t.action ? TRIUMPH_ACTION_LABELS[t.action] : null,
                  t.range,
                  t.edited ? 'Editado' : null,
                ].filter((c): c is string => !!c)}
              >
                <button
                  type="button" className="alth-triumph__btn"
                  onClick={() => setEditingTrail(t)} disabled={disabled}
                >
                  Editar
                </button>
                {renderUseButton(t.name, t.cost)}
              </RuneCard>
            ))}
          </div>
        )
        : <p className="alth-triumphs__empty">Escolha a trilha para ver os 3 triunfos iniciais.</p>}

      <Presence show={editingTrail !== null} exitMs={220}>
        {() => editingTrail && trailDef && (
          <RuneEditorModal
            key={editingTrail.id}
            initial={trailTriumphAsRune(editingTrail)}
            trail={{ glyph: trailDef.glyph, trailClass: editingTrail.trail, edited: editingTrail.edited }}
            onCancel={() => setEditingTrail(null)}
            onRestore={() => {
              onTrailOverride(editingTrail.id, null)
              setEditingTrail(null)
            }}
            onSubmit={async (input) => {
              onTrailOverride(editingTrail.id, {
                name: input.name, description: input.description, cost: input.pr_cost,
                test: input.test, action: input.action, range: input.range,
              })
              setEditingTrail(null)
            }}
          />
        )}
      </Presence>

      <div className="alth-runes__discovered-head">
        <h5 className="alth-triumphs__group">Runas descobertas</h5>
        <button
          type="button" className="alth-triumph__btn alth-triumph__btn--add"
          onClick={() => setEditing('new')} disabled={disabled}
        >
          + Nova runa
        </button>
      </div>

      <Presence show={editing !== null} exitMs={220}>
        {() => editing !== null && (
          <RuneEditorModal
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new' ? undefined : editing}
            onCancel={() => setEditing(null)}
            onSubmit={async (input, image) => {
              if (editing === 'new') await onRuneCreate(input, image ?? null)
              else await onRuneUpdate(editing, input, image)
              setEditing(null)
            }}
          />
        )}
      </Presence>

      {runes.length === 0
        ? <p className="alth-triumphs__empty">Nenhuma runa descoberta ainda — explore Altherium.</p>
        : (
          <div className="alth-triumphs__grid">
            {runes.map((r) => (
                <RuneCard
                  key={r.id}
                  trailClass="descoberta"
                  media={r.image_url
                    ? <img src={r.image_url} alt="" loading="lazy" />
                    : <span className="alth-rune__glyph" aria-hidden="true">ᚱ</span>}
                  name={r.name}
                  cost={r.pr_cost}
                  test={r.test}
                  chips={[r.action ? TRIUMPH_ACTION_LABELS[r.action] : null, r.range].filter((c): c is string => !!c)}
                  description={r.description}
                >
                  {confirmDelete === r.id
                    ? (
                      <>
                        <button type="button" className="alth-triumph__btn" onClick={() => setConfirmDelete(null)}>
                          Cancelar
                        </button>
                        <button
                          type="button" className="alth-triumph__btn alth-triumph__btn--remove"
                          onClick={() => { setConfirmDelete(null); void onRuneDelete(r) }}
                        >
                          Confirmar exclusão
                        </button>
                      </>
                    )
                    : (
                      <>
                        <button
                          type="button" className="alth-triumph__btn alth-triumph__btn--remove"
                          onClick={() => setConfirmDelete(r.id)} disabled={disabled}
                        >
                          Excluir
                        </button>
                        <button
                          type="button" className="alth-triumph__btn"
                          onClick={() => setEditing(r)} disabled={disabled}
                        >
                          Editar
                        </button>
                        {renderUseButton(r.name, r.pr_cost)}
                      </>
                    )}
                </RuneCard>
            ))}
          </div>
        )}
    </section>
  )
}

// ────────────────────────────────────────────────────────

interface RuneCardProps {
  trailClass:  RunaskinTrail | 'descoberta'
  media:       ReactNode
  name:        string
  cost:        number
  test:        string | null
  description: string
  chips?:      string[]
  children:    ReactNode
}

function RuneCard({ trailClass, media, name, cost, test, description, chips, children }: RuneCardProps) {
  return (
    <article className={`alth-rune alth-rune--${trailClass}`}>
      <div className="alth-rune__media">{media}</div>
      <div className="alth-rune__body">
        <header className="alth-triumph__head">
          <h5 className="alth-triumph__name">{name}</h5>
          <span className="alth-triumph__cost">{cost} PR</span>
        </header>
        <p className="alth-rune__test">
          <span>Teste:</span> {test || 'Sem teste'}
        </p>
        {description && <p className="alth-triumph__desc">{description}</p>}
        {chips && chips.length > 0 && (
          <div className="alth-triumph__chips">
            {chips.map((c) => <span key={c} className="alth-triumph__chip">{c}</span>)}
          </div>
        )}
        <div className="alth-triumph__actions">{children}</div>
      </div>
    </article>
  )
}

// ────────────────────────────────────────────────────────
// Editor de runa — janela modal (ModalOverlay: portal, fundo embaçado,
// Esc/clique fora fecham menos enquanto salva). Fica fora do <form> da
// ficha no DOM, então Enter nos campos não salva a ficha (e é barrado de
// qualquer forma).
// ────────────────────────────────────────────────────────

interface RuneEditorProps {
  initial?: AltheriumRune
  /** Editando um triunfo inicial da trilha: sem foto (usa a runa da trilha). */
  trail?:     { glyph: string; trailClass: RunaskinTrail; edited: boolean }
  onSubmit: (input: AltheriumRuneInput, image: File | null | undefined) => Promise<void>
  onCancel: () => void
  /** Só na trilha: volta pra versão do livro. */
  onRestore?: () => void
}

function RuneEditorModal({ initial, trail, onSubmit, onCancel, onRestore }: RuneEditorProps) {
  const [name, setName]               = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [cost, setCost]               = useState(initial?.pr_cost ?? 1)
  const [test, setTest]               = useState(initial?.test ?? '')
  const [action, setAction]           = useState<TriumphAction | ''>(initial?.action ?? '')
  const [range, setRange]             = useState(initial?.range ?? '')
  // undefined = mantém a foto atual; null = sem foto; File = nova foto
  const [image, setImage]             = useState<File | null | undefined>(undefined)
  const [preview, setPreview]         = useState<string | null>(initial?.image_url ?? null)
  const [busy, setBusy]               = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!(image instanceof File)) return
    const url = URL.createObjectURL(image)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  useEffect(() => { nameRef.current?.focus() }, [])

  function handlePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!ALTHERIUM_PORTRAIT_TYPES.includes(file.type as (typeof ALTHERIUM_PORTRAIT_TYPES)[number])) {
      setError('Escolha uma imagem JPG, PNG ou WebP.')
      return
    }
    if (file.size > ALTHERIUM_PORTRAIT_MAX_BYTES) {
      setError('A imagem deve ter no máximo 2 MB.')
      return
    }
    setError(null)
    setImage(file)
  }

  function handleRemoveImage() {
    setImage(null)
    setPreview(null)
  }

  function blockEnter(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault()
  }

  async function handleSave() {
    if (!name.trim()) {
      setError(trail ? 'Dê um nome ao triunfo.' : 'Dê um nome à runa.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit(
        {
          name: name.trim(), description: description.trim(), pr_cost: cost, test: test.trim() || null,
          action: action || null, range: range || null,
        },
        image,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a runa.')
      setBusy(false)
    }
  }

  return (
    <ModalOverlay onClose={onCancel} closeDisabled={busy}>
      <div
        className={`alth-modal__window alth-rune alth-rune--${trail ? trail.trailClass : 'descoberta'} alth-rune--editing`}
        role="dialog" aria-modal="true" aria-labelledby="alth-rune-editor-title"
        onKeyDown={blockEnter}
      >
        <header className="alth-modal__header">
          <h4 id="alth-rune-editor-title" className="alth-modal__title">
            {trail ? 'Editar triunfo da trilha' : initial ? 'Editar runa' : 'Nova runa'}
          </h4>
          <button type="button" className="modal-close" onClick={onCancel} disabled={busy} aria-label="Fechar">
            ×
          </button>
        </header>
        {trail ? (
          <div className="alth-rune__media">
            <span className="alth-rune__glyph" aria-hidden="true">{trail.glyph}</span>
          </div>
        ) : (
          <label className="alth-rune__media alth-rune__media--pick">
            {preview
              ? <img src={preview} alt="" />
              : <span className="alth-rune__pick-hint">+ Foto</span>}
            <input
              type="file" hidden accept={ALTHERIUM_PORTRAIT_TYPES.join(',')}
              onChange={handlePick} disabled={busy} aria-label="Foto da runa"
            />
          </label>
        )}
        <div className="alth-rune__body">
          {!trail && preview && (
            <button type="button" className="alth-rune__remove-img" onClick={handleRemoveImage} disabled={busy}>
              Remover foto
            </button>
          )}
          <input
            ref={nameRef}
            type="text" className="input" placeholder={trail ? 'Nome do triunfo' : 'Nome da runa'} maxLength={80}
            value={name} onChange={(e) => setName(e.target.value)} disabled={busy} aria-label={trail ? 'Nome do triunfo' : 'Nome da runa'}
          />
          <div className="alth-rune__editor-row">
            <label className="alth-rune__editor-cost">
              <span className="label">PR</span>
              <input
                type="number" className="input" min={0} max={99}
                value={cost}
                onChange={(e) => setCost(Math.max(0, Math.min(99, parseInt(e.target.value, 10) || 0)))}
                disabled={busy}
              />
            </label>
            <label className="alth-rune__editor-test">
              <span className="label">Teste</span>
              <input
                type="text" className="input" maxLength={80}
                value={test} onChange={(e) => setTest(e.target.value)} disabled={busy}
              />
            </label>
          </div>
          <div className="alth-rune__editor-row">
            <label className="alth-rune__editor-half">
              <span className="label">Tipo de ação</span>
              <Select
                value={action}
                onChange={(v) => setAction(v as TriumphAction | '')} disabled={busy}
                aria-label="Tipo de ação"
                options={[
                  { value: '', label: '—' },
                  ...(Object.keys(TRIUMPH_ACTION_LABELS) as TriumphAction[]).map((a) => ({ value: a, label: TRIUMPH_ACTION_LABELS[a] })),
                ]}
              />
            </label>
            <label className="alth-rune__editor-half">
              <span className="label">Distância</span>
              <Select
                value={range} onChange={setRange} disabled={busy}
                aria-label="Distância"
                options={[
                  { value: '', label: '—' },
                  // Mantém uma distância antiga fora da lista, se houver.
                  ...(range && !(TRIUMPH_RANGES as readonly string[]).includes(range) ? [{ value: range, label: range }] : []),
                  ...TRIUMPH_RANGES.map((r) => ({ value: r, label: r })),
                ]}
              />
            </label>
          </div>
          <textarea
            className="input" rows={3} placeholder="Descrição" maxLength={1000}
            value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy}
            aria-label={trail ? 'Descrição do triunfo' : 'Descrição da runa'}
          />
          {trail && (
            <p className="alth-hint">
              A edição vale só para esta ficha.
              {trail.edited && onRestore && (
                <>
                  {' '}
                  <button type="button" className="alth-rune__restore" onClick={onRestore} disabled={busy}>
                    Restaurar o original do livro
                  </button>
                </>
              )}
            </p>
          )}
          {error && <p className="alth-triumphs__warn" role="alert">{error}</p>}
          <div className="alth-triumph__actions">
            <button type="button" className="alth-triumph__btn" onClick={onCancel} disabled={busy}>
              Cancelar
            </button>
            <button type="button" className="alth-triumph__btn alth-triumph__btn--add" onClick={() => void handleSave()} disabled={busy}>
              {busy ? 'Salvando...' : trail ? 'Salvar triunfo' : 'Salvar runa'}
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}
