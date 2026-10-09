import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getCampaignVtmSheets,
  getOrCreateMyVtmSheet,
  removeVtmPortrait,
  subscribeToCampaignVtmSheets,
  updateVtmSheet,
  uploadVtmPortrait,
  type VtmSheetUpdate,
} from '../services/vampiroSheetService'
import { VampiroSheetForm } from './VampiroSheetForm'
import { NpcSection } from '../../components/NpcSection'
import { getClan, VAMPIRO_FEATURE, VTM_HUMANITY_MAX, VTM_HUNGER_MAX } from '../constants/vampiro'
import { useFeature } from '../../../control/siteFeatures'
import { clampTrack, healthMax, ordinal, trackState, willpowerMax } from '../utils/vampiroRules'
import type { VtmSheet, VtmSheetWithProfile } from '../../../../shared/types'
import '../../components/SheetPanel.css'
import './VampiroSheet.css'
import { Loader } from '../../../../shared/components/Loader'

// ────────────────────────────────────────────────────────
// Ficha de Vampiro na campanha: o jogador vê e edita a sua; o mestre vê
// os cards da mesa (ao vivo) e abre a ficha de cada um. Mesmo molde da
// ficha de Altherium e da Terra Devastada.
// ────────────────────────────────────────────────────────

interface VampiroSheetPanelProps {
  campaignId: string
  userRole:   'master' | 'player'
}

export function VampiroSheetPanel({ campaignId, userRole }: VampiroSheetPanelProps) {
  // Guardado no Painel de controle: só o dono do site usa a ficha (o banco
  // também só deixa ele, migration 20240188000000).
  const feature = useFeature(VAMPIRO_FEATURE)
  return (
    <section className="sheet-panel">
      <header className="sheet-panel__header">
        <div className="sheet-panel__title-row">
          <span className="sheet-panel__icon" aria-hidden="true">☥</span>
          <h3 className="sheet-panel__title">Ficha Vampiro: A Máscara</h3>
        </div>
      </header>
      <div className="sheet-panel__body">
        {!feature.visible
          ? <p className="sheet-empty">A ficha de Vampiro ainda não foi liberada. Volte em breve.</p>
          : userRole === 'player' ? <PlayerView campaignId={campaignId} /> : <MasterView campaignId={campaignId} />}
        {feature.visible && (
          <NpcSection<VtmSheet>
            table="vtm_character_sheets"
            campaignId={campaignId}
            userRole={userRole}
            summary={(s) => {
              const hMax = healthMax(s)
              const h = clampTrack({ superficial: s.health_superficial, aggravated: s.health_aggravated }, hMax)
              return {
                line:     `${getClan(s.clan)?.label ?? 'Sem clã'} · ${ordinal(s.generation)} geração`,
                portrait: s.portrait_url,
                bars: (
                  <>
                    <CardBar sigla="Vitalidade" tone="vitality" current={hMax - h.superficial - h.aggravated} max={hMax} />
                    <CardBar sigla="Fome" tone="hunger" current={s.hunger} max={VTM_HUNGER_MAX} />
                  </>
                ),
              }
            }}
            renderSheet={(s, { readOnly, onUpdated }) => (
              <SheetEditor sheet={s} ownerName="NPC" readOnly={readOnly} onSheetUpdated={onUpdated} />
            )}
          />
        )}
      </div>
    </section>
  )
}

// ── Edição (jogador e mestre) ───────────────────────────

interface SheetEditorProps {
  sheet:          VtmSheet
  ownerName?:     string
  /** NPC aberto por um jogador: mostra tudo e não salva nada. */
  readOnly?:      boolean
  onSheetUpdated: (sheet: VtmSheet) => void
}

function SheetEditor({ sheet, ownerName, readOnly = false, onSheetUpdated }: SheetEditorProps) {
  const [saveError, setSaveError] = useState<string | null>(null)
  const [portraitBusy, setPortraitBusy] = useState(false)

  async function handleSave(data: VtmSheetUpdate) {
    if (readOnly) return
    setSaveError(null)
    try {
      onSheetUpdated(await updateVtmSheet(sheet.id, data))
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Não foi possível salvar a ficha.')
      throw err
    }
  }

  async function portrait(run: () => Promise<VtmSheet>) {
    setSaveError(null)
    setPortraitBusy(true)
    try { onSheetUpdated(await run()) } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Não foi possível atualizar o retrato.')
    } finally { setPortraitBusy(false) }
  }

  return (
    <VampiroSheetForm
      key={sheet.id} sheet={sheet} ownerName={ownerName} onSave={handleSave} saveError={saveError}
      portraitBusy={portraitBusy}
      onPortraitChange={(file) => void portrait(() => uploadVtmPortrait(sheet.id, file))}
      onPortraitRemove={() => void portrait(() => removeVtmPortrait(sheet.id))}
    />
  )
}

// ── Jogador: a própria ficha ────────────────────────────

function PlayerView({ campaignId }: { campaignId: string }) {
  const [sheet, setSheet]     = useState<VtmSheet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getOrCreateMyVtmSheet(campaignId)
      .then((data) => { if (!cancelled) { setSheet(data); setError(null) } })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Não foi possível carregar a ficha.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [campaignId])

  if (loading) {
    return <div className="sheet-loading"><Loader small /></div>
  }
  if (error) return <div className="sheet-feedback sheet-feedback--error" role="alert">{error}</div>
  if (!sheet) return null
  return <SheetEditor sheet={sheet} onSheetUpdated={setSheet} />
}

// ── Mestre: cards da mesa + ficha aberta ────────────────

function MasterView({ campaignId }: { campaignId: string }) {
  const [sheets, setSheets]   = useState<VtmSheetWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  // Cópia tirada ao selecionar: os cards seguem o Realtime; o editor só muda
  // com os saves do próprio mestre (se o jogador salvar, aparece o aviso).
  const [editing, setEditing] = useState<VtmSheetWithProfile | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editing || !window.matchMedia('(max-width: 768px)').matches) return
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [editing?.id])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      setSheets(await getCampaignVtmSheets(campaignId))
      setError(null)
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Não foi possível carregar as fichas.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [campaignId])

  useEffect(() => { void load() }, [load])

  useEffect(() => subscribeToCampaignVtmSheets(
    campaignId,
    (updated) => setSheets((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))),
    () => { void load(true) },
  ), [campaignId, load])

  function handleSheetUpdated(updated: VtmSheet) {
    setSheets((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)))
    setEditing((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev))
  }

  if (loading) {
    return <div className="sheet-loading"><Loader small /></div>
  }
  if (error) return <div className="sheet-feedback sheet-feedback--error" role="alert">{error}</div>
  if (sheets.length === 0) return <p className="sheet-empty">Nenhum jogador criou ficha de Vampiro ainda.</p>

  const latest = editing ? sheets.find((s) => s.id === editing.id) ?? null : null
  const outdated = !!(latest && editing && Date.parse(latest.updated_at) > Date.parse(editing.updated_at))

  return (
    <div className="sheets-list-wrapper">
      <div className="sheets-cards anim-stagger">
        {sheets.map((s) => {
          const ownerLabel = s.profile?.display_name ?? 'Jogador removido'
          const hMax = healthMax(s)
          const wMax = willpowerMax(s)
          const h = clampTrack({ superficial: s.health_superficial, aggravated: s.health_aggravated }, hMax)
          const w = clampTrack({ superficial: s.willpower_superficial, aggravated: s.willpower_aggravated }, wMax)
          const hState = trackState(h, hMax)
          const clan = getClan(s.clan)
          return (
            <button
              key={s.id} type="button"
              className={`sheet-card ${editing?.id === s.id ? 'sheet-card--active' : ''}`}
              onClick={() => setEditing(s)} aria-pressed={editing?.id === s.id}
            >
              <div className="sheet-card__top">
                <span className="sheet-card__avatar" aria-hidden={s.portrait_url ? undefined : true}>
                  {s.portrait_url ? <img src={s.portrait_url} alt="" loading="lazy" /> : ownerLabel.charAt(0).toUpperCase()}
                </span>
                <span className="sheet-card__player">{ownerLabel}</span>
              </div>
              <span className="sheet-card__char">
                {s.character_name ? <strong>{s.character_name}</strong> : 'Sem nome'}
                {` · ${clan?.label ?? 'Sem clã'} · ${ordinal(s.generation)} geração`}
              </span>
              <div className="sheet-card__bars">
                <CardBar sigla="Vitalidade" tone="vitality" current={hMax - h.superficial - h.aggravated} max={hMax}
                  note={hState === 'broken' ? 'torpor' : hState === 'impaired' ? 'debilitado' : undefined} />
                <CardBar sigla="Vontade" tone="mystic" current={wMax - w.superficial - w.aggravated} max={wMax} />
                <CardBar sigla="Fome" tone="hunger" current={s.hunger} max={VTM_HUNGER_MAX} />
                <CardBar sigla="Humanidade" tone="resource" current={s.humanity} max={VTM_HUMANITY_MAX}
                  note={s.stains ? `${s.stains} ${s.stains === 1 ? 'mancha' : 'manchas'}` : undefined} />
              </div>
            </button>
          )
        })}
      </div>

      {editing ? (
        <div className="sheets-list__form" ref={formRef}>
          {outdated && latest && (
            <div className="sheet-outdated" role="status">
              <span>O jogador atualizou a ficha. Recarregar?</span>
              <button type="button" className="btn btn-ghost sheet-outdated__btn" onClick={() => setEditing(latest)}>Recarregar</button>
            </div>
          )}
          <div key={editing.id} className="anim-page">
            <SheetEditor sheet={editing} ownerName={editing.profile?.display_name ?? 'Jogador removido'} onSheetUpdated={handleSheetUpdated} />
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
  tone:    'vitality' | 'mystic' | 'resource' | 'hunger'
  current: number
  max:     number
  note?:   string
}

function CardBar({ sigla, tone, current, max, note }: CardBarProps) {
  const pct = Math.max(0, Math.min(100, (current / Math.max(1, max)) * 100))
  return (
    <div className={`sheet-card__bar sheet-card__bar--${tone === 'hunger' ? 'vitality' : tone} vtm-cardbar--${tone}`}>
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
