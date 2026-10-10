import { FormEvent, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Presence } from '../../../../shared/components/Presence'
import { Select } from '../../../../shared/components/Select'
import { TabIndicator, useStableTabPanels, useTabDirection } from '../../../../shared/components/TabIndicator'
import type {
  TdaCondition,
  TdaConditionDuration,
  TdaInventoryItem,
  TdaSheet,
  TdaSupplies,
  TdaTrait,
  TdaTrunfo,
} from '../../../../shared/types'
import {
  CONDITIONS_INITIAL_MAX,
  CONDITIONS_MAX,
  CONDITION_DURATIONS,
  CONVICTION_MAX,
  HEALTH_MAX,
  HORROR_MAX,
  INVENTORY_MAX,
  ITEM_KINDS,
  PROTECTION_LEVELS,
  WEAPON_LEVELS,
  WEAPON_PRESETS,
  TEXT_LIMITS,
  TRAITS_INITIAL_MAX,
  TRAITS_MAX,
  TRUNFOS_MAX,
} from '../constants/terraDevastadaAdaptada'
import { clampHealth, convictionCost, healthBand, horrorBand, initialHorror, newId } from '../utils/tdaRules'
import { useTdaFonts } from '../utils/tdaFonts'
import {
  KIT_HEAL,
  RECIPES,
  UPGRADE_MAX,
  WEAPON_TYPES,
  ammoCap,
  clampBackpack,
  craft,
  durabilityMax,
  normalizeSupplies,
  normalizeWeapon,
  spendWeaponUse,
  supplyCap,
  throwableCap,
  upgradeWeapon,
  weaponType,
  type SupplyKey,
} from '../utils/tdaSupplies'
import { announceTda, type TdaSheetUpdate } from '../services/tdaSheetService'
import { TdaTestModal, type TdaTestPurpose } from './TdaTestModal'
import { TdaHorrorModal } from './TdaHorrorModal'
import { TdaCombatModal, type TdaCombatMode } from './TdaCombatModal'
import { TdaSuppliesTab } from './TdaSuppliesTab'
import './TerraDevastadaAdaptadaSheet.css'

// ────────────────────────────────────────────────────────
// Ficha Terra Devastada Adaptada. Salvamento automático igual ao da ficha
// Altherium: o que está na tela é comparado com o que o banco tem e vai
// AUTOSAVE_DELAY_MS depois da última mudança, um save por vez.
// ────────────────────────────────────────────────────────

interface TdaSheetFormProps {
  sheet:      TdaSheet
  ownerName?: string
  onSave:     (data: TdaSheetUpdate) => Promise<void>
  saveError:  string | null
}

type FormData = {
  character_name: string
  concept:        string
  description:    string
  background:     string
  traits:         TdaTrait[]
  conditions:     TdaCondition[]
  trunfos:        TdaTrunfo[]
  inventory:      TdaInventoryItem[]
  supplies:       TdaSupplies
  backpack:       number
  health:         number
  horror:         number
  conviction:     number
  notes:          string
}

function sheetToForm(s: TdaSheet): FormData {
  const backpack = clampBackpack(s.backpack ?? 0)
  return {
    character_name: s.character_name ?? '',
    concept:        s.concept ?? '',
    description:    s.description ?? '',
    background:     s.background ?? '',
    traits:         s.traits ?? [],
    conditions:     s.conditions ?? [],
    trunfos:        s.trunfos ?? [],
    inventory:      (s.inventory ?? []).map((i) => normalizeWeapon(i, backpack)),
    supplies:       normalizeSupplies(s.supplies),
    backpack,
    health:         s.health ?? HEALTH_MAX,
    horror:         s.horror,
    conviction:     s.conviction,
    notes:          s.notes ?? '',
  }
}

function formToPayload(f: FormData): TdaSheetUpdate {
  return {
    character_name: f.character_name.trim() || null,
    concept:        f.concept.trim() || null,
    description:    f.description.trim() || null,
    background:     f.background.trim() || null,
    // Linhas em branco não vão pro banco. Os objetos são montados campo a
    // campo, sempre na mesma ordem: o jsonb devolve as chaves reordenadas,
    // e o eco do próprio save precisa bater com o que foi enviado.
    traits: f.traits.filter((t) => t.name.trim())
      .map((t) => ({ id: t.id, name: t.name.trim(), tag: t.tag ?? null })),
    conditions: f.conditions.filter((c) => c.name.trim())
      .map((c) => ({ id: c.id, name: c.name.trim(), duration: c.duration })),
    trunfos: f.trunfos.filter((t) => t.name.trim() || t.description.trim())
      .map((t) => ({ id: t.id, name: t.name.trim(), description: t.description.trim() })),
    inventory: f.inventory.filter((i) => i.name.trim())
      .map((i) => ({
        id: i.id, name: i.name.trim(), qty: i.qty, kind: i.kind, level: i.kind === 'item' ? 0 : i.level,
        ...(i.kind === 'arma' ? { wtype: weaponType(i), ammo: i.ammo ?? 0, dur: i.dur ?? 0, up: i.up ?? 0 } : {}),
      })),
    supplies:       f.supplies,
    backpack:       f.backpack,
    health:         f.health,
    horror:         f.horror,
    conviction:     f.conviction,
    notes:          f.notes.trim() || null,
  }
}

function payloadKey(f: FormData): string {
  return JSON.stringify(formToPayload(f))
}

function validateForm(f: FormData): string | null {
  if (f.character_name.trim().length > TEXT_LIMITS.name) return `O nome deve ter no máximo ${TEXT_LIMITS.name} caracteres.`
  if (f.concept.trim().length > TEXT_LIMITS.concept) return `O conceito deve ter no máximo ${TEXT_LIMITS.concept} caracteres.`
  if (f.description.trim().length > TEXT_LIMITS.description) return `A descrição deve ter no máximo ${TEXT_LIMITS.description} caracteres.`
  if (f.background.trim().length > TEXT_LIMITS.background) return `Os antecedentes devem ter no máximo ${TEXT_LIMITS.background} caracteres.`
  if (f.notes.trim().length > TEXT_LIMITS.notes) return `As anotações devem ter no máximo ${TEXT_LIMITS.notes} caracteres.`
  return null
}

const AUTOSAVE_DELAY_MS = 800

type SaveState = 'saved' | 'pending' | 'saving' | 'error'

type TabId = 'personagem' | 'inventario' | 'suprimentos' | 'trunfos' | 'historia'

const TABS: { id: TabId; label: string }[] = [
  { id: 'personagem', label: 'Características' },
  { id: 'inventario',  label: 'Inventário' },
  { id: 'suprimentos', label: 'Suprimentos' },
  { id: 'trunfos',    label: 'Trunfos' },
  { id: 'historia',   label: 'História' },
]
const TAB_IDS = TABS.map((t) => t.id)

const DURATION_OPTIONS = CONDITION_DURATIONS.map((d) => ({ value: d.id, label: d.label }))
const KIND_OPTIONS = ITEM_KINDS.map((k) => ({ value: k.id, label: k.label }))
const WEAPON_LEVEL_OPTIONS = WEAPON_LEVELS.map((l) => ({ value: String(l.value), label: l.label }))
const PROTECTION_LEVEL_OPTIONS = PROTECTION_LEVELS.map((l) => ({ value: String(l.value), label: l.label }))
const WEAPON_PRESET_OPTIONS = [
  { value: '', label: 'Arma pronta…' },
  ...WEAPON_PRESETS.map((w) => ({ value: w.name, label: `${w.name} (dano ${w.damage})` })),
]
const TAG_OPTIONS = [
  { value: '',          label: 'Comum' },
  { value: 'motiva',    label: 'Motivação' },
  { value: 'desmotiva', label: 'Desmotivação' },
]

export function TdaSheetForm({ sheet, ownerName, onSave, saveError }: TdaSheetFormProps) {
  useTdaFonts()
  const [form, setForm] = useState<FormData>(() => sheetToForm(sheet))
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('personagem')
  const tabDir = useTabDirection(TAB_IDS, activeTab)
  const { tabsRef, selectTab, panelsStyle } = useStableTabPanels(setActiveTab)
  const [testing, setTesting] = useState<TdaTestPurpose | null>(null)
  const [horrorScene, setHorrorScene] = useState(false)
  const [combat, setCombat] = useState<TdaCombatMode | null>(null)

  // ── Salvamento automático (ver AltheriumSheetForm) ──
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const formRef   = useRef(form)
  const onSaveRef = useRef(onSave)
  const lastSaved = useRef(payloadKey(sheetToForm(sheet)))
  const inFlight  = useRef(false)
  const queued    = useRef(false)
  formRef.current   = form
  onSaveRef.current = onSave

  useEffect(() => {
    const incoming = payloadKey(sheetToForm(sheet))
    if (incoming === lastSaved.current) return
    lastSaved.current = incoming
    setForm(sheetToForm(sheet))
    setSaveState('saved')
  }, [sheet])

  async function flush(): Promise<void> {
    if (inFlight.current) { queued.current = true; return }
    const current = formRef.current
    const invalid = validateForm(current)
    if (invalid) { setError(invalid); setSaveState('error'); return }
    const key = payloadKey(current)
    if (key === lastSaved.current) { setSaveState('saved'); return }

    const previous = lastSaved.current
    lastSaved.current = key
    inFlight.current = true
    setSaveState('saving')
    try {
      await onSaveRef.current(formToPayload(current))
      setSaveState(payloadKey(formRef.current) === lastSaved.current ? 'saved' : 'pending')
    } catch {
      lastSaved.current = previous
      setSaveState('error')
    } finally {
      inFlight.current = false
      if (queued.current) { queued.current = false; void flush() }
    }
  }

  useEffect(() => {
    if (payloadKey(form) === lastSaved.current) {
      if (!inFlight.current) setSaveState('saved')
      return
    }
    setSaveState('pending')
    const timer = setTimeout(() => { void flush() }, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  useEffect(() => {
    const isDirty = () => inFlight.current || payloadKey(formRef.current) !== lastSaved.current
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirty()) return
      void flush()
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      if (payloadKey(formRef.current) !== lastSaved.current && !validateForm(formRef.current)) {
        void onSaveRef.current(formToPayload(formRef.current)).catch(() => {})
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError(null)
  }

  function update<K extends 'traits' | 'conditions' | 'trunfos' | 'inventory'>(
    key: K, id: string, patch: Partial<FormData[K][number]>,
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: (prev[key] as { id: string }[]).map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }))
    setError(null)
  }

  function remove(key: 'traits' | 'conditions' | 'trunfos' | 'inventory', id: string) {
    setForm((prev) => ({ ...prev, [key]: (prev[key] as { id: string }[]).filter((it) => it.id !== id) }))
  }

  function addTrait(name: string) {
    setForm((prev) => prev.traits.length >= TRAITS_MAX ? prev
      : { ...prev, traits: [...prev.traits, { id: newId(), name, tag: null }] })
  }

  function addCondition(name: string, duration: TdaConditionDuration = 'indeterminada') {
    setForm((prev) => prev.conditions.length >= CONDITIONS_MAX ? prev
      : { ...prev, conditions: [...prev.conditions, { id: newId(), name, duration }] })
  }

  function setSupply(key: SupplyKey, delta: number) {
    setForm((prev) => ({
      ...prev,
      supplies: { ...prev.supplies, [key]: Math.max(0, Math.min(Math.max(supplyCap(key, prev.backpack), prev.supplies[key]), prev.supplies[key] + delta)) },
    }))
  }

  function craftRecipe(id: string) {
    const recipe = RECIPES.find((r) => r.id === id)
    if (!recipe) return
    const res = craft(recipe, form.supplies, form.inventory, form.backpack)
    if ('error' in res) { setError(res.error); return }
    setForm((prev) => ({ ...prev, supplies: res.supplies, inventory: res.inventory }))
    setError(null)
    announceTda(sheet.campaign_id, `${who} fabricou ${recipe.name}.`)
  }

  function useKit() {
    if (form.supplies.kits < 1 || form.health >= HEALTH_MAX) return
    const next = clampHealth(form.health + KIT_HEAL)
    setForm((prev) => ({ ...prev, health: next, supplies: { ...prev.supplies, kits: prev.supplies.kits - 1 } }))
    announceTda(sheet.campaign_id, `${who} usou um kit médico: Vida ${form.health} → ${next}/${HEALTH_MAX}.`)
  }

  function takeSupplement(name: string) {
    if (form.supplies.suplementos < 1 || form.traits.length >= TRAITS_MAX) return
    setForm((prev) => ({
      ...prev,
      supplies: { ...prev.supplies, suplementos: prev.supplies.suplementos - 1 },
      traits: [...prev.traits, { id: newId(), name, tag: null }],
    }))
    announceTda(sheet.campaign_id, `${who} tomou um suplemento e ganhou uma característica: ${name}.`)
  }

  function upgradeOne(id: string) {
    const res = upgradeWeapon(form.inventory, id, form.supplies)
    if ('error' in res) { setError(res.error); return }
    setForm((prev) => ({ ...prev, supplies: res.supplies, inventory: res.inventory }))
    setError(null)
    const item = form.inventory.find((i) => i.id === id)
    announceTda(sheet.campaign_id, `${who} melhorou ${item?.name.trim() || 'uma arma'} na bancada.`)
  }

  function changeKind(id: string, kind: TdaInventoryItem['kind']) {
    setForm((prev) => ({
      ...prev,
      inventory: prev.inventory.map((i) => (i.id !== id ? i : normalizeWeapon(
        { ...i, kind, level: kind === 'item' ? 0 : i.level || 1, wtype: undefined, ammo: undefined, dur: undefined },
        prev.backpack,
      ))),
    }))
    setError(null)
  }

  const who = form.character_name.trim() || ownerName || 'Um sobrevivente'
  const band = horrorBand(form.horror)
  const hband = healthBand(form.health)
  const cost = convictionCost(form.horror)
  const suggestedHorror = initialHorror(form.traits)
  const tagged = form.traits.some((t) => t.tag)
  const traitsCount = form.traits.filter((t) => t.name.trim()).length
  const conditionsCount = form.conditions.filter((c) => c.name.trim()).length

  return (
    <form
      className="tda-sheet"
      onSubmit={(e: FormEvent) => { e.preventDefault(); void flush() }}
      noValidate
      style={{ '--tab-dir': tabDir } as CSSProperties}
    >
      {ownerName && <p className="tda-sheet__owner">Ficha de <strong>{ownerName}</strong></p>}

      {/* ── Cabeçalho: identidade + Horror/Convicção ── */}
      <header className="tda-hero">
        <div className="tda-hero__identity">
          <input
            type="text" className="tda-hero__name" placeholder="Nome do sobrevivente"
            maxLength={TEXT_LIMITS.name} value={form.character_name}
            onChange={(e) => set('character_name', e.target.value)} aria-label="Nome"
          />
          <label className="tda-field">
            <span className="tda-label">Conceito</span>
            <input
              type="text" className="input" maxLength={TEXT_LIMITS.concept}
              placeholder="Quem é você em poucas palavras. Ex.: Andarilho solitário"
              value={form.concept} onChange={(e) => set('concept', e.target.value)}
            />
          </label>
          <label className="tda-field">
            <span className="tda-label">Descrição</span>
            <textarea
              className="input tda-textarea" rows={3} maxLength={TEXT_LIMITS.description}
              placeholder="Idade, altura, peso, olhos, cabelo, marcas..."
              value={form.description} onChange={(e) => set('description', e.target.value)}
            />
          </label>
        </div>

        <div className="tda-hero__meters">
          <section className={`tda-meter tda-meter--health tda-meter--${hband.level}`} aria-label="Vida">
            <div className="tda-meter__head">
              <span className="tda-meter__title">Vida</span>
              <div className="tda-meter__controls">
                <button
                  type="button" className="tda-stepper__btn" aria-label="Menos um de Vida"
                  onClick={() => set('health', clampHealth(form.health - 1))} disabled={form.health <= 0}
                >
                  −
                </button>
                <span className="tda-meter__value">{form.health}<small>/{HEALTH_MAX}</small></span>
                <button
                  type="button" className="tda-stepper__btn" aria-label="Mais um de Vida"
                  onClick={() => set('health', clampHealth(form.health + 1))} disabled={form.health >= HEALTH_MAX}
                >
                  +
                </button>
              </div>
            </div>
            <Track
              max={HEALTH_MAX} value={form.health} groups={HEALTH_MAX} label="Vida"
              onChange={(v) => set('health', v)}
            />
            <p className="tda-meter__band"><strong>{hband.title}.</strong> {hband.effect}</p>
          </section>

          <section className={`tda-meter tda-meter--horror tda-meter--band-${band.min}`} aria-label="Horror">
            <div className="tda-meter__head">
              <span className="tda-meter__title">Horror</span>
              <span className="tda-meter__value">{form.horror}<small>/{HORROR_MAX}</small></span>
            </div>
            <Track
              max={HORROR_MAX} value={form.horror} groups={3} label="Horror"
              onChange={(v) => set('horror', v)}
            />
            <p className="tda-meter__band"><strong>{band.title}.</strong> {band.effect}</p>
          </section>

          <section className="tda-meter tda-meter--conviction" aria-label="Convicção">
            <div className="tda-meter__head">
              <span className="tda-meter__title">Convicção</span>
              <div className="tda-meter__controls">
                <button
                  type="button" className="tda-stepper__btn" aria-label="Menos um de Convicção"
                  onClick={() => set('conviction', Math.max(0, form.conviction - 1))} disabled={form.conviction <= 0}
                >
                  −
                </button>
                <span className="tda-meter__value">{form.conviction}<small>/{CONVICTION_MAX}</small></span>
                <button
                  type="button" className="tda-stepper__btn" aria-label="Mais um de Convicção"
                  onClick={() => set('conviction', Math.min(CONVICTION_MAX, form.conviction + 1))}
                  disabled={form.conviction >= CONVICTION_MAX}
                >
                  +
                </button>
              </div>
            </div>
            <Track
              max={CONVICTION_MAX} value={form.conviction} groups={CONVICTION_MAX} label="Convicção"
              onChange={(v) => set('conviction', v)}
            />
            <p className="tda-meter__band">1 ponto de desempenho garantido custa <strong>{cost}</strong> (o seu Horror).</p>
          </section>

          <div className="tda-hero__actions">
            <button type="button" className="tda-btn tda-btn--danger tda-btn--big" onClick={() => setCombat('atacar')}>
              Atacar
            </button>
            <button type="button" className="tda-btn tda-btn--big" onClick={() => setCombat('esquivar')}>
              Esquivar
            </button>
            <button type="button" className="tda-btn tda-btn--primary tda-btn--big" onClick={() => setTesting('teste')}>
              Fazer um teste
            </button>
            <button type="button" className="tda-btn tda-btn--big" onClick={() => setHorrorScene(true)}>
              Cena de horror
            </button>
            <button type="button" className="tda-btn" onClick={() => setTesting('redencao')} disabled={form.horror <= 0}>
              Redenção do horror
            </button>
            <button type="button" className="tda-btn" onClick={() => setTesting('conviccao')} disabled={form.conviction >= CONVICTION_MAX}>
              Recuperar Convicção
            </button>
          </div>
        </div>
      </header>

      {/* ── Abas ── */}
      <nav ref={tabsRef} className="campaign-tabs tda-sheet-tabs" role="tablist" aria-label="Seções da ficha">
        {TABS.map((tab) => (
          <button
            key={tab.id} type="button" role="tab"
            aria-selected={activeTab === tab.id} aria-controls={`tda-tabpanel-${tab.id}`}
            className={`campaign-tab ${activeTab === tab.id ? 'campaign-tab--active' : ''}`}
            onClick={() => selectTab(tab.id)}
          >
            <span className="campaign-tab__label">{tab.label}</span>
          </button>
        ))}
        <TabIndicator activeKey={activeTab} />
      </nav>

      <div className="tda-tab-panels" style={panelsStyle}>
        {/* ── Características e condições ── */}
        <div id="tda-tabpanel-personagem" role="tabpanel" hidden={activeTab !== 'personagem'}>
          {activeTab === 'personagem' && (
            <div className="tda-tab-panel tda-columns anim-tab-panel">
              <section className="tda-card">
                <div className="tda-card__header">
                  <h4 className="tda-card__title">Características fixas <span className="tda-card__subtitle">você é assim</span></h4>
                  <span className={`tda-counter${traitsCount > TRAITS_INITIAL_MAX ? ' tda-counter--info' : ''}`}>
                    {traitsCount}/{TRAITS_INITIAL_MAX}
                  </span>
                </div>
                <p className="tda-hint">
                  Habilidades, profissões, vícios, manias, sentimentos, defeitos... Cada uma que ajuda num teste vale +1d; cada uma que atrapalha, −1d.
                  Na criação são até {TRAITS_INITIAL_MAX}; o Narrador pode dar mais durante o jogo.
                </p>

                <ul className="tda-list">
                  {form.traits.map((t) => (
                    <li key={t.id} className="tda-row">
                      <input
                        type="text" className="input tda-row__name" maxLength={TEXT_LIMITS.item}
                        value={t.name} placeholder="Característica"
                        onChange={(e) => update('traits', t.id, { name: e.target.value })}
                        aria-label="Característica"
                      />
                      <Select
                        listClassName="tda-select-list"
                        className="tda-row__select" value={t.tag ?? ''}
                        onChange={(v) => update('traits', t.id, { tag: (v || null) as TdaTrait['tag'] })}
                        options={TAG_OPTIONS} aria-label="Efeito no Horror"
                      />
                      <button type="button" className="tda-row__remove" onClick={() => remove('traits', t.id)} aria-label={`Remover ${t.name || 'característica'}`}>×</button>
                    </li>
                  ))}
                </ul>
                <AddRow
                  placeholder="Nova característica (Enter)" maxLength={TEXT_LIMITS.item}
                  disabled={form.traits.length >= TRAITS_MAX} onAdd={addTrait}
                />

                <div className="tda-initial-horror">
                  <p className="tda-hint">
                    <strong>Motivação</strong> = algo que inibe o horror (−1 no Horror inicial);
                    {' '}<strong>Desmotivação</strong> = algo que o estimula (+1). Horror inicial pelas marcações: <strong>{suggestedHorror}</strong>.
                  </p>
                  {tagged && suggestedHorror !== form.horror && (
                    <button type="button" className="tda-btn" onClick={() => set('horror', suggestedHorror)}>
                      Usar {suggestedHorror} como Horror
                    </button>
                  )}
                </div>
              </section>

              <section className="tda-card">
                <div className="tda-card__header">
                  <h4 className="tda-card__title">Condições <span className="tda-card__subtitle">você está assim</span></h4>
                  <span className="tda-counter">{conditionsCount}</span>
                </div>
                <p className="tda-hint">
                  Características temporárias: ferido, exausto, bêbado, apavorado... Somam ou tiram dados como as fixas, até sumirem.
                  Na criação, até {CONDITIONS_INITIAL_MAX}.
                </p>

                <ul className="tda-list">
                  {form.conditions.map((c) => (
                    <li key={c.id} className="tda-row">
                      <input
                        type="text" className="input tda-row__name" maxLength={TEXT_LIMITS.item}
                        value={c.name} placeholder="Condição"
                        onChange={(e) => update('conditions', c.id, { name: e.target.value })}
                        aria-label="Condição"
                      />
                      <Select
                        listClassName="tda-select-list"
                        className="tda-row__select" value={c.duration}
                        onChange={(v) => update('conditions', c.id, { duration: v as TdaConditionDuration })}
                        options={DURATION_OPTIONS} aria-label="Duração"
                      />
                      <button type="button" className="tda-row__remove" onClick={() => remove('conditions', c.id)} aria-label={`Remover ${c.name || 'condição'}`}>×</button>
                    </li>
                  ))}
                </ul>
                <AddRow
                  placeholder="Nova condição (Enter)" maxLength={TEXT_LIMITS.item}
                  disabled={form.conditions.length >= CONDITIONS_MAX} onAdd={(name) => addCondition(name)}
                />
                <p className="tda-hint">
                  Duração: {CONDITION_DURATIONS.map((d) => `${d.label.toLowerCase()} (${d.hint.toLowerCase().replace(/\.$/, '')})`).join('; ')}.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* ── Inventário ── */}
        <div id="tda-tabpanel-inventario" role="tabpanel" hidden={activeTab !== 'inventario'}>
          {activeTab === 'inventario' && (
            <div className="tda-tab-panel anim-tab-panel">
              <section className="tda-card">
                <div className="tda-card__header">
                  <h4 className="tda-card__title">Inventário</h4>
                  <span className="tda-counter">{form.inventory.length}</span>
                </div>
                <p className="tda-hint">
                  Armas têm <strong>Dano</strong> (1 a 6): é o que tiram do alvo quando você acerta, e não somam dados no teste.
                  Proteções somam dados ao se defender: baixa 1d, alta 2d, extrema 3d.
                  Armas de fogo gastam balas, corpo a corpo gasta usos e arremessos somem ao usar. O limite do que cabe e os materiais ficam na aba Suprimentos.
                </p>
                <ul className="tda-list">
                  {form.inventory.map((it) => (
                    <li key={it.id} className="tda-item">
                      <div className="tda-row tda-row--item">
                      <input
                        type="number" className="input tda-row__qty" min={1} max={9999}
                        value={it.qty} aria-label="Quantidade"
                        onChange={(e) => update('inventory', it.id, { qty: Math.max(1, Math.min(9999, parseInt(e.target.value, 10) || 1)) })}
                      />
                      <input
                        type="text" className="input tda-row__name" maxLength={TEXT_LIMITS.item}
                        value={it.name} placeholder="Item" aria-label="Item"
                        onChange={(e) => update('inventory', it.id, { name: e.target.value })}
                      />
                      <Select
                        listClassName="tda-select-list"
                        className="tda-row__select" value={it.kind}
                        onChange={(v) => changeKind(it.id, v as TdaInventoryItem['kind'])}
                        options={KIND_OPTIONS} aria-label="Tipo"
                      />
                      {it.kind !== 'item' && (
                        <Select
                          listClassName="tda-select-list"
                          className="tda-row__select" value={String(it.level || 1)}
                          onChange={(v) => update('inventory', it.id, { level: Number(v) })}
                          options={it.kind === 'arma' ? WEAPON_LEVEL_OPTIONS : PROTECTION_LEVEL_OPTIONS}
                          aria-label={it.kind === 'arma' ? 'Dano' : 'Proteção'}
                        />
                      )}
                      <button type="button" className="tda-row__remove" onClick={() => remove('inventory', it.id)} aria-label={`Remover ${it.name || 'item'}`}>×</button>
                      </div>
                      {it.kind === 'arma' && (
                        <WeaponExtras
                          item={it} backpack={form.backpack} supplies={form.supplies}
                          onChange={(patch) => update('inventory', it.id, patch)}
                          onUpgrade={() => upgradeOne(it.id)}
                        />
                      )}
                    </li>
                  ))}
                </ul>
                <div className="tda-field">
                  <Select
                    listClassName="tda-select-list"
                    value="" options={WEAPON_PRESET_OPTIONS} aria-label="Adicionar arma pronta"
                    disabled={form.inventory.length >= INVENTORY_MAX}
                    onChange={(name) => {
                      const preset = WEAPON_PRESETS.find((w) => w.name === name)
                      if (!preset) return
                      setForm((prev) => ({
                        ...prev,
                        inventory: [...prev.inventory, normalizeWeapon(
                          { id: newId(), name: preset.name, qty: 1, kind: 'arma', level: preset.damage, wtype: preset.wtype },
                          prev.backpack,
                        )],
                      }))
                    }}
                  />
                </div>
                <AddRow
                  placeholder="Novo item (Enter). Ex.: Pistola calibre 38" maxLength={TEXT_LIMITS.item}
                  disabled={form.inventory.length >= INVENTORY_MAX}
                  onAdd={(name) => setForm((prev) => ({
                    ...prev, inventory: [...prev.inventory, { id: newId(), name, qty: 1, kind: 'item', level: 0 }],
                  }))}
                />
              </section>
            </div>
          )}
        </div>

        {/* ── Suprimentos ── */}
        <div id="tda-tabpanel-suprimentos" role="tabpanel" hidden={activeTab !== 'suprimentos'}>
          {activeTab === 'suprimentos' && (
            <TdaSuppliesTab
              supplies={form.supplies} backpack={form.backpack} health={form.health}
              traitsFull={form.traits.length >= TRAITS_MAX}
              onSupply={setSupply}
              onBackpack={(v) => set('backpack', clampBackpack(v))}
              onCraft={craftRecipe}
              onUseKit={useKit}
              onSupplement={takeSupplement}
            />
          )}
        </div>

        {/* ── Trunfos ── */}
        <div id="tda-tabpanel-trunfos" role="tabpanel" hidden={activeTab !== 'trunfos'}>
          {activeTab === 'trunfos' && (
            <div className="tda-tab-panel anim-tab-panel">
              <section className="tda-card">
                <div className="tda-card__header">
                  <h4 className="tda-card__title">Trunfos</h4>
                  <span className="tda-counter">{form.trunfos.length}</span>
                </div>
                <ul className="tda-list tda-list--trunfos">
                  {form.trunfos.map((t) => (
                    <li key={t.id} className="tda-trunfo">
                      <div className="tda-row">
                        <input
                          type="text" className="input tda-row__name" maxLength={TEXT_LIMITS.item}
                          value={t.name} placeholder="Nome do trunfo" aria-label="Nome do trunfo"
                          onChange={(e) => update('trunfos', t.id, { name: e.target.value })}
                        />
                        <button type="button" className="tda-row__remove" onClick={() => remove('trunfos', t.id)} aria-label={`Remover ${t.name || 'trunfo'}`}>×</button>
                      </div>
                      <textarea
                        className="input tda-textarea" rows={2} maxLength={TEXT_LIMITS.trunfoDesc}
                        value={t.description} placeholder="O que ele faz" aria-label="Descrição do trunfo"
                        onChange={(e) => update('trunfos', t.id, { description: e.target.value })}
                      />
                    </li>
                  ))}
                </ul>
                {form.trunfos.length === 0 && <p className="tda-hint">Nenhum trunfo anotado.</p>}
                <div className="tda-actions tda-actions--start">
                  <button
                    type="button" className="tda-btn" disabled={form.trunfos.length >= TRUNFOS_MAX}
                    onClick={() => setForm((prev) => ({
                      ...prev, trunfos: [...prev.trunfos, { id: newId(), name: '', description: '' }],
                    }))}
                  >
                    + Trunfo
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* ── Antecedentes e anotações ── */}
        <div id="tda-tabpanel-historia" role="tabpanel" hidden={activeTab !== 'historia'}>
          {activeTab === 'historia' && (
            <div className="tda-tab-panel anim-tab-panel">
              <section className="tda-card">
                <div className="tda-card__header">
                  <h4 className="tda-card__title">Antecedentes</h4>
                  <span className="tda-counter">{form.background.length}/{TEXT_LIMITS.background}</span>
                </div>
                <p className="tda-hint">
                  Como sobreviveu? Algum ente querido está vivo? Motivações, aliados, inimigos, ocupação, dogmas... Ainda acredita em cura?
                </p>
                <textarea
                  className="input tda-textarea tda-textarea--tall" rows={10} maxLength={TEXT_LIMITS.background}
                  value={form.background} onChange={(e) => set('background', e.target.value)} aria-label="Antecedentes"
                />
              </section>
              <section className="tda-card">
                <div className="tda-card__header">
                  <h4 className="tda-card__title">Anotações</h4>
                  <span className="tda-counter">{form.notes.length}/{TEXT_LIMITS.notes}</span>
                </div>
                <textarea
                  className="input tda-textarea" rows={6} maxLength={TEXT_LIMITS.notes}
                  value={form.notes} onChange={(e) => set('notes', e.target.value)} aria-label="Anotações"
                />
              </section>
            </div>
          )}
        </div>
      </div>

      {/* ── Rodapé: salvamento ── */}
      <footer className="tda-sheet__footer">
        {(error || saveError) && <p className="tda-warn" role="alert">{error ?? saveError}</p>}
        <span className={`alth-save-status alth-save-status--${saveState}`} role="status" aria-live="polite">
          {saveState === 'saved'   && '✓ Tudo salvo'}
          {saveState === 'pending' && 'Alterações pendentes…'}
          {saveState === 'saving'  && <><span className="spinner spinner--sm" /> Salvando…</>}
          {saveState === 'error'   && 'Erro ao salvar'}
        </span>
        {(saveState === 'pending' || saveState === 'error') && (
          <button type="submit" className="tda-btn">{saveState === 'error' ? 'Tentar de novo' : 'Salvar agora'}</button>
        )}
      </footer>

      <Presence show={combat !== null} exitMs={220}>
        {() => combat && (
          <TdaCombatModal
            campaignId={sheet.campaign_id}
            who={who}
            traits={form.traits} conditions={form.conditions} inventory={form.inventory}
            health={form.health} horror={form.horror} conviction={form.conviction}
            initialMode={combat}
            onHealth={(value) => set('health', clampHealth(value))}
            onConviction={(delta) => setForm((prev) => ({
              ...prev, conviction: Math.max(0, Math.min(CONVICTION_MAX, prev.conviction + delta)),
            }))}
            onUseWeapon={(id) => setForm((prev) => ({ ...prev, inventory: spendWeaponUse(prev.inventory, id) }))}
            onAnnounce={(msg) => announceTda(sheet.campaign_id, msg)}
            onClose={() => setCombat(null)}
          />
        )}
      </Presence>

      <Presence show={testing !== null} exitMs={220}>
        {() => testing && (
          <TdaTestModal
            campaignId={sheet.campaign_id}
            who={who}
            traits={form.traits} conditions={form.conditions} inventory={form.inventory}
            horror={form.horror} conviction={form.conviction}
            initialPurpose={testing}
            onConviction={(delta) => setForm((prev) => ({
              ...prev, conviction: Math.max(0, Math.min(CONVICTION_MAX, prev.conviction + delta)),
            }))}
            onHorror={(delta) => setForm((prev) => ({
              ...prev, horror: Math.max(0, Math.min(HORROR_MAX, prev.horror + delta)),
            }))}
            onAnnounce={(msg) => announceTda(sheet.campaign_id, msg)}
            onClose={() => setTesting(null)}
          />
        )}
      </Presence>

      <Presence show={horrorScene} exitMs={220}>
        {() => horrorScene && (
          <TdaHorrorModal
            campaignId={sheet.campaign_id}
            who={who}
            traits={form.traits} conditions={form.conditions} inventory={form.inventory}
            horror={form.horror}
            onApply={(value) => set('horror', value)}
            onAddCondition={(name) => addCondition(name)}
            onAddTrait={addTrait}
            onAnnounce={(msg) => announceTda(sheet.campaign_id, msg)}
            onClose={() => setHorrorScene(false)}
          />
        )}
      </Presence>
    </form>
  )
}

// ── Trilha de caixinhas (Horror, Convicção) ─────────────

interface TrackProps {
  max:      number
  value:    number
  /** De quantas em quantas caixinhas separa um grupo. */
  groups:   number
  label:    string
  onChange: (value: number) => void
}

/** Clicar na caixinha N marca até N; clicar na última marcada desmarca ela. */
function Track({ max, value, groups, label, onChange }: TrackProps) {
  return (
    <div className="tda-track" role="group" aria-label={label}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          className={`tda-track__box${n <= value ? ' tda-track__box--on' : ''}${n % groups === 0 && n < max ? ' tda-track__box--gap' : ''}`}
          data-band={Math.ceil(n / 3)}
          onClick={() => onChange(n === value ? n - 1 : n)}
          aria-label={`${label} ${n}`}
          aria-pressed={n <= value}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

// ── Linha de adicionar ──────────────────────────────────

interface WeaponExtrasProps {
  item:      TdaInventoryItem
  backpack:  number
  supplies:  TdaSupplies
  onChange:  (patch: Partial<TdaInventoryItem>) => void
  onUpgrade: () => void
}

/** Linha de baixo de uma arma: tipo, balas ou usos, e melhorias na bancada. */
function WeaponExtras({ item, backpack, supplies, onChange, onUpgrade }: WeaponExtrasProps) {
  const type = weaponType(item)
  const up = item.up ?? 0
  const canUpgrade = up < UPGRADE_MAX && supplies.pecas >= 1 && supplies.sucata >= 1
  const typeOptions = WEAPON_TYPES.map((t) => ({ value: t.id, label: t.label }))

  function changeType(next: string) {
    const wtype = next as TdaInventoryItem['wtype']
    const draft = { ...item, wtype }
    onChange({
      wtype,
      ammo: wtype === 'fogo' ? Math.min(item.ammo || 6, ammoCap(draft, backpack)) : 0,
      dur:  wtype === 'corpo' ? Math.min(item.dur || durabilityMax(draft), durabilityMax(draft)) : 0,
    })
  }

  return (
    <div className="tda-item__extras">
      <Select
        listClassName="tda-select-list" className="tda-item__type"
        value={type} onChange={changeType} options={typeOptions} aria-label="Tipo de arma"
      />

      {type === 'fogo' && (
        <span className="tda-item__stock">
          <span className="tda-item__label">Balas</span>
          <span className="tda-stepper">
            <button type="button" className="tda-stepper__btn" aria-label="Menos uma bala"
              onClick={() => onChange({ ammo: Math.max(0, (item.ammo ?? 0) - 1) })} disabled={(item.ammo ?? 0) <= 0}>−</button>
            <span className="tda-stepper__value">{item.ammo ?? 0}<small>/{ammoCap(item, backpack)}</small></span>
            <button type="button" className="tda-stepper__btn" aria-label="Mais uma bala"
              onClick={() => onChange({ ammo: (item.ammo ?? 0) + 1 })} disabled={(item.ammo ?? 0) >= ammoCap(item, backpack)}>+</button>
          </span>
        </span>
      )}

      {type === 'corpo' && (
        <span className="tda-item__stock">
          <span className="tda-item__label">Usos</span>
          <span className="tda-stepper">
            <button type="button" className="tda-stepper__btn" aria-label="Menos um uso"
              onClick={() => onChange({ dur: Math.max(0, (item.dur ?? 0) - 1) })} disabled={(item.dur ?? 0) <= 0}>−</button>
            <span className="tda-stepper__value">{item.dur ?? 0}<small>/{durabilityMax(item)}</small></span>
            <button type="button" className="tda-stepper__btn" aria-label="Mais um uso"
              onClick={() => onChange({ dur: (item.dur ?? 0) + 1 })} disabled={(item.dur ?? 0) >= durabilityMax(item)}>+</button>
          </span>
          {(item.dur ?? 0) === 0 && <span className="tda-warn">Quebrada</span>}
        </span>
      )}

      {type === 'consumivel' && (
        <span className="tda-item__stock tda-hint">Cabem até {throwableCap(backpack)}.</span>
      )}

      <span className="tda-item__stock">
        <span className="tda-item__label">Melhoria</span>
        <span className="tda-item__up">{up}/{UPGRADE_MAX}</span>
        {type !== 'consumivel' && (
          <button
            type="button" className="tda-btn" onClick={onUpgrade} disabled={!canUpgrade}
            title="Gasta 1 Peça e 1 Sucata: +2 balas ou +2 usos. O dano não muda."
          >
            Melhorar
          </button>
        )}
      </span>
    </div>
  )
}

interface AddRowProps {
  placeholder: string
  maxLength:   number
  disabled?:   boolean
  onAdd:       (name: string) => void
}

function AddRow({ placeholder, maxLength, disabled = false, onAdd }: AddRowProps) {
  const [text, setText] = useState('')
  function add() {
    const name = text.trim()
    if (!name || disabled) return
    onAdd(name)
    setText('')
  }
  return (
    <div className="tda-add-row">
      <input
        type="text" className="input" maxLength={maxLength} placeholder={placeholder}
        value={text} disabled={disabled} aria-label={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
      />
      <button type="button" className="tda-btn" onClick={add} disabled={disabled || !text.trim()}>Adicionar</button>
    </div>
  )
}
