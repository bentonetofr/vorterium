import { FormEvent, useEffect, useState } from 'react'
import {
  ATTRIBUTES,
  ATTRIBUTE_HARD_MAX,
  ATTRIBUTE_MAX_AT_CREATION,
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
  const pointsUsed = attributePointsUsed(projected)
  const slotsTotal = domainSlotsTotal(projected)

  const domainMap   = new Map(domains.map((d) => [d.domain, d.points]))
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

      {/* ── Cabeçalho: nome, raiz, gênesis ── */}
      <header className="alth-header">
        <input
          type="text"
          className="input alth-header__name"
          placeholder="Nome do personagem"
          maxLength={80}
          value={form.character_name}
          onChange={(e) => set('character_name', e.target.value)}
          disabled={saving}
          aria-label="Nome do personagem"
        />

        <div className="alth-header__row">
          <select
            className="input alth-header__select" value={form.raiz}
            onChange={(e) => set('raiz', e.target.value as AltheriumRaiz | '')}
            disabled={saving} aria-label="Raiz"
          >
            <option value="">Raiz —</option>
            {RAIZES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>

          <select
            className="input alth-header__select" value={form.genesis}
            onChange={(e) => set('genesis', e.target.value)}
            disabled={saving} aria-label="Gênesis"
          >
            <option value="">Gênesis —</option>
            {GENESIS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>

          <label className="alth-header__level">
            <span className="label">Nível</span>
            <input
              type="number" className="input" min={1} max={5}
              value={form.level}
              onChange={(e) => set('level', clamp(e.target.value, 1, 5))}
              disabled={saving}
            />
          </label>
        </div>

        {form.genesis && (
          <p className="alth-hint alth-hint--center">
            {GENESIS.find((g) => g.id === form.genesis)?.effect}
          </p>
        )}
      </header>

      {/* ── Recursos: PV / PE / FV-PR-Cartas ── */}
      <section className="alth-section">
        <div className="alth-vitals">
          <VitalRow
            sigla="PV" label="Vitalidade"
            current={form.vitality_current} max={vitalityMax(projected)} roll={form.vitality_roll}
            onCurrent={(v) => set('vitality_current', v)} onRoll={(v) => set('vitality_roll', v)}
            disabled={saving}
          />
          <VitalRow
            sigla="PE" label="Equilíbrio"
            current={form.equilibrio_current} max={equilibrioMax(projected)} roll={form.equilibrio_roll}
            onCurrent={(v) => set('equilibrio_current', v)} onRoll={(v) => set('equilibrio_roll', v)}
            disabled={saving}
          />
          {usesFv(raiz) && (
            <VitalRow
              sigla="FV" label="Força de Vontade"
              current={form.fv_current} max={fvMax(projected)} roll={form.fv_roll}
              onCurrent={(v) => set('fv_current', v)} onRoll={(v) => set('fv_roll', v)}
              disabled={saving}
            />
          )}
          {usesPr(raiz) && (
            <VitalRow
              sigla="PR" label="Pontos Rúnicos"
              current={form.pr_current} max={prMax(projected)} roll={form.pr_roll}
              onCurrent={(v) => set('pr_current', v)} onRoll={(v) => set('pr_roll', v)}
              disabled={saving}
            />
          )}
          {usesCards(raiz) && (
            <div className="alth-vital">
              <span className="alth-vital__sigla" title="Cartas">Cartas</span>
              <input
                type="number" className="input alth-vital__current" min={0}
                value={form.cards_current}
                onChange={(e) => set('cards_current', clamp(e.target.value, 0, 999))}
                disabled={saving} aria-label="Cartas atuais"
              />
              <span className="alth-vital__max">/ {cardsMax(projected) ?? '—'}</span>
              <span className="alth-vital__note">13 × nível</span>
            </div>
          )}
        </div>
        <p className="alth-hint">
          O campo <strong>d10</strong> é o resultado rolado uma vez na criação — o máximo sai dele
          somado à base da raiz e ao atributo, então acompanha mudanças de atributo sozinho.
        </p>
      </section>

      {/* ── Atributos ── */}
      <section className="alth-section">
        <div className="alth-section__header">
          <h4 className="alth-section__title">Atributos</h4>
          <span className={`alth-counter${pointsUsed > ATTRIBUTE_POINTS_AT_CREATION ? ' alth-counter--over' : ''}`}>
            {pointsUsed} / {ATTRIBUTE_POINTS_AT_CREATION} pontos de criação
          </span>
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
                {value === 0 && <span className="alth-table__warn">1d desvantagem</span>}
              </div>
            )
          })}
        </div>
        <p className="alth-hint">
          Na criação: 16 pontos, valores pares, teto {ATTRIBUTE_MAX_AT_CREATION} por atributo.
          Subir de nível dá +2 pontos e passa desse teto.
          {raiz === 'runaskin' && ' Runaskin ganha +2 em Rúnico fora dos 16.'}
        </p>
      </section>

      {/* ── Defesa por parte do corpo ── */}
      <section className="alth-section">
        <div className="alth-section__header">
          <h4 className="alth-section__title">Defesa (DB por parte)</h4>
          <span className="alth-counter">Movimento: {movementMeters(form.attr_impulso)}m</span>
        </div>

        <div className="alth-table alth-table--db">
          {BODY_PARTS.map((part) => (
            <div key={part.id} className="alth-table__col">
              <span className="alth-table__head">
                {part.label} <span className="alth-table__range">({part.range})</span>
              </span>
              <input
                type="number" className="input alth-table__value" min={0}
                value={form[part.id] as number}
                onChange={(e) => set(part.id, clamp(e.target.value, 0, 999) as never)}
                disabled={saving}
                aria-label={`DB em ${part.label}`}
              />
            </div>
          ))}
        </div>
        <p className="alth-hint">
          O inimigo rola 1d10 pra saber onde acerta; o DB daquela parte é subtraído do dano.
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

        <div className="alth-domains" role="table" aria-label="Domínios">
          <div className="alth-domains__head" role="row">
            <span role="columnheader">Domínio</span>
            <span role="columnheader">Atributo</span>
            <span role="columnheader">Dados</span>
            <span role="columnheader">Pontos</span>
          </div>

          {DOMAINS.map((d) => {
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

      {/* ── Hacksilvers e anotações ── */}
      <section className="alth-section">
        <div className="alth-section__header">
          <h4 className="alth-section__title">Posses e anotações</h4>
          <label className="alth-hacksilvers">
            <span className="label">Hacksilvers (₴)</span>
            <input
              type="number" className="input" min={0}
              value={form.hacksilvers}
              onChange={(e) => set('hacksilvers', clamp(e.target.value, 0, 9_999_999))}
              disabled={saving}
            />
          </label>
        </div>

        <textarea
          className="input alth-notes" rows={6} maxLength={NOTES_MAX}
          placeholder="Inventário, triunfos, armas, histórico..."
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

interface VitalRowProps {
  sigla:     string
  label:     string
  current:   number
  max:       number | null
  roll:      number | null
  onCurrent: (value: number) => void
  onRoll:    (value: number | null) => void
  disabled:  boolean
}

function VitalRow({ sigla, label, current, max, roll, onCurrent, onRoll, disabled }: VitalRowProps) {
  return (
    <div className="alth-vital">
      <span className="alth-vital__sigla" title={label}>{sigla}</span>
      <input
        type="number" className="input alth-vital__current" min={0}
        value={current}
        onChange={(e) => onCurrent(clamp(e.target.value, 0, 9999))}
        disabled={disabled}
        aria-label={`${label} atual`}
      />
      <span className="alth-vital__max">/ {max ?? '—'}</span>
      <label className="alth-vital__roll">
        <span className="alth-vital__note">d10</span>
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
