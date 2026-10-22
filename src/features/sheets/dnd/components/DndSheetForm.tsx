import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { TabIndicator, useStableTabPanels, useTabDirection } from '../../../../shared/components/TabIndicator'
import { confirmDialog } from '../../../../shared/components/dialogs'
import type { DndCharacterFeature, DndCharacterResource, DndCharacterSheet, DndCharacterSheetUpdateInput } from '../../../../shared/types'
import { useDndSheetData } from '../hooks/useDndSheetData'
import { classLine, deriveSheet } from '../model/sheetModel'
import { DERIVED_COLUMNS, formEchoKey, formFromSheet, formToPayload, sheetAfterSave, sheetWithForm, validateForm, withoutDerived, type DndForm } from '../model/sheetForm'
import { desiredClassResources, planClassResources } from '../model/classResources'
import { planSlotResources } from '../model/slots'
import { applyLongRest, applyShortRest, longRestSheet } from '../rules/rest'
import { removeDndResource, saveDndResource, setDndResourceCurrent, updateDndFeature } from '../services/dndResourceService'
import { DndHero } from './DndHero'
import { DndPersonagemTab } from './DndPersonagemTab'
import { DndAtributosTab } from './DndAtributosTab'
import { DndCombateTab } from './DndCombateTab'
import { DndMagiasTab } from './DndMagiasTab'
import { DndInventarioTab } from './DndInventarioTab'
import { DndCaracteristicasTab } from './DndCaracteristicasTab'
import { DndHistoriaTab } from './DndHistoriaTab'
import type { SheetCtx } from './sheetContext'
import { DndRollProvider } from '../rolls/DndRollProvider'
import './DndSheet.css'

// ────────────────────────────────────────────────────────
// Ficha de D&D 5e (2014): cabeçalho, sete abas e salvamento automático igual
// ao do Vampiro e do Altherium (AUTOSAVE_DELAY_MS depois da última mudança, um
// save por vez, o eco do próprio save não apaga o que foi digitado). As
// partes repetíveis (classes, perícias, ataques, inventário, magias, recursos,
// características) salvam na hora, cada uma na sua tabela. Os números que o
// livro calcula saem do motor de regras e vão junto no save, pros cards do mestre.
// ────────────────────────────────────────────────────────

interface DndSheetFormProps {
  sheet:        DndCharacterSheet
  ownerName?:   string
  /** NPC aberto por um jogador: mostra tudo e não salva nada. */
  readOnly?:    boolean
  isNpc?:       boolean
  onSave:       (data: DndCharacterSheetUpdateInput) => Promise<void>
  saveError:    string | null
  portraitBusy:     boolean
  onPortraitChange: (file: File) => Promise<void>
  onPortraitRemove: () => void
}

const AUTOSAVE_DELAY_MS = 800
type SaveState = 'saved' | 'pending' | 'saving' | 'error'

type TabId = 'personagem' | 'atributos' | 'combate' | 'magias' | 'inventario' | 'caracteristicas' | 'historia'
const TABS: { id: TabId; label: string }[] = [
  { id: 'personagem',      label: 'Personagem' },
  { id: 'atributos',       label: 'Atributos e Perícias' },
  { id: 'combate',         label: 'Combate' },
  { id: 'magias',          label: 'Magias' },
  { id: 'inventario',      label: 'Inventário' },
  { id: 'caracteristicas', label: 'Características' },
  { id: 'historia',        label: 'História' },
]
const TAB_IDS = TABS.map((t) => t.id)

export function DndSheetForm({ sheet, ownerName, readOnly = false, isNpc = false, onSave, saveError, portraitBusy, onPortraitChange, onPortraitRemove }: DndSheetFormProps) {
  const data = useDndSheetData(sheet.id, sheet.campaign_id)
  const [form, setForm] = useState<DndForm>(() => formFromSheet(sheet))
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [restBusy, setRestBusy] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('personagem')
  const tabDir = useTabDirection(TAB_IDS, activeTab)
  const { tabsRef, selectTab, panelsStyle } = useStableTabPanels(setActiveTab)

  // ── Contas (motor de regras) ──
  const bundle = useMemo(
    () => deriveSheet({ sheet: sheetWithForm(sheet, form), classes: data.classes, details: data.details, proficiencies: data.proficiencies }),
    [sheet, form, data.classes, data.details, data.proficiencies],
  )
  const { derived, gear, prof } = bundle

  // Se alguma tabela da ficha nova não carregou, não dá pra saber as classes: o nível não é enviado.
  const hasClasses = data.classes.length > 0 || data.degraded
  const classText = data.classes.length > 0 ? classLine(data.classes) : (sheet.class_name ?? '')
  // Com tabelas sem carregar, o cálculo está incompleto: os números calculados não são gravados.
  const payload = useMemo(() => {
    const body = formToPayload(sheet, form, derived, classText, hasClasses)
    return data.degraded ? withoutDerived(body) : body
  }, [sheet, form, derived, classText, hasClasses, data.degraded])
  const payloadJson = useMemo(() => JSON.stringify(payload), [payload])

  // ── Salvamento automático (ver VampiroSheetForm) ──
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const formRef     = useRef(form)
  const payloadRef  = useRef(payload)
  const onSaveRef   = useRef(onSave)
  const sheetRef    = useRef(sheet)
  sheetRef.current = sheet
  const lastSaved   = useRef(payloadJson)
  const hasClassesRef = useRef(hasClasses)
  hasClassesRef.current = hasClasses
  const lastFormKey = useRef(formEchoKey(formFromSheet(sheet), hasClasses))
  const inFlight    = useRef(false)
  const queued      = useRef(false)
  const ready       = !data.loading && !data.error
  const readyRef    = useRef(ready)
  formRef.current = form
  payloadRef.current = payload
  onSaveRef.current = onSave
  readyRef.current = ready

  // Ficha nova vinda de fora (o mestre mexeu, outra aba): o eco do próprio save é ignorado.
  useEffect(() => {
    const incoming = formEchoKey(formFromSheet(sheet), hasClassesRef.current)
    if (incoming === lastFormKey.current) return
    lastFormKey.current = incoming
    setForm(formFromSheet(sheet))
    setSaveState('saved')
  }, [sheet])

  // A primeira conta, com tudo carregado, define o que "já está salvo" (não grava só por abrir a ficha).
  const baselined = useRef(false)
  useEffect(() => {
    if (!ready || baselined.current) return
    baselined.current = true
    // Se os números calculados da linha do banco estão defasados (ficha antiga, regra nova), grava uma vez pra os cards do mestre ficarem certos.
    const body = payloadRef.current as Record<string, unknown>
    const stale = !data.degraded && DERIVED_COLUMNS.some((k) => body[k] !== (sheet as unknown as Record<string, unknown>)[k])
    lastSaved.current = stale ? '' : JSON.stringify(payloadRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  const flush = useCallback(async (): Promise<void> => {
    if (readOnly || !readyRef.current || !baselined.current) return
    if (inFlight.current) { queued.current = true; return }
    const invalid = validateForm(formRef.current)
    if (invalid) { setError(invalid); setSaveState('error'); return }
    const body = payloadRef.current
    const key = JSON.stringify(body)
    if (key === lastSaved.current) { setSaveState('saved'); return }

    const previous = lastSaved.current
    lastSaved.current = key
    // o que o servidor vai devolver (texto sem espaços nas pontas, nulos...): o eco do save bate com isto
    lastFormKey.current = formEchoKey(formFromSheet(sheetAfterSave(sheetRef.current, body)), hasClassesRef.current)
    inFlight.current = true
    setSaveState('saving')
    try {
      await onSaveRef.current(body)
      setSaveState(JSON.stringify(payloadRef.current) === lastSaved.current ? 'saved' : 'pending')
    } catch {
      lastSaved.current = previous
      setSaveState('error')
    } finally {
      inFlight.current = false
      if (queued.current) { queued.current = false; void flush() }
    }
  }, [readOnly])

  useEffect(() => {
    if (readOnly || !ready || !baselined.current) return
    if (payloadJson === lastSaved.current) {
      if (!inFlight.current) setSaveState('saved')
      return
    }
    setSaveState('pending')
    const timer = setTimeout(() => { void flush() }, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [payloadJson, readOnly, ready, flush])

  useEffect(() => {
    if (readOnly) return
    const isDirty = () => inFlight.current || JSON.stringify(payloadRef.current) !== lastSaved.current
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!readyRef.current || !isDirty()) return
      void flush()
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      if (readyRef.current && baselined.current && JSON.stringify(payloadRef.current) !== lastSaved.current && !validateForm(formRef.current)) {
        void onSaveRef.current(payloadRef.current).catch(() => {})
      }
    }
  }, [readOnly, flush])

  const set = useCallback(<K extends keyof DndForm>(key: K, value: DndForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError(null)
  }, [])

  const update = useCallback((fn: (prev: DndForm) => DndForm) => {
    setForm(fn)
    setError(null)
  }, [])

  // ── Espaços de magia como recursos: o máximo vem do motor ──
  const slotSync = useRef(false)
  useEffect(() => {
    if (readOnly || !ready || data.degraded || slotSync.current || form.manual_modes.includes('spell_slots')) return
    const slots = derived.spellcasting?.slots ?? [0, 0, 0, 0, 0, 0, 0, 0, 0]
    const existing = data.resources.filter((r) => r.source === 'spell_slots')
    const plan = planSlotResources(slots, derived.spellcasting?.pact ?? null, existing)
    if (plan.length === 0) return
    slotSync.current = true
    void (async () => {
      try {
        const saved: DndCharacterResource[] = []
        for (const p of plan) saved.push(await saveDndResource(sheet.id, p))
        data.setResources((rs) => [...rs.filter((r) => !saved.some((s) => s.key === r.key)), ...saved])
      } catch {
        // sem a migration ou sem rede: os espaços só não aparecem; a ficha segue
      } finally { slotSync.current = false }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, ready, data.degraded, derived.spellcasting, data.resources, form.manual_modes])

  // ── Recursos de classe e de raça (Fúria, Ki, Surto de Ação...): o máximo vem das tabelas do livro ──
  const classResSync = useRef(false)
  useEffect(() => {
    if (readOnly || !ready || data.degraded || classResSync.current || form.manual_modes.includes('class_resources')) return
    const desired = desiredClassResources({
      classes: data.classes.map((c) => ({ classKey: c.class_key, level: c.level, subclassKey: c.subclass_key })),
      abilityMods: derived.abilityMods,
      raceKey: form.race_key || null,
    })
    const { upserts, removals } = planClassResources(desired, data.resources)
    if (upserts.length === 0 && removals.length === 0) return
    classResSync.current = true
    void (async () => {
      try {
        const saved: DndCharacterResource[] = []
        for (const u of upserts) saved.push(await saveDndResource(sheet.id, u))
        for (const id of removals) await removeDndResource(id)
        data.setResources((rs) => [...rs.filter((r) => !removals.includes(r.id) && !saved.some((x) => x.key === r.key)), ...saved])
      } catch {
        // sem rede: os recursos só não aparecem agora; a ficha segue e tenta de novo na próxima mudança
      } finally { classResSync.current = false }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, ready, data.degraded, data.classes, derived.abilityMods, form.race_key, data.resources, form.manual_modes])

  // ── Descansos ──
  async function rechargeResourcesAndFeatures(kind: 'short' | 'long') {
    const apply = kind === 'short' ? applyShortRest : applyLongRest
    const resourceItems = data.resources.map((r) => ({ ...r, current: r.current_value, max: r.max_value }))
    const resourceAfter = apply(resourceItems)
    const featureItems = data.features
      .filter((f) => f.uses_max != null)
      .map((f) => ({ ...f, current: f.uses_current ?? 0, max: f.uses_max ?? 0 }))
    const featureAfter = apply(featureItems)

    const resourceChanges = resourceAfter.filter((r, i) => r.current !== resourceItems[i].current)
    const featureChanges = featureAfter.filter((f, i) => f.current !== featureItems[i].current)

    const savedResources: DndCharacterResource[] = []
    for (const r of resourceChanges) savedResources.push(await setDndResourceCurrent({ id: r.id, max_value: r.max_value }, r.max_value))
    const savedFeatures: DndCharacterFeature[] = []
    for (const f of featureChanges) savedFeatures.push(await updateDndFeature(f.id, { uses_current: f.uses_max }))
    if (savedResources.length) data.setResources((rs) => rs.map((r) => savedResources.find((s) => s.id === r.id) ?? r))
    if (savedFeatures.length) data.setFeatures((fs) => fs.map((f) => savedFeatures.find((s) => s.id === f.id) ?? f))
    return resourceChanges.length + featureChanges.length
  }

  async function shortRest() {
    if (readOnly || restBusy) return
    setRestBusy(true); setError(null); setNotice(null)
    try {
      const n = await rechargeResourcesAndFeatures('short')
      setNotice(n ? `Descanso curto: ${n} ${n === 1 ? 'recurso recarregado' : 'recursos recarregados'}. Gaste dados de vida na aba Combate para recuperar PV.` : 'Descanso curto feito. Nada precisava recarregar; gaste dados de vida na aba Combate para recuperar PV.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível fazer o descanso curto.')
    } finally { setRestBusy(false) }
  }

  async function longRest() {
    if (readOnly || restBusy) return
    const ok = await confirmDialog({
      title: 'Descanso longo',
      message: 'PV ao máximo, todos os recursos e espaços de magia recarregam, você recupera metade dos dados de vida e perde 1 nível de exaustão. Fazer o descanso longo?',
      confirmLabel: 'Descansar',
    })
    if (!ok) return
    setRestBusy(true); setError(null); setNotice(null)
    try {
      const n = await rechargeResourcesAndFeatures('long')
      const hpMax = derived.hpMax ?? form.hp_max
      const rest = longRestSheet({
        hpMax, hpCurrent: form.hp_current, exhaustion: form.exhaustion,
        deathSaves: { successes: form.death_save_successes, failures: form.death_save_failures },
        hitDiceUsed: form.hit_dice_used, hitDicePool: derived.hitDice,
      })
      update((f) => ({
        ...f, hp_current: rest.hpCurrent, exhaustion: rest.exhaustion, concentrating_on: '',
        death_save_successes: rest.deathSaves.successes, death_save_failures: rest.deathSaves.failures, hit_dice_used: rest.hitDiceUsed,
      }))
      setNotice(`Descanso longo feito${n ? `, ${n} ${n === 1 ? 'recurso recarregado' : 'recursos recarregados'}` : ''}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível fazer o descanso longo.')
    } finally { setRestBusy(false) }
  }

  const ctx: SheetCtx = {
    sheet, form, set, update, data, derived, gear, prof,
    readOnly, campaignId: sheet.campaign_id,
    report: (msg) => setError(msg),
  }

  if (data.loading) return <div className="sheet-loading"><span className="spinner" /></div>
  if (data.error) return <div className="sheet-feedback sheet-feedback--error" role="alert">{data.error}</div>

  return (
    <form
      className="dsh-sheet" noValidate
      onSubmit={(e: FormEvent) => { e.preventDefault(); void flush() }}
      style={{ '--tab-dir': tabDir } as CSSProperties}
    >
      <DndRollProvider ctx={ctx}>
      {ownerName && <p className="dsh-sheet__owner">Ficha de <strong>{ownerName}</strong></p>}
      {data.degraded && !readOnly && (
        <p className="dsh-warn dsh-sheet__degraded" role="status">
          Parte da ficha não carregou (as tabelas novas de D&D podem não ter sido aplicadas no banco). Classes, recursos e características ficam indisponíveis até lá.
        </p>
      )}

      <DndHero
        ctx={ctx} isNpc={isNpc} portraitBusy={portraitBusy}
        onPortraitChange={onPortraitChange} onPortraitRemove={onPortraitRemove}
        onShortRest={() => void shortRest()} onLongRest={() => void longRest()} restBusy={restBusy}
      />

      <nav ref={tabsRef} className="campaign-tabs dsh-tabs" role="tablist" aria-label="Seções da ficha">
        {TABS.map((tab) => (
          <button
            key={tab.id} type="button" role="tab"
            aria-selected={activeTab === tab.id} aria-controls={`dsh-tabpanel-${tab.id}`}
            className={`campaign-tab ${activeTab === tab.id ? 'campaign-tab--active' : ''}`}
            onClick={() => selectTab(tab.id)}
          >
            <span className="campaign-tab__label">{tab.label}</span>
          </button>
        ))}
        <TabIndicator activeKey={activeTab} />
      </nav>

      <div className="dsh-tab-panels" style={panelsStyle}>
        <div id="dsh-tabpanel-personagem" role="tabpanel" hidden={activeTab !== 'personagem'}>{activeTab === 'personagem' && <DndPersonagemTab ctx={ctx} />}</div>
        <div id="dsh-tabpanel-atributos" role="tabpanel" hidden={activeTab !== 'atributos'}>{activeTab === 'atributos' && <DndAtributosTab ctx={ctx} />}</div>
        <div id="dsh-tabpanel-combate" role="tabpanel" hidden={activeTab !== 'combate'}>{activeTab === 'combate' && <DndCombateTab ctx={ctx} />}</div>
        <div id="dsh-tabpanel-magias" role="tabpanel" hidden={activeTab !== 'magias'}>{activeTab === 'magias' && <DndMagiasTab ctx={ctx} />}</div>
        <div id="dsh-tabpanel-inventario" role="tabpanel" hidden={activeTab !== 'inventario'}>{activeTab === 'inventario' && <DndInventarioTab ctx={ctx} />}</div>
        <div id="dsh-tabpanel-caracteristicas" role="tabpanel" hidden={activeTab !== 'caracteristicas'}>{activeTab === 'caracteristicas' && <DndCaracteristicasTab ctx={ctx} />}</div>
        <div id="dsh-tabpanel-historia" role="tabpanel" hidden={activeTab !== 'historia'}>{activeTab === 'historia' && <DndHistoriaTab ctx={ctx} />}</div>
      </div>

      <footer className="dsh-sheet__footer">
        {(error || saveError) && <p className="dsh-warn" role="alert">{error ?? saveError}</p>}
        {notice && !error && <p className="dsh-note" role="status">{notice}</p>}
        {!readOnly && (
          <>
            <span className={`dsh-save dsh-save--${saveState}`} role="status" aria-live="polite">
              {saveState === 'saved'   && '✓ Tudo salvo'}
              {saveState === 'pending' && 'Alterações pendentes…'}
              {saveState === 'saving'  && <><span className="spinner spinner--sm" /> Salvando…</>}
              {saveState === 'error'   && 'Erro ao salvar'}
            </span>
            {(saveState === 'pending' || saveState === 'error') && (
              <button type="submit" className="dsh-chip">{saveState === 'error' ? 'Tentar de novo' : 'Salvar agora'}</button>
            )}
          </>
        )}
      </footer>
      </DndRollProvider>
    </form>
  )
}
