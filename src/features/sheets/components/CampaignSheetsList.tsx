import { useCallback, useEffect, useState } from 'react'
import {
  getCampaignSheets,
  isSheetFilled,
  updateSheet,
  type SheetUpdateData,
} from '../services/sheetService'
import { SimpleSheetForm } from './SimpleSheetForm'
import type { SheetWithProfile } from '../../../shared/types'

// ────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────

interface CampaignSheetsListProps {
  campaignId: string
}

// ────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────

export function CampaignSheetsList({ campaignId }: CampaignSheetsListProps) {
  const [sheets, setSheets]           = useState<SheetWithProfile[]>([])
  const [loading, setLoading]         = useState(true)
  const [listError, setListError]     = useState<string | null>(null)
  const [selected, setSelected]       = useState<SheetWithProfile | null>(null)
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setListError(null)
    try {
      const data = await getCampaignSheets(campaignId)
      setSheets(data)
      // Mantém a seleção atual se ainda existir
      if (selected) {
        const updated = data.find((s) => s.id === selected.id)
        if (updated) setSelected(updated)
      }
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Erro ao carregar fichas.')
    } finally {
      setLoading(false)
    }
  // `selected` é intencionalmente excluído das deps
  }, [campaignId])

  useEffect(() => { load() }, [load])

  async function handleSave(data: SheetUpdateData) {
    if (!selected) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const updated = await updateSheet(selected.id, data)
      const withProfile = { ...updated, profile: selected.profile }
      setSelected(withProfile)
      setSheets((prev) => prev.map((s) => (s.id === updated.id ? withProfile : s)))
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Não foi possível salvar a ficha.')
    } finally {
      setSaving(false)
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="sheet-loading">
        <div className="spinner spinner--sm" />
        <span>Carregando fichas...</span>
      </div>
    )
  }

  // ── Erro ──
  if (listError) {
    return (
      <div className="sheet-feedback sheet-feedback--error" role="alert">
        {listError}
      </div>
    )
  }

  // ── Sem fichas ──
  if (sheets.length === 0) {
    return (
      <p className="sheet-empty">
        Nenhum jogador criou ficha ainda.
      </p>
    )
  }

  return (
    <div className="sheets-list-wrapper">
      {/* ── Cards de resumo, um por jogador ── */}
      <div className="sheets-cards">
        {sheets.map((sheet) => {
          const isSelected = selected?.id === sheet.id
          const filled     = isSheetFilled(sheet)

          return (
            <button
              key={sheet.id}
              className={`sheet-card ${isSelected ? 'sheet-card--active' : ''}`}
              onClick={() => {
                setSelected(sheet)
                setSaveError(null)
                setSaveSuccess(false)
              }}
              aria-pressed={isSelected}
            >
              <div className="sheet-card__top">
                <span className="sheet-card__avatar">
                  {sheet.profile.display_name.charAt(0).toUpperCase()}
                </span>
                <span className="sheet-card__player">{sheet.profile.display_name}</span>
              </div>

              <span className="sheet-card__char">
                {sheet.character_name
                  ? <>
                      <strong>{sheet.character_name}</strong>
                      {sheet.archetype ? ` · ${sheet.archetype}` : ''}
                    </>
                  : 'Sem nome'
                }
              </span>

              <div className="sheet-card__meta">
                <span className="sheet-card__level">Nv {sheet.level}</span>
                <span>
                  {sheet.hp_current}<span className="text-muted">/{sheet.hp_max} PV</span>
                </span>
              </div>

              <span className={`sheet-filled-badge sheet-filled-badge--sm ${filled ? 'sheet-filled-badge--filled' : 'sheet-filled-badge--empty'}`}>
                {filled ? 'Preenchida' : 'Não preenchida'}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Ficha selecionada ── */}
      {selected ? (
        <div className="sheets-list__form">
          <SimpleSheetForm
            key={selected.id}
            sheet={selected}
            ownerName={selected.profile.display_name}
            onSave={handleSave}
            saving={saving}
            saveError={saveError}
            saveSuccess={saveSuccess}
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
