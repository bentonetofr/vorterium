import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getCampaignTdSheets,
  getOrCreateMyTdSheet,
  subscribeToCampaignTdSheets,
  updateTdSheet,
  type TdSheetUpdate,
} from '../services/tdSheetService'
import { TdSheetForm } from './TdSheetForm'
import { CONVICTION_MAX, HORROR_MAX } from '../constants/terraDevastada'
import { horrorBand } from '../utils/tdRules'
import type { TdSheet, TdSheetWithProfile } from '../../../../shared/types'
import '../../components/SheetPanel.css'
import './TerraDevastadaSheet.css'

interface TdSheetPanelProps {
  campaignId: string
  userRole:   'master' | 'player'
}

export function TdSheetPanel({ campaignId, userRole }: TdSheetPanelProps) {
  return (
    <section className="sheet-panel">
      <header className="sheet-panel__header">
        <div className="sheet-panel__title-row">
          <span className="sheet-panel__icon" aria-hidden="true">☣</span>
          <h3 className="sheet-panel__title">Ficha Terra Devastada</h3>
        </div>
      </header>

      <div className="sheet-panel__body">
        {userRole === 'player'
          ? <PlayerView campaignId={campaignId} />
          : <MasterView campaignId={campaignId} />
        }
      </div>
    </section>
  )
}

// ── Edição (jogador e mestre) ───────────────────────────

interface SheetEditorProps {
  sheet:          TdSheet
  ownerName?:     string
  onSheetUpdated: (sheet: TdSheet) => void
}

function SheetEditor({ sheet, ownerName, onSheetUpdated }: SheetEditorProps) {
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handleSave(data: TdSheetUpdate) {
    setSaveError(null)
    try {
      onSheetUpdated(await updateTdSheet(sheet.id, data))
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Não foi possível salvar a ficha.')
      throw err
    }
  }

  return <TdSheetForm key={sheet.id} sheet={sheet} ownerName={ownerName} onSave={handleSave} saveError={saveError} />
}

// ── Jogador — própria ficha ─────────────────────────────

function PlayerView({ campaignId }: { campaignId: string }) {
  const [sheet, setSheet]     = useState<TdSheet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getOrCreateMyTdSheet(campaignId)
      .then((data) => { if (!cancelled) { setSheet(data); setError(null) } })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Não foi possível carregar a ficha.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [campaignId])

  if (loading) {
    return (
      <div className="sheet-loading">
        <div className="spinner spinner--sm" />
        <span>Carregando ficha...</span>
      </div>
    )
  }
  if (error) return <div className="sheet-feedback sheet-feedback--error" role="alert">{error}</div>
  if (!sheet) return null

  return <SheetEditor sheet={sheet} onSheetUpdated={setSheet} />
}

// ── Mestre — cards de resumo + ficha selecionada ────────

function MasterView({ campaignId }: { campaignId: string }) {
  const [sheets, setSheets]   = useState<TdSheetWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  // Cópia tirada ao selecionar (ver MasterAltheriumView): os cards seguem o
  // Realtime; o editor só muda com os saves do próprio mestre.
  const [editing, setEditing] = useState<TdSheetWithProfile | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editing || !window.matchMedia('(max-width: 768px)').matches) return
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [editing?.id])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      setSheets(await getCampaignTdSheets(campaignId))
      setError(null)
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Não foi possível carregar as fichas.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [campaignId])

  useEffect(() => { load() }, [load])

  useEffect(() => subscribeToCampaignTdSheets(
    campaignId,
    (updated) => setSheets((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))),
    () => { void load(true) },
  ), [campaignId, load])

  function handleSheetUpdated(updated: TdSheet) {
    setSheets((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)))
    setEditing((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev))
  }

  if (loading) {
    return (
      <div className="sheet-loading">
        <div className="spinner spinner--sm" />
        <span>Carregando fichas...</span>
      </div>
    )
  }
  if (error) return <div className="sheet-feedback sheet-feedback--error" role="alert">{error}</div>
  if (sheets.length === 0) return <p className="sheet-empty">Nenhum jogador criou ficha de Terra Devastada ainda.</p>

  const latest = editing ? sheets.find((s) => s.id === editing.id) ?? null : null
  const outdated = !!(latest && editing && Date.parse(latest.updated_at) > Date.parse(editing.updated_at))

  return (
    <div className="sheets-list-wrapper">
      <div className="sheets-cards anim-stagger">
        {sheets.map((s) => {
          const ownerLabel = s.profile?.display_name ?? 'Jogador removido'
          const band = horrorBand(s.horror)
          return (
            <button
              key={s.id}
              className={`sheet-card ${editing?.id === s.id ? 'sheet-card--active' : ''}`}
              onClick={() => setEditing(s)}
              aria-pressed={editing?.id === s.id}
            >
              <div className="sheet-card__top">
                <span className="sheet-card__avatar" aria-hidden="true">{ownerLabel.charAt(0).toUpperCase()}</span>
                <span className="sheet-card__player">{ownerLabel}</span>
              </div>

              <span className="sheet-card__char">
                {s.character_name ? <strong>{s.character_name}</strong> : 'Sem nome'}
                {s.concept ? ` · ${s.concept}` : ''}
              </span>

              <div className="sheet-card__bars">
                <CardBar sigla="Horror" tone="vitality" current={s.horror} max={HORROR_MAX} note={band.title} />
                <CardBar sigla="Convicção" tone="resource" current={s.conviction} max={CONVICTION_MAX} />
              </div>

              {s.conditions.length > 0 && (
                <span className="td-card-conditions">
                  {s.conditions.slice(0, 4).map((c) => c.name).join(' · ')}
                  {s.conditions.length > 4 ? ` · +${s.conditions.length - 4}` : ''}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {editing ? (
        <div className="sheets-list__form" ref={formRef}>
          {outdated && latest && (
            <div className="sheet-outdated" role="status">
              <span>O jogador atualizou a ficha — recarregar?</span>
              <button type="button" className="btn btn-ghost sheet-outdated__btn" onClick={() => setEditing(latest)}>
                Recarregar
              </button>
            </div>
          )}
          <div key={editing.id} className="anim-page">
            <SheetEditor
              sheet={editing}
              ownerName={editing.profile?.display_name ?? 'Jogador removido'}
              onSheetUpdated={handleSheetUpdated}
            />
          </div>
        </div>
      ) : (
        <p className="sheet-empty sheet-empty--hint">Selecione um jogador acima para ver e editar a ficha.</p>
      )}
    </div>
  )
}

interface CardBarProps {
  sigla:   string
  tone:    'vitality' | 'resource'
  current: number
  max:     number
  note?:   string
}

function CardBar({ sigla, tone, current, max, note }: CardBarProps) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100))
  return (
    <div className={`sheet-card__bar sheet-card__bar--${tone}`}>
      <div className="sheet-card__bar-top">
        <span className="sheet-card__bar-sigla">{sigla}{note ? ` · ${note}` : ''}</span>
        <span key={`${current}/${max}`} className="sheet-card__bar-values anim-bump">{current} / {max}</span>
      </div>
      <div className="sheet-card__bar-track">
        <div className="sheet-card__bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
