import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMySheets, isSheetFilled, type SheetWithCampaign } from '../services/sheetService'
import './MySheetsPage.css'

function formatRelativeTime(iso: string): string {
  const diff    = Date.now() - new Date(iso).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 5)  return 'agora'
  if (seconds < 60) return `${seconds}s atrás`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}min atrás`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)   return `${hours}h atrás`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

interface SheetCardProps {
  sheet:      SheetWithCampaign
  onNavigate: (campaignId: string) => void
}

function SheetCard({ sheet, onNavigate }: SheetCardProps) {
  const filled = isSheetFilled(sheet)

  return (
    <div className="my-sheet-card">
      <div className="my-sheet-card__header">
        <div className="my-sheet-card__identity">
          <h3 className="my-sheet-card__char-name">
            {sheet.character_name?.trim()
              ? sheet.character_name.trim()
              : <span className="my-sheet-card__unnamed">Sem nome</span>
            }
          </h3>
          <p className="my-sheet-card__campaign">
            {sheet.campaign_name}
            {sheet.campaign_system && (
              <span className="my-sheet-card__system"> · {sheet.campaign_system}</span>
            )}
          </p>
        </div>
        <span className={`my-sheet-badge ${filled ? 'my-sheet-badge--filled' : 'my-sheet-badge--empty'}`}>
          {filled ? 'Preenchida' : 'Incompleta'}
        </span>
      </div>

      <div className="my-sheet-card__stats">
        {sheet.archetype && <span>{sheet.archetype}</span>}
        <span>Nível {sheet.level}</span>
        <span>PV {sheet.hp_current}/{sheet.hp_max}</span>
      </div>

      <div className="my-sheet-card__footer">
        <span className="my-sheet-card__updated">
          Atualizada {formatRelativeTime(sheet.updated_at)}
        </span>
        <button
          className="btn btn-ghost my-sheet-card__btn"
          onClick={() => onNavigate(sheet.campaign_id)}
        >
          Abrir campanha →
        </button>
      </div>
    </div>
  )
}

export function MySheetsPage() {
  const navigate = useNavigate()
  const [sheets,  setSheets]  = useState<SheetWithCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    getMySheets()
      .then(setSheets)
      .catch((err) => setError(
        err instanceof Error ? err.message : 'Não foi possível carregar suas fichas.'
      ))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="my-sheets-page">
      <div className="my-sheets-page__header">
        <h1 className="my-sheets-page__title">Minhas fichas</h1>
        <p className="my-sheets-page__sub">Seus personagens em todas as campanhas.</p>
      </div>

      {loading && (
        <div className="my-sheets-page__state">
          <div className="spinner spinner--sm" />
          <span>Carregando fichas...</span>
        </div>
      )}

      {error && (
        <div className="my-sheets-page__error" role="alert">{error}</div>
      )}

      {!loading && !error && sheets.length === 0 && (
        <div className="my-sheets-page__empty">
          <p className="my-sheets-page__empty-icon">◎</p>
          <p className="my-sheets-page__empty-title">Nenhuma ficha encontrada.</p>
          <p className="my-sheets-page__empty-text">
            Entre em uma campanha e preencha sua ficha para vê-la aqui.
          </p>
        </div>
      )}

      {!loading && !error && sheets.length > 0 && (
        <div className="my-sheets-grid">
          {sheets.map((sheet) => (
            <SheetCard
              key={sheet.id}
              sheet={sheet}
              onNavigate={(id) => navigate(`/campanhas/${id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
