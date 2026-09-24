import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AvatarCropEditor } from '../../../users/components/AvatarCropEditor'
import { Presence } from '../../../../shared/components/Presence'
import { TabIndicator, useTabDirection } from '../../../../shared/components/TabIndicator'
import {
  ATTRIBUTES,
  ATTRIBUTE_HARD_MAX,
  BODY_PARTS,
  DOMAINS,
  DOMAIN_MAX_POINTS,
  GENESIS,
  RAIZES,
  type AltheriumRaiz,
} from '../constants/altherium'
import {
  berserkerTriumphLimit,
  cardsMax,
  domainSlotsTotal,
  movementMeters,
  runaskinUsesPerScene,
  usesCards,
  usesFv,
  usesPr,
  usesRunico,
} from '../utils/altheriumCalculations'
import { AltheriumBodyDiagram, type BodyZone } from './AltheriumBodyDiagram'
import { AltheriumInventoryCard } from './AltheriumInventoryCard'
import { AltheriumTriumphsPanel } from './AltheriumTriumphsPanel'
import { AltheriumDragBar } from './AltheriumDragBar'
import { AltheriumRunaskinTriumphs } from './AltheriumRunaskinTriumphs'
import type { RunaskinTrail } from '../constants/altheriumTriumphs'
import { findArmor } from '../constants/altheriumItems'
import type { AltheriumSheet, AltheriumDomainPoints, AltheriumInventoryItem, AltheriumRune } from '../../../../shared/types'
import {
  ALTHERIUM_PORTRAIT_MAX_BYTES,
  ALTHERIUM_PORTRAIT_TYPES,
  announceTriumphUse,
  type AltheriumRuneInput,
  type AltheriumSheetUpdate,
} from '../services/altheriumSheetService'
import './AltheriumSheet.css'

const NOTES_MAX = 2000

interface AltheriumSheetFormProps {
  sheet:                    AltheriumSheet
  domains:                  AltheriumDomainPoints[]
  inventory:                AltheriumInventoryItem[]
  ownerName?:               string
  /** Chamado pelo salvamento automático — deve lançar erro se falhar. */
  onSave:                   (data: AltheriumSheetUpdate) => Promise<void>
  onDomainChange:           (domain: string, points: number) => Promise<void>
  onPortraitChange:         (file: File) => Promise<void>
  onPortraitRemove:         () => Promise<void>
  portraitBusy:             boolean
  onInventoryAdd:           (itemType: AltheriumInventoryItem['item_type'], itemId: string) => Promise<void>
  onInventoryUpdateQuantity: (id: string, quantity: number) => Promise<void>
  onInventoryRemove:        (id: string) => Promise<void>
  onInventoryEquip:         (id: string, equipped: boolean, zone: BodyZone | null) => Promise<void>
  runes:                    AltheriumRune[]
  onRuneCreate:             (input: AltheriumRuneInput, image: File | null) => Promise<void>
  onRuneUpdate:             (rune: AltheriumRune, input: AltheriumRuneInput, image: File | null | undefined) => Promise<void>
  onRuneDelete:             (rune: AltheriumRune) => Promise<void>
  saveError:                string | null
}

type FormData = {
  character_name:     string
  level:              number
  raiz:               AltheriumRaiz | ''
  genesis:            string
  attr_furia:         number
  attr_destino:       number
  attr_espirito:      number
  attr_impulso:       number
  attr_estrategia:    number
  attr_runico:        number
  vitality_current:   number
  vitality_max:       number
  equilibrio_current: number
  equilibrio_max:     number
  fv_current:         number
  fv_max:             number
  pr_current:         number
  pr_max:             number
  cards_current:      number
  hacksilvers:        number
  db_pernas:          number
  db_bracos:          number
  db_tronco:          number
  db_cabeca:          number
  dano_pernas:        number
  dano_bracos:        number
  dano_tronco:        number
  dano_cabeca:        number
  berserker_triumphs: string[]
  runaskin_trail:     RunaskinTrail | ''
  runaskin_scene_uses: number
  notes:              string
}

function sheetToForm(s: AltheriumSheet): FormData {
  return {
    character_name:     s.character_name ?? '',
    level:              s.level,
    raiz:               s.raiz ?? '',
    genesis:            s.genesis ?? '',
    attr_furia:         s.attr_furia,
    attr_destino:       s.attr_destino,
    attr_espirito:      s.attr_espirito,
    attr_impulso:       s.attr_impulso,
    attr_estrategia:    s.attr_estrategia,
    attr_runico:        s.attr_runico,
    vitality_current:   s.vitality_current,
    vitality_max:       s.vitality_max,
    equilibrio_current: s.equilibrio_current,
    equilibrio_max:     s.equilibrio_max,
    fv_current:         s.fv_current,
    fv_max:             s.fv_max ?? 10,
    pr_current:         s.pr_current,
    pr_max:             s.pr_max ?? 10,
    cards_current:      s.cards_current,
    hacksilvers:        s.hacksilvers,
    db_pernas:          s.db_pernas,
    db_bracos:          s.db_bracos,
    db_tronco:          s.db_tronco,
    db_cabeca:          s.db_cabeca,
    dano_pernas:        s.dano_pernas,
    dano_bracos:        s.dano_bracos,
    dano_tronco:        s.dano_tronco,
    dano_cabeca:        s.dano_cabeca,
    berserker_triumphs: s.berserker_triumphs ?? [],
    runaskin_trail:     s.runaskin_trail ?? '',
    runaskin_scene_uses: s.runaskin_scene_uses ?? 0,
    notes:              s.notes ?? '',
  }
}

/** O que vai pro banco a partir do formulário (também serve pra comparar
 *  "o que está na tela" com "o que já foi salvo"). */
function formToPayload(f: FormData): AltheriumSheetUpdate {
  return {
    character_name:      f.character_name.trim() || null,
    level:               f.level,
    raiz:                f.raiz === '' ? null : f.raiz,
    genesis:             f.genesis === '' ? null : f.genesis,
    attr_furia:          f.attr_furia,
    attr_destino:        f.attr_destino,
    attr_espirito:       f.attr_espirito,
    attr_impulso:        f.attr_impulso,
    attr_estrategia:     f.attr_estrategia,
    attr_runico:         f.attr_runico,
    vitality_current:    f.vitality_current,
    vitality_max:        f.vitality_max,
    equilibrio_current:  f.equilibrio_current,
    equilibrio_max:      f.equilibrio_max,
    fv_current:          f.fv_current,
    fv_max:              f.fv_max,
    pr_current:          f.pr_current,
    pr_max:              f.pr_max,
    cards_current:       f.cards_current,
    hacksilvers:         f.hacksilvers,
    db_pernas:           f.db_pernas,
    db_bracos:           f.db_bracos,
    db_tronco:           f.db_tronco,
    db_cabeca:           f.db_cabeca,
    dano_pernas:         f.dano_pernas,
    dano_bracos:         f.dano_bracos,
    dano_tronco:         f.dano_tronco,
    dano_cabeca:         f.dano_cabeca,
    berserker_triumphs:  f.berserker_triumphs,
    runaskin_trail:      f.runaskin_trail === '' ? null : f.runaskin_trail,
    runaskin_scene_uses: f.runaskin_scene_uses,
    notes:               f.notes.trim() || null,
  }
}

function payloadKey(f: FormData): string {
  return JSON.stringify(formToPayload(f))
}

function validateForm(f: FormData): string | null {
  if (f.character_name.trim().length > 80) return 'O nome do personagem deve ter no máximo 80 caracteres.'
  if (f.notes.length > NOTES_MAX) return `As anotações devem ter no máximo ${NOTES_MAX} caracteres.`
  return null
}

/** Atraso do salvamento automático depois da última mudança. */
const AUTOSAVE_DELAY_MS = 800

type SaveState = 'saved' | 'pending' | 'saving' | 'error'

/** Projeção do formulário sobre a ficha, para os cálculos derivados verem o estado em edição. */
function formToSheet(sheet: AltheriumSheet, f: FormData): AltheriumSheet {
  return {
    ...sheet,
    level:           f.level,
    raiz:            f.raiz === '' ? null : f.raiz,
    attr_furia:      f.attr_furia,
    attr_destino:    f.attr_destino,
    attr_espirito:   f.attr_espirito,
    attr_impulso:    f.attr_impulso,
    attr_estrategia: f.attr_estrategia,
    attr_runico:     f.attr_runico,
    vitality_max:    f.vitality_max,
    equilibrio_max:  f.equilibrio_max,
  }
}

function clamp(value: string, min: number, max: number): number {
  const n = parseInt(value, 10)
  if (isNaN(n)) return min
  return Math.max(min, Math.min(max, n))
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// ────────────────────────────────────────────────────────
// Abas — Fase 1: só organização do que já existe. Sem URL própria (a
// ficha é um painel dentro da Mesa da Sessão, não uma rota) — mesmo
// padrão de SessionTablePanel.tsx. Reseta sozinha quando o `key={sheet.id}`
// troca de ficha (o componente inteiro remonta).
// ────────────────────────────────────────────────────────

type AltheriumFormTabId = 'visao-geral' | 'combate' | 'dominios' | 'triunfos'

interface AltheriumFormTab {
  id:    AltheriumFormTabId
  label: string
}

const ALTHERIUM_FORM_TABS: AltheriumFormTab[] = [
  { id: 'visao-geral', label: 'Atributos' },
  { id: 'combate',     label: 'Inventário' },
  { id: 'dominios',    label: 'Domínios' },
  { id: 'triunfos',    label: 'Triunfos' },
]
const ALTHERIUM_FORM_TAB_IDS = ALTHERIUM_FORM_TABS.map((tab) => tab.id)

export function AltheriumSheetForm({
  sheet, domains, inventory, ownerName, onSave, onDomainChange,
  onPortraitChange, onPortraitRemove, portraitBusy,
  onInventoryAdd, onInventoryUpdateQuantity, onInventoryRemove, onInventoryEquip,
  runes, onRuneCreate, onRuneUpdate, onRuneDelete,
  saveError,
}: AltheriumSheetFormProps) {
  const [form, setForm] = useState<FormData>(() => sheetToForm(sheet))
  const [error, setError] = useState<string | null>(null)
  const [domainFilter, setDomainFilter] = useState('')
  const [activeTab, setActiveTab] = useState<AltheriumFormTabId>('visao-geral')
  const tabDir = useTabDirection(ALTHERIUM_FORM_TAB_IDS, activeTab)
  const [portraitDraft, setPortraitDraft] = useState<File | null>(null)
  const [portraitPickError, setPortraitPickError] = useState<string | null>(null)

  const dbInputRefs = {
    db_cabeca: useRef<HTMLInputElement>(null),
    db_bracos: useRef<HTMLInputElement>(null),
    db_tronco: useRef<HTMLInputElement>(null),
    db_pernas: useRef<HTMLInputElement>(null),
  }
  const woundInputRefs = {
    dano_cabeca: useRef<HTMLInputElement>(null),
    dano_bracos: useRef<HTMLInputElement>(null),
    dano_tronco: useRef<HTMLInputElement>(null),
    dano_pernas: useRef<HTMLInputElement>(null),
  }

  // ── Salvamento automático ──────────────────────────────
  // `lastSaved` = o que o banco tem (em forma de payload). Qualquer
  // diferença entre ele e o formulário é "pendente" e vai pro banco
  // AUTOSAVE_DELAY_MS depois da última mudança. Só um save por vez; se
  // mudar algo durante o envio, o próximo pega. lastSaved é atualizado
  // ANTES de enviar, pra quando a ficha salva voltar pelo `sheet` (eco do
  // próprio save) ela ser reconhecida e não sobrescrever o que foi
  // digitado nesse meio tempo.
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const formRef   = useRef(form)
  const onSaveRef = useRef(onSave)
  const lastSaved = useRef(payloadKey(sheetToForm(sheet)))
  const inFlight  = useRef(false)
  const queued    = useRef(false)
  formRef.current   = form
  onSaveRef.current = onSave

  // Ficha nova vinda de fora (outra pessoa salvou, mestre recarregou) —
  // o eco do próprio save tem o mesmo payload e é ignorado.
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
    // flush só lê refs; o timer reinicia a cada mudança do formulário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  // Sair da página com algo não salvo → o navegador pergunta. Trocar de
  // ficha (o editor desmonta) → o que estiver pendente é salvo na hora.
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

  /** Anuncia pra mesa (chat + Atividade) que um triunfo foi usado. */
  function announceTriumph(what: string) {
    const who = form.character_name.trim() || ownerName || 'Um personagem'
    announceTriumphUse(sheet.campaign_id, `${who} usou ${what}`)
  }

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError(null)
  }

  function handleZoneClick(zone: BodyZone) {
    const input = dbInputRefs[zone].current
    input?.focus()
    input?.select()
  }

  function handleWoundZoneClick(zone: BodyZone) {
    const woundField = (`dano_${zone.slice(3)}` as const) as keyof typeof woundInputRefs
    const input = woundInputRefs[woundField].current
    input?.focus()
    input?.select()
  }

  function handlePortraitPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setPortraitPickError(null)
    if (!ALTHERIUM_PORTRAIT_TYPES.includes(file.type as (typeof ALTHERIUM_PORTRAIT_TYPES)[number])) {
      setPortraitPickError('Escolha uma imagem JPG, PNG ou WebP.')
      return
    }
    if (file.size > ALTHERIUM_PORTRAIT_MAX_BYTES) {
      setPortraitPickError('O retrato deve ter no máximo 2 MB.')
      return
    }
    setPortraitDraft(file)
  }

  async function handlePortraitSave(file: File) {
    await onPortraitChange(file)
    setPortraitDraft(null)
  }

  function handleToggleEquip(item: AltheriumInventoryItem, action: 'equip' | 'unequip', zone?: BodyZone) {
    if (action === 'unequip') {
      void onInventoryEquip(item.id, false, null)
      return
    }
    const armor = findArmor(item.item_id)
    if (!armor) return

    if (armor.coverage === 'todas') {
      (['db_cabeca', 'db_bracos', 'db_tronco', 'db_pernas'] as const).forEach((z) => {
        set(z, Math.min(999, form[z] + armor.db))
      })
      void onInventoryEquip(item.id, true, null)
    } else if (zone) {
      set(zone, Math.min(999, form[zone] + armor.db))
      void onInventoryEquip(item.id, true, zone)
    }
  }

  // Estado projetado: o máximo de Cartas (do nível) e os domínios acompanham
  // o que está sendo editado agora. PV/PE/FV/PR não são derivados — o
  // máximo de cada um é campo direto do form.
  const projected  = formToSheet(sheet, form)
  const raiz       = form.raiz === '' ? null : form.raiz
  const cartasMax  = cardsMax(projected)
  const slotsTotal = domainSlotsTotal(projected)

  const domainMap    = new Map(domains.map((d) => [d.domain, d.points]))
  const domainsUsed  = domains.reduce((sum, d) => sum + d.points, 0)
  const filteredDomains = useMemo(() => {
    const q = normalize(domainFilter.trim())
    if (!q) return DOMAINS
    return DOMAINS.filter((d) => normalize(d.label).includes(q))
  }, [domainFilter])

  // FV, PR e Cartas vivem na aba Triunfos, onde são gastos.
  const prWidget = usesPr(raiz) && (
    <VitalWidget
      sigla="PR" label="Pontos Rúnicos" tone="resource"
      current={form.pr_current} max={form.pr_max}
      onCurrent={(v) => set('pr_current', v)} onMax={(v) => set('pr_max', v)}
    />
  )
  const fvWidget = usesFv(raiz) && (
    <VitalWidget
      sigla="FV" label="Força de Vontade" tone="resource"
      current={form.fv_current} max={form.fv_max}
      onCurrent={(v) => set('fv_current', v)} onMax={(v) => set('fv_max', v)}
    />
  )
  const cardsWidget = usesCards(raiz) && (
    <div className="alth-vital-widget alth-vital-widget--resource">
      <div className="alth-vital-widget__top">
        <span className="alth-vital-widget__sigla">Cartas</span>
        <span className="alth-vital-widget__values">
          <input
            type="number" className="alth-vital-widget__value-input" min={0}
            value={form.cards_current}
            onChange={(e) => set('cards_current', clamp(e.target.value, 0, 999))}
            aria-label="Cartas atuais"
          />
          <span className="alth-vital-widget__max">{` / ${cartasMax ?? '—'}`}</span>
        </span>
      </div>
      <AltheriumDragBar
        value={form.cards_current} max={cartasMax}
        onChange={(v) => set('cards_current', v)}
        label="Cartas"
        trackClassName="alth-vital-widget__bar" fillClassName="alth-vital-widget__bar-fill"
      />
      <span className="alth-vital-widget__note">13 × nível</span>
    </div>
  )

  // Enter num campo (ou "Salvar agora") salva na hora, sem esperar o atraso.
  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    void flush()
  }

  return (
    <form
      className="alth-sheet"
      onSubmit={handleSubmit}
      noValidate
      style={{ '--tab-dir': tabDir } as CSSProperties}
    >
      {ownerName && (
        <p className="alth-sheet__owner">Ficha de <strong>{ownerName}</strong></p>
      )}

      {/* ── Cabeçalho ── */}
      <header className="alth-hero">
        <div className="alth-hero__identity">
          <div className="alth-hero__portrait-wrap">
            <label className="alth-hero__portrait">
              {sheet.portrait_url
                ? <img key={sheet.portrait_url} src={sheet.portrait_url} alt="" className="anim-img-swap" />
                : <span className="alth-hero__portrait-placeholder" aria-hidden="true">✦</span>
              }
              <span className="alth-hero__portrait-overlay">Trocar</span>
              <input
                type="file"
                accept={ALTHERIUM_PORTRAIT_TYPES.join(',')}
                hidden
                disabled={portraitBusy}
                onChange={handlePortraitPick}
                aria-label="Retrato do personagem"
              />
            </label>
            {sheet.portrait_url && (
              <button
                type="button"
                className="alth-hero__portrait-remove"
                onClick={() => void onPortraitRemove()}
                disabled={portraitBusy}
                aria-label="Remover retrato"
              >
                ×
              </button>
            )}
            {portraitPickError && (
              <p className="alth-hero__portrait-error" role="alert">{portraitPickError}</p>
            )}
          </div>

          <div className="alth-hero__identity-main">
            <input
              type="text"
              className="alth-hero__name"
              placeholder="Nome do personagem"
              maxLength={80}
              value={form.character_name}
              onChange={(e) => set('character_name', e.target.value)}
              aria-label="Nome do personagem"
            />
            <div className="alth-hero__tags">
              <label className="alth-hero__field alth-hero__field--raiz">
                <span className="alth-hero__field-label">Raiz</span>
                <select
                  className="input alth-hero__select" value={form.raiz}
                  onChange={(e) => set('raiz', e.target.value as AltheriumRaiz | '')}
                >
                  <option value="">—</option>
                  {RAIZES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </label>
              <label className="alth-hero__field alth-hero__field--genesis">
                <span className="alth-hero__field-label">Gênesis</span>
                <select
                  className="input alth-hero__select" value={form.genesis}
                  onChange={(e) => set('genesis', e.target.value)}
                >
                  <option value="">—</option>
                  {GENESIS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="alth-hero__vitals">
          <VitalBar
            sigla="PV" label="Vitalidade" tone="vitality"
            current={form.vitality_current} max={form.vitality_max}
            onCurrent={(v) => set('vitality_current', v)} onMax={(v) => set('vitality_max', v)}
          />
          <VitalBar
            sigla="PE" label="Equilíbrio" tone="mystic"
            current={form.equilibrio_current} max={form.equilibrio_max}
            onCurrent={(v) => set('equilibrio_current', v)} onMax={(v) => set('equilibrio_max', v)}
          />
        </div>

        <div className="alth-hero__stats">
          <label className="alth-hero__level">
            <span className="label">Nível</span>
            <input
              type="number" className="input" min={1} max={5}
              value={form.level}
              onChange={(e) => set('level', clamp(e.target.value, 1, 5))}
            />
          </label>
          <label className="alth-hero__coins">
            <span className="label">Hacksilvers (₴)</span>
            <input
              type="number" className="input" min={0}
              value={form.hacksilvers}
              onChange={(e) => set('hacksilvers', clamp(e.target.value, 0, 9_999_999))}
            />
          </label>
        </div>
      </header>

      <Presence show={!!portraitDraft} exitMs={220}>
        {() => portraitDraft && (
          <AvatarCropEditor
            file={portraitDraft}
            saving={portraitBusy}
            onCancel={() => setPortraitDraft(null)}
            onSave={handlePortraitSave}
            title="Ajustar retrato"
            description="Escolha o enquadramento que será exibido no cabeçalho da ficha."
            confirmLabel="Usar este retrato"
          />
        )}
      </Presence>

      {form.genesis && (
        <p className="alth-hint alth-hint--center">
          {GENESIS.find((g) => g.id === form.genesis)?.effect}
        </p>
      )}

      {/* ── Abas ── */}
      <nav className="campaign-tabs alth-sheet-tabs" role="tablist" aria-label="Seções da ficha">
        {ALTHERIUM_FORM_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`alth-tabpanel-${tab.id}`}
            className={`campaign-tab ${activeTab === tab.id ? 'campaign-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="campaign-tab__label">{tab.label}</span>
          </button>
        ))}
        <TabIndicator activeKey={activeTab} />
      </nav>

      {/* ── Atributos: atributos, anotações ── */}
      <div id="alth-tabpanel-visao-geral" role="tabpanel" hidden={activeTab !== 'visao-geral'}>
        {activeTab === 'visao-geral' && (
          <div className="alth-tab-panel anim-tab-panel">
            <section className="alth-card">
              <div className="alth-card__header">
                <h4 className="alth-card__title">Atributos</h4>
              </div>

              <div className="alth-table alth-table--attrs">
                {ATTRIBUTES.map((attr) => {
                  const key    = `attr_${attr.id}` as keyof FormData
                  const value  = form[key] as number
                  const hidden = attr.id === 'runico' && raiz !== null && !usesRunico(raiz)
                  if (hidden) return null
                  return (
                    <div key={attr.id} className="alth-table__col" title={attr.description}>
                      <span className="alth-table__head">{attr.label}</span>
                      <input
                        type="number" className="input alth-table__value"
                        min={0} max={ATTRIBUTE_HARD_MAX}
                        value={value}
                        onChange={(e) => set(key, clamp(e.target.value, 0, ATTRIBUTE_HARD_MAX) as never)}
                        aria-label={attr.label}
                      />
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="alth-section alth-journal">
              <h4 className="alth-section__title">Anotações</h4>
              <textarea
                className="input alth-notes" rows={6} maxLength={NOTES_MAX}
                placeholder="Histórico, NPCs, pistas..."
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
              />
            </section>
          </div>
        )}
      </div>

      {/* ── Inventário: anatomia/armadura e itens ── */}
      <div id="alth-tabpanel-combate" role="tabpanel" hidden={activeTab !== 'combate'}>
        {activeTab === 'combate' && (
          <div className="alth-tab-panel anim-tab-panel">
        <section className="alth-card">
          <div className="alth-card__header">
            <h4 className="alth-card__title">Anatomia &amp; Armadura</h4>
            <span className="alth-counter">Movimento {movementMeters(form.attr_impulso)}m</span>
          </div>

          <div className="alth-anatomy">
            <AltheriumBodyDiagram
              variant="protecao"
              build={raiz}
              values={{
                db_cabeca: form.db_cabeca,
                db_bracos: form.db_bracos,
                db_tronco: form.db_tronco,
                db_pernas: form.db_pernas,
              }}
              onZoneClick={handleZoneClick}
            />

            <div className="alth-anatomy__fields">
              {BODY_PARTS.map((part) => {
                const woundField = (`dano_${part.id.slice(3)}` as const) as keyof typeof woundInputRefs
                return (
                  <div key={part.id} className="alth-anatomy__field">
                    <span className="label">{part.label} <span className="alth-table__range">({part.range})</span></span>
                    <div className="alth-anatomy__field-inputs">
                      <label className="alth-anatomy__field-input">
                        <span className="alth-anatomy__field-input-tag">DB</span>
                        <input
                          ref={dbInputRefs[part.id]}
                          type="number" className="input" min={0}
                          value={form[part.id] as number}
                          onChange={(e) => set(part.id, clamp(e.target.value, 0, 999) as never)}
                          aria-label={`DB em ${part.label}`}
                        />
                      </label>
                      <label className="alth-anatomy__field-input alth-anatomy__field-input--wound">
                        <input
                          ref={woundInputRefs[woundField]}
                          type="number" className="input" min={0}
                          value={form[woundField]}
                          onChange={(e) => set(woundField, clamp(e.target.value, 0, 999))}
                          aria-label={`Dano em ${part.label}`}
                        />
                        <span className="alth-anatomy__field-input-tag">Dano</span>
                      </label>
                    </div>
                  </div>
                )
              })}
            </div>

            <AltheriumBodyDiagram
              variant="dano"
              build={raiz}
              visualMax={form.vitality_max}
              values={{
                db_cabeca: form.dano_cabeca,
                db_bracos: form.dano_bracos,
                db_tronco: form.dano_tronco,
                db_pernas: form.dano_pernas,
              }}
              onZoneClick={handleWoundZoneClick}
            />
          </div>
        </section>

            <AltheriumInventoryCard
              inventory={inventory}
              onAdd={onInventoryAdd}
              onUpdateQuantity={onInventoryUpdateQuantity}
              onRemove={onInventoryRemove}
              onToggleEquip={handleToggleEquip}
            />
          </div>
        )}
      </div>

      {/* ── Domínios ── */}
      <div id="alth-tabpanel-dominios" role="tabpanel" hidden={activeTab !== 'dominios'}>
        {activeTab === 'dominios' && (
          <div className="alth-tab-panel anim-tab-panel">
      <section className="alth-section">
        <div className="alth-section__header">
          <h4 className="alth-section__title">Domínios</h4>
          <span className={`alth-counter${slotsTotal != null && domainsUsed > slotsTotal ? ' alth-counter--over' : ''}`}>
            {domainsUsed} / {slotsTotal ?? '—'} pontos
          </span>
        </div>

        <input
          type="text"
          className="input alth-domains__search"
          placeholder="Buscar domínio (ex: Brutalidade, Luta, Resiliência)..."
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
        />

        <div className="alth-domains" role="table" aria-label="Domínios">
          <div className="alth-domains__head" role="row">
            <span role="columnheader">Domínio</span>
            <span role="columnheader">Atributo</span>
            <span role="columnheader">Dados</span>
            <span role="columnheader">Pontos</span>
          </div>

          {filteredDomains.length === 0 && (
            <p className="alth-domains__empty">Nenhum domínio encontrado.</p>
          )}

          {filteredDomains.map((d) => {
            const points    = domainMap.get(d.id) ?? 0
            const attrLabel = ATTRIBUTES.find((a) => a.id === d.attribute)?.label ?? ''
            return (
              <div key={d.id} className={`alth-domains__row${points > 0 ? ' alth-domains__row--active' : ''}`} role="row">
                <span className="alth-domains__name" role="cell">{d.label}</span>
                <span className="alth-domains__attr" role="cell">{attrLabel}</span>
                <span className="alth-domains__dice" role="cell">{1 + points}d10</span>
                <span className="alth-domains__points" role="cell">
                  {Array.from({ length: DOMAIN_MAX_POINTS + 1 }, (_, n) => (
                    <button
                      key={n}
                      type="button"
                      className={`alth-domains__pt${points === n ? ' alth-domains__pt--active' : ''}`}
                      onClick={() => onDomainChange(d.id, n)}
                      aria-label={`${n} ponto(s) em ${d.label}`}
                      aria-pressed={points === n}
                    >
                      {n}
                    </button>
                  ))}
                </span>
              </div>
            )
          })}
        </div>
        <p className="alth-hint">
          Cada ponto vale +1d10 no teste do domínio (máximo {DOMAIN_MAX_POINTS}). Alterações aqui salvam na hora.
        </p>
      </section>
          </div>
        )}
      </div>

      {/* ── Triunfos: Berserker escolhe (paga FV), Pilar tem todos (paga cartas) ── */}
      <div id="alth-tabpanel-triunfos" role="tabpanel" hidden={activeTab !== 'triunfos'}>
        {activeTab === 'triunfos' && (
          <div className="alth-tab-panel anim-tab-panel">
            {(fvWidget || prWidget || cardsWidget) && (
              <div className="alth-vitals-strip">
                {fvWidget}
                {prWidget}
                {cardsWidget}
              </div>
            )}
            {raiz === 'runaskin'
              ? (
                <AltheriumRunaskinTriumphs
                  trail={form.runaskin_trail === '' ? null : form.runaskin_trail}
                  onTrailChange={(t) => set('runaskin_trail', t ?? '')}
                  sceneUses={form.runaskin_scene_uses}
                  usesLimit={runaskinUsesPerScene(form.pr_max, form.level)}
                  onNewScene={() => set('runaskin_scene_uses', 0)}
                  prCurrent={form.pr_current}
                  onUse={(cost, name) => {
                    setForm((prev) => ({
                      ...prev,
                      pr_current:          Math.max(0, prev.pr_current - cost),
                      runaskin_scene_uses: prev.runaskin_scene_uses + 1,
                    }))
                    announceTriumph(`${name} (−${cost} PR)`)
                  }}
                  runes={runes}
                  onRuneCreate={onRuneCreate}
                  onRuneUpdate={onRuneUpdate}
                  onRuneDelete={onRuneDelete}
                />
              )
              : (
                <AltheriumTriumphsPanel
                  raiz={raiz}
                  triumphIds={form.berserker_triumphs}
                  limit={berserkerTriumphLimit(domains)}
                  fvCurrent={form.fv_current}
                  cardsCurrent={form.cards_current}
                  onChange={(ids) => set('berserker_triumphs', ids)}
                  onSpendFv={(cost, name) => {
                    set('fv_current', Math.max(0, form.fv_current - cost))
                    announceTriumph(`${name} (−${cost} FV)`)
                  }}
                  onSpendCards={(cost, name) => {
                    set('cards_current', Math.max(0, form.cards_current - cost))
                    announceTriumph(`${name} (−${cost} ${cost === 1 ? 'carta' : 'cartas'})`)
                  }}
                />
              )}
          </div>
        )}
      </div>

      {error && <div className="sheet-feedback sheet-feedback--error" role="alert">{error}</div>}
      {saveError && <div className="sheet-feedback sheet-feedback--error" role="alert">{saveError}</div>}

      {/* Salvamento automático — o botão só aparece quando há algo pra salvar
          (atalho pra não esperar o atraso, ou tentar de novo após erro). */}
      <div className="alth-actions">
        <span className={`alth-save-status alth-save-status--${saveState}`} role="status" aria-live="polite">
          {saveState === 'saved'   && '✓ Tudo salvo'}
          {saveState === 'pending' && 'Alterações pendentes…'}
          {saveState === 'saving'  && <><span className="spinner spinner--sm" /> Salvando…</>}
          {saveState === 'error'   && 'Erro ao salvar'}
        </span>
        {(saveState === 'pending' || saveState === 'error') && (
          <button type="submit" className="btn btn-ghost">
            {saveState === 'error' ? 'Tentar de novo' : 'Salvar agora'}
          </button>
        )}
      </div>
    </form>
  )
}

// ────────────────────────────────────────────────────────

// FV/PR — atual e máximo são dois campos diretos (como PV/PE), editáveis
// no próprio "atual / máximo" da barra.

interface VitalWidgetProps {
  sigla:     string
  label:     string
  tone:      'vitality' | 'mystic' | 'resource'
  current:   number
  max:       number
  onCurrent: (value: number) => void
  onMax:     (value: number) => void
  disabled?: boolean
}

function VitalWidget({ sigla, label, tone, current, max, onCurrent, onMax, disabled = false }: VitalWidgetProps) {
  return (
    <div className={`alth-vital-widget alth-vital-widget--${tone}`}>
      <div className="alth-vital-widget__top">
        <span className="alth-vital-widget__sigla" title={label}>{sigla}</span>
        <span className="alth-vital-widget__values">
          <input
            type="number" className="alth-vital-widget__value-input" min={0}
            value={current}
            onChange={(e) => onCurrent(clamp(e.target.value, 0, 9999))}
            disabled={disabled}
            aria-label={`${label} atual`}
          />
          <span className="alth-vital-widget__sep">/</span>
          <input
            type="number" className="alth-vital-widget__value-input alth-vital-widget__max-input" min={1}
            value={max}
            onChange={(e) => onMax(clamp(e.target.value, 1, 9999))}
            disabled={disabled}
            aria-label={`${label} máximo`}
          />
        </span>
      </div>
      <AltheriumDragBar
        value={current} max={max}
        onChange={onCurrent}
        disabled={disabled} label={label}
        trackClassName="alth-vital-widget__bar" fillClassName="alth-vital-widget__bar-fill"
      />
    </div>
  )
}

// ────────────────────────────────────────────────────────
// PV/PE — vivem no cabeçalho (compactas, sem moldura própria) e não têm
// mais d10-na-criação: atual e máximo são dois campos diretos, e a
// barra acompanha os dois em tempo real — e é arrastável (AltheriumDragBar).
// ────────────────────────────────────────────────────────

interface VitalBarProps {
  sigla:     string
  label:     string
  tone:      'vitality' | 'mystic'
  current:   number
  max:       number
  onCurrent: (value: number) => void
  onMax:     (value: number) => void
  disabled?: boolean
}

function VitalBar({ sigla, label, tone, current, max, onCurrent, onMax, disabled = false }: VitalBarProps) {
  return (
    <div className={`alth-vital-bar alth-vital-bar--${tone}`}>
      <div className="alth-vital-bar__top">
        <span className="alth-vital-bar__sigla" title={label}>{sigla}</span>
        <span className="alth-vital-bar__values">
          <input
            type="number" className="alth-vital-bar__value-input" min={0}
            value={current}
            onChange={(e) => onCurrent(clamp(e.target.value, 0, 9999))}
            disabled={disabled}
            aria-label={`${label} atual`}
          />
          <span className="alth-vital-bar__sep">/</span>
          <input
            type="number" className="alth-vital-bar__value-input alth-vital-bar__max-input" min={1}
            value={max}
            onChange={(e) => onMax(clamp(e.target.value, 1, 9999))}
            disabled={disabled}
            aria-label={`${label} máximo`}
          />
        </span>
      </div>
      <AltheriumDragBar
        value={current} max={max}
        onChange={onCurrent}
        disabled={disabled} label={label}
        trackClassName="alth-vital-bar__bar" fillClassName="alth-vital-bar__bar-fill"
      />
    </div>
  )
}
