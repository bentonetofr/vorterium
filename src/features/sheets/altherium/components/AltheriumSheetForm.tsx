import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
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
  cardsMax,
  domainSlotsTotal,
  fvMax,
  movementMeters,
  prMax,
  usesCards,
  usesFv,
  usesPr,
  usesRunico,
} from '../utils/altheriumCalculations'
import { AltheriumBodyDiagram, type BodyZone } from './AltheriumBodyDiagram'
import type { AltheriumSheet, AltheriumDomainPoints } from '../../../../shared/types'
import type { AltheriumSheetUpdate } from '../services/altheriumSheetService'
import './AltheriumSheet.css'

const NOTES_MAX = 2000

interface AltheriumSheetFormProps {
  sheet:          AltheriumSheet
  domains:        AltheriumDomainPoints[]
  ownerName?:     string
  onSave:         (data: AltheriumSheetUpdate) => Promise<void>
  onDomainChange: (domain: string, points: number) => Promise<void>
  saving:         boolean
  saveError:      string | null
  saveSuccess:    boolean
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
  fv_roll:            number | null
  fv_current:         number
  pr_roll:            number | null
  pr_current:         number
  cards_current:      number
  hacksilvers:        number
  db_pernas:          number
  db_bracos:          number
  db_tronco:          number
  db_cabeca:          number
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
    fv_roll:            s.fv_roll,
    fv_current:         s.fv_current,
    pr_roll:            s.pr_roll,
    pr_current:         s.pr_current,
    cards_current:      s.cards_current,
    hacksilvers:        s.hacksilvers,
    db_pernas:          s.db_pernas,
    db_bracos:          s.db_bracos,
    db_tronco:          s.db_tronco,
    db_cabeca:          s.db_cabeca,
    notes:              s.notes ?? '',
  }
}

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
    fv_roll:         f.fv_roll,
    pr_roll:         f.pr_roll,
  }
}

function clamp(value: string, min: number, max: number): number {
  const n = parseInt(value, 10)
  if (isNaN(n)) return min
  return Math.max(min, Math.min(max, n))
}

function clampOrNull(value: string, min: number, max: number): number | null {
  if (value.trim() === '') return null
  return clamp(value, min, max)
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
  { id: 'visao-geral', label: 'Visão Geral' },
  { id: 'combate',     label: 'Combate' },
  { id: 'dominios',    label: 'Domínios' },
  { id: 'triunfos',    label: 'Triunfos' },
]

export function AltheriumSheetForm({
  sheet, domains, ownerName, onSave, onDomainChange, saving, saveError, saveSuccess,
}: AltheriumSheetFormProps) {
  const [form, setForm] = useState<FormData>(() => sheetToForm(sheet))
  const [error, setError] = useState<string | null>(null)
  const [domainFilter, setDomainFilter] = useState('')
  const [activeTab, setActiveTab] = useState<AltheriumFormTabId>('visao-geral')

  const dbInputRefs = {
    db_cabeca: useRef<HTMLInputElement>(null),
    db_bracos: useRef<HTMLInputElement>(null),
    db_tronco: useRef<HTMLInputElement>(null),
    db_pernas: useRef<HTMLInputElement>(null),
  }

  useEffect(() => { setForm(sheetToForm(sheet)) }, [sheet])

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError(null)
  }

  function handleZoneClick(zone: BodyZone) {
    const input = dbInputRefs[zone].current
    input?.focus()
    input?.select()
  }

  // Estado projetado: os máximos de FV/PR/Cartas acompanham o que está
  // sendo editado agora. PV/PE não são mais derivados — são campos
  // diretos do form, lidos direto (form.vitality_max/equilibrio_max).
  const projected  = formToSheet(sheet, form)
  const raiz       = form.raiz === '' ? null : form.raiz
  const forcaMax   = fvMax(projected)
  const runicoMax  = prMax(projected)
  const cartasMax  = cardsMax(projected)
  const slotsTotal = domainSlotsTotal(projected)

  const domainMap    = new Map(domains.map((d) => [d.domain, d.points]))
  const domainsUsed  = domains.reduce((sum, d) => sum + d.points, 0)
  const filteredDomains = useMemo(() => {
    const q = normalize(domainFilter.trim())
    if (!q) return DOMAINS
    return DOMAINS.filter((d) => normalize(d.label).includes(q))
  }, [domainFilter])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (form.character_name.trim().length > 80) {
      setError('O nome do personagem deve ter no máximo 80 caracteres.')
      return
    }
    if (form.notes.length > NOTES_MAX) {
      setError(`As anotações devem ter no máximo ${NOTES_MAX} caracteres.`)
      return
    }

    await onSave({
      character_name:     form.character_name.trim() || null,
      level:              form.level,
      raiz:               form.raiz === '' ? null : form.raiz,
      genesis:            form.genesis === '' ? null : form.genesis,
      attr_furia:         form.attr_furia,
      attr_destino:       form.attr_destino,
      attr_espirito:      form.attr_espirito,
      attr_impulso:       form.attr_impulso,
      attr_estrategia:    form.attr_estrategia,
      attr_runico:        form.attr_runico,
      vitality_current:   form.vitality_current,
      vitality_max:       form.vitality_max,
      equilibrio_current: form.equilibrio_current,
      equilibrio_max:     form.equilibrio_max,
      fv_roll:            form.fv_roll,
      fv_current:         form.fv_current,
      pr_roll:            form.pr_roll,
      pr_current:         form.pr_current,
      cards_current:      form.cards_current,
      hacksilvers:        form.hacksilvers,
      db_pernas:          form.db_pernas,
      db_bracos:          form.db_bracos,
      db_tronco:          form.db_tronco,
      db_cabeca:          form.db_cabeca,
      notes:              form.notes.trim() || null,
    })
  }

  return (
    <form className="alth-sheet" onSubmit={handleSubmit} noValidate>
      {ownerName && (
        <p className="alth-sheet__owner">Ficha de <strong>{ownerName}</strong></p>
      )}

      {/* ── Cabeçalho ── */}
      <header className="alth-hero">
        <div className="alth-hero__identity">
          <input
            type="text"
            className="alth-hero__name"
            placeholder="Nome do personagem"
            maxLength={80}
            value={form.character_name}
            onChange={(e) => set('character_name', e.target.value)}
            disabled={saving}
            aria-label="Nome do personagem"
          />
          <div className="alth-hero__tags">
            <select
              className="input alth-hero__select" value={form.raiz}
              onChange={(e) => set('raiz', e.target.value as AltheriumRaiz | '')}
              disabled={saving} aria-label="Raiz"
            >
              <option value="">Raiz —</option>
              {RAIZES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            <select
              className="input alth-hero__select" value={form.genesis}
              onChange={(e) => set('genesis', e.target.value)}
              disabled={saving} aria-label="Gênesis"
            >
              <option value="">Gênesis —</option>
              {GENESIS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </div>
        </div>

        <div className="alth-hero__vitals">
          <VitalBar
            sigla="PV" label="Vitalidade" tone="vitality"
            current={form.vitality_current} max={form.vitality_max}
            onCurrent={(v) => set('vitality_current', v)} onMax={(v) => set('vitality_max', v)}
            disabled={saving}
          />
          <VitalBar
            sigla="PE" label="Equilíbrio" tone="mystic"
            current={form.equilibrio_current} max={form.equilibrio_max}
            onCurrent={(v) => set('equilibrio_current', v)} onMax={(v) => set('equilibrio_max', v)}
            disabled={saving}
          />
        </div>

        <div className="alth-hero__stats">
          <label className="alth-hero__level">
            <span className="label">Nível</span>
            <input
              type="number" className="input" min={1} max={5}
              value={form.level}
              onChange={(e) => set('level', clamp(e.target.value, 1, 5))}
              disabled={saving}
            />
          </label>
          <label className="alth-hero__coins">
            <span className="label">Hacksilvers (₴)</span>
            <input
              type="number" className="input" min={0}
              value={form.hacksilvers}
              onChange={(e) => set('hacksilvers', clamp(e.target.value, 0, 9_999_999))}
              disabled={saving}
            />
          </label>
        </div>
      </header>

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
      </nav>

      {/* ── Visão Geral: recursos que dependem da raiz, atributos, crônicas ── */}
      <div id="alth-tabpanel-visao-geral" role="tabpanel" hidden={activeTab !== 'visao-geral'}>
        {activeTab === 'visao-geral' && (
          <div className="alth-tab-panel animate-fade-up">
            {(usesFv(raiz) || usesPr(raiz) || usesCards(raiz)) && (
              <>
                <div className="alth-vitals-strip">
                  {usesFv(raiz) && (
                    <VitalWidget
                      sigla="FV" label="Força de Vontade" tone="resource"
                      current={form.fv_current} max={forcaMax} roll={form.fv_roll}
                      pct={forcaMax ? Math.max(0, Math.min(100, (form.fv_current / forcaMax) * 100)) : 0}
                      onCurrent={(v) => set('fv_current', v)} onRoll={(v) => set('fv_roll', v)}
                      disabled={saving}
                    />
                  )}
                  {usesPr(raiz) && (
                    <VitalWidget
                      sigla="PR" label="Pontos Rúnicos" tone="mystic"
                      current={form.pr_current} max={runicoMax} roll={form.pr_roll}
                      pct={runicoMax ? Math.max(0, Math.min(100, (form.pr_current / runicoMax) * 100)) : 0}
                      onCurrent={(v) => set('pr_current', v)} onRoll={(v) => set('pr_roll', v)}
                      disabled={saving}
                    />
                  )}
                  {usesCards(raiz) && (
                    <div className="alth-vital-widget alth-vital-widget--resource">
                      <div className="alth-vital-widget__top">
                        <span className="alth-vital-widget__sigla">Cartas</span>
                        <span className="alth-vital-widget__values">
                          <input
                            type="number" className="input" min={0}
                            value={form.cards_current}
                            onChange={(e) => set('cards_current', clamp(e.target.value, 0, 999))}
                            disabled={saving} aria-label="Cartas atuais"
                          />
                          <span className="alth-vital-widget__max">/ {cartasMax ?? '—'}</span>
                        </span>
                      </div>
                      <span className="alth-vital-widget__note">13 × nível</span>
                    </div>
                  )}
                </div>
                <p className="alth-hint">
                  O campo <strong>d10</strong> é o resultado rolado uma vez na criação — o máximo sai dele
                  somado à base da raiz e ao atributo, então acompanha mudanças de atributo sozinho.
                </p>
              </>
            )}

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
                        disabled={saving}
                        aria-label={attr.label}
                      />
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="alth-section alth-journal">
              <h4 className="alth-section__title">Crônicas</h4>
              <textarea
                className="input alth-notes" rows={6} maxLength={NOTES_MAX}
                placeholder="Histórico, NPCs, pistas..."
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                disabled={saving}
              />
            </section>
          </div>
        )}
      </div>

      {/* ── Combate: anatomia/armadura (armas chegam numa próxima atualização) ── */}
      <div id="alth-tabpanel-combate" role="tabpanel" hidden={activeTab !== 'combate'}>
        {activeTab === 'combate' && (
          <div className="alth-tab-panel animate-fade-up">
        <section className="alth-card">
          <div className="alth-card__header">
            <h4 className="alth-card__title">Anatomia &amp; Armadura</h4>
            <span className="alth-counter">Movimento {movementMeters(form.attr_impulso)}m</span>
          </div>

          <div className="alth-anatomy">
            <AltheriumBodyDiagram
              values={{
                db_cabeca: form.db_cabeca,
                db_bracos: form.db_bracos,
                db_tronco: form.db_tronco,
                db_pernas: form.db_pernas,
              }}
              onZoneClick={handleZoneClick}
            />

            <div className="alth-anatomy__fields">
              {BODY_PARTS.map((part) => (
                <label key={part.id} className="alth-anatomy__field">
                  <span className="label">{part.label} <span className="alth-table__range">({part.range})</span></span>
                  <input
                    ref={dbInputRefs[part.id]}
                    type="number" className="input" min={0}
                    value={form[part.id] as number}
                    onChange={(e) => set(part.id, clamp(e.target.value, 0, 999) as never)}
                    disabled={saving}
                    aria-label={`DB em ${part.label}`}
                  />
                </label>
              ))}
            </div>
          </div>
          <p className="alth-hint">
            DB = dano bloqueado. O inimigo rola 1d10 pra saber onde acerta; a zona armada
            (destacada no diagrama) reduz o dano recebido ali. Clique numa zona pra editar.
          </p>
        </section>

            <AltheriumComingSoon
              title="Armas e armaduras"
              message="O catálogo de armas e armaduras com estatísticas chega numa próxima atualização."
            />
          </div>
        )}
      </div>

      {/* ── Domínios ── */}
      <div id="alth-tabpanel-dominios" role="tabpanel" hidden={activeTab !== 'dominios'}>
        {activeTab === 'dominios' && (
          <div className="alth-tab-panel animate-fade-up">
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
                      disabled={saving}
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

      {/* ── Triunfos: fase futura ── */}
      <div id="alth-tabpanel-triunfos" role="tabpanel" hidden={activeTab !== 'triunfos'}>
        {activeTab === 'triunfos' && (
          <div className="alth-tab-panel animate-fade-up">
            <AltheriumComingSoon
              title="Triunfos"
              message="Trilhas, naipes e habilidades especiais por raiz chegam numa próxima atualização."
            />
          </div>
        )}
      </div>

      {error && <div className="sheet-feedback sheet-feedback--error" role="alert">{error}</div>}
      {saveError && <div className="sheet-feedback sheet-feedback--error" role="alert">{saveError}</div>}
      {saveSuccess && <div className="sheet-feedback sheet-feedback--success" role="status">Ficha salva.</div>}

      <div className="alth-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <><span className="spinner spinner--sm" /> Salvando...</> : 'Salvar ficha'}
        </button>
      </div>
    </form>
  )
}

// ────────────────────────────────────────────────────────

interface VitalWidgetProps {
  sigla:     string
  label:     string
  tone:      'vitality' | 'mystic' | 'resource'
  current:   number
  max:       number | null
  roll:      number | null
  pct:       number
  onCurrent: (value: number) => void
  onRoll:    (value: number | null) => void
  disabled:  boolean
}

function VitalWidget({ sigla, label, tone, current, max, roll, pct, onCurrent, onRoll, disabled }: VitalWidgetProps) {
  return (
    <div className={`alth-vital-widget alth-vital-widget--${tone}`}>
      <div className="alth-vital-widget__top">
        <span className="alth-vital-widget__sigla" title={label}>{sigla}</span>
        <span className="alth-vital-widget__values">
          <input
            type="number" className="input" min={0}
            value={current}
            onChange={(e) => onCurrent(clamp(e.target.value, 0, 9999))}
            disabled={disabled}
            aria-label={`${label} atual`}
          />
          <span className="alth-vital-widget__max">/ {max ?? '—'}</span>
        </span>
      </div>
      <div className="alth-vital-widget__bar">
        <div className="alth-vital-widget__bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <label className="alth-vital-widget__roll">
        <span className="alth-vital-widget__note">d10 na criação</span>
        <input
          type="number" className="input" min={1} max={10}
          value={roll ?? ''}
          onChange={(e) => onRoll(clampOrNull(e.target.value, 1, 10))}
          disabled={disabled}
          aria-label={`d10 rolado de ${label}`}
        />
      </label>
    </div>
  )
}

// ────────────────────────────────────────────────────────
// PV/PE — vivem no cabeçalho (compactas, sem moldura própria) e não têm
// mais d10-na-criação: atual e máximo são dois campos diretos, e a
// barra acompanha os dois em tempo real (recalculada a cada render).
// ────────────────────────────────────────────────────────

interface VitalBarProps {
  sigla:     string
  label:     string
  tone:      'vitality' | 'mystic'
  current:   number
  max:       number
  onCurrent: (value: number) => void
  onMax:     (value: number) => void
  disabled:  boolean
}

function VitalBar({ sigla, label, tone, current, max, onCurrent, onMax, disabled }: VitalBarProps) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0
  return (
    <div className={`alth-vital-bar alth-vital-bar--${tone}`}>
      <div className="alth-vital-bar__top">
        <span className="alth-vital-bar__sigla" title={label}>{sigla}</span>
        <span className="alth-vital-bar__values">
          <input
            type="number" className="input" min={0}
            value={current}
            onChange={(e) => onCurrent(clamp(e.target.value, 0, 9999))}
            disabled={disabled}
            aria-label={`${label} atual`}
          />
          <span className="alth-vital-bar__sep">/</span>
          <input
            type="number" className="input alth-vital-bar__max-input" min={1}
            value={max}
            onChange={(e) => onMax(clamp(e.target.value, 1, 9999))}
            disabled={disabled}
            aria-label={`${label} máximo`}
          />
        </span>
      </div>
      <div className="alth-vital-bar__bar">
        <div className="alth-vital-bar__bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Placeholder pras abas/seções que ainda não existem (Fase 2 e 3 —
// catálogo de armas/armaduras e Triunfos, ver spec).
// ────────────────────────────────────────────────────────

interface AltheriumComingSoonProps {
  title:   string
  message: string
}

function AltheriumComingSoon({ title, message }: AltheriumComingSoonProps) {
  return (
    <div className="alth-coming-soon">
      <span className="alth-coming-soon__icon" aria-hidden="true">✦</span>
      <h4 className="alth-coming-soon__title">{title}</h4>
      <p className="alth-coming-soon__message">{message}</p>
    </div>
  )
}
