import { FormEvent, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Presence } from '../../../../shared/components/Presence'
import { Select } from '../../../../shared/components/Select'
import { TabIndicator, useStableTabPanels, useTabDirection } from '../../../../shared/components/TabIndicator'
import type {
  TdCondition,
  TdConditionDuration,
  TdInventoryItem,
  TdSheet,
  TdTrait,
  TdTrunfo,
} from '../../../../shared/types'
import {
  CONDITIONS_INITIAL_MAX,
  CONDITIONS_MAX,
  CONDITION_DURATIONS,
  CONVICTION_MAX,
  HORROR_MAX,
  INVENTORY_MAX,
  ITEM_KINDS,
  ITEM_LEVELS,
  TEXT_LIMITS,
  TRAITS_INITIAL_MAX,
  TRAITS_MAX,
  TRUNFOS_MAX,
} from '../constants/terraDevastada'
import { convictionCost, horrorBand, initialHorror, newId } from '../utils/tdRules'
import { announceTd, type TdSheetUpdate } from '../services/tdSheetService'
import { TdTestModal, type TdTestPurpose } from './TdTestModal'
import { TdHorrorModal } from './TdHorrorModal'
import './TerraDevastadaSheet.css'

// ────────────────────────────────────────────────────────
// Ficha Terra Devastada. Salvamento automático igual ao da ficha
// Altherium: o que está na tela é comparado com o que o banco tem e vai
// AUTOSAVE_DELAY_MS depois da última mudança, um save por vez.
// ────────────────────────────────────────────────────────

interface TdSheetFormProps {
  sheet:      TdSheet
  ownerName?: string
  onSave:     (data: TdSheetUpdate) => Promise<void>
  saveError:  string | null
}

type FormData = {
  character_name: string
  concept:        string
  description:    string
  background:     string
  traits:         TdTrait[]
  conditions:     TdCondition[]
  trunfos:        TdTrunfo[]
  inventory:      TdInventoryItem[]
  horror:         number
  conviction:     number
  notes:          string
}

function sheetToForm(s: TdSheet): FormData {
  return {
    character_name: s.character_name ?? '',
    concept:        s.concept ?? '',
    description:    s.description ?? '',
    background:     s.background ?? '',
    traits:         s.traits ?? [],
    conditions:     s.conditions ?? [],
    trunfos:        s.trunfos ?? [],
    inventory:      s.inventory ?? [],
    horror:         s.horror,
    conviction:     s.conviction,
    notes:          s.notes ?? '',
  }
}

function formToPayload(f: FormData): TdSheetUpdate {
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
      .map((i) => ({ id: i.id, name: i.name.trim(), qty: i.qty, kind: i.kind, level: i.kind === 'item' ? 0 : i.level })),
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

type TabId = 'personagem' | 'inventario' | 'trunfos' | 'historia'

const TABS: { id: TabId; label: string }[] = [
  { id: 'personagem', label: 'Características' },
  { id: 'inventario', label: 'Inventário' },
  { id: 'trunfos',    label: 'Trunfos' },
  { id: 'historia',   label: 'História' },
]
const TAB_IDS = TABS.map((t) => t.id)

const DURATION_OPTIONS = CONDITION_DURATIONS.map((d) => ({ value: d.id, label: d.label }))
const KIND_OPTIONS = ITEM_KINDS.map((k) => ({ value: k.id, label: k.label }))
const LEVEL_OPTIONS = ITEM_LEVELS.map((l) => ({ value: String(l.value), label: l.label }))
const TAG_OPTIONS = [
  { value: '',          label: 'Comum' },
  { value: 'motiva',    label: 'Motivação' },
  { value: 'desmotiva', label: 'Desmotivação' },
]

export function TdSheetForm({ sheet, ownerName, onSave, saveError }: TdSheetFormProps) {
  const [form, setForm] = useState<FormData>(() => sheetToForm(sheet))
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('personagem')
  const tabDir = useTabDirection(TAB_IDS, activeTab)
  const { tabsRef, selectTab, panelsStyle } = useStableTabPanels(setActiveTab)
  const [testing, setTesting] = useState<TdTestPurpose | null>(null)
  const [horrorScene, setHorrorScene] = useState(false)

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

  function addCondition(name: string, duration: TdConditionDuration = 'indeterminada') {
    setForm((prev) => prev.conditions.length >= CONDITIONS_MAX ? prev
      : { ...prev, conditions: [...prev.conditions, { id: newId(), name, duration }] })
  }

  const who = form.character_name.trim() || ownerName || 'Um sobrevivente'
  const band = horrorBand(form.horror)
  const cost = convictionCost(form.horror)
  const suggestedHorror = initialHorror(form.traits)
  const tagged = form.traits.some((t) => t.tag)
  const traitsCount = form.traits.filter((t) => t.name.trim()).length
  const conditionsCount = form.conditions.filter((c) => c.name.trim()).length

  return (
    <form
      className="td-sheet"
      onSubmit={(e: FormEvent) => { e.preventDefault(); void flush() }}
      noValidate
      style={{ '--tab-dir': tabDir } as CSSProperties}
    >
      {ownerName && <p className="td-sheet__owner">Ficha de <strong>{ownerName}</strong></p>}

      {/* ── Cabeçalho: identidade + Horror/Convicção ── */}
      <header className="td-hero">
        <div className="td-hero__identity">
          <input
            type="text" className="td-hero__name" placeholder="Nome do sobrevivente"
            maxLength={TEXT_LIMITS.name} value={form.character_name}
            onChange={(e) => set('character_name', e.target.value)} aria-label="Nome"
          />
          <label className="td-field">
            <span className="td-label">Conceito</span>
            <input
              type="text" className="input" maxLength={TEXT_LIMITS.concept}
              placeholder="Quem é você em poucas palavras. Ex.: Andarilho solitário"
              value={form.concept} onChange={(e) => set('concept', e.target.value)}
            />
          </label>
          <label className="td-field">
            <span className="td-label">Descrição</span>
            <textarea
              className="input td-textarea" rows={3} maxLength={TEXT_LIMITS.description}
              placeholder="Idade, altura, peso, olhos, cabelo, marcas..."
              value={form.description} onChange={(e) => set('description', e.target.value)}
            />
          </label>
        </div>

        <div className="td-hero__meters">
          <section className={`td-meter td-meter--horror td-meter--band-${band.min}`} aria-label="Horror">
            <div className="td-meter__head">
              <span className="td-meter__title">Horror</span>
              <span className="td-meter__value">{form.horror}<small>/{HORROR_MAX}</small></span>
            </div>
            <Track
              max={HORROR_MAX} value={form.horror} groups={3} label="Horror"
              onChange={(v) => set('horror', v)}
            />
            <p className="td-meter__band"><strong>{band.title}.</strong> {band.effect}</p>
          </section>

          <section className="td-meter td-meter--conviction" aria-label="Convicção">
            <div className="td-meter__head">
              <span className="td-meter__title">Convicção</span>
              <div className="td-meter__controls">
                <button
                  type="button" className="td-stepper__btn" aria-label="Menos um de Convicção"
                  onClick={() => set('conviction', Math.max(0, form.conviction - 1))} disabled={form.conviction <= 0}
                >
                  −
                </button>
                <span className="td-meter__value">{form.conviction}<small>/{CONVICTION_MAX}</small></span>
                <button
                  type="button" className="td-stepper__btn" aria-label="Mais um de Convicção"
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
            <p className="td-meter__band">1 ponto de desempenho garantido custa <strong>{cost}</strong> (o seu Horror).</p>
          </section>

          <div className="td-hero__actions">
            <button type="button" className="td-btn td-btn--primary td-btn--big" onClick={() => setTesting('teste')}>
              Fazer um teste
            </button>
            <button type="button" className="td-btn td-btn--danger td-btn--big" onClick={() => setHorrorScene(true)}>
              Cena de horror
            </button>
            <button type="button" className="td-btn" onClick={() => setTesting('redencao')} disabled={form.horror <= 0}>
              Redenção do horror
            </button>
            <button type="button" className="td-btn" onClick={() => setTesting('conviccao')} disabled={form.conviction >= CONVICTION_MAX}>
              Recuperar Convicção
            </button>
          </div>
        </div>
      </header>

      {/* ── Abas ── */}
      <nav ref={tabsRef} className="campaign-tabs td-sheet-tabs" role="tablist" aria-label="Seções da ficha">
        {TABS.map((tab) => (
          <button
            key={tab.id} type="button" role="tab"
            aria-selected={activeTab === tab.id} aria-controls={`td-tabpanel-${tab.id}`}
            className={`campaign-tab ${activeTab === tab.id ? 'campaign-tab--active' : ''}`}
            onClick={() => selectTab(tab.id)}
          >
            <span className="campaign-tab__label">{tab.label}</span>
          </button>
        ))}
        <TabIndicator activeKey={activeTab} />
      </nav>

      <div className="td-tab-panels" style={panelsStyle}>
        {/* ── Características e condições ── */}
        <div id="td-tabpanel-personagem" role="tabpanel" hidden={activeTab !== 'personagem'}>
          {activeTab === 'personagem' && (
            <div className="td-tab-panel td-columns anim-tab-panel">
              <section className="td-card">
                <div className="td-card__header">
                  <h4 className="td-card__title">Características fixas <span className="td-card__subtitle">você é assim</span></h4>
                  <span className={`td-counter${traitsCount > TRAITS_INITIAL_MAX ? ' td-counter--info' : ''}`}>
                    {traitsCount}/{TRAITS_INITIAL_MAX}
                  </span>
                </div>
                <p className="td-hint">
                  Habilidades, profissões, vícios, manias, sentimentos, defeitos... Cada uma que ajuda num teste vale +1d; cada uma que atrapalha, −1d.
                  Na criação são até {TRAITS_INITIAL_MAX}; o Narrador pode dar mais durante o jogo.
                </p>

                <ul className="td-list">
                  {form.traits.map((t) => (
                    <li key={t.id} className="td-row">
                      <input
                        type="text" className="input td-row__name" maxLength={TEXT_LIMITS.item}
                        value={t.name} placeholder="Característica"
                        onChange={(e) => update('traits', t.id, { name: e.target.value })}
                        aria-label="Característica"
                      />
                      <Select
                        className="td-row__select" value={t.tag ?? ''}
                        onChange={(v) => update('traits', t.id, { tag: (v || null) as TdTrait['tag'] })}
                        options={TAG_OPTIONS} aria-label="Efeito no Horror"
                      />
                      <button type="button" className="td-row__remove" onClick={() => remove('traits', t.id)} aria-label={`Remover ${t.name || 'característica'}`}>×</button>
                    </li>
                  ))}
                </ul>
                <AddRow
                  placeholder="Nova característica (Enter)" maxLength={TEXT_LIMITS.item}
                  disabled={form.traits.length >= TRAITS_MAX} onAdd={addTrait}
                />

                <div className="td-initial-horror">
                  <p className="td-hint">
                    <strong>Motivação</strong> = algo que inibe o horror (−1 no Horror inicial);
                    {' '}<strong>Desmotivação</strong> = algo que o estimula (+1). Horror inicial pelas marcações: <strong>{suggestedHorror}</strong>.
                  </p>
                  {tagged && suggestedHorror !== form.horror && (
                    <button type="button" className="td-btn" onClick={() => set('horror', suggestedHorror)}>
                      Usar {suggestedHorror} como Horror
                    </button>
                  )}
                </div>
              </section>

              <section className="td-card">
                <div className="td-card__header">
                  <h4 className="td-card__title">Condições <span className="td-card__subtitle">você está assim</span></h4>
                  <span className="td-counter">{conditionsCount}</span>
                </div>
                <p className="td-hint">
                  Características temporárias: ferido, exausto, bêbado, apavorado... Somam ou tiram dados como as fixas, até sumirem.
                  Na criação, até {CONDITIONS_INITIAL_MAX}.
                </p>

                <ul className="td-list">
                  {form.conditions.map((c) => (
                    <li key={c.id} className="td-row">
                      <input
                        type="text" className="input td-row__name" maxLength={TEXT_LIMITS.item}
                        value={c.name} placeholder="Condição"
                        onChange={(e) => update('conditions', c.id, { name: e.target.value })}
                        aria-label="Condição"
                      />
                      <Select
                        className="td-row__select" value={c.duration}
                        onChange={(v) => update('conditions', c.id, { duration: v as TdConditionDuration })}
                        options={DURATION_OPTIONS} aria-label="Duração"
                      />
                      <button type="button" className="td-row__remove" onClick={() => remove('conditions', c.id)} aria-label={`Remover ${c.name || 'condição'}`}>×</button>
                    </li>
                  ))}
                </ul>
                <AddRow
                  placeholder="Nova condição (Enter)" maxLength={TEXT_LIMITS.item}
                  disabled={form.conditions.length >= CONDITIONS_MAX} onAdd={(name) => addCondition(name)}
                />
                <p className="td-hint">
                  Duração: {CONDITION_DURATIONS.map((d) => `${d.label.toLowerCase()} (${d.hint.toLowerCase().replace(/\.$/, '')})`).join('; ')}.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* ── Inventário ── */}
        <div id="td-tabpanel-inventario" role="tabpanel" hidden={activeTab !== 'inventario'}>
          {activeTab === 'inventario' && (
            <div className="td-tab-panel anim-tab-panel">
              <section className="td-card">
                <div className="td-card__header">
                  <h4 className="td-card__title">Inventário</h4>
                  <span className="td-counter">{form.inventory.length}</span>
                </div>
                <p className="td-hint">
                  Armas têm letalidade e proteções têm proteção: baixa 1d, alta 2d, extrema 3d. Entram no teste como bônus
                  (ferir, bloquear) ou penalidade (não matar, esquivar).
                </p>
                <ul className="td-list">
                  {form.inventory.map((it) => (
                    <li key={it.id} className="td-row td-row--item">
                      <input
                        type="number" className="input td-row__qty" min={1} max={9999}
                        value={it.qty} aria-label="Quantidade"
                        onChange={(e) => update('inventory', it.id, { qty: Math.max(1, Math.min(9999, parseInt(e.target.value, 10) || 1)) })}
                      />
                      <input
                        type="text" className="input td-row__name" maxLength={TEXT_LIMITS.item}
                        value={it.name} placeholder="Item" aria-label="Item"
                        onChange={(e) => update('inventory', it.id, { name: e.target.value })}
                      />
                      <Select
                        className="td-row__select" value={it.kind}
                        onChange={(v) => {
                          const kind = v as TdInventoryItem['kind']
                          update('inventory', it.id, { kind, level: kind === 'item' ? 0 : it.level || 1 })
                        }}
                        options={KIND_OPTIONS} aria-label="Tipo"
                      />
                      {it.kind !== 'item' && (
                        <Select
                          className="td-row__select" value={String(it.level || 1)}
                          onChange={(v) => update('inventory', it.id, { level: Number(v) })}
                          options={LEVEL_OPTIONS}
                          aria-label={it.kind === 'arma' ? 'Letalidade' : 'Proteção'}
                        />
                      )}
                      <button type="button" className="td-row__remove" onClick={() => remove('inventory', it.id)} aria-label={`Remover ${it.name || 'item'}`}>×</button>
                    </li>
                  ))}
                </ul>
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

        {/* ── Trunfos ── */}
        <div id="td-tabpanel-trunfos" role="tabpanel" hidden={activeTab !== 'trunfos'}>
          {activeTab === 'trunfos' && (
            <div className="td-tab-panel anim-tab-panel">
              <section className="td-card">
                <div className="td-card__header">
                  <h4 className="td-card__title">Trunfos</h4>
                  <span className="td-counter">{form.trunfos.length}</span>
                </div>
                <ul className="td-list td-list--trunfos">
                  {form.trunfos.map((t) => (
                    <li key={t.id} className="td-trunfo">
                      <div className="td-row">
                        <input
                          type="text" className="input td-row__name" maxLength={TEXT_LIMITS.item}
                          value={t.name} placeholder="Nome do trunfo" aria-label="Nome do trunfo"
                          onChange={(e) => update('trunfos', t.id, { name: e.target.value })}
                        />
                        <button type="button" className="td-row__remove" onClick={() => remove('trunfos', t.id)} aria-label={`Remover ${t.name || 'trunfo'}`}>×</button>
                      </div>
                      <textarea
                        className="input td-textarea" rows={2} maxLength={TEXT_LIMITS.trunfoDesc}
                        value={t.description} placeholder="O que ele faz" aria-label="Descrição do trunfo"
                        onChange={(e) => update('trunfos', t.id, { description: e.target.value })}
                      />
                    </li>
                  ))}
                </ul>
                {form.trunfos.length === 0 && <p className="td-hint">Nenhum trunfo anotado.</p>}
                <div className="td-actions td-actions--start">
                  <button
                    type="button" className="td-btn" disabled={form.trunfos.length >= TRUNFOS_MAX}
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
        <div id="td-tabpanel-historia" role="tabpanel" hidden={activeTab !== 'historia'}>
          {activeTab === 'historia' && (
            <div className="td-tab-panel anim-tab-panel">
              <section className="td-card">
                <div className="td-card__header">
                  <h4 className="td-card__title">Antecedentes</h4>
                  <span className="td-counter">{form.background.length}/{TEXT_LIMITS.background}</span>
                </div>
                <p className="td-hint">
                  Como sobreviveu? Algum ente querido está vivo? Motivações, aliados, inimigos, ocupação, dogmas... Ainda acredita em cura?
                </p>
                <textarea
                  className="input td-textarea td-textarea--tall" rows={10} maxLength={TEXT_LIMITS.background}
                  value={form.background} onChange={(e) => set('background', e.target.value)} aria-label="Antecedentes"
                />
              </section>
              <section className="td-card">
                <div className="td-card__header">
                  <h4 className="td-card__title">Anotações</h4>
                  <span className="td-counter">{form.notes.length}/{TEXT_LIMITS.notes}</span>
                </div>
                <textarea
                  className="input td-textarea" rows={6} maxLength={TEXT_LIMITS.notes}
                  value={form.notes} onChange={(e) => set('notes', e.target.value)} aria-label="Anotações"
                />
              </section>
            </div>
          )}
        </div>
      </div>

      {/* ── Rodapé: salvamento ── */}
      <footer className="td-sheet__footer">
        {(error || saveError) && <p className="td-warn" role="alert">{error ?? saveError}</p>}
        <span className={`alth-save-status alth-save-status--${saveState}`} role="status" aria-live="polite">
          {saveState === 'saved'   && '✓ Tudo salvo'}
          {saveState === 'pending' && 'Alterações pendentes…'}
          {saveState === 'saving'  && <><span className="spinner spinner--sm" /> Salvando…</>}
          {saveState === 'error'   && 'Erro ao salvar'}
        </span>
        {(saveState === 'pending' || saveState === 'error') && (
          <button type="submit" className="td-btn">{saveState === 'error' ? 'Tentar de novo' : 'Salvar agora'}</button>
        )}
      </footer>

      <Presence show={testing !== null} exitMs={220}>
        {() => testing && (
          <TdTestModal
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
            onAnnounce={(msg) => announceTd(sheet.campaign_id, msg)}
            onClose={() => setTesting(null)}
          />
        )}
      </Presence>

      <Presence show={horrorScene} exitMs={220}>
        {() => horrorScene && (
          <TdHorrorModal
            campaignId={sheet.campaign_id}
            who={who}
            traits={form.traits} conditions={form.conditions} inventory={form.inventory}
            horror={form.horror}
            onApply={(value) => set('horror', value)}
            onAddCondition={(name) => addCondition(name)}
            onAddTrait={addTrait}
            onAnnounce={(msg) => announceTd(sheet.campaign_id, msg)}
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
    <div className="td-track" role="group" aria-label={label}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          className={`td-track__box${n <= value ? ' td-track__box--on' : ''}${n % groups === 0 && n < max ? ' td-track__box--gap' : ''}`}
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
    <div className="td-add-row">
      <input
        type="text" className="input" maxLength={maxLength} placeholder={placeholder}
        value={text} disabled={disabled} aria-label={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
      />
      <button type="button" className="td-btn" onClick={add} disabled={disabled || !text.trim()}>Adicionar</button>
    </div>
  )
}
