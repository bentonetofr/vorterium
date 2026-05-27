import { useCallback, useEffect, useState } from 'react'
import {
  getOrCreateMySheet,
  isSheetFilled,
  updateSheet,
  type SheetUpdateData,
} from '../services/sheetService'
import { SimpleSheetForm } from './SimpleSheetForm'
import { CampaignSheetsList } from './CampaignSheetsList'
import type { CharacterSheet } from '../../../shared/types'
import './SheetPanel.css'

// ────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────

interface SimpleSheetPanelProps {
  campaignId: string
  userRole: 'master' | 'player'
}

// ────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────

export function SimpleSheetPanel({ campaignId, userRole }: SimpleSheetPanelProps) {
  // Apenas para o jogador — rastreamos a ficha para mostrar badge no cabeçalho
  const [playerSheet, setPlayerSheet] = useState<CharacterSheet | null>(null)

  const filled  = playerSheet ? isSheetFilled(playerSheet) : null

  return (
    <section className="sheet-panel">
      <header className="sheet-panel__header">
        <div className="sheet-panel__title-row">
          <span className="sheet-panel__icon" aria-hidden="true">◉</span>
          <h3 className="sheet-panel__title">Ficha Simples</h3>
          {userRole === 'player' && filled !== null && (
            <span className={`sheet-filled-badge ${filled ? 'sheet-filled-badge--filled' : 'sheet-filled-badge--empty'}`}>
              {filled ? 'Preenchida' : 'Não preenchida'}
            </span>
          )}
        </div>
      </header>

      <div className="sheet-panel__body">
        {userRole === 'player'
          ? (
            <PlayerSheetView
              campaignId={campaignId}
              onSheetChange={setPlayerSheet}
            />
          )
          : <CampaignSheetsList campaignId={campaignId} />
        }
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────
// Vista do jogador — carrega ou cria própria ficha
// ────────────────────────────────────────────────────────

interface PlayerSheetViewProps {
  campaignId: string
  onSheetChange: (sheet: CharacterSheet | null) => void
}

function PlayerSheetView({ campaignId, onSheetChange }: PlayerSheetViewProps) {
  const [sheet, setSheet]             = useState<CharacterSheet | null>(null)
  const [loading, setLoading]         = useState(true)
  const [loadError, setLoadError]     = useState<string | null>(null)
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  function applySheet(s: CharacterSheet | null) {
    setSheet(s)
    onSheetChange(s)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await getOrCreateMySheet(campaignId)
      applySheet(data)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar a ficha.')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId])

  useEffect(() => { load() }, [load])

  async function handleSave(data: SheetUpdateData) {
    if (!sheet) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const updated = await updateSheet(sheet.id, data)
      applySheet(updated)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Não foi possível salvar a ficha.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="sheet-loading">
        <div className="spinner spinner--sm" />
        <span>Carregando ficha...</span>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="sheet-feedback sheet-feedback--error" role="alert">
        {loadError}
      </div>
    )
  }

  if (!sheet) return null

  return (
    <SimpleSheetForm
      sheet={sheet}
      onSave={handleSave}
      saving={saving}
      saveError={saveError}
      saveSuccess={saveSuccess}
    />
  )
}
