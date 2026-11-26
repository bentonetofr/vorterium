import { useMemo, useState } from 'react'
import { ADVANCE_OPTIONS, DOMAINS, TRAIT_INFO } from '../catalog/rules'
import { CLASSES } from '../catalog/classes'
import { DOMAIN_CARDS } from '../catalog/domainCards'
import { experienceMod, maxCardLevel, ownedDomains } from '../model/derive'
import { achievementsAt, advanceChoices, domainPickCap, newExperienceId, pickCost, unmarkedTraits, validateAdvancement, type AdvanceChoice } from '../model/levelUp'
import type { DhAdvancement, DhClassKey, DhDomain, DhPick, DhSheetData, DhTrait } from '../model/types'
import { Banner, signed } from './DhUi'

// ────────────────────────────────────────────────────────
// O passo de uma subida de nível (usado na aba Subir de nível e, no formulário da ficha rápida, uma vez por nível):
// conquistas do nível, duas opções do quadro do patamar e a carta de domínio do nível.
// ────────────────────────────────────────────────────────

const OPT_LABEL = new Map<string, string>(ADVANCE_OPTIONS.map((o) => [o.opt, o.label]))

type Draft = { choice: AdvanceChoice; pick: DhPick }

interface WizardProps {
  /** A ficha antes da subida: ela sobe para data.level + 1. */
  data: DhSheetData
  /** Chamado com a subida já conferida e o nome da Experiência nova (se o nível dá uma). */
  onApply: (adv: DhAdvancement, experienceName: string) => void | Promise<void>
  onCancel?: () => void
  applyLabel?: string
  cancelLabel?: string
  /** Sem a moldura de caixa e o título (quando já está dentro de uma janela). */
  bare?: boolean
}

export function DhLevelWizard({ data, onApply, onCancel, applyLabel, cancelLabel = 'Cancelar', bare }: WizardProps) {
  const next = data.level + 1
  const [picks, setPicks] = useState<Draft[]>([])
  const [expName, setExpName] = useState('')
  const [card, setCard] = useState('')
  const [error, setError] = useState<string | null>(null)
  const expId = useMemo(() => newExperienceId(), [data.level])
  const ach = achievementsAt(next)
  const choices = advanceChoices(data, next)
  const spent = picks.reduce((n, p) => n + pickCost(p.pick.opt), 0)

  function choose(c: AdvanceChoice) {
    if (c.blocked || spent + c.cost > 2) return
    const mc0 = CLASSES.find((x) => x.key !== data.classKey)!
    const blank: DhPick =
      c.opt === 'hp' || c.opt === 'stress' || c.opt === 'evasion' ? { opt: c.opt, tier: c.tier }
      : c.opt === 'subclass' || c.opt === 'proficiency' ? { opt: c.opt, tier: c.tier as 3 | 4 }
      : c.opt === 'traits' ? { opt: 'traits', tier: c.tier, traits: [unmarkedTraits(data, next)[0] ?? 'agility', unmarkedTraits(data, next)[1] ?? 'strength'] }
      : c.opt === 'experiences' ? { opt: 'experiences', tier: c.tier, ids: [data.experiences[0]?.id ?? '', data.experiences[1]?.id ?? ''] }
      : c.opt === 'domain' ? { opt: 'domain', tier: c.tier, card: '' }
      : { opt: 'multiclass', tier: c.tier as 3 | 4, classKey: mc0.key, domain: mc0.domains[0], subclassKey: mc0.subclasses[0].key }
    setPicks((p) => [...p, { choice: c, pick: blank }])
  }

  function patch(i: number, pick: DhPick) {
    setPicks((p) => p.map((d, j) => (j === i ? { ...d, pick } : d)))
  }

  async function confirm() {
    const adv: DhAdvancement = { level: next, picks: picks.map((d) => d.pick), experienceId: ach.experience ? expId : null, card: card || null }
    const check = validateAdvancement(data, adv)
    if (check) { setError(check); return }
    if (ach.experience && !expName.trim()) { setError('Dê um nome à nova Experiência.'); return }
    await onApply(adv, expName.trim())
    setPicks([]); setExpName(''); setCard(''); setError(null)
  }

  const body = (
    <>
      <p className="dh-hint">Ao subir, seus limiares de dano aumentam em +1 (nível + base da armadura).</p>

      <div className="dh-ach">
        <h4>Conquistas do nível</h4>
        {!ach.experience && <p>Nenhuma conquista especial neste nível.</p>}
        {ach.experience && (
          <>
            <p>Uma Experiência nova (+2) e +1 de Proficiência{ach.clearsMarks ? '; as marcas dos atributos são limpas' : ''}.</p>
            <label>Nome da nova Experiência
              <input value={expName} maxLength={120} onChange={(e) => setExpName(e.target.value)} placeholder="Específica, como “Contrabandista do Porto Velho”" />
            </label>
          </>
        )}
      </div>

      <h4>Escolha duas opções <small>({spent}/2)</small></h4>
      <ul className="dh-opts">
        {choices.map((c) => {
          const dis = !!c.blocked || spent + c.cost > 2
          return (
            <li key={`${c.opt}${c.tier}`} className={dis ? 'is-off' : ''}>
              <span className="dh-opts__tier">P{c.tier}</span>
              <span>{OPT_LABEL.get(c.opt)} <small>{c.blocked ?? `${c.remaining} casa${c.remaining === 1 ? '' : 's'} livre${c.remaining === 1 ? '' : 's'}`}</small></span>
              <button type="button" className="btn" disabled={dis} onClick={() => choose(c)}>Escolher</button>
            </li>
          )
        })}
      </ul>

      {picks.map((d, i) => (
        <div key={i} className="dh-pick">
          <header><b>{OPT_LABEL.get(d.pick.opt)}</b> <small>(patamar {d.pick.tier})</small> <button type="button" className="dh-x" aria-label="Tirar" onClick={() => setPicks((p) => p.filter((_, j) => j !== i))}>×</button></header>
          <PickForm data={data} level={next} pick={d.pick} onChange={(p) => patch(i, p)} extraExp={ach.experience && expName.trim() ? { id: expId, name: expName.trim() } : null} />
        </div>
      ))}

      <h4>Carta de domínio do nível</h4>
      <CardSelect data={data} level={next} extra={picks.map((d) => d.pick)} value={card} onChange={setCard} cap={10} />

      {error && <p className="sheet-feedback sheet-feedback--error" role="alert">{error}</p>}
      <div className="dh-actions">
        <button type="button" className="btn btn-primary" disabled={spent !== 2 || !card} onClick={() => void confirm()}>{applyLabel ?? `Confirmar nível ${next}`}</button>
        {onCancel && <button type="button" className="btn" onClick={onCancel}>{cancelLabel}</button>}
      </div>
    </>
  )

  if (bare) return <div className="dh-level__wizard">{body}</div>
  return (
    <section className="dh-box dh-level__wizard">
      <Banner>Nível {next}</Banner>
      {body}
    </section>
  )
}

export function describePick(p: DhPick, data: DhSheetData): string {
  switch (p.opt) {
    case 'traits': return `+1 em ${p.traits.map((t) => TRAIT_INFO[t].label).join(' e ')}`
    case 'hp': return '+1 espaço de Vida'
    case 'stress': return '+1 espaço de Fadiga'
    case 'experiences': return `+1 em ${p.ids.map((id) => data.experiences.find((e) => e.id === id)?.name || '—').join(' e ')}`
    case 'domain': return `carta extra: ${DOMAIN_CARDS.find((c) => c.id === p.card)?.name ?? '—'}`
    case 'evasion': return '+1 de Evasão'
    case 'subclass': return 'subclasse melhorada'
    case 'proficiency': return '+1 de Proficiência'
    case 'multiclass': return `multiclasse: ${CLASSES.find((c) => c.key === p.classKey)?.name}`
  }
}

function TraitSelect({ value, options, onChange, label }: { value: DhTrait; options: DhTrait[]; onChange: (t: DhTrait) => void; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as DhTrait)}>
      {options.map((t) => <option key={t} value={t}>{TRAIT_INFO[t].label}</option>)}
    </select>
  )
}

function PickForm({ data, level, pick, onChange, extraExp }: { data: DhSheetData; level: number; pick: DhPick; onChange: (p: DhPick) => void; extraExp: { id: string; name: string } | null }) {
  if (pick.opt === 'traits') {
    const free = unmarkedTraits(data, level)
    return (
      <div className="dh-pick__body">
        <TraitSelect label="Primeiro atributo" value={pick.traits[0]} options={free} onChange={(t) => onChange({ ...pick, traits: [t, pick.traits[1]] })} />
        <TraitSelect label="Segundo atributo" value={pick.traits[1]} options={free} onChange={(t) => onChange({ ...pick, traits: [pick.traits[0], t] })} />
      </div>
    )
  }
  if (pick.opt === 'experiences') {
    const exps = [...data.experiences, ...(extraExp ? [{ id: extraExp.id, name: extraExp.name, mod: 2 }] : [])]
    return (
      <div className="dh-pick__body">
        {[0, 1].map((i) => (
          <select key={i} aria-label={`Experiência ${i + 1}`} value={pick.ids[i]} onChange={(e) => { const ids: [string, string] = [...pick.ids]; ids[i] = e.target.value; onChange({ ...pick, ids }) }}>
            <option value="">Escolha…</option>
            {exps.map((e) => <option key={e.id} value={e.id}>{e.name || 'Sem nome'} ({signed(experienceMod(data, e.id))} → {signed(experienceMod(data, e.id) + 1)})</option>)}
          </select>
        ))}
      </div>
    )
  }
  if (pick.opt === 'domain') {
    return <CardSelect data={data} level={level} extra={[]} value={pick.card} onChange={(c) => onChange({ ...pick, card: c })} cap={domainPickCap(pick.tier)} />
  }
  if (pick.opt === 'multiclass') {
    const cls = CLASSES.find((c) => c.key === pick.classKey)!
    const mine = new Set(ownedDomains(data))
    return (
      <div className="dh-pick__body">
        <select aria-label="Classe" value={pick.classKey} onChange={(e) => {
          const c = CLASSES.find((x) => x.key === e.target.value as DhClassKey)!
          onChange({ ...pick, classKey: c.key, domain: c.domains.find((d) => !mine.has(d)) ?? c.domains[0], subclassKey: c.subclasses[0].key })
        }}>
          {CLASSES.filter((c) => c.key !== data.classKey).map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
        </select>
        <select aria-label="Domínio" value={pick.domain} onChange={(e) => onChange({ ...pick, domain: e.target.value as DhDomain })}>
          {cls.domains.map((d) => <option key={d} value={d} disabled={mine.has(d)}>{DOMAINS[d].name}{mine.has(d) ? ' (você já tem)' : ''}</option>)}
        </select>
        <select aria-label="Subclasse" value={pick.subclassKey} onChange={(e) => onChange({ ...pick, subclassKey: e.target.value })}>
          {cls.subclasses.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
        </select>
        <p className="dh-hint">Cartas do domínio novo: só até metade do seu nível (arredondado para cima). Você ganha a habilidade de classe e a carta fundamental da subclasse.</p>
      </div>
    )
  }
  return null
}

function CardSelect({ data, level, extra, value, onChange, cap }: { data: DhSheetData; level: number; extra: DhPick[]; value: string; onChange: (id: string) => void; cap: number }) {
  const probe: DhSheetData = { ...data, level, advancements: [...data.advancements, { level, picks: extra, experienceId: null, card: null }] }
  const owned = new Set([...data.loadout, ...data.vault, ...extra.flatMap((p) => (p.opt === 'domain' ? [p.card] : []))])
  const doms = ownedDomains(probe)
  const list = DOMAIN_CARDS.filter((c) => doms.includes(c.domain) && c.level <= Math.min(cap, maxCardLevel(probe, c.domain)) && (!owned.has(c.id) || c.id === value))
  return (
    <select aria-label="Carta de domínio" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Escolha uma carta…</option>
      {doms.map((d) => (
        <optgroup key={d} label={DOMAINS[d].name}>
          {list.filter((c) => c.domain === d).map((c) => <option key={c.id} value={c.id}>Nível {c.level} · {c.name}</option>)}
        </optgroup>
      ))}
    </select>
  )
}
