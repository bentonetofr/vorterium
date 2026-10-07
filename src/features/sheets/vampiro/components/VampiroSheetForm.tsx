import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent } from 'react'
import { Select } from '../../../../shared/components/Select'
import { TabIndicator, useStableTabPanels, useTabDirection } from '../../../../shared/components/TabIndicator'
import type { VtmSheet, VtmSpecialty } from '../../../../shared/types'
import {
  VTM_ATTRIBUTES, VTM_CLANS, VTM_DISCIPLINES, VTM_GENERATION_MAX, VTM_GENERATION_MIN, VTM_GROUPS,
  VTM_PORTRAIT_TYPES, VTM_SKILL_KEYS, VTM_SKILLS, VTM_TEXT_LIMITS,
  getClan, type VtmAttrKey,
} from '../constants/vampiro'
import { VTM_PREDATORS } from '../constants/vtmPredators'
import { VTM_POWER_BY_ID } from '../constants/vtmPowers'
import { VTM_RITE_BY_ID } from '../constants/vtmRituals'
import {
  attrSpreadOk, bloodPotencyRow, bpRange, clampTrack, healthMax, isThinBlood, newId, ordinal,
  resilienceBonus, skillSpread, willpowerMax, type Track,
} from '../utils/vampiroRules'
import type { VtmSheetUpdate } from '../services/vampiroSheetService'
import { DamageTrack, Dots, HumanityTrack, HungerTrack } from './VtmControls'
import { VtmDisciplinesTab } from './VtmDisciplinesTab'
import { VtmAdvantagesTab } from './VtmAdvantagesTab'
import { VtmConvictionsTab } from './VtmConvictionsTab'
import { VtmXpTab } from './VtmXpTab'
import { VtmPredatorCard } from './VtmPredatorCard'
import type { VtmForm } from './vtmForm'
import './VampiroSheet.css'

// ────────────────────────────────────────────────────────
// Ficha de Vampiro: A Máscara (5ª edição). Cabeçalho com retrato,
// identidade e as trilhas (Vitalidade, Força de Vontade, Fome,
// Humanidade); abas de Atributos e Perícias, Disciplinas, Vantagens, Clã e
// Sangue (com o tipo de predador), Convicções, Experiência e História.
// Tudo que é conta sai sozinho (máximos, Potência de Sangue, disciplinas
// e perdição do clã, conferência da criação). Salvamento automático igual
// ao da ficha Altherium: AUTOSAVE_DELAY_MS depois da última mudança, um
// save por vez, e o eco do próprio save não apaga o que foi digitado.
// ────────────────────────────────────────────────────────

interface VampiroSheetFormProps {
  sheet:      VtmSheet
  ownerName?: string
  onSave:     (data: VtmSheetUpdate) => Promise<void>
  saveError:  string | null
  portraitBusy:     boolean
  onPortraitChange: (file: File) => void
  onPortraitRemove: () => void
}

type FormData = VtmForm

const ATTR_COLS = VTM_ATTRIBUTES.map((a) => `attr_${a.key}` as const)

function sheetToForm(s: VtmSheet): FormData {
  return {
    character_name: s.character_name ?? '',
    concept:        s.concept ?? '',
    chronicle:      s.chronicle ?? '',
    sire:           s.sire ?? '',
    ambition:       s.ambition ?? '',
    desire:         s.desire ?? '',
    clan:           s.clan ?? '',
    predator_type:  s.predator_type ?? '',
    generation:     s.generation,
    attr_strength: s.attr_strength, attr_dexterity: s.attr_dexterity, attr_stamina: s.attr_stamina,
    attr_charisma: s.attr_charisma, attr_manipulation: s.attr_manipulation, attr_composure: s.attr_composure,
    attr_intelligence: s.attr_intelligence, attr_wits: s.attr_wits, attr_resolve: s.attr_resolve,
    skills:         s.skills ?? {},
    specialties:    s.specialties ?? [],
    health_superficial: s.health_superficial, health_aggravated: s.health_aggravated, health_bonus: s.health_bonus,
    willpower_superficial: s.willpower_superficial, willpower_aggravated: s.willpower_aggravated, willpower_bonus: s.willpower_bonus,
    hunger:         s.hunger,
    humanity:       s.humanity,
    stains:         s.stains,
    blood_potency:  s.blood_potency,
    history:        s.history ?? '',
    notes:          s.notes ?? '',
    // Marco 2 (sem a migration, as colunas não vêm: começam vazias)
    disciplines:     s.disciplines ?? {},
    powers:          s.powers ?? [],
    rituals:         s.rituals ?? [],
    advantages:      s.advantages ?? [],
    convictions:     s.convictions ?? [],
    xp_log:          s.xp_log ?? [],
    predator_grants: s.predator_grants ?? null,
    creation_tier:   s.creation_tier ?? 'neonato',
  }
}

const DISC_ORDER = Object.keys(VTM_DISCIPLINES)

function formToPayload(f: FormData): VtmSheetUpdate {
  // Perícias: só as com ponto, sempre na ordem da lista (o jsonb devolve as
  // chaves reordenadas; o eco do próprio save precisa bater com o enviado).
  const skills: Record<string, number> = {}
  for (const k of VTM_SKILLS) { const v = f.skills[k.key] ?? 0; if (v > 0) skills[k.key] = v }
  const hMax = healthMax(f)
  const wMax = willpowerMax(f)
  const h = clampTrack({ superficial: f.health_superficial, aggravated: f.health_aggravated }, hMax)
  const w = clampTrack({ superficial: f.willpower_superficial, aggravated: f.willpower_aggravated }, wMax)
  return {
    character_name: f.character_name.trim() || null,
    concept:        f.concept.trim() || null,
    chronicle:      f.chronicle.trim() || null,
    sire:           f.sire.trim() || null,
    ambition:       f.ambition.trim() || null,
    desire:         f.desire.trim() || null,
    clan:           f.clan || null,
    predator_type:  f.predator_type || null,
    generation:     f.generation,
    attr_strength: f.attr_strength, attr_dexterity: f.attr_dexterity, attr_stamina: f.attr_stamina,
    attr_charisma: f.attr_charisma, attr_manipulation: f.attr_manipulation, attr_composure: f.attr_composure,
    attr_intelligence: f.attr_intelligence, attr_wits: f.attr_wits, attr_resolve: f.attr_resolve,
    skills,
    specialties: f.specialties.filter((sp) => sp.name.trim() && VTM_SKILL_KEYS.has(sp.skill))
      .map((sp) => ({ id: sp.id, skill: sp.skill, name: sp.name.trim() })),
    health_superficial: h.superficial, health_aggravated: h.aggravated, health_bonus: f.health_bonus,
    willpower_superficial: w.superficial, willpower_aggravated: w.aggravated, willpower_bonus: f.willpower_bonus,
    hunger:         f.hunger,
    humanity:       f.humanity,
    stains:         f.stains,
    blood_potency:  f.blood_potency,
    history:        f.history.trim() || null,
    notes:          f.notes.trim() || null,
    // Disciplinas na ordem fixa e só com ponto (mesmo motivo das perícias).
    disciplines:     Object.fromEntries(DISC_ORDER.filter((d) => (f.disciplines[d] ?? 0) > 0).map((d) => [d, f.disciplines[d]])),
    powers:          f.powers.filter((id) => VTM_POWER_BY_ID.has(id)),
    rituals:         f.rituals.filter((id) => VTM_RITE_BY_ID.has(id)),
    // Objetos sempre com as chaves na mesma ordem: o jsonb devolve reordenado.
    advantages:      f.advantages.map((a) => ({
      id: a.id, key: a.key, kind: a.kind, name: a.name.trim() || 'Sem nome', dots: a.dots, note: a.note.trim(), source: a.source,
    })),
    convictions:     f.convictions.map((c) => ({
      id: c.id, conviction: c.conviction.trim(), touchstone: c.touchstone.trim(), note: c.note.trim(), status: c.status,
    })),
    xp_log:          f.xp_log.map((e) => ({
      id: e.id, at: e.at, kind: e.kind, amount: e.amount, label: e.label,
      ...(e.note ? { note: e.note } : {}),
      ...(e.target ? { target: {
        type: e.target.type, key: e.target.key, from: e.target.from, to: e.target.to,
        ...(e.target.extra ? { extra: e.target.extra } : {}),
      } } : {}),
    })),
    predator_grants: f.predator_grants && {
      predator: f.predator_grants.predator, discipline: f.predator_grants.discipline, specialtyId: f.predator_grants.specialtyId,
      advantageIds: f.predator_grants.advantageIds, humanity: f.predator_grants.humanity, bloodPotency: f.predator_grants.bloodPotency,
    },
    creation_tier:   f.creation_tier,
  }
}

function payloadKey(f: FormData): string {
  return JSON.stringify(formToPayload(f))
}

function validateForm(f: FormData): string | null {
  const L = VTM_TEXT_LIMITS
  const over = (v: string, n: number) => v.trim().length > n
  if (over(f.character_name, L.character_name)) return `O nome deve ter no máximo ${L.character_name} caracteres.`
  if (over(f.concept, L.concept)) return `O conceito deve ter no máximo ${L.concept} caracteres.`
  if (over(f.history, L.history)) return `A história deve ter no máximo ${L.history} caracteres.`
  if (over(f.notes, L.notes)) return `As anotações devem ter no máximo ${L.notes} caracteres.`
  return null
}

const AUTOSAVE_DELAY_MS = 800
type SaveState = 'saved' | 'pending' | 'saving' | 'error'

type TabId = 'atributos' | 'disciplinas' | 'vantagens' | 'cla' | 'conviccoes' | 'experiencia' | 'historia'
const TABS: { id: TabId; label: string }[] = [
  { id: 'atributos',   label: 'Atributos e Perícias' },
  { id: 'disciplinas', label: 'Disciplinas' },
  { id: 'vantagens',   label: 'Vantagens' },
  { id: 'cla',         label: 'Clã e Sangue' },
  { id: 'conviccoes',  label: 'Convicções' },
  { id: 'experiencia', label: 'Experiência' },
  { id: 'historia',    label: 'História' },
]
const TAB_IDS = TABS.map((t) => t.id)

const CLAN_OPTIONS = [{ value: '', label: 'Sem clã' }, ...VTM_CLANS.map((c) => ({ value: c.id, label: c.label }))]
const PREDATOR_OPTIONS = [{ value: '', label: 'Sem tipo' }, ...VTM_PREDATORS.map((p) => ({ value: p.id, label: p.label }))]
const GENERATION_OPTIONS = Array.from({ length: VTM_GENERATION_MAX - VTM_GENERATION_MIN + 1 }, (_, i) => {
  const g = VTM_GENERATION_MAX - i
  return { value: String(g), label: `${ordinal(g)}${g >= 14 ? ' · sangue-ralo' : ''}` }
})

export function VampiroSheetForm({
  sheet, ownerName, onSave, saveError, portraitBusy, onPortraitChange, onPortraitRemove,
}: VampiroSheetFormProps) {
  const [form, setForm] = useState<FormData>(() => sheetToForm(sheet))
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('atributos')
  const tabDir = useTabDirection(TAB_IDS, activeTab)
  const { tabsRef, selectTab, panelsStyle } = useStableTabPanels(setActiveTab)
  const [addingSpec, setAddingSpec] = useState<string | null>(null)
  const [specText, setSpecText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Salvamento automático (ver AltheriumSheetForm) ──
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const formRef   = useRef(form)
  const onSaveRef = useRef(onSave)
  const lastSaved = useRef(payloadKey(sheetToForm(sheet)))
  const inFlight  = useRef(false)
  const queued    = useRef(false)
  formRef.current   = form
  onSaveRef.current = onSave

  // Ficha nova vinda de fora (o mestre mexeu, outra aba): o eco do próprio save é ignorado.
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

  /** As abas do Marco 2 mexem em várias partes de uma vez. */
  function update(fn: (prev: FormData) => FormData) {
    setForm(fn)
    setError(null)
  }

  // ── Contas ──
  const hMax = healthMax(form)
  const wMax = willpowerMax(form)
  const health: Track = clampTrack({ superficial: form.health_superficial, aggravated: form.health_aggravated }, hMax)
  const will: Track = clampTrack({ superficial: form.willpower_superficial, aggravated: form.willpower_aggravated }, wMax)
  const clan = getClan(form.clan)
  const range = bpRange(form.generation)
  const bp = bloodPotencyRow(form.blood_potency)
  const thin = isThinBlood(form.generation)
  const attrOk = attrSpreadOk(ATTR_COLS.map((c) => form[c]))
  const spread = skillSpread(form)
  const attrTotal = ATTR_COLS.reduce((n, c) => n + form[c], 0)
  const skillTotal = VTM_SKILLS.reduce((n, k) => n + (form.skills[k.key] ?? 0), 0)

  function setGeneration(g: number) {
    // Mudou a geração: a Potência de Sangue vai pro valor inicial dela se estiver fora do limite.
    const r = bpRange(g)
    setForm((prev) => ({
      ...prev, generation: g,
      blood_potency: prev.blood_potency < r.min || prev.blood_potency > r.max ? r.start : prev.blood_potency,
    }))
  }

  function setSkill(key: string, v: number) {
    setForm((prev) => ({ ...prev, skills: { ...prev.skills, [key]: v } }))
  }

  function addSpecialty(skill: string) {
    const name = specText.trim().slice(0, VTM_TEXT_LIMITS.specialty)
    if (name) setForm((prev) => ({ ...prev, specialties: [...prev.specialties, { id: newId(), skill, name }] }))
    setSpecText('')
    setAddingSpec(null)
  }

  function removeSpecialty(id: string) {
    setForm((prev) => ({ ...prev, specialties: prev.specialties.filter((s) => s.id !== id) }))
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) onPortraitChange(f)
  }

  const specsOf = (skill: string): VtmSpecialty[] => form.specialties.filter((s) => s.skill === skill)

  return (
    <form
      className="vtm-sheet"
      onSubmit={(e: FormEvent) => { e.preventDefault(); void flush() }}
      noValidate
      style={{ '--tab-dir': tabDir } as CSSProperties}
    >
      {ownerName && <p className="vtm-sheet__owner">Ficha de <strong>{ownerName}</strong></p>}

      {/* ── Cabeçalho: retrato, identidade e trilhas ── */}
      <header className="vtm-hero">
        <div className="vtm-hero__id">
          <div className="vtm-portrait">
            <button
              type="button" className="vtm-portrait__img" onClick={() => fileRef.current?.click()} disabled={portraitBusy}
              aria-label={sheet.portrait_url ? 'Trocar o retrato' : 'Enviar um retrato'}
            >
              {sheet.portrait_url
                ? <img src={sheet.portrait_url} alt="" />
                : <span className="vtm-portrait__empty" aria-hidden="true">☥</span>}
              {portraitBusy && <span className="vtm-portrait__busy"><span className="spinner spinner--sm" /></span>}
            </button>
            {sheet.portrait_url && !portraitBusy && (
              <button type="button" className="vtm-portrait__remove" onClick={onPortraitRemove} aria-label="Remover o retrato">×</button>
            )}
            <input ref={fileRef} type="file" accept={VTM_PORTRAIT_TYPES.join(',')} hidden onChange={onFile} />
          </div>

          <div className="vtm-hero__fields">
            <input
              type="text" className="vtm-hero__name" placeholder="Nome do vampiro" maxLength={VTM_TEXT_LIMITS.character_name}
              value={form.character_name} onChange={(e) => set('character_name', e.target.value)} aria-label="Nome"
            />
            <input
              type="text" className="input vtm-hero__concept" placeholder="Conceito (ex.: detetive que não larga o caso)" maxLength={VTM_TEXT_LIMITS.concept}
              value={form.concept} onChange={(e) => set('concept', e.target.value)} aria-label="Conceito"
            />
            <div className="vtm-hero__selects">
              <label className="vtm-field">
                <span className="vtm-label">Clã</span>
                <Select options={CLAN_OPTIONS} value={form.clan} onChange={(v) => set('clan', v)} aria-label="Clã" />
              </label>
              <label className="vtm-field">
                <span className="vtm-label">Geração</span>
                <Select options={GENERATION_OPTIONS} value={String(form.generation)} onChange={(v) => setGeneration(Number(v))} aria-label="Geração" />
              </label>
              <label className="vtm-field">
                <span className="vtm-label">Tipo de predador</span>
                <Select options={PREDATOR_OPTIONS} value={form.predator_type} onChange={(v) => set('predator_type', v)} aria-label="Tipo de predador" />
              </label>
            </div>
          </div>
        </div>

        <div className="vtm-hero__tracks">
          <DamageTrack
            kind="health" title="Vitalidade" max={hMax}
            formula={`Vigor ${form.attr_stamina} + 3${resilienceBonus(form) ? ` + Resiliência ${resilienceBonus(form)}` : ''}`} track={health} bonus={form.health_bonus}
            onTrack={(t) => setForm((p) => ({ ...p, health_superficial: t.superficial, health_aggravated: t.aggravated }))}
            onBonus={(b) => set('health_bonus', b)}
          />
          <DamageTrack
            kind="willpower" title="Força de Vontade" formula={`Autocontrole ${form.attr_composure} + Determinação ${form.attr_resolve}`}
            max={wMax} track={will} bonus={form.willpower_bonus}
            onTrack={(t) => setForm((p) => ({ ...p, willpower_superficial: t.superficial, willpower_aggravated: t.aggravated }))}
            onBonus={(b) => set('willpower_bonus', b)}
          />
          <HungerTrack value={form.hunger} onChange={(v) => set('hunger', v)} />
          <HumanityTrack
            humanity={form.humanity} stains={form.stains}
            onHumanity={(v) => set('humanity', v)} onStains={(v) => set('stains', v)}
          />
        </div>
      </header>

      {/* ── Abas ── */}
      <nav ref={tabsRef} className="campaign-tabs vtm-sheet-tabs" role="tablist" aria-label="Seções da ficha">
        {TABS.map((tab) => (
          <button
            key={tab.id} type="button" role="tab"
            aria-selected={activeTab === tab.id} aria-controls={`vtm-tabpanel-${tab.id}`}
            className={`campaign-tab ${activeTab === tab.id ? 'campaign-tab--active' : ''}`}
            onClick={() => selectTab(tab.id)}
          >
            <span className="campaign-tab__label">{tab.label}</span>
          </button>
        ))}
        <TabIndicator activeKey={activeTab} />
      </nav>

      <div className="vtm-tab-panels" style={panelsStyle}>
        {/* ── Atributos e perícias ── */}
        <div id="vtm-tabpanel-atributos" role="tabpanel" hidden={activeTab !== 'atributos'}>
          {activeTab === 'atributos' && (
            <div className="vtm-tab-panel anim-tab-panel">
              <section className="vtm-card">
                <div className="vtm-card__header">
                  <h4 className="vtm-card__title">Atributos</h4>
                  <span className={`vtm-badge${attrOk ? ' vtm-badge--ok' : ''}`} title="Na criação: um em 4, três em 3, quatro em 2 e um em 1">
                    {attrOk ? '✓ distribuição da criação' : `${attrTotal} pontos · criação: 4, 3, 3, 3, 2, 2, 2, 2, 1`}
                  </span>
                </div>
                <div className="vtm-grid3">
                  {VTM_GROUPS.map((g) => (
                    <div key={g.id} className="vtm-col">
                      <h5 className="vtm-col__title">{g.label}</h5>
                      {VTM_ATTRIBUTES.filter((a) => a.group === g.id).map((a) => (
                        <div key={a.key} className="vtm-row">
                          <span className="vtm-row__label">{a.label}</span>
                          <Dots value={form[`attr_${a.key as VtmAttrKey}`]} min={1} label={a.label}
                            onChange={(v) => set(`attr_${a.key as VtmAttrKey}`, v)} />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </section>

              <section className="vtm-card">
                <div className="vtm-card__header">
                  <h4 className="vtm-card__title">Perícias</h4>
                  <span className={`vtm-badge${spread ? ' vtm-badge--ok' : ''}`} title="Faz-tudo: 3/2×8/1×10 · Equilibrado: 3×3/2×5/1×7 · Especialista: 4/3×3/2×3/1×3">
                    {spread ? `✓ ${spread}` : `${skillTotal} pontos`}
                  </span>
                </div>
                <div className="vtm-grid3">
                  {VTM_GROUPS.map((g) => (
                    <div key={g.id} className="vtm-col">
                      <h5 className="vtm-col__title">{g.label === 'Físicos' ? 'Físicas' : g.label === 'Sociais' ? 'Sociais' : 'Mentais'}</h5>
                      {VTM_SKILLS.filter((k) => k.group === g.id).map((k) => {
                        const dots = form.skills[k.key] ?? 0
                        const specs = specsOf(k.key)
                        return (
                          <div key={k.key} className="vtm-skill">
                            <div className="vtm-row">
                              <span className="vtm-row__label">
                                {k.label}
                                {dots > 0 && addingSpec !== k.key && (
                                  <button type="button" className="vtm-spec-add" onClick={() => { setAddingSpec(k.key); setSpecText('') }}
                                    aria-label={`Especialização em ${k.label}`} title="Especialização">+</button>
                                )}
                              </span>
                              <Dots value={dots} label={k.label} onChange={(v) => setSkill(k.key, v)} />
                            </div>
                            {(specs.length > 0 || addingSpec === k.key) && (
                              <div className="vtm-specs">
                                {specs.map((sp) => (
                                  <span key={sp.id} className="vtm-spec">
                                    {sp.name}
                                    <button type="button" onClick={() => removeSpecialty(sp.id)} aria-label={`Tirar ${sp.name}`}>×</button>
                                  </span>
                                ))}
                                {addingSpec === k.key && (
                                  <input
                                    autoFocus className="vtm-spec-input" maxLength={VTM_TEXT_LIMITS.specialty} placeholder="Especialização…"
                                    value={specText} onChange={(e) => setSpecText(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSpecialty(k.key) } if (e.key === 'Escape') setAddingSpec(null) }}
                                    onBlur={() => addSpecialty(k.key)}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>

        {/* ── Disciplinas ── */}
        <div id="vtm-tabpanel-disciplinas" role="tabpanel" hidden={activeTab !== 'disciplinas'}>
          {activeTab === 'disciplinas' && <VtmDisciplinesTab form={form} update={update} />}
        </div>

        {/* ── Vantagens ── */}
        <div id="vtm-tabpanel-vantagens" role="tabpanel" hidden={activeTab !== 'vantagens'}>
          {activeTab === 'vantagens' && <VtmAdvantagesTab form={form} update={update} />}
        </div>

        {/* ── Clã e sangue ── */}
        <div id="vtm-tabpanel-cla" role="tabpanel" hidden={activeTab !== 'cla'}>
          {activeTab === 'cla' && (
            <div className="vtm-tab-panel vtm-columns anim-tab-panel">
              <section className="vtm-card">
                <div className="vtm-card__header">
                  <h4 className="vtm-card__title">{clan ? clan.label : 'Clã'}</h4>
                </div>
                {clan ? (
                  <dl className="vtm-facts">
                    <dt>Disciplinas do clã</dt>
                    <dd className="vtm-chips">
                      {clan.disciplines.length
                        ? clan.disciplines.map((d) => <span key={d} className="vtm-tag">{VTM_DISCIPLINES[d]}</span>)
                        : <span className="vtm-muted">Nenhuma fixa: escolhe livremente (custa como fora do clã).</span>}
                    </dd>
                    <dt>Perdição</dt>
                    <dd>{clan.bane ? <>{clan.bane} <span className="vtm-muted">· gravidade {bp.bane}</span></> : <span className="vtm-muted">Nenhuma.</span>}</dd>
                    <dt>Compulsão</dt>
                    <dd>{clan.compulsion ?? <span className="vtm-muted">Nenhuma.</span>}</dd>
                  </dl>
                ) : (
                  <p className="vtm-muted">Escolha o clã no alto da ficha: as disciplinas, a perdição e a compulsão aparecem aqui.</p>
                )}
                <label className="vtm-field">
                  <span className="vtm-label">Senhor</span>
                  <input type="text" className="input" maxLength={VTM_TEXT_LIMITS.sire} value={form.sire}
                    onChange={(e) => set('sire', e.target.value)} placeholder="Quem te Abraçou" />
                </label>
              </section>

              <VtmPredatorCard form={form} update={update} />

              <section className="vtm-card">
                <div className="vtm-card__header">
                  <h4 className="vtm-card__title">Potência de Sangue</h4>
                  <span className="vtm-badge" title={`Limite da ${ordinal(form.generation)} geração`}>
                    {thin ? 'sangue-ralo: 0' : `${ordinal(form.generation)} geração: ${range.min} a ${range.max}`}
                  </span>
                </div>
                <div className="vtm-row vtm-row--bp">
                  <Dots value={form.blood_potency} max={10} label="Potência de Sangue" limit={range.max}
                    onChange={(v) => set('blood_potency', v)} />
                  <span className="vtm-bp-num">{form.blood_potency}</span>
                </div>
                {(form.blood_potency > range.max || form.blood_potency < range.min) && (
                  <p className="vtm-warn">Fora do limite da {ordinal(form.generation)} geração ({range.min} a {range.max}).</p>
                )}
                <dl className="vtm-facts vtm-facts--grid">
                  <dt>Surto de Sangue</dt><dd>+{bp.surge} {bp.surge === 1 ? 'dado' : 'dados'}</dd>
                  <dt>Regeneração</dt><dd>{bp.mend} superficial por despertar</dd>
                  <dt>Bônus de disciplina</dt><dd>{bp.power ? `+${bp.power}` : 'nenhum'}</dd>
                  <dt>Rerrolar despertar</dt><dd>{bp.reroll ? `disciplinas até nível ${bp.reroll}` : 'não'}</dd>
                  <dt>Gravidade da perdição</dt><dd>{bp.bane}</dd>
                  <dt>Alimentação</dt><dd>{bp.feeding}</dd>
                </dl>
              </section>
            </div>
          )}
        </div>

        {/* ── Convicções ── */}
        <div id="vtm-tabpanel-conviccoes" role="tabpanel" hidden={activeTab !== 'conviccoes'}>
          {activeTab === 'conviccoes' && <VtmConvictionsTab form={form} update={update} />}
        </div>

        {/* ── Experiência ── */}
        <div id="vtm-tabpanel-experiencia" role="tabpanel" hidden={activeTab !== 'experiencia'}>
          {activeTab === 'experiencia' && <VtmXpTab form={form} update={update} />}
        </div>

        {/* ── História ── */}
        <div id="vtm-tabpanel-historia" role="tabpanel" hidden={activeTab !== 'historia'}>
          {activeTab === 'historia' && (
            <div className="vtm-tab-panel vtm-columns anim-tab-panel">
              <section className="vtm-card">
                <div className="vtm-card__header"><h4 className="vtm-card__title">Quem é</h4></div>
                <label className="vtm-field">
                  <span className="vtm-label">Crônica</span>
                  <input type="text" className="input" maxLength={VTM_TEXT_LIMITS.chronicle} value={form.chronicle} onChange={(e) => set('chronicle', e.target.value)} />
                </label>
                <label className="vtm-field">
                  <span className="vtm-label">Ambição <span className="vtm-muted">· o objetivo de longo prazo</span></span>
                  <input type="text" className="input" maxLength={VTM_TEXT_LIMITS.ambition} value={form.ambition} onChange={(e) => set('ambition', e.target.value)} />
                </label>
                <label className="vtm-field">
                  <span className="vtm-label">Desejo <span className="vtm-muted">· o que quer agora, nesta sessão</span></span>
                  <input type="text" className="input" maxLength={VTM_TEXT_LIMITS.desire} value={form.desire} onChange={(e) => set('desire', e.target.value)} />
                </label>
              </section>
              <section className="vtm-card">
                <div className="vtm-card__header">
                  <h4 className="vtm-card__title">História</h4>
                  <span className="vtm-counter">{form.history.length}/{VTM_TEXT_LIMITS.history}</span>
                </div>
                <textarea className="input vtm-textarea vtm-textarea--tall" rows={9} maxLength={VTM_TEXT_LIMITS.history}
                  value={form.history} onChange={(e) => set('history', e.target.value)} aria-label="História"
                  placeholder="A vida antes do Abraço, como foi Abraçado, o que perdeu, o que ainda guarda…" />
              </section>
              <section className="vtm-card">
                <div className="vtm-card__header">
                  <h4 className="vtm-card__title">Anotações</h4>
                  <span className="vtm-counter">{form.notes.length}/{VTM_TEXT_LIMITS.notes}</span>
                </div>
                <textarea className="input vtm-textarea" rows={6} maxLength={VTM_TEXT_LIMITS.notes}
                  value={form.notes} onChange={(e) => set('notes', e.target.value)} aria-label="Anotações" />
              </section>
            </div>
          )}
        </div>
      </div>

      {/* ── Rodapé: salvamento ── */}
      <footer className="vtm-sheet__footer">
        {(error || saveError) && <p className="vtm-warn" role="alert">{error ?? saveError}</p>}
        <span className={`vtm-save vtm-save--${saveState}`} role="status" aria-live="polite">
          {saveState === 'saved'   && '✓ Tudo salvo'}
          {saveState === 'pending' && 'Alterações pendentes…'}
          {saveState === 'saving'  && <><span className="spinner spinner--sm" /> Salvando…</>}
          {saveState === 'error'   && 'Erro ao salvar'}
        </span>
        {(saveState === 'pending' || saveState === 'error') && (
          <button type="submit" className="vtm-chip">{saveState === 'error' ? 'Tentar de novo' : 'Salvar agora'}</button>
        )}
      </footer>
    </form>
  )
}
