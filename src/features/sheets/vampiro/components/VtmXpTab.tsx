import { useState } from 'react'
import { Select } from '../../../../shared/components/Select'
import type { VtmXpEntry } from '../../../../shared/types'
import { VTM_ATTRIBUTES, VTM_DISCIPLINES, VTM_SKILLS, VTM_TEXT_LIMITS, type VtmAttrKey, type VtmDiscipline } from '../constants/vampiro'
import { VTM_ADVANTAGES, VTM_ADV_BY_KEY } from '../constants/vtmAdvantages'
import { VTM_RITE_RULES, type VtmRiteKind } from '../constants/vtmRituals'
import { bpRange, newId } from '../utils/vampiroRules'
import {
  VTM_XP_COSTS, catalogRites, checkRite, discDots, disciplineCost, xpEntry, xpTotals,
} from '../utils/vtmProgress'
import type { VtmForm, VtmUpdate } from './vtmForm'

// ────────────────────────────────────────────────────────
// Aba Experiência: XP ganha (com o motivo), XP gasta com o custo do Livro
// Básico calculado sozinho, e o histórico de tudo. Comprar já sobe o ponto
// na ficha; o último gasto pode ser desfeito (devolve a XP e o ponto).
// Custos: atributo novo nível × 5; perícia × 3; especialização 3;
// disciplina do clã × 5, Caitiff × 6, fora do clã × 7; ritual, cerimônia
// e fórmula nível × 3; vantagem 3 por ponto; Potência de Sangue × 10.
// ────────────────────────────────────────────────────────

type BuyType = 'atributo' | 'pericia' | 'especializacao' | 'disciplina' | VtmRiteKind | 'vantagem' | 'nova_vantagem' | 'potencia'

const BUY_TYPES: { value: BuyType; label: string }[] = [
  { value: 'atributo', label: 'Atributo' },
  { value: 'pericia', label: 'Perícia' },
  { value: 'especializacao', label: 'Especialização' },
  { value: 'disciplina', label: 'Disciplina' },
  { value: 'ritual', label: 'Ritual de Feitiçaria' },
  { value: 'cerimonia', label: 'Cerimônia de Oblívio' },
  { value: 'formula', label: 'Fórmula de Alquimia' },
  { value: 'vantagem', label: 'Ponto numa vantagem que já tem' },
  { value: 'nova_vantagem', label: 'Vantagem nova' },
  { value: 'potencia', label: 'Potência de Sangue' },
]

interface Offer { cost: number; label: string; apply: (f: VtmForm) => VtmForm; target: VtmXpEntry['target'] }

function offerFor(form: VtmForm, type: BuyType, key: string, specName: string): Offer | string | null {
  if (!key && type !== 'potencia') return null
  switch (type) {
    case 'atributo': {
      const a = VTM_ATTRIBUTES.find((x) => x.key === key)!
      const col = `attr_${key as VtmAttrKey}` as const
      const from = form[col]
      if (from >= 5) return `${a.label} já está no máximo.`
      return {
        cost: VTM_XP_COSTS.attribute(from + 1), label: `${a.label} ${from} → ${from + 1}`,
        apply: (f) => ({ ...f, [col]: from + 1 }), target: { type, key, from, to: from + 1 },
      }
    }
    case 'pericia': {
      const k = VTM_SKILLS.find((x) => x.key === key)!
      const from = form.skills[key] ?? 0
      if (from >= 5) return `${k.label} já está no máximo.`
      return {
        cost: VTM_XP_COSTS.skill(from + 1), label: `${k.label} ${from} → ${from + 1}`,
        apply: (f) => ({ ...f, skills: { ...f.skills, [key]: from + 1 } }), target: { type, key, from, to: from + 1 },
      }
    }
    case 'especializacao': {
      const k = VTM_SKILLS.find((x) => x.key === key)!
      if (!(form.skills[key] ?? 0)) return `Precisa de pelo menos 1 ponto em ${k.label}.`
      const name = specName.trim().slice(0, VTM_TEXT_LIMITS.specialty)
      if (!name) return 'Escreva a especialização.'
      const id = newId()
      return {
        cost: VTM_XP_COSTS.specialty(), label: `Especialização: ${k.label} (${name})`,
        apply: (f) => ({ ...f, specialties: [...f.specialties, { id, skill: key, name }] }),
        target: { type, key, from: 0, to: 1, extra: id },
      }
    }
    case 'disciplina': {
      const d = key as VtmDiscipline
      const from = discDots(form, d)
      if (from >= 5) return `${VTM_DISCIPLINES[d]} já está no máximo.`
      const { cost, why } = disciplineCost(form, d, from + 1)
      return {
        cost, label: `${VTM_DISCIPLINES[d]} ${from} → ${from + 1} (${why})`,
        apply: (f) => ({ ...f, disciplines: { ...f.disciplines, [d]: from + 1 } }), target: { type, key, from, to: from + 1 },
      }
    }
    case 'ritual': case 'cerimonia': case 'formula': {
      const r = catalogRites(type).find((x) => x.id === key)
      if (!r) return null
      if (form.rituals.includes(r.id)) return 'Já aprendeu.'
      const check = checkRite(form, r)
      if (!check.ok) return check.reason
      return {
        cost: VTM_XP_COSTS.rite(r.level), label: `${VTM_RITE_RULES[type].label}: ${r.name} (nível ${r.level})`,
        apply: (f) => ({ ...f, rituals: [...f.rituals, r.id] }), target: { type, key, from: 0, to: 1, extra: r.id },
      }
    }
    case 'vantagem': {
      const a = form.advantages.find((x) => x.id === key)
      if (!a) return null
      const def = VTM_ADV_BY_KEY.get(a.key)
      const allowed = def ? def.dots.filter((n) => n > a.dots) : [a.dots + 1]
      const to = allowed[0]
      if (to == null || to > 6) return `${a.name} já está no máximo.`
      return {
        cost: VTM_XP_COSTS.advantage(to - a.dots), label: `${a.name} ${a.dots} → ${to}`,
        apply: (f) => ({ ...f, advantages: f.advantages.map((x) => (x.id === a.id ? { ...x, dots: to } : x)) }),
        target: { type, key: a.id, from: a.dots, to },
      }
    }
    case 'nova_vantagem': {
      const def = VTM_ADV_BY_KEY.get(key)
      if (!def) return null
      const id = newId()
      const dots = def.dots[0]
      return {
        cost: VTM_XP_COSTS.advantage(dots), label: `${def.name} (${dots})`,
        apply: (f) => ({ ...f, advantages: [...f.advantages, { id, key: def.key, kind: def.kind, name: def.name, dots, note: '', source: 'xp' }] }),
        target: { type, key, from: 0, to: dots, extra: id },
      }
    }
    case 'potencia': {
      const from = form.blood_potency
      const max = bpRange(form.generation).max
      if (from >= max) return `A ${form.generation}ª geração não passa de Potência ${max}.`
      return {
        cost: VTM_XP_COSTS.bloodPotency(from + 1), label: `Potência de Sangue ${from} → ${from + 1}`,
        apply: (f) => ({ ...f, blood_potency: from + 1 }), target: { type, key: 'blood_potency', from, to: from + 1 },
      }
    }
  }
}

/** Desfaz um gasto: volta o ponto, se ele ainda estiver como o gasto deixou. */
function undoSpend(f: VtmForm, e: VtmXpEntry): VtmForm | string {
  const t = e.target
  if (!t) return 'Este gasto não guardou o que mudou; ajuste à mão.'
  switch (t.type) {
    case 'atributo': {
      const col = `attr_${t.key as VtmAttrKey}` as const
      if (f[col] !== t.to) return 'O atributo já mudou desde a compra; ajuste à mão.'
      return { ...f, [col]: t.from }
    }
    case 'pericia':
      if ((f.skills[t.key] ?? 0) !== t.to) return 'A perícia já mudou desde a compra; ajuste à mão.'
      return { ...f, skills: { ...f.skills, [t.key]: t.from } }
    case 'especializacao':
      return { ...f, specialties: f.specialties.filter((s) => s.id !== t.extra) }
    case 'disciplina':
      if (discDots(f, t.key) !== t.to) return 'A disciplina já mudou desde a compra; ajuste à mão.'
      return { ...f, disciplines: { ...f.disciplines, [t.key]: t.from } }
    case 'ritual': case 'cerimonia': case 'formula':
      return { ...f, rituals: f.rituals.filter((r) => r !== t.extra) }
    case 'vantagem':
      return { ...f, advantages: f.advantages.map((a) => (a.id === t.key && a.dots === t.to ? { ...a, dots: t.from } : a)) }
    case 'nova_vantagem':
      return { ...f, advantages: f.advantages.filter((a) => a.id !== t.extra) }
    case 'potencia':
      if (f.blood_potency !== t.to) return 'A Potência já mudou desde a compra; ajuste à mão.'
      return { ...f, blood_potency: t.from }
  }
  return 'Não sei desfazer este gasto.'
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function VtmXpTab({ form, update }: { form: VtmForm; update: VtmUpdate }) {
  const totals = xpTotals(form.xp_log)
  const [gain, setGain] = useState(1)
  const [gainNote, setGainNote] = useState('')
  const [type, setType] = useState<BuyType>('atributo')
  const [key, setKey] = useState('')
  const [specName, setSpecName] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const offer = offerFor(form, type, key, specName)
  const lastSpend = [...form.xp_log].reverse().find((e) => e.kind === 'gasto')

  function addGain() {
    if (gain <= 0) return
    update((p) => ({ ...p, xp_log: [...p.xp_log, xpEntry('ganho', gain, gainNote.trim() || 'XP da sessão')] }))
    setGainNote('')
    setMsg(null)
  }

  function buy() {
    if (!offer || typeof offer === 'string') return
    if (offer.cost > totals.available) { setMsg(`Falta XP: custa ${offer.cost}, sobram ${totals.available}.`); return }
    update((p) => ({ ...offer.apply(p), xp_log: [...p.xp_log, xpEntry('gasto', offer.cost, offer.label, { target: offer.target })] }))
    setMsg(`Comprado: ${offer.label} (${offer.cost} XP).`)
    setSpecName('')
    if (type === 'nova_vantagem' || type === 'ritual' || type === 'cerimonia' || type === 'formula') setKey('')
  }

  function undo(e: VtmXpEntry) {
    const check = undoSpend(form, e)
    if (typeof check === 'string') { setMsg(check); return }
    update((p) => {
      const r = undoSpend(p, e)
      return typeof r === 'string' ? p : { ...r, xp_log: p.xp_log.filter((x) => x.id !== e.id) }
    })
    setMsg(`Desfeito: ${e.label}.`)
  }

  function removeGain(e: VtmXpEntry) {
    if (totals.available - e.amount < 0) { setMsg('Essa XP já foi gasta: desfaça os gastos antes.'); return }
    update((p) => ({ ...p, xp_log: p.xp_log.filter((x) => x.id !== e.id) }))
  }

  const keyOptions = optionsFor(form, type)

  return (
    <div className="vtm-tab-panel anim-tab-panel">
      <section className="vtm-card">
        <div className="vtm-card__header"><h4 className="vtm-card__title">Experiência</h4></div>
        <div className="vtm-xp-totals">
          <div><span className="vtm-label">Ganha</span><strong>{totals.earned}</strong></div>
          <div><span className="vtm-label">Gasta</span><strong>{totals.spent}</strong></div>
          <div className="vtm-xp-totals__free"><span className="vtm-label">Disponível</span><strong>{totals.available}</strong></div>
        </div>
        <div className="vtm-add-row">
          <input type="number" className="input vtm-xp-amount" min={1} max={99} value={gain}
            onChange={(e) => setGain(Math.max(0, Math.min(99, parseInt(e.target.value, 10) || 0)))} aria-label="XP ganha" />
          <input className="input" maxLength={120} placeholder="Motivo (ex.: sessão 4)" value={gainNote} onChange={(e) => setGainNote(e.target.value)} />
          <button type="button" className="vtm-chip" onClick={addGain} disabled={gain <= 0}>+ Ganhar XP</button>
        </div>
      </section>

      <section className="vtm-card">
        <div className="vtm-card__header"><h4 className="vtm-card__title">Gastar</h4></div>
        <div className="vtm-xp-buy">
          <Select options={BUY_TYPES} value={type} onChange={(v) => { setType(v as BuyType); setKey(''); setMsg(null) }} aria-label="O que comprar" />
          {type !== 'potencia' && (
            <Select options={[{ value: '', label: 'Escolha…' }, ...keyOptions]} value={key} onChange={(v) => { setKey(v); setMsg(null) }} aria-label="Qual" />
          )}
          {type === 'especializacao' && (
            <input className="input" maxLength={VTM_TEXT_LIMITS.specialty} placeholder="Especialização" value={specName} onChange={(e) => setSpecName(e.target.value)} />
          )}
        </div>
        {typeof offer === 'string' && <p className="vtm-warn">{offer}</p>}
        {offer && typeof offer !== 'string' && (
          <div className="vtm-xp-offer">
            <span>{offer.label}</span>
            <strong className={offer.cost > totals.available ? 'vtm-xp-offer__short' : ''}>{offer.cost} XP</strong>
            <button type="button" className="vtm-chip" onClick={buy}>Comprar</button>
          </div>
        )}
        {msg && <p className="vtm-muted" role="status">{msg}</p>}
        <p className="vtm-muted">
          Custos do Livro Básico: atributo novo nível × 5 · perícia × 3 · especialização 3 · disciplina do clã × 5,
          Caitiff × 6, fora do clã × 7 · ritual, cerimônia e fórmula nível × 3 · vantagem 3 por ponto · Potência de Sangue × 10.
        </p>
      </section>

      <section className="vtm-card">
        <div className="vtm-card__header">
          <h4 className="vtm-card__title">Histórico</h4>
          <span className="vtm-counter">{form.xp_log.length}</span>
        </div>
        {form.xp_log.length === 0 && <p className="vtm-muted">Nada ainda.</p>}
        <ul className="vtm-xp-log">
          {[...form.xp_log].reverse().map((e) => (
            <li key={e.id} className={`vtm-xp-log__item vtm-xp-log__item--${e.kind}`}>
              <span className="vtm-xp-log__amount">{e.kind === 'ganho' ? '+' : '−'}{e.amount}</span>
              <span className="vtm-xp-log__label">{e.label}</span>
              <span className="vtm-faint">{fmtDate(e.at)}</span>
              {e.kind === 'gasto' && e.id === lastSpend?.id && (
                <button type="button" className="vtm-chip" onClick={() => undo(e)} title="Devolve a XP e volta o ponto">Desfazer</button>
              )}
              {e.kind === 'ganho' && (
                <button type="button" className="vtm-x" onClick={() => removeGain(e)} aria-label="Apagar este ganho">×</button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function optionsFor(form: VtmForm, type: BuyType): { value: string; label: string }[] {
  switch (type) {
    case 'atributo':
      return VTM_ATTRIBUTES.map((a) => ({ value: a.key, label: `${a.label} (${form[`attr_${a.key}`]})` }))
    case 'pericia':
      return VTM_SKILLS.map((k) => ({ value: k.key, label: `${k.label} (${form.skills[k.key] ?? 0})` }))
    case 'especializacao':
      return VTM_SKILLS.filter((k) => (form.skills[k.key] ?? 0) > 0).map((k) => ({ value: k.key, label: k.label }))
    case 'disciplina':
      return (Object.keys(VTM_DISCIPLINES) as VtmDiscipline[])
        .filter((d) => d !== 'alquimia' || form.generation >= 14)
        .map((d) => ({ value: d, label: `${VTM_DISCIPLINES[d]} (${discDots(form, d)})` }))
    case 'ritual': case 'cerimonia': case 'formula':
      return catalogRites(type).filter((r) => !form.rituals.includes(r.id) && checkRite(form, r).ok)
        .map((r) => ({ value: r.id, label: `${'●'.repeat(r.level)} ${r.name}` }))
    case 'vantagem':
      return form.advantages.filter((a) => a.kind !== 'flaw').map((a) => ({ value: a.id, label: `${a.name} (${a.dots})` }))
    case 'nova_vantagem':
      return VTM_ADVANTAGES.filter((d) => d.kind !== 'flaw' && (!d.only || (d.only === 'caitiff' && form.clan === 'caitiff') || (d.only === 'sangue_ralo' && form.generation >= 14)))
        .map((d) => ({ value: d.key, label: `${d.name} (${d.dots[0]})` }))
    case 'potencia':
      return []
  }
}
