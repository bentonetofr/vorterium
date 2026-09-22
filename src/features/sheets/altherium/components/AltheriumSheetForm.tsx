import { FormEvent, useEffect, useState } from 'react'
import {
  ATTRIBUTES,
  ATTRIBUTE_MAX,
  ATTRIBUTE_POINTS_AT_CREATION,
  BODY_PARTS,
  DOMAINS,
  DOMAIN_MAX_POINTS,
  GENESIS,
  RAIZES,
  type AltheriumRaiz,
} from '../constants/altherium'
import {
  attributePointsUsed,
  cardsMax,
  domainSlotsTotal,
  equilibrioMax,
  fvMax,
  movementMeters,
  prMax,
  usesCards,
  usesFv,
  usesPr,
  usesRunico,
  vitalityMax,
} from '../utils/altheriumCalculations'
import type { AltheriumSheet, AltheriumDomainPoints } from '../../../../shared/types'
import type { AltheriumSheetUpdate } from '../services/altheriumSheetService'
import './AltheriumSheet.css'

const NOTES_MAX = 2000

interface AltheriumSheetFormProps {
  sheet:        AltheriumSheet
  domains:      AltheriumDomainPoints[]
  ownerName?:   string
  onSave:       (data: AltheriumSheetUpdate) => Promise<void>
  onDomainChange: (domain: string, points: number) => Promise<void>
  saving:       boolean
  saveError:    string | null
  saveSuccess:  boolean
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
  vitality_roll:      number | null
  vitality_current:   number
  equilibrio_roll:    number | null
  equilibrio_current: number
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
    vitality_roll:      s.vitality_roll,
    vitality_current:   s.vitality_current,
    equilibrio_roll:    s.equilibrio_roll,
    equilibrio_current: s.equilibrio_current,
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
    vitality_roll:   f.vitality_roll,
    equilibrio_roll: f.equilibrio_roll,
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

export function AltheriumSheetForm({
  sheet, domains, ownerName, onSave, onDomainChange, saving, saveError, saveSuccess,
}: AltheriumSheetFormProps) {
  const [form, setForm] = useState<FormData>(() => sheetToForm(sheet))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setForm(sheetToForm(sheet)) }, [sheet])

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError(null)
  }

  // Estado projetado: os máximos acompanham o que está sendo editado agora
  const projected  = formToSheet(sheet, form)
  const raiz       = form.raiz === '' ? null : form.raiz
  const vitMax     = vitalityMax(projected)
  const eqMax      = equilibrioMax(projected)
  const forcaMax   = fvMax(projected)
  const runicoMax  = prMax(projected)
  const cartasMax  = cardsMax(projected)
  const pointsUsed = attributePointsUsed(projected)
  const slotsTotal = domainSlotsTotal(projected)

  const domainMap = new Map(domains.map((d) => [d.domain, d.points]))
  const domainsUsed = domains.reduce((sum, d) => sum + d.points, 0)

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
      vitality_roll:      form.vitality_roll,
      vitality_current:   form.vitality_current,
      equilibrio_roll:    form.equilibrio_roll,
      equilibrio_current: form.equilibrio_current,
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

      {/* ── Identidade ── */}
      <section className="alth-section">
        <h4 className="alth-section__title">Identidade</h4>
        <div className="alth-grid alth-grid--identity">
          <label className="alth-field alth-field--wide">
            <span className="label">Nome do personagem</span>
            <input
              type="text" className="input" maxLength={80}
              value={form.character_name}
              onChange={(e) => set('character_name', e.target.value)}
              disabled={saving}
            />
          </label>

          <label className="alth-field">
            <span className="label">Nível</span>
            <input
              type="number" className="input" min={1} max={5}
              value={form.level}
              onChange={(e) => set('level', clamp(e.target.value, 1, 5))}
              disabled={saving}
            />
          </label>

          <label className="alth-field">
            <span className="label">Raiz</span>
            <select
              className="input" value={form.raiz}
              onChange={(e) => set('raiz', e.target.value as AltheriumRaiz | '')}
              disabled={saving}
            >
              <option value="">—</option>
              {RAIZES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>

          <label className="alth-field">
            <span className="label">Gênesis</span>
            <select
              className="input" value={form.genesis}
              onChange={(e) => set('genesis', e.target.value)}
              disabled={saving}
            >
              <option value="">—</option>
              {GENESIS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </label>
        </div>

        {form.genesis && (
          <p className="alth-hint">{GENESIS.find((g) => g.id === form.genesis)?.effect}</p>
        )}
        {raiz && (
          <p className="alth-hint">{RAIZES.find((r) => r.id === raiz)?.description}</p>
        )}
      </section>

      {/* ── Atributos ── */}
      <section className="alth-section">
        <div className="alth-section__header">
          <h4 className="alth-section__title">Atributos</h4>
          <span className={`alth-counter${pointsUsed > ATTRIBUTE_POINTS_AT_CREATION ? ' alth-counter--over' : ''}`}>
            {pointsUsed} / {ATTRIBUTE_POINTS_AT_CREATION} pontos
          </span>
        </div>

        <div className="alth-grid alth-grid--attrs">
          {ATTRIBUTES.map((attr) => {
            const key = `attr_${attr.id}` as keyof FormData
            const value = form[key] as number
            const hidden = attr.id === 'runico' && raiz !== null && !usesRunico(raiz)
            if (hidden) return null
            return (
              <label key={attr.id} className="alth-attr" title={attr.description}>
                <span className="alth-attr__label">{attr.label}</span>
                <input
                  type="number" className="input alth-attr__input"
                  min={0} max={ATTRIBUTE_MAX}
                  value={value}
                  onChange={(e) => set(key, clamp(e.target.value, 0, ATTRIBUTE_MAX) as never)}
                  disabled={saving}
                />
                {value === 0 && <span className="alth-attr__warn">1d desvantagem</span>}
              </label>
            )
          })}
        </div>
        <p className="alth-hint">
          16 pontos na criação, apenas valores pares, máximo {ATTRIBUTE_MAX}.
          {raiz === 'runaskin' && ' Runaskin ganha +2 em Rúnico fora desses pontos.'}
        </p>
      </section>

      {/* ── Recursos ── */}
      <section className="alth-section">
        <h4 className="alth-section__title">Recursos</h4>
        <div className="alth-resources">
          <ResourceRow
            label="Vitalidade" current={form.vitality_current} max={vitMax} roll={form.vitality_roll}
            onCurrent={(v) => set('vitality_current', v)} onRoll={(v) => set('vitality_roll', v)}
            disabled={saving}
          />
          <ResourceRow
            label="Equilíbrio" current={form.equilibrio_current} max={eqMax} roll={form.equilibrio_roll}
            onCurrent={(v) => set('equilibrio_current', v)} onRoll={(v) => set('equilibrio_roll', v)}
            disabled={saving}
          />
          {usesFv(raiz) && (
            <ResourceRow
              label="Força de Vontade" current={form.fv_current} max={forcaMax} roll={form.fv_roll}
              onCurrent={(v) => set('fv_current', v)} onRoll={(v) => set('fv_roll', v)}
              disabled={saving}
            />
          )}
          {usesPr(raiz) && (
            <ResourceRow
              label="Pontos Rúnicos" current={form.pr_current} max={runicoMax} roll={form.pr_roll}
              onCurrent={(v) => set('pr_current', v)} onRoll={(v) => set('pr_roll', v)}
              disabled={saving}
            />
          )}
          {usesCards(raiz) && (
            <div className="alth-resource">
              <span className="alth-resource__label">Cartas</span>
              <input
                type="number" className="input alth-resource__current" min={0}
                value={form.cards_current}
                onChange={(e) => set('cards_current', clamp(e.target.value, 0, 999))}
                disabled={saving}
              />
              <span className="alth-resource__max">/ {cartasMax ?? '—'}</span>
              <span className="alth-resource__roll-label">13 × nível</span>
            </div>
          )}
        </div>
        <p className="alth-hint">
          O campo <strong>d10</strong> é o resultado rolado uma vez na criação — o máximo é calculado
          a partir dele e do atributo, então acompanha mudanças de atributo sozinho.
        </p>
      </section>

      {/* ── Domínios ── */}
      <section className="alth-section">
        <div className="alth-section__header">
          <h4 className="alth-section__title">Domínios</h4>
          <span className={`alth-counter${slotsTotal != null && domainsUsed > slotsTotal ? ' alth-counter--over' : ''}`}>
            {domainsUsed} / {slotsTotal ?? '—'} pontos
          </span>
        </div>

        <ul className="alth-domains">
          {DOMAINS.map((d) => {
            const points = domainMap.get(d.id) ?? 0
            const attrLabel = ATTRIBUTES.find((a) => a.id === d.attribute)?.label ?? ''
            return (
              <li key={d.id} className={`alth-domain${points > 0 ? ' alth-domain--active' : ''}`}>
                <span className="alth-domain__name">{d.label}</span>
                <span className="alth-domain__attr">{attrLabel}</span>
                <span className="alth-domain__dice">{1 + points}d10</span>
                <div className="alth-domain__points" role="group" aria-label={`Pontos em ${d.label}`}>
                  {Array.from({ length: DOMAIN_MAX_POINTS + 1 }, (_, n) => (
                    <button
                      key={n}
                      type="button"
                      className={`alth-domain__pt${points === n ? ' alth-domain__pt--active' : ''}`}
                      onClick={() => onDomainChange(d.id, n)}
                      disabled={saving}
                      aria-pressed={points === n}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
        <p className="alth-hint">
          Cada ponto adiciona +1d10 no teste do domínio. Máximo {DOMAIN_MAX_POINTS} por domínio.
          Alterações em domínios salvam na hora.
        </p>
      </section>

      {/* ── Defesa e recursos materiais ── */}
      <section className="alth-section">
        <h4 className="alth-section__title">Defesa e posses</h4>
        <div className="alth-grid alth-grid--db">
          {BODY_PARTS.map((part) => (
            <label key={part.id} className="alth-field">
              <span className="label">{part.label} <span className="alth-db__range">({part.range})</span></span>
              <input
                type="number" className="input" min={0}
                value={form[part.id] as number}
                onChange={(e) => set(part.id, clamp(e.target.value, 0, 999) as never)}
                disabled={saving}
              />
            </label>
          ))}

          <label className="alth-field">
            <span className="label">Hacksilvers (₴)</span>
            <input
              type="number" className="input" min={0}
              value={form.hacksilvers}
              onChange={(e) => set('hacksilvers', clamp(e.target.value, 0, 9_999_999))}
              disabled={saving}
            />
          </label>

          <div className="alth-field">
            <span className="label">Movimento</span>
            <span className="alth-derived">{movementMeters(form.attr_impulso)}m por turno</span>
          </div>
        </div>
        <p className="alth-hint">
          DB = dano bloqueado da armadura naquela parte. O inimigo rola 1d10 para saber onde acerta.
        </p>
      </section>

      {/* ── Anotações ── */}
      <section className="alth-section">
        <h4 className="alth-section__title">Anotações</h4>
        <textarea
          className="input alth-notes" rows={5} maxLength={NOTES_MAX}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          disabled={saving}
        />
      </section>

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

interface ResourceRowProps {
  label:     string
  current:   number
  max:       number | null
  roll:      number | null
  onCurrent: (value: number) => void
  onRoll:    (value: number | null) => void
  disabled:  boolean
}

function ResourceRow({ label, current, max, roll, onCurrent, onRoll, disabled }: ResourceRowProps) {
  return (
    <div className="alth-resource">
      <span className="alth-resource__label">{label}</span>
      <input
        type="number" className="input alth-resource__current" min={0}
        value={current}
        onChange={(e) => onCurrent(clamp(e.target.value, 0, 9999))}
        disabled={disabled}
        aria-label={`${label} atual`}
      />
      <span className="alth-resource__max">/ {max ?? '—'}</span>
      <label className="alth-resource__roll">
        <span className="alth-resource__roll-label">d10</span>
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
