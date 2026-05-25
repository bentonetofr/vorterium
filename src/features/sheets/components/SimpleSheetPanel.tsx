import { useCallback, useEffect, useState } from 'react'
import {
  getOrCreateMySheet,
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
  return (
    <section className="sheet-panel">
      <header className="sheet-panel__header">
        <div className="sheet-panel__title-row">
          <span className="sheet-panel__icon" aria-hidden="true">◉</span>
          <h3 className="sheet-panel__title">Ficha Simples</h3>
        </div>
      </header>

      <div className="sheet-panel__body">
        {userRole === 'player'
          ? <PlayerSheetView campaignId={campaignId} />
          : <CampaignSheetsList campaignId={campaignId} />
        }
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────
// Vista do jogador — carrega ou cria própria ficha
// ────────────────────────────────────────────────────────

function PlayerSheetView({ campaignId }: { campaignId: string }) {
  const [sheet, setSheet]           = useState<CharacterSheet | null>(null)
  const [loading, setLoading]       = useState(true)
  const [loadError, setLoadError]   = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await getOrCreateMySheet(campaignId)
      setSheet(data)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar a ficha.')
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => { load() }, [load])

  async function handleSave(data: SheetUpdateData) {
    if (!sheet) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const updated = await updateSheet(sheet.id, data)
      setSheet(updated)
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
