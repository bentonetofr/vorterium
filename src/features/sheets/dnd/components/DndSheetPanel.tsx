import { useCallback, useEffect, useRef, useState } from 'react'
import { useFeature } from '../../../control/siteFeatures'
import { NpcSection } from '../../components/NpcSection'
import { Loader } from '../../../../shared/components/Loader'
import type { DndCharacterClass, DndCharacterSheet, DndCharacterSheetUpdateInput } from '../../../../shared/types'
import { getClass, getRace, getSubrace } from '../catalog'
import { DND_FEATURE } from '../constants/dnd'
import { classLine } from '../model/sheetModel'
import { formatMeters } from '../model/format'
import {
  ensureMyDndSheet, getCampaignDndSheets, listDndClassesForSheets, subscribeToCampaignDndSheets, subscribeToDndClasses,
  updateDndSheet, type DndSheetWithProfile,
} from '../services/dndSheetService'
import { removeDndPortrait, uploadDndPortrait } from '../services/dndPortraitService'
import { DndSheetForm } from './DndSheetForm'
import '../../components/SheetPanel.css'
import './DndSheet.css'

// ────────────────────────────────────────────────────────
// Ficha de D&D 5e na campanha: o jogador vê e edita a sua; o mestre vê os
// cards da mesa (ao vivo) e abre a ficha de cada um; NPCs do mestre na seção
// de baixo. Mesmo molde das fichas de Altherium, Terra Devastada e Vampiro.
// ────────────────────────────────────────────────────────

interface DndSheetPanelProps {
  campaignId: string
  userRole:   'master' | 'player'
}

export function DndSheetPanel({ campaignId, userRole }: DndSheetPanelProps) {
  // Guardado no Painel de controle: só o dono do site usa a ficha (o banco
  // também só deixa ele, migration 20240203000000).
  const feature = useFeature(DND_FEATURE)
  return (
    <section className="sheet-panel">
      <header className="sheet-panel__header">
        <div className="sheet-panel__title-row">
          <span className="sheet-panel__icon" aria-hidden="true">⚔</span>
          <h3 className="sheet-panel__title">Ficha D&amp;D 5e</h3>
        </div>
      </header>
      <div className="sheet-panel__body">
        {!feature.visible
          ? <p className="sheet-empty">A ficha de D&amp;D ainda não foi liberada. Volte em breve.</p>
          : userRole === 'player' ? <PlayerView campaignId={campaignId} /> : <MasterView campaignId={campaignId} />}
        {feature.visible && (
          <NpcSection<DndCharacterSheet>
            table="dnd_character_sheets"
            campaignId={campaignId}
            userRole={userRole}
            summary={(s) => ({
              line:     [getClass(s.class_key ?? '')?.name ?? s.class_name, `nível ${s.level}`].filter(Boolean).join(' · '),
              portrait: s.portrait_url,
              bars:     <CardStats sheet={s} />,
            })}
            renderSheet={(s, { readOnly, onUpdated }) => (
              <SheetEditor sheet={s} ownerName="NPC" readOnly={readOnly} isNpc onSheetUpdated={onUpdated} />
            )}
          />
        )}
      </div>
    </section>
  )
}

// ── Edição (jogador e mestre) ───────────────────────────

interface SheetEditorProps {
  sheet:          DndCharacterSheet
  ownerName?:     string
  readOnly?:      boolean
  isNpc?:         boolean
  onSheetUpdated: (sheet: DndCharacterSheet) => void
}

function SheetEditor({ sheet, ownerName, readOnly = false, isNpc = false, onSheetUpdated }: SheetEditorProps) {
  const [saveError, setSaveError] = useState<string | null>(null)
  const [portraitBusy, setPortraitBusy] = useState(false)

  async function handleSave(data: DndCharacterSheetUpdateInput) {
    if (readOnly) return
    setSaveError(null)
    try {
      onSheetUpdated(await updateDndSheet(sheet.id, data, sheet.campaign_id, data.character_name))
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Não foi possível salvar a ficha.')
      throw err
    }
  }

  async function portrait(run: () => Promise<DndCharacterSheet>) {
    setSaveError(null)
    setPortraitBusy(true)
    try { onSheetUpdated(await run()) } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Não foi possível atualizar o retrato.')
    } finally { setPortraitBusy(false) }
  }

  return (
    <DndSheetForm
      key={sheet.id} sheet={sheet} ownerName={ownerName} readOnly={readOnly} isNpc={isNpc}
      onSave={handleSave} saveError={saveError} portraitBusy={portraitBusy}
      onPortraitChange={(file) => void portrait(() => uploadDndPortrait(sheet.id, file))}
      onPortraitRemove={() => void portrait(() => removeDndPortrait(sheet.id))}
    />
  )
}

// ── Jogador: a própria ficha ────────────────────────────

function PlayerView({ campaignId }: { campaignId: string }) {
  const [sheet, setSheet]     = useState<DndCharacterSheet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ensureMyDndSheet(campaignId)
      .then((data) => { if (!cancelled) { setSheet(data); setError(null) } })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Não foi possível carregar a ficha.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [campaignId])

  if (loading) return <div className="sheet-loading"><Loader small /></div>
  if (error) return <div className="sheet-feedback sheet-feedback--error" role="alert">{error}</div>
  if (!sheet) return null
  return <SheetEditor sheet={sheet} onSheetUpdated={setSheet} />
}

// ── Mestre: cards da mesa + ficha aberta ────────────────

function MasterView({ campaignId }: { campaignId: string }) {
  const [sheets, setSheets]   = useState<DndSheetWithProfile[]>([])
  const [classes, setClasses] = useState<DndCharacterClass[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  // Cópia tirada ao selecionar: os cards seguem o Realtime; o editor só muda
  // com os saves do próprio mestre (se o jogador salvar, aparece o aviso).
  const [editing, setEditing] = useState<DndSheetWithProfile | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editing || !window.matchMedia('(max-width: 768px)').matches) return
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [editing?.id])

  const loadClasses = useCallback(async (ids: string[]) => {
    setClasses(await listDndClassesForSheets(ids))
  }, [])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const list = await getCampaignDndSheets(campaignId)
      setSheets(list)
      setError(null)
      void loadClasses(list.map((s) => s.id))
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Não foi possível carregar as fichas.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [campaignId, loadClasses])

  useEffect(() => { void load() }, [load])

  useEffect(() => subscribeToCampaignDndSheets(
    campaignId,
    (updated) => setSheets((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))),
    () => { void load(true) },
  ), [campaignId, load])

  // classe e nível mudam em outra tabela: recarrega as linhas de classe quando algo muda
  const sheetIds = useRef<string[]>([])
  sheetIds.current = sheets.map((s) => s.id)
  useEffect(() => subscribeToDndClasses(() => { void loadClasses(sheetIds.current) }), [loadClasses])

  function handleSheetUpdated(updated: DndCharacterSheet) {
    setSheets((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)))
    setEditing((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev))
  }

  if (loading) return <div className="sheet-loading"><Loader small /></div>
  if (error) return <div className="sheet-feedback sheet-feedback--error" role="alert">{error}</div>
  if (sheets.length === 0) return <p className="sheet-empty">Nenhum jogador criou ficha de D&amp;D ainda.</p>

  const latest = editing ? sheets.find((s) => s.id === editing.id) ?? null : null
  const outdated = !!(latest && editing && Date.parse(latest.updated_at) > Date.parse(editing.updated_at))

  return (
    <div className="sheets-list-wrapper">
      <div className="sheets-cards anim-stagger">
        {sheets.map((s) => {
          const ownerLabel = s.profile?.display_name ?? 'Jogador removido'
          const rows = classes.filter((c) => c.sheet_id === s.id)
          const race = s.race_key ? getRace(s.race_key) : undefined
          const subrace = s.race_key && s.subrace_key ? getSubrace(s.race_key, s.subrace_key) : undefined
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
                {` · ${[subrace?.name ?? race?.name ?? s.race, classLine(rows, s.class_name) === 'Sem classe' ? null : classLine(rows, s.class_name)].filter(Boolean).join(' · ') || 'sem raça e classe'}`}
                {` · nível ${s.level}`}
              </span>
              <div className="sheet-card__bars"><CardStats sheet={s} /></div>
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

// ── Peças dos cards ─────────────────────────────────────

/** PV, CA, iniciativa e deslocamento (as colunas calculadas que a ficha grava) e as condições. */
function CardStats({ sheet: s }: { sheet: DndCharacterSheet }) {
  const max = Math.max(1, s.hp_max)
  const hp = Math.max(0, Math.min(max, s.hp_current))
  const pct = (hp / max) * 100
  const conditions = s.conditions ?? []
  return (
    <>
      <div className="sheet-card__bar sheet-card__bar--vitality">
        <div className="sheet-card__bar-top">
          <span className="sheet-card__bar-sigla">PV{s.hp_temp ? ` · +${s.hp_temp} temp.` : ''}</span>
          <span key={`${hp}/${max}`} className="sheet-card__bar-values anim-bump">{hp} / {max}</span>
        </div>
        <div className="sheet-card__bar-track"><div className="sheet-card__bar-fill" style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="dsh-cardchips">
        <span className="dsh-cardchip" title="Classe de Armadura">CA {s.armor_class}</span>
        <span className="dsh-cardchip" title="Iniciativa">Ini {s.initiative_bonus >= 0 ? '+' : ''}{s.initiative_bonus}</span>
        <span className="dsh-cardchip" title="Deslocamento">{formatMeters(s.speed)}</span>
        {s.concentrating_on && <span className="dsh-cardchip dsh-cardchip--accent" title={`Concentrando em ${s.concentrating_on}`}>Concentrando</span>}
        {conditions.length > 0 && <span className="dsh-cardchip dsh-cardchip--bad" title={`${conditions.length} condição(ões)`}>{conditions.length} cond.</span>}
        {(s.exhaustion ?? 0) > 0 && <span className="dsh-cardchip dsh-cardchip--bad">Exaustão {s.exhaustion}</span>}
        {s.hp_current === 0 && <span className="dsh-cardchip dsh-cardchip--bad">Caído</span>}
      </div>
    </>
  )
}
