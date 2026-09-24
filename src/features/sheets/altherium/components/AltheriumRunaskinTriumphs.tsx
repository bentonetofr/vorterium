import { useEffect, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react'
import {
  RUNASKIN_TRAILS,
  RUNASKIN_TRIUMPHS,
  TRIUMPH_ACTION_LABELS,
  type RunaskinTrail,
} from '../constants/altheriumTriumphs'
import {
  ALTHERIUM_PORTRAIT_MAX_BYTES,
  ALTHERIUM_PORTRAIT_TYPES,
  type AltheriumRuneInput,
} from '../services/altheriumSheetService'
import type { AltheriumRune } from '../../../../shared/types'

// ────────────────────────────────────────────────────────
// Triunfos do Runaskin — trilha (3 iniciais do livro) + runas
// descobertas (criadas na ficha, com foto). Cada "Usar" desconta o PR e
// conta um uso na cena, até o NR; "Nova cena" zera o contador. PR e
// contador persistem com "Salvar ficha"; runas salvam na hora.
// ────────────────────────────────────────────────────────

interface AltheriumRunaskinTriumphsProps {
  trail:         RunaskinTrail | null
  onTrailChange: (trail: RunaskinTrail | null) => void
  sceneUses:     number
  usesLimit:     number | null
  onNewScene:    () => void
  prCurrent:     number
  onUse:         (cost: number) => void
  runes:         AltheriumRune[]
  onRuneCreate:  (input: AltheriumRuneInput, image: File | null) => Promise<void>
  onRuneUpdate:  (rune: AltheriumRune, input: AltheriumRuneInput, image: File | null | undefined) => Promise<void>
  onRuneDelete:  (rune: AltheriumRune) => Promise<void>
  disabled:      boolean
}

export function AltheriumRunaskinTriumphs({
  trail, onTrailChange, sceneUses, usesLimit, onNewScene, prCurrent, onUse,
  runes, onRuneCreate, onRuneUpdate, onRuneDelete, disabled,
}: AltheriumRunaskinTriumphsProps) {
  const [editing, setEditing]           = useState<AltheriumRune | 'new' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [lastUsed, setLastUsed]         = useState<string | null>(null)

  const trailDef   = RUNASKIN_TRAILS.find((t) => t.id === trail) ?? null
  const initial    = RUNASKIN_TRIUMPHS.filter((t) => t.trail === trail)
  const limitHit   = usesLimit != null && sceneUses >= usesLimit

  function renderUseButton(name: string, cost: number) {
    const noPr = prCurrent < cost
    return (
      <button
        type="button" className="alth-triumph__btn alth-triumph__btn--use"
        disabled={disabled || noPr || limitHit}
        title={limitHit ? 'Limite de usos da cena (NR) atingido' : noPr ? 'PR insuficiente' : undefined}
        onClick={() => {
          onUse(cost)
          setLastUsed(`${name} usado — −${cost} PR. Salve a ficha para registrar.`)
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
          <select
            className="input" value={trail ?? ''}
            onChange={(e) => onTrailChange((e.target.value || null) as RunaskinTrail | null)}
            disabled={disabled}
          >
            <option value="">—</option>
            {RUNASKIN_TRAILS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
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
        {usesLimit == null && ' Preencha o d10 do PR na Visão Geral pra calcular.'}
      </p>

      {trailDef && (
        <p className={`alth-runes__rule alth-runes__rule--${trailDef.id}`}>
          <strong>{trailDef.label}:</strong> {trailDef.rule}
        </p>
      )}
      {lastUsed && <p className="alth-triumphs__used" role="status">{lastUsed}</p>}

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
                chips={[TRIUMPH_ACTION_LABELS[t.action], t.range]}
              >
                {renderUseButton(t.name, t.cost)}
              </RuneCard>
            ))}
          </div>
        )
        : <p className="alth-triumphs__empty">Escolha a trilha para ver os 3 triunfos iniciais.</p>}

      <div className="alth-runes__discovered-head">
        <h5 className="alth-triumphs__group">Runas descobertas</h5>
        {editing === null && (
          <button
            type="button" className="alth-triumph__btn alth-triumph__btn--add"
            onClick={() => setEditing('new')} disabled={disabled}
          >
            + Nova runa
          </button>
        )}
      </div>

      {editing === 'new' && (
        <RuneEditor
          onCancel={() => setEditing(null)}
          onSubmit={async (input, image) => {
            await onRuneCreate(input, image ?? null)
            setEditing(null)
          }}
        />
      )}

      {runes.length === 0 && editing !== 'new'
        ? <p className="alth-triumphs__empty">Nenhuma runa descoberta ainda — explore Altherium.</p>
        : (
          <div className="alth-triumphs__grid">
            {runes.map((r) => (editing !== 'new' && editing?.id === r.id
              ? (
                <RuneEditor
                  key={r.id}
                  initial={r}
                  onCancel={() => setEditing(null)}
                  onSubmit={async (input, image) => {
                    await onRuneUpdate(r, input, image)
                    setEditing(null)
                  }}
                />
              )
              : (
                <RuneCard
                  key={r.id}
                  trailClass="descoberta"
                  media={r.image_url
                    ? <img src={r.image_url} alt="" loading="lazy" />
                    : <span className="alth-rune__glyph" aria-hidden="true">ᚱ</span>}
                  name={r.name}
                  cost={r.pr_cost}
                  test={r.test}
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
                          onClick={() => setEditing(r)} disabled={disabled || editing !== null}
                        >
                          Editar
                        </button>
                        {renderUseButton(r.name, r.pr_cost)}
                      </>
                    )}
                </RuneCard>
              )))}
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
// Editor de runa — não é um <form> (já estamos dentro do form da ficha);
// Enter nos campos de uma linha é barrado pra não salvar a ficha inteira.
// ────────────────────────────────────────────────────────

interface RuneEditorProps {
  initial?: AltheriumRune
  onSubmit: (input: AltheriumRuneInput, image: File | null | undefined) => Promise<void>
  onCancel: () => void
}

function RuneEditor({ initial, onSubmit, onCancel }: RuneEditorProps) {
  const [name, setName]               = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [cost, setCost]               = useState(initial?.pr_cost ?? 1)
  const [test, setTest]               = useState(initial?.test ?? '')
  // undefined = mantém a foto atual; null = sem foto; File = nova foto
  const [image, setImage]             = useState<File | null | undefined>(undefined)
  const [preview, setPreview]         = useState<string | null>(initial?.image_url ?? null)
  const [busy, setBusy]               = useState(false)
  const [error, setError]             = useState<string | null>(null)

  useEffect(() => {
    if (!(image instanceof File)) return
    const url = URL.createObjectURL(image)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

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
      setError('Dê um nome à runa.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit(
        { name: name.trim(), description: description.trim(), pr_cost: cost, test: test.trim() || null },
        image,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a runa.')
      setBusy(false)
    }
  }

  return (
    <div className="alth-rune alth-rune--descoberta alth-rune--editing" onKeyDown={blockEnter}>
      <label className="alth-rune__media alth-rune__media--pick">
        {preview
          ? <img src={preview} alt="" />
          : <span className="alth-rune__pick-hint">+ Foto</span>}
        <input
          type="file" hidden accept={ALTHERIUM_PORTRAIT_TYPES.join(',')}
          onChange={handlePick} disabled={busy} aria-label="Foto da runa"
        />
      </label>
      <div className="alth-rune__body">
        {preview && (
          <button type="button" className="alth-rune__remove-img" onClick={handleRemoveImage} disabled={busy}>
            Remover foto
          </button>
        )}
        <input
          type="text" className="input" placeholder="Nome da runa" maxLength={80}
          value={name} onChange={(e) => setName(e.target.value)} disabled={busy} aria-label="Nome da runa"
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
              type="text" className="input" placeholder="Ex.: Luta com Rúnico" maxLength={80}
              value={test} onChange={(e) => setTest(e.target.value)} disabled={busy}
            />
          </label>
        </div>
        <textarea
          className="input" rows={3} placeholder="Descrição" maxLength={1000}
          value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy}
          aria-label="Descrição da runa"
        />
        {error && <p className="alth-triumphs__warn" role="alert">{error}</p>}
        <div className="alth-triumph__actions">
          <button type="button" className="alth-triumph__btn" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="alth-triumph__btn alth-triumph__btn--add" onClick={() => void handleSave()} disabled={busy}>
            {busy ? 'Salvando...' : 'Salvar runa'}
          </button>
        </div>
      </div>
    </div>
  )
}
