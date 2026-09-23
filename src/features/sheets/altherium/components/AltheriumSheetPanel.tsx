import { useCallback, useEffect, useState } from 'react'
import {
  getOrCreateMyAltheriumSheet,
  getCampaignAltheriumSheets,
  getAltheriumDomains,
  setAltheriumDomainPoints,
  updateAltheriumSheet,
  type AltheriumSheetUpdate,
} from '../services/altheriumSheetService'
import { AltheriumSheetForm } from './AltheriumSheetForm'
import { RAIZES } from '../constants/altherium'
import type {
  AltheriumSheet,
  AltheriumDomainPoints,
  AltheriumSheetWithProfile,
} from '../../../../shared/types'
import '../../components/SheetPanel.css'
import './AltheriumSheet.css'

interface AltheriumSheetPanelProps {
  campaignId: string
  userRole:   'master' | 'player'
}

export function AltheriumSheetPanel({ campaignId, userRole }: AltheriumSheetPanelProps) {
  return (
    <section className="sheet-panel">
      <header className="sheet-panel__header">
        <div className="sheet-panel__title-row">
          <span className="sheet-panel__icon" aria-hidden="true">✦</span>
          <h3 className="sheet-panel__title">Ficha Altherium</h3>
        </div>
      </header>

      <div className="sheet-panel__body">
        {userRole === 'player'
          ? <PlayerAltheriumView campaignId={campaignId} />
          : <MasterAltheriumView campaignId={campaignId} />
        }
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────
// Edição de uma ficha (compartilhada entre jogador e mestre)
// ────────────────────────────────────────────────────────

interface SheetEditorProps {
  sheet:      AltheriumSheet
  ownerName?: string
  onSheetUpdated: (sheet: AltheriumSheet) => void
}

function SheetEditor({ sheet, ownerName, onSheetUpdated }: SheetEditorProps) {
  const [domains, setDomains]         = useState<AltheriumDomainPoints[]>([])
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const loadDomains = useCallback(() => {
    getAltheriumDomains(sheet.id).then(setDomains).catch(() => { /* domínios só não aparecem */ })
  }, [sheet.id])

  useEffect(() => { loadDomains() }, [loadDomains])

  async function handleSave(data: AltheriumSheetUpdate) {
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const updated = await updateAltheriumSheet(sheet.id, data)
      onSheetUpdated(updated)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Não foi possível salvar a ficha.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDomainChange(domain: string, points: number) {
    setSaveError(null)
    try {
      await setAltheriumDomainPoints(sheet.id, domain, points)
      loadDomains()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Não foi possível salvar o domínio.')
    }
  }

  return (
    <AltheriumSheetForm
      key={sheet.id}
      sheet={sheet}
      domains={domains}
      ownerName={ownerName}
      onSave={handleSave}
      onDomainChange={handleDomainChange}
      saving={saving}
      saveError={saveError}
      saveSuccess={saveSuccess}
    />
  )
}

// ────────────────────────────────────────────────────────
// Jogador — própria ficha
// ────────────────────────────────────────────────────────

function PlayerAltheriumView({ campaignId }: { campaignId: string }) {
  const [sheet, setSheet]     = useState<AltheriumSheet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await getOrCreateMyAltheriumSheet(campaignId)
        if (cancelled) return
        setSheet(data)
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Não foi possível carregar a ficha.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
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

// ────────────────────────────────────────────────────────
// Mestre — cards de resumo + ficha selecionada
// ────────────────────────────────────────────────────────

function MasterAltheriumView({ campaignId }: { campaignId: string }) {
  const [sheets, setSheets]     = useState<AltheriumSheetWithProfile[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getCampaignAltheriumSheets(campaignId)
      setSheets(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as fichas.')
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => { load() }, [load])

  function handleSheetUpdated(updated: AltheriumSheet) {
    setSheets((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)))
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

  if (sheets.length === 0) {
    return <p className="sheet-empty">Nenhum jogador criou ficha de Altherium ainda.</p>
  }

  const selected = sheets.find((s) => s.id === selectedId) ?? null

  return (
    <div className="sheets-list-wrapper">
      <div className="sheets-cards">
        {sheets.map((s) => {
          const raizLabel = s.raiz ? RAIZES.find((r) => r.id === s.raiz)?.label ?? '—' : 'Sem raiz'
          // profile vem null quando o dono não é mais membro da campanha
          // (RLS de profiles exige co-membro atual) — a ficha continua existindo.
          const ownerLabel = s.profile?.display_name ?? 'Jogador removido'
          return (
            <button
              key={s.id}
              className={`sheet-card ${selectedId === s.id ? 'sheet-card--active' : ''}`}
              onClick={() => setSelectedId(s.id)}
              aria-pressed={selectedId === s.id}
            >
              <div className="sheet-card__top">
                <span className="sheet-card__avatar">
                  {ownerLabel.charAt(0).toUpperCase()}
                </span>
                <span className="sheet-card__player">{ownerLabel}</span>
              </div>

              <span className="sheet-card__char">
                {s.character_name
                  ? <><strong>{s.character_name}</strong>{` · ${raizLabel}`}</>
                  : `Sem nome · ${raizLabel}`
                }
              </span>

              <div className="sheet-card__meta">
                <span className="sheet-card__level">Nv {s.level}</span>
                <span>
                  {s.vitality_current}<span className="text-muted">/{s.vitality_max} PV</span>
                </span>
              </div>

              <div className="sheet-card__meta">
                <span className="sheet-card__level">Equilíbrio</span>
                <span>
                  {s.equilibrio_current}<span className="text-muted">/{s.equilibrio_max}</span>
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {selected ? (
        <div className="sheets-list__form">
          <SheetEditor
            sheet={selected}
            ownerName={selected.profile?.display_name ?? 'Jogador removido'}
            onSheetUpdated={handleSheetUpdated}
          />
        </div>
      ) : (
        <p className="sheet-empty sheet-empty--hint">
          Selecione um jogador acima para ver e editar a ficha.
        </p>
      )}
    </div>
  )
}
