import { useMemo, useState } from 'react'
import { ADVANCE_OPTIONS, DOMAINS, TRAIT_INFO } from '../catalog/rules'
import { CLASSES } from '../catalog/classes'
import { DOMAIN_CARDS } from '../catalog/domainCards'
import { experienceMod, maxCardLevel, ownedDomains, tierOf } from '../model/derive'
import { achievementsAt, advanceChoices, domainPickCap, newExperienceId, pickCost, unmarkedTraits, validateAdvancement, type AdvanceChoice } from '../model/levelUp'
import type { DhAdvancement, DhClassKey, DhDomain, DhPick, DhSheetData, DhTrait } from '../model/types'
import { Banner, signed, DhSelect } from './DhUi'

// ────────────────────────────────────────────────────────
// O passo de uma subida de nível (usado na aba Subir de nível e, no formulário da ficha rápida, uma vez por nível):
// conquistas do nível, duas opções do quadro do patamar e a carta de domínio do nível.
// ────────────────────────────────────────────────────────

const OPT_LABEL = new Map<string, string>(ADVANCE_OPTIONS.map((o) => [o.opt, o.label]))
const TIER_LEVELS: Record<number, string> = { 2: '2 a 4', 3: '5 a 7', 4: '8 a 10' }

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
  /** Uma pergunta por vez (conquistas, quadro, detalhes, carta e confirmação), para a janela de subir de nível. */
  stepped?: boolean
}

export function DhLevelWizard({ data, onApply, onCancel, applyLabel, cancelLabel = 'Cancelar', bare, stepped }: WizardProps) {
  const next = data.level + 1
  const [picks, setPicks] = useState<Draft[]>([])
  const [expName, setExpName] = useState('')
  const [card, setCard] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const expId = useMemo(() => newExperienceId(), [data.level])
  const ach = achievementsAt(next)
  const choices = advanceChoices(data, next)
  const spent = picks.reduce((n, p) => n + pickCost(p.pick.opt), 0)
  const tiersShown = [...new Set(choices.map((c) => c.tier))].sort((x, z) => z - x)

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
    setPicks([]); setExpName(''); setCard(''); setError(null); setStep(0)
  }

  const achBlock = (
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
  )

  const boardBlock = (
    <>
      <div className="dh-board__head">
        <h4>Escolha duas opções do quadro</h4>
        <span className="dh-board__spent" role="status" aria-label={`${spent} de 2 escolhas feitas`}>
          {[0, 1].map((k) => <i key={k} className={k < spent ? 'is-on' : ''} />)}
        </span>
      </div>
      <p className="dh-hint">Cada casinha vazia é uma vez que a opção ainda pode ser escolhida. Clique numa casinha vazia para marcar; clique numa dourada para desmarcar.</p>
      {tiersShown.map((t) => (
        <section key={t} className="dh-board">
          <h5>Patamar {t} <small>(níveis {TIER_LEVELS[t]})</small></h5>
          <ul className="dh-board__rows">
            {choices.filter((c) => c.tier === t).map((c) => {
              const cap = (ADVANCE_OPTIONS.find((o) => o.opt === c.opt)?.slots as Record<number, number> | undefined)?.[c.tier] ?? 0
              const used = cap - c.remaining
              const mine = picks.filter((d) => d.choice.opt === c.opt && d.choice.tier === c.tier).length
              const blocked = !!c.blocked
              const full = spent + c.cost > 2
              return (
                <li key={`${c.opt}${c.tier}`} className={`dh-board__row${blocked && mine === 0 ? ' is-off' : ''}`}>
                  <span className="dh-board__boxes" role="group" aria-label={`${OPT_LABEL.get(c.opt)}: ${cap} casas`}>
                    {Array.from({ length: cap }, (_, k) => {
                      const state = k < used ? 'used' : k < used + mine ? 'picked' : 'free'
                      const canClick = state === 'free' ? !blocked && !full : state === 'picked'
                      return (
                        <button key={k} type="button" className={`dh-board__box is-${state}`} disabled={!canClick}
                          aria-label={state === 'used' ? 'Casa já usada' : state === 'picked' ? 'Casa marcada agora: clique para desmarcar' : 'Casa livre: clique para escolher'}
                          onClick={() => {
                            if (state === 'picked') { const at = picks.map((d) => d.choice.opt === c.opt && d.choice.tier === c.tier).lastIndexOf(true); setPicks((p) => p.filter((_, j) => j !== at)) } else choose(c)
                          }} />
                      )
                    })}
                  </span>
                  <span className="dh-board__text">{OPT_LABEL.get(c.opt)}{c.blocked && mine === 0 && <small>{c.blocked}</small>}</span>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </>
  )

  const picksBlock = picks.map((d, i) => (
    <div key={i} className="dh-pick">
      <header><b>{OPT_LABEL.get(d.pick.opt)}</b> <small>(patamar {d.pick.tier})</small> <button type="button" className="dh-x" aria-label="Tirar" onClick={() => setPicks((p) => p.filter((_, j) => j !== i))}>×</button></header>
      <PickForm data={data} level={next} pick={d.pick} onChange={(p) => patch(i, p)} extraExp={ach.experience && expName.trim() ? { id: expId, name: expName.trim() } : null} />
    </div>
  ))

  const cardBlock = (
    <>
      <h4>Carta de domínio do nível</h4>
      <CardSelect data={data} level={next} extra={picks.map((d) => d.pick)} value={card} onChange={setCard} cap={10} />
    </>
  )

  const errorBlock = error && <p className="sheet-feedback sheet-feedback--error" role="alert">{error}</p>

  const body = (
    <>
      <p className="dh-hint">Ao subir, seus limiares de dano aumentam em +1 (nível + base da armadura).</p>
      {achBlock}
      {boardBlock}
      {picksBlock}
      {cardBlock}
      {errorBlock}
      <div className="dh-actions">
        <button type="button" className="btn btn-primary" disabled={spent !== 2 || !card} onClick={() => void confirm()}>{applyLabel ?? `Confirmar nível ${next}`}</button>
        {onCancel && <button type="button" className="btn" onClick={onCancel}>{cancelLabel}</button>}
      </div>
    </>
  )

  // ── uma pergunta por vez (a janela de subir de nível) ──
  const needsDetails = picks.some((d) => d.pick.opt === 'traits' || d.pick.opt === 'experiences' || d.pick.opt === 'domain' || d.pick.opt === 'multiclass')
  const stepIds = ['conquistas', 'quadro', ...(needsDetails ? ['detalhes'] : []), 'carta', 'confirmar'] as const
  const cur = stepIds[Math.min(step, stepIds.length - 1)]
  const STEP_TITLE: Record<(typeof stepIds)[number], string> = { conquistas: `Nível ${next}: conquistas`, quadro: 'Quais são as duas escolhas?', detalhes: 'Detalhes das escolhas', carta: 'Qual carta de domínio entra?', confirmar: 'Tudo certo?' }
  const stepOk: Record<(typeof stepIds)[number], boolean> = {
    conquistas: !ach.experience || expName.trim().length > 0,
    quadro: spent === 2,
    detalhes: true,
    carta: !!card,
    confirmar: true,
  }
  const lastStep = cur === 'confirmar'

  if (stepped) {
    return (
      <div className="dh-lvlsteps">
        <div className="dh-lvlsteps__dots" aria-hidden="true">
          {stepIds.map((id, k) => <i key={id} className={k < stepIds.indexOf(cur) ? 'is-done' : k === stepIds.indexOf(cur) ? 'is-now' : ''} />)}
        </div>
        <p className="dh-lvlsteps__count">Pergunta {stepIds.indexOf(cur) + 1} de {stepIds.length}</p>
        <h3 className="dh-lvlsteps__title">{STEP_TITLE[cur]}</h3>
        <div className="dh-lvlsteps__body" key={cur}>
          {cur === 'conquistas' && <>{achBlock}<p className="dh-hint">Ao subir, seus limiares de dano aumentam em +1 (nível + base da armadura).</p></>}
          {cur === 'quadro' && boardBlock}
          {cur === 'detalhes' && <>{picksBlock}</>}
          {cur === 'carta' && cardBlock}
          {cur === 'confirmar' && (
            <ul className="dh-q__sum dh-lvlsteps__sum">
              <li><b>Nível {next}</b> · Patamar {tierOf(next)}</li>
              {ach.experience && <li>Experiência nova: <b>{expName.trim()}</b> (+2)</li>}
              {picks.map((d, i) => <li key={i}>{describePick(d.pick, data)}</li>)}
              <li>Carta de domínio: <b>{DOMAIN_CARDS.find((c) => c.id === card)?.name ?? '—'}</b></li>
            </ul>
          )}
          {errorBlock}
        </div>
        <footer className="dh-dialog__foot">
          <button type="button" className="btn" onClick={() => { setError(null); if (step === 0) onCancel?.(); else setStep(step - 1) }}>{step === 0 ? cancelLabel : 'Voltar'}</button>
          {lastStep
            ? <button type="button" className="btn btn-primary" onClick={() => void confirm()}>{applyLabel ?? `Subir para o nível ${next}`}</button>
            : <button type="button" className="btn btn-primary" disabled={!stepOk[cur]} onClick={() => { setError(null); setStep(step + 1) }}>Continuar</button>}
        </footer>
      </div>
    )
  }

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
    <DhSelect label={label} value={value} onChange={(v) => onChange(v as DhTrait)} options={options.map((t) => ({ value: t, label: TRAIT_INFO[t].label }))} />
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
          <DhSelect key={i} label={`Experiência ${i + 1}`} value={pick.ids[i]} onChange={(v) => { const ids: [string, string] = [...pick.ids]; ids[i] = v; onChange({ ...pick, ids }) }}
            options={[{ value: '', label: 'Escolha…' }, ...exps.map((e) => ({ value: e.id, label: `${e.name || 'Sem nome'} (${signed(experienceMod(data, e.id))} → ${signed(experienceMod(data, e.id) + 1)})` }))]} />
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
        <DhSelect label="Classe" value={pick.classKey} onChange={(v) => {
          const c = CLASSES.find((x) => x.key === v as DhClassKey)!
          onChange({ ...pick, classKey: c.key, domain: c.domains.find((d) => !mine.has(d)) ?? c.domains[0], subclassKey: c.subclasses[0].key })
        }} options={CLASSES.filter((c) => c.key !== data.classKey).map((c) => ({ value: c.key, label: c.name }))} />
        <DhSelect label="Domínio" value={pick.domain} onChange={(v) => onChange({ ...pick, domain: v as DhDomain })}
          options={cls.domains.map((d) => ({ value: d, label: `${DOMAINS[d].name}${mine.has(d) ? ' (você já tem)' : ''}`, disabled: mine.has(d) }))} />
        <DhSelect label="Subclasse" value={pick.subclassKey} onChange={(v) => onChange({ ...pick, subclassKey: v })}
          options={cls.subclasses.map((x) => ({ value: x.key, label: x.name }))} />
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
    <DhSelect label="Carta de domínio" value={value} onChange={onChange}
      options={[{ value: '', label: 'Escolha uma carta…' }, ...doms.flatMap((d) => list.filter((c) => c.domain === d).map((c) => ({ value: c.id, label: `${DOMAINS[d].name} · Nível ${c.level} · ${c.name}` })))]} />
  )
}
