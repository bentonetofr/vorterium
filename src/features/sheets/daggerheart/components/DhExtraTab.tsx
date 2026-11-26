import { BEASTFORMS, beastform } from '../catalog/beastforms'
import { COMPANION_PICKS, RANGE_INFO, RANGE_ORDER, TRAIT_INFO } from '../catalog/rules'
import { evasion, multiclassPick, proficiency, tierOf } from '../model/derive'
import { emptyCompanion, newId } from '../model/defaults'
import type { DhSheetData } from '../model/types'
import { Banner, Inline, RuleText, Stepper, signed, DhSelect } from './DhUi'
import { Slots } from './DhUi'

// ────────────────────────────────────────────────────────
// Extras de classe: Forma de Fera do druida e Companheiro Animal do patrulheiro (subclasse Treinador).
// ────────────────────────────────────────────────────────

interface Props {
  data: DhSheetData
  update: (fn: (d: DhSheetData) => DhSheetData) => void
  canEdit: boolean
}

export function hasBeastform(d: DhSheetData): boolean {
  return d.classKey === 'druida' || multiclassPick(d)?.classKey === 'druida'
}

export function hasCompanion(d: DhSheetData): boolean {
  const mc = multiclassPick(d)
  return d.subclassKey === 'treinador' || (mc?.classKey === 'patrulheiro' && mc.subclassKey === 'treinador')
}

export function DhExtraTab({ data, update, canEdit }: Props) {
  return (
    <div className="dh-extra">
      {hasBeastform(data) && <BeastformPanel data={data} update={update} canEdit={canEdit} />}
      {hasCompanion(data) && <CompanionPanel data={data} update={update} canEdit={canEdit} />}
      {!hasBeastform(data) && !hasCompanion(data) && <p className="dh-empty">Sua classe não tem extras além da ficha.</p>}
    </div>
  )
}

function BeastformPanel({ data, update, canEdit }: Props) {
  const tier = tierOf(data.level)
  const cur = beastform(data.trackers.beastform)
  const list = BEASTFORMS.filter((b) => b.tier <= tier)
  const prof = proficiency(data)
  return (
    <section className="dh-box">
      <Banner>Forma de Fera</Banner>
      <p className="dh-hint">Marque 1 Ponto de Fadiga para se transformar (3 Esperança com a habilidade Evolução, sem Fadiga). Em forma de fera você não usa armas nem conjura cartas de domínio. Ao atacar, usa o alcance, o atributo e o dado da criatura, mas a sua Proficiência ({prof}).</p>
      {cur && (
        <div className="dh-beast is-active">
          <h4>{cur.name} <small>{cur.examples}</small></h4>
          <p>{cur.trait ? <>{TRAIT_INFO[cur.trait].label} {signed(cur.traitBonus)} · </> : null}Evasão {signed(cur.evasion)} (total {evasion(data) + cur.evasion})
            {cur.attackTrait && <> · {RANGE_INFO[cur.attackRange].short} ({TRAIT_INFO[cur.attackTrait].label}) {prof}{cur.dice} fís</>}</p>
          {cur.advantages.length > 0 && <p>Vantagem em: {cur.advantages.join(', ')}.</p>}
          {cur.features.map((f) => <div key={f.name} className="dh-feature"><h4>{f.name}</h4><RuleText text={f.text} /></div>)}
          {canEdit && <button type="button" className="btn" onClick={() => update((d) => ({ ...d, trackers: { ...d.trackers, beastform: '' } }))}>Sair da Forma de Fera</button>}
        </div>
      )}
      <div className="dh-beastgrid">
        {list.filter((b) => b.key !== cur?.key).map((b) => (
          <article key={b.key} className="dh-beast">
            <h4>{b.name} <small>P{b.tier}</small></h4>
            <p className="dh-hint">{b.examples}</p>
            <p>{b.trait ? <>{TRAIT_INFO[b.trait].label} {signed(b.traitBonus)} · </> : null}{b.evasion ? <>Evasão {signed(b.evasion)} · </> : null}{b.attackTrait ? <>{RANGE_INFO[b.attackRange].short} {b.dice}</> : b.note}</p>
            {b.advantages.length > 0 && <p className="dh-hint">Vantagem: {b.advantages.join(', ')}</p>}
            <details><summary>Habilidades</summary>{b.features.map((f) => <div key={f.name} className="dh-feature"><h4>{f.name}</h4><RuleText text={f.text} /></div>)}</details>
            {canEdit && <button type="button" className="btn" onClick={() => update((d) => ({ ...d, trackers: { ...d.trackers, beastform: b.key } }))}>Transformar</button>}
          </article>
        ))}
      </div>
    </section>
  )
}

function CompanionPanel({ data, update, canEdit }: Props) {
  const c = data.companion
  if (!c) {
    return (
      <section className="dh-box">
        <Banner>Companheiro Animal</Banner>
        <p className="dh-hint">Trabalhe com o mestre para decidir que animal acompanha você. Dê um nome, escolha duas Experiências (+2) e descreva o ataque padrão.</p>
        {canEdit && <button type="button" className="btn btn-primary" onClick={() => update((d) => ({ ...d, companion: { ...emptyCompanion(), experiences: [{ id: newId(), name: '', mod: 2 }, { id: newId(), name: '', mod: 2 }] } }))}>Criar ficha do companheiro</button>}
      </section>
    )
  }
  const set = (patch: Partial<typeof c>) => update((d) => (d.companion ? { ...d, companion: { ...d.companion, ...patch } } : d))
  const dieSteps: (6 | 8 | 10 | 12)[] = [6, 8, 10, 12]
  const fierce = c.picks.filter((p) => p === 'feroz').length
  const rangeIdx = Math.min(RANGE_ORDER.length - 1, RANGE_ORDER.indexOf(c.range))
  return (
    <section className="dh-box">
      <Banner>Companheiro Animal</Banner>
      <div className="dh-form">
        <label>Nome<Inline value={c.name} onChange={(v) => set({ name: v })} disabled={!canEdit} maxLength={80} aria-label="Nome do companheiro" /></label>
        <label>Evasão <Stepper value={c.evasion + (c.picks.includes('atento') ? 2 : 0)} min={0} max={30} label="Evasão do companheiro" disabled={!canEdit} onChange={(v) => set({ evasion: v - (c.picks.includes('atento') ? 2 : 0) })} /></label>
        <label>Ataque padrão<Inline value={c.attack} onChange={(v) => set({ attack: v })} disabled={!canEdit} maxLength={200} placeholder="Como ele causa dano" aria-label="Ataque do companheiro" /></label>
        <label>Dado de dano
          <DhSelect label="Dado de dano" value={String(c.damageDie)} disabled={!canEdit} onChange={(v) => set({ damageDie: Number(v) as typeof c.damageDie })} options={dieSteps.map((n) => ({ value: String(n), label: `d${n}` }))} />
        </label>
        <label>Alcance
          <DhSelect label="Alcance" value={RANGE_ORDER[rangeIdx]} disabled={!canEdit} onChange={(v) => set({ range: v as typeof c.range })} options={RANGE_ORDER.map((r) => ({ value: r, label: RANGE_INFO[r].label }))} />
        </label>
      </div>
      <p className="dh-hint">Feroz: {fierce}× (aumenta o dado ou o alcance em um passo cada vez). Ao mandá-lo atacar, ele usa sua Proficiência ({proficiency(data)}).</p>
      <div className="dh-row"><span className="dh-row__label">Fadiga</span>
        <Slots open={c.stressSlots + c.picks.filter((p) => p === 'resiliente').length} total={12} marked={c.stressMarked} label="Fadiga do companheiro" tone="stress" onChange={canEdit ? (n) => set({ stressMarked: n }) : undefined} />
      </div>
      <h4>Experiências do companheiro</h4>
      <ul className="dh-exps">
        {c.experiences.map((e) => (
          <li key={e.id}>
            <Inline value={e.name} onChange={(v) => set({ experiences: c.experiences.map((x) => (x.id === e.id ? { ...x, name: v } : x)) })} disabled={!canEdit} maxLength={80} placeholder="Experiência" aria-label="Experiência do companheiro" />
            <b>{signed(e.mod)}</b>
          </li>
        ))}
      </ul>
      <h4>Treinamento (uma opção por nível)</h4>
      <ul className="dh-opts">
        {COMPANION_PICKS.map((p) => {
          const n = c.picks.filter((x) => x === p.key).length
          const max = p.max ?? 1
          return (
            <li key={p.key} className={n >= max ? 'is-off' : ''}>
              <span><b>{p.name}</b> {n > 0 && <small>({n}×)</small>}<small>{p.text}</small></span>
              {canEdit && <span className="dh-actions"><button type="button" className="btn" disabled={n >= max} onClick={() => set({ picks: [...c.picks, p.key] })}>Escolher</button>{n > 0 && <button type="button" className="dh-link" onClick={() => { const i = c.picks.lastIndexOf(p.key); set({ picks: c.picks.filter((_, j) => j !== i) }) }}>Tirar</button>}</span>}
            </li>
          )
        })}
      </ul>
      <label className="dh-qa">Anotações<Inline multiline rows={3} maxLength={4000} value={c.notes} onChange={(v) => set({ notes: v })} disabled={!canEdit} aria-label="Anotações do companheiro" /></label>
    </section>
  )
}
