import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { TabIndicator, useStableTabPanels, useTabDirection } from '../../../../shared/components/TabIndicator'
import { parseDiceFormula, recordRoll, rollParsedFormula } from '../../../dice/services/diceService'
import { getMyDiceSkin } from '../../../dice3d/diceSkinService'
import { DEFAULT_SKIN } from '../../../dice3d/skins'
import { supabase } from '../../../../shared/lib/supabase'
import {
  DH_CLASS_LABELS, DH_DOMAIN_LABELS, DH_HOPE_MAX, DH_STRESS_MAX, DH_HP_MAX_SLOTS,
} from '../constants/daggerheart'
import { DH_ANCESTRIES, DH_COMMUNITIES } from '../catalog/ancestries'
import { DH_ALL_ARMOR } from '../catalog/armor'
// DH_ALL_WEAPONS não usado diretamente (armas criadas manualmente)

import { computeThresholds, describeRollOutcome, resolveDualityRoll } from '../rules/derive'
import {
  addDhDomainCard, addDhExperience, addDhInventoryItem, addDhWeapon,
  deleteDhDomainCard, deleteDhExperience, deleteDhInventoryItem, deleteDhWeapon,
  updateDhDomainCard, updateDhExperience, updateDhInventoryItem, updateDhWeapon,
} from '../services/dhSheetService'
import type {
  DhCharacterSheet, DhDomainCard, DhExperience, DhFullSheet,
  DhInventoryItem, DhSheetUpdateInput, DhTraitKey, DhWeapon,
} from '../rules/types'
import '../../components/SheetPanel.css'
import './DaggerheartSheet.css'

// ────────────────────────────────────────────────────────
// DhSheetForm: ficha DaggerHeart com abas e salvamento automático (800 ms).
// Slots de PV/Estresse são salvos na hora; campos de texto esperam o delay.
// ────────────────────────────────────────────────────────

interface DhSheetFormProps {
  full:       DhFullSheet
  ownerName?: string
  onSave:     (patch: DhSheetUpdateInput) => Promise<void>
  saveError:  string | null
}

type TabId = 'personagem' | 'combate' | 'dominio' | 'inventario' | 'anotacoes'
const TABS: { id: TabId; label: string }[] = [
  { id: 'personagem',  label: 'Personagem'  },
  { id: 'combate',     label: 'Combate'     },
  { id: 'dominio',     label: 'Domínio'     },
  { id: 'inventario',  label: 'Inventário'  },
  { id: 'anotacoes',   label: 'Anotações'   },
]
const TAB_IDS = TABS.map((t) => t.id)

const AUTOSAVE_DELAY_MS = 800
type SaveState = 'saved' | 'pending' | 'saving' | 'error'

const TRAITS: { key: DhTraitKey; label: string; abbr: string }[] = [
  { key: 'agility',   label: 'Agilidade',    abbr: 'AGI' },
  { key: 'strength',  label: 'Força',        abbr: 'FOR' },
  { key: 'finesse',   label: 'Destreza',     abbr: 'DES' },
  { key: 'instinct',  label: 'Instinto',     abbr: 'INS' },
  { key: 'presence',  label: 'Presença',     abbr: 'PRE' },
  { key: 'knowledge', label: 'Conhecimento', abbr: 'CON' },
]

const TRAIT_MOD_OPTIONS = [-1, 0, 1, 2]

export function DhSheetForm({ full: initialFull, ownerName, onSave, saveError }: DhSheetFormProps) {
  const [sheet, setSheet]       = useState(initialFull.sheet)
  const [experiences, setExps]  = useState(initialFull.experiences)
  const [cards, setCards]       = useState(initialFull.cards)
  const [weapons, setWeapons]   = useState(initialFull.weapons)
  const [inventory, setInventory] = useState(initialFull.inventory)

  const [activeTab, setActiveTab] = useState<TabId>('personagem')
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const tabDir = useTabDirection(TAB_IDS, activeTab)
  const { tabsRef, selectTab, panelsStyle } = useStableTabPanels(setActiveTab)

  // ── Autosave ──────────────────────────────────────────
  const sheetRef  = useRef(sheet)
  sheetRef.current = sheet
  const dirtyRef  = useRef<DhSheetUpdateInput>({})
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = useRef(false)
  const echoRef   = useRef<string | null>(null)

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setSaveState('pending')
    timerRef.current = setTimeout(async () => {
      if (savingRef.current || Object.keys(dirtyRef.current).length === 0) return
      const patch = { ...dirtyRef.current }
      dirtyRef.current = {}
      savingRef.current = true
      setSaveState('saving')
      try {
        echoRef.current = JSON.stringify(patch)
        await onSave(patch)
        setSaveState('saved')
      } catch {
        setSaveState('error')
        dirtyRef.current = { ...patch, ...dirtyRef.current }
      } finally {
        savingRef.current = false
      }
    }, AUTOSAVE_DELAY_MS)
  }, [onSave])

  function field<K extends keyof DhSheetUpdateInput>(key: K, value: DhSheetUpdateInput[K]) {
    setSheet((prev) => ({ ...prev, [key]: value } as DhCharacterSheet))
    dirtyRef.current[key] = value
    scheduleSave()
  }

  async function saveNow(patch: DhSheetUpdateInput) {
    if (timerRef.current) clearTimeout(timerRef.current)
    dirtyRef.current = {}
    setSaveState('saving')
    try {
      await onSave(patch)
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
  }

  // ── Slot click (salva na hora) ────────────────────────
  function slotClick(key: 'hp_current' | 'stress_current' | 'hope' | 'armor_score_current', i: number) {
    const val = sheet[key] === i ? i - 1 : i
    const next = Math.max(0, val)
    setSheet((prev) => ({ ...prev, [key]: next } as DhCharacterSheet))
    void saveNow({ [key]: next })
  }

  // ── Limiares calculados ───────────────────────────────
  const thresholds = useMemo(() => computeThresholds({
    level:       sheet.level,
    proficiency: sheet.proficiency,
    traits:      {
      agility:   sheet.trait_agility,
      strength:  sheet.trait_strength,
      finesse:   sheet.trait_finesse,
      instinct:  sheet.trait_instinct,
      presence:  sheet.trait_presence,
      knowledge: sheet.trait_knowledge,
    },
    armor: {
      base_major:  sheet.armor_base_major,
      base_severe: sheet.armor_base_severe,
      score:       sheet.armor_score,
    },
  }), [sheet])

  // ── Save state label ──────────────────────────────────
  const stateLabel = saveState === 'pending' ? 'pendente…' : saveState === 'saving' ? 'salvando…'
    : saveState === 'error' ? 'erro ao salvar' : ''

  const ctx: FormCtx = {
    sheet, experiences, cards, weapons, inventory,
    field, saveNow, slotClick, thresholds,
    setExps, setCards, setWeapons, setInventory,
  }

  return (
    <div className="dh-form">
      {/* Cabeçalho */}
      <div className="dh-form__header">
        <div className="dh-form__title-row">
          <input
            className="dh-form__char-name input"
            placeholder="Nome do personagem"
            value={sheet.character_name ?? ''}
            onChange={(e) => field('character_name', e.target.value)}
          />
          <span className="dh-form__level-badge">Nível {sheet.level}</span>
          {DH_CLASS_LABELS[sheet.class_key] && (
            <span className="dh-form__class-badge">{DH_CLASS_LABELS[sheet.class_key]}</span>
          )}
        </div>
        {ownerName && (
          <div className="sheet-form__owner">
            <span className="sheet-form__owner-label">Jogador</span>
            <span className="sheet-form__owner-name">{ownerName}</span>
          </div>
        )}
        {stateLabel && <span className="dh-form__save-state">{stateLabel}</span>}
        {saveError && <div className="sheet-feedback sheet-feedback--error" role="alert">{saveError}</div>}
      </div>

      {/* Abas */}
      <div className="dh-tabs-wrapper">
        <div className="dh-tabs" ref={tabsRef as React.RefObject<HTMLDivElement>} role="tablist" aria-label="Seções da ficha">
          {TABS.map((tab) => (
            <button
              key={tab.id} role="tab" type="button"
              id={`dh-tab-${tab.id}`} aria-controls={`dh-panel-${tab.id}`}
              aria-selected={activeTab === tab.id}
              className={`dh-tab${activeTab === tab.id ? ' dh-tab--active' : ''}`}
              onClick={() => selectTab(tab.id as TabId)}
            >
              {tab.label}
            </button>
          ))}
          <TabIndicator activeKey={activeTab} />
        </div>

        <div className="dh-panels" style={panelsStyle}>
          {TAB_IDS.map((id, idx) => (
            <div
              key={id} id={`dh-panel-${id}`} role="tabpanel" aria-labelledby={`dh-tab-${id}`}
              aria-hidden={activeTab !== id}
              className={`dh-panel anim-tab-${tabDir > 0 ? 'forward' : 'back'}`}
              style={{ '--tab-idx': idx } as React.CSSProperties}
            >
              {id === 'personagem' && <PersonagemTab ctx={ctx} />}
              {id === 'combate'    && <CombateTab    ctx={ctx} />}
              {id === 'dominio'    && <DominioTab    ctx={ctx} />}
              {id === 'inventario' && <InventarioTab ctx={ctx} />}
              {id === 'anotacoes'  && <AnotacoesTab  ctx={ctx} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Contexto interno (não exposto) ────────────────────

interface FormCtx {
  sheet:       DhCharacterSheet
  experiences: DhExperience[]
  cards:       DhDomainCard[]
  weapons:     DhWeapon[]
  inventory:   DhInventoryItem[]
  field:       <K extends keyof DhSheetUpdateInput>(k: K, v: DhSheetUpdateInput[K]) => void
  saveNow:     (patch: DhSheetUpdateInput) => Promise<void>
  slotClick:   (key: 'hp_current' | 'stress_current' | 'hope' | 'armor_score_current', i: number) => void
  thresholds:  { major: number; severe: number }
  setExps:     React.Dispatch<React.SetStateAction<DhExperience[]>>
  setCards:    React.Dispatch<React.SetStateAction<DhDomainCard[]>>
  setWeapons:  React.Dispatch<React.SetStateAction<DhWeapon[]>>
  setInventory: React.Dispatch<React.SetStateAction<DhInventoryItem[]>>
}

// ── Componente de slots ───────────────────────────────

function SlotRow({ label, current, max, onToggle, colorClass = 'dh-slot--hp' }: {
  label: string; current: number; max: number
  onToggle: (i: number) => void; colorClass?: string
}) {
  return (
    <div className="dh-slot-group">
      <span className="dh-slot-label">{label}</span>
      <div className="dh-slots">
        {Array.from({ length: max }, (_, idx) => idx + 1).map((i) => (
          <button
            key={i} type="button"
            className={`dh-slot ${i <= current ? `dh-slot--filled ${colorClass}` : ''}`}
            onClick={() => onToggle(i)}
            aria-label={`${label} ${i} ${i <= current ? '(marcado)' : ''}`}
          />
        ))}
      </div>
      <span className="dh-slot-count">{current}/{max}</span>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// ABA: PERSONAGEM
// ════════════════════════════════════════════════════════

const PersonagemTab = memo(function PersonagemTab({ ctx }: { ctx: FormCtx }) {
  const { sheet, field } = ctx
  return (
    <div className="dh-tab-content">
      {/* Identidade */}
      <section className="dh-section">
        <h4 className="dh-section__title">Identidade</h4>
        <div className="dh-row dh-row--2">
          <label className="dh-field">
            <span className="dh-field__label">Nome</span>
            <input className="input" value={sheet.character_name ?? ''} onChange={(e) => field('character_name', e.target.value)} />
          </label>
          <label className="dh-field">
            <span className="dh-field__label">Pronomes</span>
            <input className="input" placeholder="ex: ela/dela" value={sheet.pronouns ?? ''} onChange={(e) => field('pronouns', e.target.value)} />
          </label>
        </div>
        <div className="dh-row dh-row--3">
          <label className="dh-field">
            <span className="dh-field__label">Classe</span>
            <select className="input" value={sheet.class_key} onChange={(e) => field('class_key', e.target.value as DhCharacterSheet['class_key'])}>
              {Object.entries(DH_CLASS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="dh-field">
            <span className="dh-field__label">Subclasse</span>
            <input className="input" placeholder="ex: Arqueiro" value={sheet.subclass_key ?? ''} onChange={(e) => field('subclass_key', e.target.value || null)} />
          </label>
          <label className="dh-field">
            <span className="dh-field__label">Nível</span>
            <input className="input" type="number" min={1} max={10} value={sheet.level}
              onChange={(e) => field('level', Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))} />
          </label>
        </div>
        <div className="dh-row dh-row--2">
          <label className="dh-field">
            <span className="dh-field__label">Ancestral</span>
            <select className="input" value={sheet.ancestry ?? ''} onChange={(e) => field('ancestry', e.target.value || null)}>
              <option value="">— escolher —</option>
              {DH_ANCESTRIES.map((a) => <option key={a.key} value={a.key}>{a.name_pt}</option>)}
            </select>
          </label>
          <label className="dh-field">
            <span className="dh-field__label">Comunidade</span>
            <select className="input" value={sheet.community ?? ''} onChange={(e) => field('community', e.target.value || null)}>
              <option value="">— escolher —</option>
              {DH_COMMUNITIES.map((c) => <option key={c.key} value={c.key}>{c.name_pt}</option>)}
            </select>
          </label>
        </div>
      </section>

      {/* Traços */}
      <section className="dh-section">
        <h4 className="dh-section__title">Traços <span className="dh-section__hint">(+2 / +1 / +1 / 0 / 0 / −1)</span></h4>
        <div className="dh-traits-grid">
          {TRAITS.map(({ key, abbr, label }) => {
            const fkey = `trait_${key}` as keyof DhCharacterSheet
            const val  = sheet[fkey] as number
            return (
              <div key={key} className="dh-trait">
                <span className="dh-trait__abbr">{abbr}</span>
                <select
                  className="dh-trait__select"
                  value={val}
                  onChange={(e) => field(fkey as keyof DhSheetUpdateInput, parseInt(e.target.value))}
                >
                  {TRAIT_MOD_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n >= 0 ? `+${n}` : n}</option>
                  ))}
                </select>
                <span className="dh-trait__label">{label}</span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
})

// ════════════════════════════════════════════════════════
// ABA: COMBATE
// ════════════════════════════════════════════════════════

const CombateTab = memo(function CombateTab({ ctx }: { ctx: FormCtx }) {
  const { sheet, field, slotClick, thresholds } = ctx
  return (
    <div className="dh-tab-content">
      {/* PV e Estresse */}
      <section className="dh-section">
        <h4 className="dh-section__title">PV &amp; Estresse</h4>
        <SlotRow label="PV" current={sheet.hp_current} max={sheet.hp_max}
          onToggle={(i) => slotClick('hp_current', i)} colorClass="dh-slot--hp" />
        <SlotRow label="Estresse" current={sheet.stress_current} max={sheet.stress_max}
          onToggle={(i) => slotClick('stress_current', i)} colorClass="dh-slot--stress" />
        <div className="dh-row dh-row--2">
          <label className="dh-field">
            <span className="dh-field__label">Máx. PV</span>
            <input className="input" type="number" min={1} max={DH_HP_MAX_SLOTS} value={sheet.hp_max}
              onChange={(e) => field('hp_max', Math.max(1, Math.min(DH_HP_MAX_SLOTS, parseInt(e.target.value) || 6)))} />
          </label>
          <label className="dh-field">
            <span className="dh-field__label">Máx. Estresse</span>
            <input className="input" type="number" min={1} max={DH_STRESS_MAX} value={sheet.stress_max}
              onChange={(e) => field('stress_max', Math.max(1, Math.min(DH_STRESS_MAX, parseInt(e.target.value) || 6)))} />
          </label>
        </div>
      </section>

      {/* Esperança */}
      <section className="dh-section">
        <h4 className="dh-section__title">Esperança</h4>
        <SlotRow label="Esperança" current={sheet.hope} max={DH_HOPE_MAX}
          onToggle={(i) => slotClick('hope', i)} colorClass="dh-slot--hope" />
      </section>

      {/* Armadura */}
      <section className="dh-section">
        <h4 className="dh-section__title">Armadura</h4>
        <div className="dh-row dh-row--2">
          <label className="dh-field">
            <span className="dh-field__label">Tipo</span>
            <select className="input" value={sheet.armor_name ?? ''} onChange={(e) => {
              const armor = DH_ALL_ARMOR.find((a) => a.key === e.target.value)
              if (armor) {
                field('armor_name', armor.key)
                void ctx.saveNow({
                  armor_name: armor.key,
                  armor_score: armor.score,
                  armor_score_current: armor.score,
                  armor_base_major: armor.base_major,
                  armor_base_severe: armor.base_severe,
                })
              } else {
                field('armor_name', null)
              }
            }}>
              <option value="">— personalizado —</option>
              {DH_ALL_ARMOR.map((a) => <option key={a.key} value={a.key}>{a.name_pt}</option>)}
            </select>
          </label>
          <div className="dh-field">
            <span className="dh-field__label">Slots de Armadura</span>
            <SlotRow label="" current={sheet.armor_score_current} max={sheet.armor_score || 1}
              onToggle={(i) => slotClick('armor_score_current', i)} colorClass="dh-slot--armor" />
          </div>
        </div>
        <div className="dh-thresholds">
          <div className="dh-threshold">
            <span className="dh-threshold__label">Limiar Grave</span>
            <span className="dh-threshold__value">{thresholds.major}</span>
          </div>
          <div className="dh-threshold">
            <span className="dh-threshold__label">Limiar Severo</span>
            <span className="dh-threshold__value">{thresholds.severe}</span>
          </div>
        </div>
      </section>

      {/* Outros valores */}
      <section className="dh-section">
        <h4 className="dh-section__title">Valores de Combate</h4>
        <div className="dh-row dh-row--3">
          <label className="dh-field">
            <span className="dh-field__label">Evasão</span>
            <input className="input" type="number" min={8} max={20} value={sheet.evasion}
              onChange={(e) => field('evasion', parseInt(e.target.value) || 10)} />
          </label>
          <label className="dh-field">
            <span className="dh-field__label">Proficiência</span>
            <input className="input" type="number" min={1} max={6} value={sheet.proficiency}
              onChange={(e) => field('proficiency', Math.max(1, Math.min(6, parseInt(e.target.value) || 1)))} />
          </label>
          {sheet.spellcast_trait && (
            <div className="dh-field">
              <span className="dh-field__label">Traço de Magia</span>
              <span className="dh-infobox">
                {TRAITS.find((t) => t.key === sheet.spellcast_trait)?.label ?? sheet.spellcast_trait}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Duality Dice */}
      <DualityDicePanel sheet={sheet} />
    </div>
  )
})

// ── Duality Dice ──────────────────────────────────────

function DualityDicePanel({ sheet }: { sheet: DhCharacterSheet }) {
  const [traitKey, setTraitKey] = useState<DhTraitKey>('agility')
  const [difficulty, setDifficulty] = useState(12)
  const [rolling, setRolling] = useState(false)
  const [result, setResult] = useState<{
    hope: number; fear: number; total: number
    outcome: string; withHope: boolean
  } | null>(null)
  const [rollErr, setRollErr] = useState<string | null>(null)

  async function handleRoll() {
    setRolling(true)
    setRollErr(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado.')

      const skin = await getMyDiceSkin().catch(() => DEFAULT_SKIN)

      // Rola 2d12 e lê os valores individuais
      const parsed = parseDiceFormula('2d12')
      const rolled = rollParsedFormula(parsed)
      const breakdown = rolled.breakdown[0]
      const [hope, fear] = 'results' in breakdown ? breakdown.results as number[] : [1, 1]

      const traitKey_ = traitKey
      const traitMod  = sheet[`trait_${traitKey_}` as keyof DhCharacterSheet] as number
      const res       = resolveDualityRoll(hope, fear, traitMod, difficulty)

      const charName = sheet.character_name?.trim() || 'Personagem'
      const traitLabel = TRAITS.find((t) => t.key === traitKey_)?.label ?? traitKey_
      const label = `Dualidade — ${traitLabel} (CD ${difficulty})`

      await recordRoll(sheet.campaign_id, rolled, false, {
        label,
        skin,
        context: {
          system:    'daggerheart',
          sheet_id:  sheet.id,
          character: charName,
        },
      })

      setResult({
        hope, fear,
        total:    res.total,
        outcome:  describeRollOutcome(res.outcome),
        withHope: res.with_hope,
      })
    } catch (err) {
      setRollErr(err instanceof Error ? err.message : 'Erro ao rolar.')
    } finally {
      setRolling(false)
    }
  }

  return (
    <section className="dh-section dh-duality">
      <h4 className="dh-section__title">Rolagem de Dualidade (2d12)</h4>
      <div className="dh-row dh-row--2">
        <label className="dh-field">
          <span className="dh-field__label">Traço</span>
          <select className="input" value={traitKey} onChange={(e) => setTraitKey(e.target.value as DhTraitKey)}>
            {TRAITS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label} ({sheet[`trait_${t.key}` as keyof DhCharacterSheet] as number >= 0
                  ? `+${sheet[`trait_${t.key}` as keyof DhCharacterSheet] as number}`
                  : sheet[`trait_${t.key}` as keyof DhCharacterSheet] as number})
              </option>
            ))}
          </select>
        </label>
        <label className="dh-field">
          <span className="dh-field__label">Dificuldade</span>
          <input className="input" type="number" min={6} max={30} value={difficulty}
            onChange={(e) => setDifficulty(Math.max(6, parseInt(e.target.value) || 12))} />
        </label>
      </div>

      <button type="button" className="btn btn-primary dh-roll-btn" onClick={() => void handleRoll()} disabled={rolling}>
        {rolling ? 'Rolando…' : '⚄  Rolar Dualidade'}
      </button>

      {rollErr && <div className="sheet-feedback sheet-feedback--error">{rollErr}</div>}

      {result && (
        <div className={`dh-roll-result ${result.withHope ? 'dh-roll-result--hope' : 'dh-roll-result--fear'}`}>
          <div className="dh-roll-result__dice">
            <span className="dh-die dh-die--hope" title="Dado de Esperança">☀ {result.hope}</span>
            <span className="dh-die dh-die--fear"  title="Dado de Medo">☽ {result.fear}</span>
          </div>
          <div className="dh-roll-result__total">Total: {result.total}</div>
          <div className="dh-roll-result__outcome">{result.outcome}</div>
        </div>
      )}
    </section>
  )
}

// ════════════════════════════════════════════════════════
// ABA: DOMÍNIO
// ════════════════════════════════════════════════════════

const DominioTab = memo(function DominioTab({ ctx }: { ctx: FormCtx }) {
  const { sheet, experiences, cards, setExps, setCards } = ctx
  const [busy, setBusy] = useState(false)

  async function addExp() {
    setBusy(true)
    try {
      const exp = await addDhExperience(sheet.id, {
        label: '', modifier: 2, sort_order: experiences.length,
      })
      setExps((p) => [...p, exp])
    } finally { setBusy(false) }
  }

  async function delExp(id: string) {
    await deleteDhExperience(id)
    setExps((p) => p.filter((e) => e.id !== id))
  }

  async function updateExpLabel(id: string, label: string) {
    setExps((p) => p.map((e) => e.id === id ? { ...e, label } : e))
    await updateDhExperience(id, { label })
  }

  async function updateExpMod(id: string, modifier: number) {
    setExps((p) => p.map((e) => e.id === id ? { ...e, modifier } : e))
    await updateDhExperience(id, { modifier })
  }

  async function addCard() {
    setBusy(true)
    try {
      const card = await addDhDomainCard(sheet.id, {
        domain: 'valor', card_name: 'Nova Carta', card_level: 1, is_equipped: true,
      })
      setCards((p) => [...p, card])
    } finally { setBusy(false) }
  }

  async function delCard(id: string) {
    await deleteDhDomainCard(id)
    setCards((p) => p.filter((c) => c.id !== id))
  }

  async function toggleEquipped(id: string, is_equipped: boolean) {
    await updateDhDomainCard(id, { is_equipped })
    setCards((p) => p.map((c) => c.id === id ? { ...c, is_equipped } : c))
  }

  return (
    <div className="dh-tab-content">
      {/* Experiências */}
      <section className="dh-section">
        <div className="dh-section__head">
          <h4 className="dh-section__title">Experiências</h4>
          <button type="button" className="btn btn-ghost dh-add-btn" onClick={() => void addExp()} disabled={busy}>+ Adicionar</button>
        </div>
        {experiences.length === 0 && <p className="sheet-empty">Nenhuma experiência registrada.</p>}
        {experiences.map((exp) => (
          <div key={exp.id} className="dh-exp-row">
            <input className="input dh-exp-label" placeholder="Descrição da experiência"
              value={exp.label} onChange={(e) => void updateExpLabel(exp.id, e.target.value)} />
            <select className="input dh-exp-mod" value={exp.modifier}
              onChange={(e) => void updateExpMod(exp.id, parseInt(e.target.value))}>
              {[1, 2, 3].map((n) => <option key={n} value={n}>+{n}</option>)}
            </select>
            <button type="button" className="dh-del-btn" onClick={() => void delExp(exp.id)} title="Remover">×</button>
          </div>
        ))}
      </section>

      {/* Cartas de Domínio */}
      <section className="dh-section">
        <div className="dh-section__head">
          <h4 className="dh-section__title">Cartas de Domínio</h4>
          <button type="button" className="btn btn-ghost dh-add-btn" onClick={() => void addCard()} disabled={busy}>+ Adicionar</button>
        </div>
        {cards.length === 0 && <p className="sheet-empty">Nenhuma carta de domínio.</p>}
        <div className="dh-cards-equipped">
          {cards.filter((c) => c.is_equipped).length > 0 && (
            <>
              <span className="dh-cards__group-label">Equipadas</span>
              {cards.filter((c) => c.is_equipped).map((c) => (
                <DomainCardRow key={c.id} card={c} setCards={setCards} onDelete={delCard} onToggle={toggleEquipped} />
              ))}
            </>
          )}
          {cards.filter((c) => !c.is_equipped).length > 0 && (
            <>
              <span className="dh-cards__group-label">Cofre</span>
              {cards.filter((c) => !c.is_equipped).map((c) => (
                <DomainCardRow key={c.id} card={c} setCards={setCards} onDelete={delCard} onToggle={toggleEquipped} />
              ))}
            </>
          )}
        </div>
      </section>
    </div>
  )
})

function DomainCardRow({ card, setCards, onDelete, onToggle }: {
  card: DhDomainCard
  setCards: React.Dispatch<React.SetStateAction<DhDomainCard[]>>
  onDelete: (id: string) => void
  onToggle: (id: string, v: boolean) => void
}) {
  async function updateName(card_name: string) {
    setCards((p) => p.map((c) => c.id === card.id ? { ...c, card_name } : c))
    await updateDhDomainCard(card.id, { card_name })
  }
  async function updateLevel(card_level: number) {
    setCards((p) => p.map((c) => c.id === card.id ? { ...c, card_level } : c))
    await updateDhDomainCard(card.id, { card_level })
  }
  return (
    <div className="dh-card-row">
      <select className="input dh-card-domain" value={card.domain}
        onChange={async (e) => {
          const domain = e.target.value as DhDomainCard['domain']
          setCards((p) => p.map((c) => c.id === card.id ? { ...c, domain } : c))
          await updateDhDomainCard(card.id, { domain })
        }}>
        {Object.entries(DH_DOMAIN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <input className="input dh-card-name" placeholder="Nome da carta"
        value={card.card_name} onChange={(e) => void updateName(e.target.value)} />
      <select className="input dh-card-level" value={card.card_level}
        onChange={(e) => void updateLevel(parseInt(e.target.value))}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>Lv {n}</option>)}
      </select>
      <button type="button" className={`dh-equip-btn ${card.is_equipped ? 'dh-equip-btn--on' : ''}`}
        onClick={() => void onToggle(card.id, !card.is_equipped)} title={card.is_equipped ? 'Mover pro cofre' : 'Equipar'}>
        {card.is_equipped ? '⚔' : '📦'}
      </button>
      <button type="button" className="dh-del-btn" onClick={() => void onDelete(card.id)} title="Remover">×</button>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// ABA: INVENTÁRIO
// ════════════════════════════════════════════════════════

const InventarioTab = memo(function InventarioTab({ ctx }: { ctx: FormCtx }) {
  const { sheet, field, weapons, inventory, setWeapons, setInventory } = ctx
  const [busy, setBusy] = useState(false)

  async function addWeapon() {
    setBusy(true)
    try {
      const w = await addDhWeapon(sheet.id, {
        weapon_name: 'Nova Arma', trait_key: 'strength',
        damage_die: 6, damage_mod: 0,
        is_primary: true, is_equipped: true,
      })
      setWeapons((p) => [...p, w])
    } finally { setBusy(false) }
  }

  async function delWeapon(id: string) {
    await deleteDhWeapon(id)
    setWeapons((p) => p.filter((w) => w.id !== id))
  }

  async function addItem() {
    setBusy(true)
    try {
      const item = await addDhInventoryItem(sheet.id, { item_name: 'Item', quantity: 1, sort_order: inventory.length })
      setInventory((p) => [...p, item])
    } finally { setBusy(false) }
  }

  async function delItem(id: string) {
    await deleteDhInventoryItem(id)
    setInventory((p) => p.filter((i) => i.id !== id))
  }

  return (
    <div className="dh-tab-content">
      {/* Armas */}
      <section className="dh-section">
        <div className="dh-section__head">
          <h4 className="dh-section__title">Armas</h4>
          <button type="button" className="btn btn-ghost dh-add-btn" onClick={() => void addWeapon()} disabled={busy}>+ Adicionar</button>
        </div>
        {weapons.length === 0 && <p className="sheet-empty">Nenhuma arma registrada.</p>}
        {weapons.map((w) => (
          <WeaponRow key={w.id} weapon={w} setWeapons={setWeapons} onDelete={delWeapon} />
        ))}
      </section>

      {/* Itens */}
      <section className="dh-section">
        <div className="dh-section__head">
          <h4 className="dh-section__title">Inventário</h4>
          <button type="button" className="btn btn-ghost dh-add-btn" onClick={() => void addItem()} disabled={busy}>+ Adicionar</button>
        </div>
        {inventory.length === 0 && <p className="sheet-empty">Nenhum item registrado.</p>}
        {inventory.map((item) => (
          <ItemRow key={item.id} item={item} setInventory={setInventory} onDelete={delItem} />
        ))}
      </section>

      {/* Ouro */}
      <section className="dh-section">
        <h4 className="dh-section__title">Ouro</h4>
        <div className="dh-row dh-row--3">
          {(['gold_handfuls', 'gold_bags', 'gold_chests'] as const).map((k, idx) => (
            <label key={k} className="dh-field">
              <span className="dh-field__label">{['Punhados', 'Bolsas', 'Baús'][idx]}</span>
              <input className="input" type="number" min={0} value={(sheet as unknown as Record<string, number>)[k] ?? 0}
                onChange={(e) => field(k, Math.max(0, parseInt(e.target.value) || 0))} />
            </label>
          ))}
        </div>
      </section>
    </div>
  )
})

function WeaponRow({ weapon, setWeapons, onDelete }: {
  weapon: DhWeapon
  setWeapons: React.Dispatch<React.SetStateAction<DhWeapon[]>>
  onDelete: (id: string) => void
}) {
  async function patch(key: keyof DhWeapon, value: DhWeapon[keyof DhWeapon]) {
    setWeapons((p) => p.map((w) => w.id === weapon.id ? { ...w, [key]: value } : w))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateDhWeapon(weapon.id, { [key]: value === null ? undefined : value } as any)
  }

  return (
    <div className="dh-weapon-row">
      <input className="input dh-weapon-name" placeholder="Nome da arma" value={weapon.weapon_name}
        onChange={(e) => void patch('weapon_name', e.target.value)} />
      <select className="input dh-weapon-trait" value={weapon.trait_key}
        onChange={(e) => void patch('trait_key', e.target.value as DhTraitKey)}>
        {TRAITS.map((t) => <option key={t.key} value={t.key}>{t.abbr}</option>)}
      </select>
      <span className="dh-weapon-dmg">
        {weapon.damage_die > 0 ? `d${weapon.damage_die}${weapon.damage_mod !== 0 ? (weapon.damage_mod > 0 ? `+${weapon.damage_mod}` : weapon.damage_mod) : ''}` : '—'}
      </span>
      <button type="button" className="dh-del-btn" onClick={() => void onDelete(weapon.id)} title="Remover">×</button>
    </div>
  )
}

function ItemRow({ item, setInventory, onDelete }: {
  item: DhInventoryItem
  setInventory: React.Dispatch<React.SetStateAction<DhInventoryItem[]>>
  onDelete: (id: string) => void
}) {
  async function patch(key: keyof DhInventoryItem, value: DhInventoryItem[keyof DhInventoryItem]) {
    setInventory((p) => p.map((i) => i.id === item.id ? { ...i, [key]: value } : i))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateDhInventoryItem(item.id, { [key]: value === null ? undefined : value } as any)
  }
  return (
    <div className="dh-item-row">
      <input className="input dh-item-name" placeholder="Item" value={item.item_name}
        onChange={(e) => void patch('item_name', e.target.value)} />
      <input className="input dh-item-qty" type="number" min={0} value={item.quantity}
        onChange={(e) => void patch('quantity', Math.max(0, parseInt(e.target.value) || 0))} />
      <input className="input dh-item-notes" placeholder="Obs." value={item.notes ?? ''}
        onChange={(e) => void patch('notes', e.target.value || null)} />
      <button type="button" className="dh-del-btn" onClick={() => void onDelete(item.id)} title="Remover">×</button>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// ABA: ANOTAÇÕES
// ════════════════════════════════════════════════════════

const AnotacoesTab = memo(function AnotacoesTab({ ctx }: { ctx: FormCtx }) {
  const { sheet, field } = ctx
  return (
    <div className="dh-tab-content">
      <section className="dh-section">
        <label className="dh-field">
          <span className="dh-field__label">Histórico</span>
          <textarea className="input sheet-notes" rows={5}
            value={sheet.background_notes ?? ''}
            onChange={(e) => field('background_notes', e.target.value || null)} />
        </label>
      </section>
      <section className="dh-section">
        <label className="dh-field">
          <span className="dh-field__label">Conexões</span>
          <textarea className="input sheet-notes" rows={4}
            value={sheet.connections_notes ?? ''}
            onChange={(e) => field('connections_notes', e.target.value || null)} />
        </label>
      </section>
      <section className="dh-section">
        <label className="dh-field">
          <span className="dh-field__label">Notas livres</span>
          <textarea className="input sheet-notes" rows={6}
            value={sheet.notes ?? ''}
            onChange={(e) => field('notes', e.target.value || null)} />
        </label>
      </section>
    </div>
  )
})
