import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMySheets, isSheetFilled } from '../services/sheetService'
import { getMyAltheriumSheetsEverywhere } from '../altherium/services/altheriumSheetService'
import { RAIZES } from '../altherium/constants/altherium'
import { getSystemLabel, type CampaignSystem } from '../../../shared/constants/systems'
import './MySheetsPage.css'

// ────────────────────────────────────────────────────────
// Minhas fichas — os personagens da pessoa em todas as campanhas, de
// todos os sistemas (ficha simples do Genérico e ficha de Altherium,
// que vivem em tabelas diferentes). "Abrir ficha" leva direto pra
// sub-aba Ficha da Sessão daquela campanha.
// ────────────────────────────────────────────────────────

interface MySheetItem {
  id:            string
  campaignId:    string
  campaignName:  string
  system:        CampaignSystem
  characterName: string | null
  filled:        boolean
  stats:         string[]
  updatedAt:     string
}

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

async function loadAllSheets(): Promise<MySheetItem[]> {
  const [simple, altherium] = await Promise.all([getMySheets(), getMyAltheriumSheetsEverywhere()])

  const items: MySheetItem[] = [
    ...simple.map((s) => ({
      id:            s.id,
      campaignId:    s.campaign_id,
      campaignName:  s.campaign_name,
      system:        s.campaign_system,
      characterName: s.character_name,
      filled:        isSheetFilled(s),
      stats:         [
        ...(s.archetype ? [s.archetype] : []),
        `Nível ${s.level}`,
        `PV ${s.hp_current}/${s.hp_max}`,
      ],
      updatedAt:     s.updated_at,
    })),
    ...altherium.map((s) => ({
      id:            s.id,
      campaignId:    s.campaign_id,
      campaignName:  s.campaign_name,
      system:        'altherium' as const,
      characterName: s.character_name,
      filled:        Boolean(s.character_name?.trim()) && s.raiz != null,
      stats:         [
        ...(s.raiz ? [RAIZES.find((r) => r.id === s.raiz)?.label ?? s.raiz] : []),
        `Nível ${s.level}`,
        `Vitalidade ${s.vitality_current}/${s.vitality_max}`,
      ],
      updatedAt:     s.updated_at,
    })),
  ]
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function SheetCard({ sheet, onOpen }: { sheet: MySheetItem; onOpen: () => void }) {
  return (
    <div className="my-sheet-card">
      <div className="my-sheet-card__header">
        <div className="my-sheet-card__identity">
          <h3 className="my-sheet-card__char-name">
            {sheet.characterName?.trim()
              ? sheet.characterName.trim()
              : <span className="my-sheet-card__unnamed">Sem nome</span>
            }
          </h3>
          <p className="my-sheet-card__campaign">
            {sheet.campaignName}
            <span className="my-sheet-card__system"> · {getSystemLabel(sheet.system)}</span>
          </p>
        </div>
        <span className={`my-sheet-badge ${sheet.filled ? 'my-sheet-badge--filled' : 'my-sheet-badge--empty'}`}>
          {sheet.filled ? 'Preenchida' : 'Incompleta'}
        </span>
      </div>

      <div className="my-sheet-card__stats">
        {sheet.stats.map((stat) => <span key={stat}>{stat}</span>)}
      </div>

      <div className="my-sheet-card__footer">
        <span className="my-sheet-card__updated">
          Atualizada {formatRelativeTime(sheet.updatedAt)}
        </span>
        <button type="button" className="btn btn-ghost my-sheet-card__btn" onClick={onOpen}>
          Abrir ficha →
        </button>
      </div>
    </div>
  )
}

export function MySheetsPage() {
  const navigate = useNavigate()
  const [sheets,  setSheets]  = useState<MySheetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    loadAllSheets()
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
        <div className="my-sheets-grid anim-stagger">
          {sheets.map((sheet) => (
            <SheetCard
              key={`${sheet.system}-${sheet.id}`}
              sheet={sheet}
              onOpen={() => navigate(`/campanhas/${sheet.campaignId}/mesa-sessao`, { state: { initialSessionSubTab: 'ficha' } })}
            />
          ))}
        </div>
      )}
    </div>
  )
}
