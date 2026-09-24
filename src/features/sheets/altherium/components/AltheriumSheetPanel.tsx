import { useCallback, useEffect, useState } from 'react'
import {
  getOrCreateMyAltheriumSheet,
  getCampaignAltheriumSheets,
  subscribeToCampaignAltheriumSheets,
  getAltheriumDomains,
  setAltheriumDomainPoints,
  updateAltheriumSheet,
  uploadAltheriumPortrait,
  removeAltheriumPortrait,
  getAltheriumInventory,
  addAltheriumInventoryItem,
  updateAltheriumInventoryItem,
  removeAltheriumInventoryItem,
  getAltheriumRunes,
  createAltheriumRune,
  updateAltheriumRune,
  deleteAltheriumRune,
  type AltheriumRuneInput,
  type AltheriumSheetUpdate,
} from '../services/altheriumSheetService'
import { AltheriumSheetForm } from './AltheriumSheetForm'
import { RAIZES } from '../constants/altherium'
import { cardsMax } from '../utils/altheriumCalculations'
import type { BodyZone } from './AltheriumBodyDiagram'
import type {
  AltheriumSheet,
  AltheriumDomainPoints,
  AltheriumInventoryItem,
  AltheriumRune,
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
  const [inventory, setInventory]     = useState<AltheriumInventoryItem[]>([])
  const [runes, setRunes]             = useState<AltheriumRune[]>([])
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [portraitBusy, setPortraitBusy] = useState(false)

  const loadDomains = useCallback(() => {
    getAltheriumDomains(sheet.id).then(setDomains).catch(() => { /* domínios só não aparecem */ })
  }, [sheet.id])

  const loadInventory = useCallback(() => {
    getAltheriumInventory(sheet.id).then(setInventory).catch(() => { /* inventário só não aparece */ })
  }, [sheet.id])

  const loadRunes = useCallback(() => {
    getAltheriumRunes(sheet.id).then(setRunes).catch(() => { /* runas só não aparecem */ })
  }, [sheet.id])

  useEffect(() => { loadDomains() }, [loadDomains])
  useEffect(() => { loadInventory() }, [loadInventory])
  useEffect(() => { loadRunes() }, [loadRunes])

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

  async function handlePortraitChange(file: File) {
    setSaveError(null)
    setPortraitBusy(true)
    try {
      onSheetUpdated(await uploadAltheriumPortrait(sheet.id, file))
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Não foi possível atualizar o retrato.')
    } finally {
      setPortraitBusy(false)
    }
  }

  async function handlePortraitRemove() {
    setSaveError(null)
    setPortraitBusy(true)
    try {
      onSheetUpdated(await removeAltheriumPortrait(sheet.id))
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Não foi possível remover o retrato.')
    } finally {
      setPortraitBusy(false)
    }
  }

  async function handleInventoryAdd(itemType: AltheriumInventoryItem['item_type'], itemId: string) {
    setSaveError(null)
    try {
      await addAltheriumInventoryItem(sheet.id, itemType, itemId)
      loadInventory()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Não foi possível adicionar o item.')
    }
  }

  async function handleInventoryUpdateQuantity(id: string, quantity: number) {
    setSaveError(null)
    try {
      await updateAltheriumInventoryItem(id, { quantity })
      loadInventory()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Não foi possível atualizar o item.')
    }
  }

  async function handleInventoryRemove(id: string) {
    setSaveError(null)
    try {
      await removeAltheriumInventoryItem(id)
      loadInventory()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Não foi possível remover o item.')
    }
  }

  async function handleInventoryEquip(id: string, equipped: boolean, zone: BodyZone | null) {
    setSaveError(null)
    try {
      await updateAltheriumInventoryItem(id, { equipped, equipped_zone: zone })
      loadInventory()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Não foi possível atualizar o equipamento.')
    }
  }

  // Criar/editar deixam o erro subir: o editor da runa mostra a mensagem
  // e continua aberto, sem perder o que foi digitado.
  async function handleRuneCreate(input: AltheriumRuneInput, image: File | null) {
    await createAltheriumRune(sheet.id, input, image)
    loadRunes()
  }

  async function handleRuneUpdate(rune: AltheriumRune, input: AltheriumRuneInput, image: File | null | undefined) {
    await updateAltheriumRune(rune, input, image)
    loadRunes()
  }

  async function handleRuneDelete(rune: AltheriumRune) {
    setSaveError(null)
    try {
      await deleteAltheriumRune(rune)
      loadRunes()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Não foi possível excluir a runa.')
    }
  }

  return (
    <AltheriumSheetForm
      key={sheet.id}
      sheet={sheet}
      domains={domains}
      inventory={inventory}
      ownerName={ownerName}
      onSave={handleSave}
      onDomainChange={handleDomainChange}
      onPortraitChange={handlePortraitChange}
      onPortraitRemove={handlePortraitRemove}
      portraitBusy={portraitBusy}
      onInventoryAdd={handleInventoryAdd}
      onInventoryUpdateQuantity={handleInventoryUpdateQuantity}
      onInventoryRemove={handleInventoryRemove}
      onInventoryEquip={handleInventoryEquip}
      runes={runes}
      onRuneCreate={handleRuneCreate}
      onRuneUpdate={handleRuneUpdate}
      onRuneDelete={handleRuneDelete}
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
  // A ficha aberta no editor é uma cópia tirada ao selecionar: os cards
  // acompanham o Realtime, mas o editor só muda com o próprio "Salvar" do
  // mestre — assim um save do jogador não apaga edições não salvas aqui.
  const [editing, setEditing]   = useState<AltheriumSheetWithProfile | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await getCampaignAltheriumSheets(campaignId)
      setSheets(data)
      setError(null)
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Não foi possível carregar as fichas.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [campaignId])

  useEffect(() => { load() }, [load])

  useEffect(() => subscribeToCampaignAltheriumSheets(
    campaignId,
    (updated) => setSheets((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))),
    () => { void load(true) },
  ), [campaignId, load])

  function handleSheetUpdated(updated: AltheriumSheet) {
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

  if (sheets.length === 0) {
    return <p className="sheet-empty">Nenhum jogador criou ficha de Altherium ainda.</p>
  }

  const selectedId = editing?.id ?? null
  const selected = editing

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
              onClick={() => setEditing(s)}
              aria-pressed={selectedId === s.id}
            >
              <div className="sheet-card__top">
                <span className="sheet-card__avatar" aria-hidden={s.portrait_url ? undefined : true}>
                  {s.portrait_url
                    ? <img src={s.portrait_url} alt="" loading="lazy" />
                    : ownerLabel.charAt(0).toUpperCase()
                  }
                </span>
                <span className="sheet-card__player">{ownerLabel}</span>
              </div>

              <span className="sheet-card__char">
                {s.character_name
                  ? <><strong>{s.character_name}</strong>{` · ${raizLabel} · Nv ${s.level}`}</>
                  : `Sem nome · ${raizLabel} · Nv ${s.level}`
                }
              </span>

              <div className="sheet-card__bars">
                <SummaryBar sigla="PV" tone="vitality" current={s.vitality_current} max={s.vitality_max} />
                <SummaryBar sigla="PE" tone="mystic" current={s.equilibrio_current} max={s.equilibrio_max} />
                {s.raiz === 'berserker' && (
                  <SummaryBar sigla="FV" tone="resource" current={s.fv_current} max={s.fv_max} />
                )}
                {s.raiz === 'runaskin' && (
                  <SummaryBar sigla="PR" tone="mystic" current={s.pr_current} max={s.pr_max} />
                )}
                {s.raiz === 'pilar' && (
                  <SummaryBar sigla="Cartas" tone="resource" current={s.cards_current} max={cardsMax(s)} />
                )}
              </div>
            </button>
          )
        })}
      </div>

      {selected ? (
        <div className="sheets-list__form">
          <SheetEditor
            key={selected.id}
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

// ────────────────────────────────────────────────────────
// Barrinha dos cards de resumo — só leitura, acompanha o Realtime.
// ────────────────────────────────────────────────────────

interface SummaryBarProps {
  sigla:   string
  tone:    'vitality' | 'mystic' | 'resource'
  current: number
  max:     number | null
}

function SummaryBar({ sigla, tone, current, max }: SummaryBarProps) {
  const pct = max && max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0
  return (
    <div className={`sheet-card__bar sheet-card__bar--${tone}`}>
      <div className="sheet-card__bar-top">
        <span className="sheet-card__bar-sigla">{sigla}</span>
        <span className="sheet-card__bar-values">{current} / {max ?? '—'}</span>
      </div>
      <div className="sheet-card__bar-track">
        <div className="sheet-card__bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
