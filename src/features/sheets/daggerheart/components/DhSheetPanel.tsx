import { useCallback, useEffect, useRef, useState } from 'react'
import { useFeature } from '../../../control/siteFeatures'
import { DH_FEATURE, DH_CLASS_LABELS } from '../constants/daggerheart'
import {
  createMyDhSheet,
  getDhSheetsByCampaign,
  getMyFullDhSheet,
  updateDhSheet,
} from '../services/dhSheetService'
import type { DhCharacterSheet, DhFullSheet, DhSheetUpdateInput } from '../rules/types'
import { DhSheetForm } from './DhSheetForm'
import { Loader } from '../../../../shared/components/Loader'
import '../../components/SheetPanel.css'
import './DaggerheartSheet.css'

// ────────────────────────────────────────────────────────
// Painel de ficha DaggerHeart: jogador edita a sua; mestre vê cards da mesa.
// ────────────────────────────────────────────────────────

interface DhSheetPanelProps {
  campaignId: string
  userRole:   'master' | 'player'
}

export function DhSheetPanel({ campaignId, userRole }: DhSheetPanelProps) {
  const feature = useFeature(DH_FEATURE)
  return (
    <section className="sheet-panel">
      <header className="sheet-panel__header">
        <div className="sheet-panel__title-row">
          <span className="sheet-panel__icon" aria-hidden="true">⚄</span>
          <h3 className="sheet-panel__title">Ficha DaggerHeart</h3>
        </div>
      </header>
      <div className="sheet-panel__body">
        {!feature.visible
          ? <p className="sheet-empty">A ficha de DaggerHeart ainda não foi liberada. Volte em breve.</p>
          : userRole === 'player'
            ? <PlayerView campaignId={campaignId} />
            : <MasterView campaignId={campaignId} />
        }
      </div>
    </section>
  )
}

// ── Jogador ────────────────────────────────────────────

function PlayerView({ campaignId }: { campaignId: string }) {
  const [full, setFull]       = useState<DhFullSheet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const existing = await getMyFullDhSheet(campaignId)
        const result   = existing ?? await createMyDhSheet(campaignId)
        if (!cancelled) { setFull(result); setError(null) }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Não foi possível carregar a ficha.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [campaignId])

  if (loading) return <div className="sheet-loading"><Loader small /></div>
  if (error)   return <div className="sheet-feedback sheet-feedback--error" role="alert">{error}</div>
  if (!full)   return null
  return (
    <SheetEditor full={full} onSheetUpdated={(sheet) => setFull((prev) => prev ? { ...prev, sheet } : prev)} />
  )
}

// ── Mestre ─────────────────────────────────────────────

type SheetWithName = DhCharacterSheet & { playerName?: string }

function MasterView({ campaignId }: { campaignId: string }) {
  const [sheets, setSheets]   = useState<SheetWithName[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [editing, setEditing] = useState<SheetWithName | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editing || !window.matchMedia('(max-width: 768px)').matches) return
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [editing?.id])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      setSheets(await getDhSheetsByCampaign(campaignId))
      setError(null)
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Não foi possível carregar as fichas.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [campaignId])

  useEffect(() => { void load() }, [load])

  function handleSheetUpdated(sheet: DhCharacterSheet) {
    setSheets((prev) => prev.map((s) => s.id === sheet.id ? { ...s, ...sheet } : s))
    setEditing((prev) => prev?.id === sheet.id ? { ...prev, ...sheet } : prev)
  }

  if (loading) return <div className="sheet-loading"><Loader small /></div>
  if (error)   return <div className="sheet-feedback sheet-feedback--error" role="alert">{error}</div>
  if (sheets.length === 0) return <p className="sheet-empty">Nenhum jogador criou ficha de DaggerHeart ainda.</p>

  return (
    <div className="sheets-list-wrapper">
      <div className="sheets-cards anim-stagger">
        {sheets.map((s) => {
          const hpPct = s.hp_max > 0 ? Math.round((s.hp_current / s.hp_max) * 100) : 0
          const stressPct = s.stress_max > 0 ? Math.round((s.stress_current / s.stress_max) * 100) : 0
          const cls = DH_CLASS_LABELS[s.class_key] ?? s.class_key
          return (
            <button
              key={s.id} type="button"
              className={`sheet-card ${editing?.id === s.id ? 'sheet-card--active' : ''}`}
              onClick={() => setEditing(s)} aria-pressed={editing?.id === s.id}
            >
              <div className="sheet-card__top">
                <span className="sheet-card__avatar">{(s.character_name ?? '?').charAt(0).toUpperCase()}</span>
                <span className="sheet-card__player">{s.character_name ?? 'Sem nome'}</span>
              </div>
              <span className="sheet-card__char">{cls} · Nível {s.level}</span>
              <div className="sheet-card__bars">
                <DhCardBar sigla="PV" current={s.hp_current} max={s.hp_max} pct={hpPct} tone="vitality" />
                <DhCardBar sigla="Estresse" current={s.stress_current} max={s.stress_max} pct={stressPct} tone="hunger" />
              </div>
            </button>
          )
        })}
      </div>

      {editing ? (
        <div className="sheets-list__form" ref={formRef}>
          <SheetEditor
            full={{ sheet: editing, experiences: [], cards: [], weapons: [], inventory: [] }}
            ownerName={editing.character_name ?? 'Personagem'}
            onSheetUpdated={handleSheetUpdated}
          />
        </div>
      ) : (
        <p className="sheet-empty sheet-empty--hint">Selecione um jogador acima para ver e editar a ficha.</p>
      )}
    </div>
  )
}

// ── Editor ─────────────────────────────────────────────

interface SheetEditorProps {
  full:           DhFullSheet
  ownerName?:     string
  onSheetUpdated: (sheet: DhCharacterSheet) => void
}

function SheetEditor({ full, ownerName, onSheetUpdated }: SheetEditorProps) {
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handleSave(patch: DhSheetUpdateInput) {
    setSaveError(null)
    try {
      onSheetUpdated(await updateDhSheet(full.sheet.id, patch))
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Não foi possível salvar a ficha.')
      throw err
    }
  }

  return (
    <DhSheetForm
      key={full.sheet.id}
      full={full}
      ownerName={ownerName}
      onSave={handleSave}
      saveError={saveError}
    />
  )
}

// ── Barrinha de card ────────────────────────────────────

function DhCardBar({ sigla, current, max, pct, tone }: {
  sigla: string; current: number; max: number; pct: number; tone: string
}) {
  return (
    <div className={`sheet-card__bar sheet-card__bar--${tone === 'hunger' ? 'vitality' : tone}`}
      style={{ '--bar-color': tone === 'hunger' ? '#e6916e' : undefined } as React.CSSProperties}>
      <div className="sheet-card__bar-top">
        <span className="sheet-card__bar-sigla">{sigla}</span>
        <span className="sheet-card__bar-values">{current} / {max}</span>
      </div>
      <div className="sheet-card__bar-track">
        <div className="sheet-card__bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
