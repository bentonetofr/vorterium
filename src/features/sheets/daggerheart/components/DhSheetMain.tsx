import { useState } from 'react'
import { ANCESTRIES, COMMUNITIES, ancestry, community } from '../catalog/heritage'
import { DOMAINS, RANGE_INFO, TRAIT_INFO } from '../catalog/rules'
import { CLASSES, dhClass } from '../catalog/classes'
import {
  addGold, allTraitValues, armorScore, attackModifier, currentClass, currentSubclass, damageFormula, evasion, flatDamageBonus, hopeSlots, hpFromDamage,
  hpSlots, markedTraits, proficiency, spellcastTrait, stressSlots, subclassStage, thresholds, traitValue, ancestryFeatures, multiclassPick,
} from '../model/derive'
import { ARMOR_SCORE_MAX, HP_SLOTS_MAX, HOPE_MAX, INVENTORY_LINES, STRESS_SLOTS_MAX } from '../model/defaults'
import { tierOf } from '../model/derive'
import type { DhSheetData, DhTrait, DhWeaponSlot } from '../model/types'
import { DH_TRAITS } from '../model/types'
import type { DhRollTarget } from '../services/dhRolls'
import { rollFree } from '../services/dhRolls'
import { DhAutomationPanel } from './DhAutomationPanel'
import { DomainIcon } from './DomainIcon'
import { DhGearPicker } from './DhGearPicker'
import { DhRollDialog, type RollSpec } from './DhRollDialog'
import { Banner, Inline, RuleText, Slots, Stepper, signed, DhSelect } from './DhUi'

// ────────────────────────────────────────────────────────
// A ficha no desenho do livro: faixa da classe, escudos de Evasão e Armadura, seis atributos, Dano e Saúde com os
// limiares, Esperança, Experiências, Ouro, Habilidade de classe; na outra coluna, armas ativas (Proficiência), armadura ativa,
// inventário e armas de reserva.
// ────────────────────────────────────────────────────────

interface Props {
  data: DhSheetData
  update: (fn: (d: DhSheetData) => DhSheetData) => void
  target: DhRollTarget
  canEdit: boolean
}

type Picker = { kind: 'armor' } | { kind: 'weapon'; where: 'primary' | 'secondary' | 'inv0' | 'inv1' } | null

export function DhSheetMain({ data, update, target, canEdit }: Props) {
  const cls = currentClass(data)
  const sub = currentSubclass(data)
  const [roll, setRoll] = useState<RollSpec | null>(null)
  const [picker, setPicker] = useState<Picker>(null)
  const [autoOpen, setAutoOpen] = useState(false)
  const [damage, setDamage] = useState('')
  const [useArmor, setUseArmor] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)

  const tv = allTraitValues(data)
  const marked = new Set(markedTraits(data))
  const prof = proficiency(data)
  const th = thresholds(data)
  const armor = armorScore(data)
  const hp = hpSlots(data)
  const stress = stressSlots(data)
  const hopeMax = hopeSlots(data)
  const tier = tierOf(data.level)
  const spell = spellcastTrait(data)
  const ed = canEdit

  const heritage = [data.ancestryName || ancestry(data.ancestryKey)?.name, community(data.communityKey)?.name].filter(Boolean).join(' · ')
  const doms = cls ? cls.domains : []

  function set<K extends keyof DhSheetData>(key: K, value: DhSheetData[K]) {
    update((d) => ({ ...d, [key]: value }))
  }

  function openTraitRoll(t: DhTrait) {
    setRoll({ title: `Teste de ${TRAIT_INFO[t].label}`, label: TRAIT_INFO[t].label, modifier: tv[t], parts: [{ name: TRAIT_INFO[t].label, value: tv[t] }] })
  }

  function openSpellRoll() {
    if (!spell) return
    setRoll({ title: 'Teste de conjuração', label: `Conjuração (${TRAIT_INFO[spell].label})`, modifier: tv[spell], parts: [{ name: TRAIT_INFO[spell].label, value: tv[spell] }] })
  }

  function openAttack(w: DhWeaponSlot) {
    const mod = attackModifier(data, w)
    const traitName = w.trait === 'conjuracao' ? (spell ? TRAIT_INFO[spell].label : 'Conjuração') : w.trait ? TRAIT_INFO[w.trait].label : 'Atributo'
    setRoll({
      title: `Ataque: ${w.name}`,
      label: `Ataque (${w.name})`,
      modifier: mod,
      parts: [{ name: traitName, value: mod }],
      attack: { weaponName: w.name, dice: w.dice, damageType: w.damageType },
    })
  }

  function applyDamage() {
    const n = Number(damage)
    if (!Number.isFinite(n) || n <= 0) return
    let marks = hpFromDamage(n, th)
    const canArmor = useArmor && armor - data.armorMarked > 0 && marks > 0
    if (canArmor) marks = Math.max(0, marks - 1)
    update((d) => ({ ...d, hpMarked: Math.min(hpSlots(d), d.hpMarked + marks), armorMarked: canArmor ? d.armorMarked + 1 : d.armorMarked }))
    setNotice(`${n} de dano: ${hpFromDamage(n, th)} PV${canArmor ? ', −1 com a Armadura' : ''} → marcou ${marks} Ponto${marks === 1 ? '' : 's'} de Vida.`)
    setDamage('')
  }

  function useHopeFeature() {
    if (!cls || data.hope < 3) return
    update((d) => ({ ...d, hope: d.hope - 3 }))
    setNotice(`${cls.hopeFeature.name}: −3 Esperança.`)
  }

  function weaponSet(where: 'primary' | 'secondary' | 'inv0' | 'inv1', w: DhWeaponSlot | null) {
    update((d) => {
      if (where === 'primary') return { ...d, primary: w }
      if (where === 'secondary') return { ...d, secondary: w }
      const inv: DhSheetData['inventoryWeapons'] = [...d.inventoryWeapons]
      inv[where === 'inv0' ? 0 : 1] = w
      return { ...d, inventoryWeapons: inv }
    })
  }

  function equipFromInventory(i: 0 | 1) {
    update((d) => {
      const w = d.inventoryWeapons[i]
      if (!w) return d
      const inv: DhSheetData['inventoryWeapons'] = [...d.inventoryWeapons]
      const secondaryKind = w.hands === 1 && d.primary && d.primary.hands === 1
      if (secondaryKind) { inv[i] = d.secondary; return { ...d, secondary: w, inventoryWeapons: inv } }
      inv[i] = d.primary
      return { ...d, primary: w, inventoryWeapons: inv }
    })
    setNotice('Em perigo, trocar de arma custa 1 Ponto de Fadiga (descansando ou em calma, não custa nada).')
  }

  const unusedHands = (data.primary?.hands ?? 0) + (data.secondary?.hands ?? 0) > 2 && data.classKey !== 'guerreiro'

  return (
    <div className="dh-paper">
      {/* ── faixa da classe ── */}
      <header className="dh-head">
        <div className="dh-head__class">
          <h2>{cls?.name ?? 'Sem classe'}</h2>
          <p>{doms.map((d) => DOMAINS[d].name).join(' & ')}</p>
          <span className="dh-head__dots">{doms.map((d) => <DomainIcon key={d} domain={d} size={32} />)}</span>
        </div>
        <div className="dh-head__fields">
          <label className="dh-field dh-field--name"><span>Nome</span><Inline value={data.name} onChange={(v) => set('name', v)} disabled={!ed} maxLength={120} aria-label="Nome do personagem" /></label>
          <label className="dh-field dh-field--pron"><span>Pronomes</span><Inline value={data.pronouns} onChange={(v) => set('pronouns', v)} disabled={!ed} maxLength={60} aria-label="Pronomes" /></label>
          <label className="dh-field"><span>Herança</span><Inline value={heritage} onChange={(v) => set('ancestryName', v)} disabled aria-label="Herança" /></label>
          <label className="dh-field"><span>Subclasse</span><Inline value={sub?.name ?? ''} onChange={() => {}} disabled aria-label="Subclasse" /></label>
        </div>
        <div className="dh-head__level" aria-label={`Nível ${data.level}`}><b>{data.level}</b><span>Nível</span></div>
      </header>

      {/* ── Evasão, Armadura e atributos ── */}
      <section className="dh-stats">
        <div className="dh-shield dh-shield--evasion"><b key={evasion(data)} className="dh-num">{evasion(data)}</b><span>Evasão</span><small>Começa em {cls?.evasion ?? 10}</small></div>
        <div className="dh-armor">
          <div className="dh-shield dh-shield--armor"><b key={armor} className="dh-num">{armor}</b><span>Armadura</span></div>
          <Slots open={armor} total={ARMOR_SCORE_MAX} marked={data.armorMarked} shape="shield" label="Pontos de Armadura" tone="armor" onChange={ed ? (n) => set('armorMarked', n) : undefined} />
        </div>
        <div className="dh-traits">
          {DH_TRAITS.map((t) => (
            <button key={t} type="button" className="dh-trait" onClick={() => openTraitRoll(t)} title={`Rolar ${TRAIT_INFO[t].label}`}>
              <span className="dh-trait__name">{TRAIT_INFO[t].label}</span>
              <i className={`dh-trait__mark${marked.has(t) ? ' is-on' : ''}`} aria-label={marked.has(t) ? 'Marcado' : 'Livre'} />
              <b key={tv[t]} className="dh-num">{signed(tv[t])}</b>
              <small>{TRAIT_INFO[t].verbs.join(' · ')}</small>
            </button>
          ))}
        </div>
      </section>

      {ed && (
        <div className="dh-tools">
          <button type="button" className="dh-link" onClick={() => setAutoOpen(true)}>Automatizar</button>
          {spell && <button type="button" className="dh-link" onClick={openSpellRoll}>Teste de conjuração ({TRAIT_INFO[spell].label} {signed(tv[spell])})</button>}
        </div>
      )}

      {ed && (!cls || !sub || !data.ancestryKey || !data.communityKey) && (
        <section className="dh-origin" aria-label="Origem do personagem">
          <h4>Origem do personagem</h4>
          <p className="dh-hint">Ao escolher, o site já aplica: a classe traz Evasão, Vida, domínios e habilidades; a subclasse, as habilidades e o atributo de conjuração; a herança, as habilidades dela.</p>
          <div className="dh-form">
            <label>Classe
              <DhSelect label="Classe" value={data.classKey ?? ''} onChange={(v) => update((d) => ({ ...d, classKey: (v || null) as DhSheetData['classKey'], subclassKey: null }))}
                options={[{ value: '', label: 'Escolha…' }, ...CLASSES.map((c) => ({ value: c.key, label: c.name }))]} />
            </label>
            <label>Subclasse
              <DhSelect label="Subclasse" value={data.subclassKey ?? ''} disabled={!cls} onChange={(v) => set('subclassKey', v || null)}
                options={[{ value: '', label: 'Escolha…' }, ...(cls?.subclasses ?? []).map((x) => ({ value: x.key, label: x.name }))]} />
            </label>
            <label>Ancestralidade
              <DhSelect label="Ancestralidade" value={data.ancestryKey ?? ''} onChange={(v) => update((d) => ({ ...d, ancestryKey: v || null, ancestry2Key: d.ancestry2Key === v ? null : d.ancestry2Key }))}
                options={[{ value: '', label: 'Escolha…' }, ...ANCESTRIES.map((x) => ({ value: x.key, label: x.name }))]} />
            </label>
            <label>Segunda ancestralidade (mista)
              <DhSelect label="Segunda ancestralidade" value={data.ancestry2Key ?? ''} disabled={!data.ancestryKey} onChange={(v) => set('ancestry2Key', v || null)}
                options={[{ value: '', label: 'Nenhuma' }, ...ANCESTRIES.filter((x) => x.key !== data.ancestryKey).map((x) => ({ value: x.key, label: x.name }))]} />
            </label>
            <label>Comunidade
              <DhSelect label="Comunidade" value={data.communityKey ?? ''} onChange={(v) => set('communityKey', v || null)}
                options={[{ value: '', label: 'Escolha…' }, ...COMMUNITIES.map((x) => ({ value: x.key, label: x.name }))]} />
            </label>
          </div>
        </section>
      )}

      {notice && <p className="dh-notice" role="status" onClick={() => setNotice(null)}>{notice}</p>}

      <div className="dh-cols">
        {/* ═══ coluna da esquerda ═══ */}
        <div className="dh-col">
          <section className="dh-box">
            <Banner>Dano e Saúde</Banner>
            <p className="dh-hint">Some seu nível aos limiares de dano da armadura.</p>
            <div className="dh-thresholds" aria-label="Limiares de dano">
              <span className="dh-th dh-th--minor"><b>Menor</b><small>Marque 1 PV</small></span>
              <span className="dh-th__num">{th.major}</span>
              <span className="dh-th dh-th--major"><b>Maior</b><small>Marque 2 PV</small></span>
              <span className="dh-th__num">{th.severe}</span>
              <span className="dh-th dh-th--severe"><b>Grave</b><small>Marque 3 PV</small></span>
            </div>
            <div className="dh-row"><span className="dh-row__label">PV</span><Slots open={hp} total={HP_SLOTS_MAX} marked={data.hpMarked} label="Pontos de Vida" tone="hp" onChange={ed ? (n) => set('hpMarked', n) : undefined} /></div>
            <div className="dh-row"><span className="dh-row__label">Fadiga</span><Slots open={stress} total={STRESS_SLOTS_MAX} marked={data.stressMarked} label="Pontos de Fadiga" tone="stress" onChange={ed ? (n) => set('stressMarked', n) : undefined} /></div>
            {data.hpMarked >= hp && <p className="dh-alert">Último Ponto de Vida marcado: faça um Movimento de Morte (aba Descanso).</p>}
            {data.stressMarked >= stress && <p className="dh-alert dh-alert--soft">Fadiga cheia: você está Vulnerável até recuperar ao menos 1 Ponto de Fadiga.</p>}
            {ed && (
              <div className="dh-damage">
                <label>Receber dano
                  <input type="number" min={0} value={damage} placeholder="valor" onChange={(e) => setDamage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applyDamage() }} />
                </label>
                <label className="dh-check"><input type="checkbox" checked={useArmor} onChange={(e) => setUseArmor(e.target.checked)} /> Marcar 1 Ponto de Armadura</label>
                <button type="button" className="btn" onClick={applyDamage} disabled={!damage}>Aplicar</button>
              </div>
            )}
          </section>

          <section className="dh-box">
            <Banner>Esperança</Banner>
            <p className="dh-hint">Gaste 1 Ponto de Esperança para usar uma Experiência ou ajudar um aliado.</p>
            <Slots open={hopeMax} total={HOPE_MAX + (data.companion?.picks.includes('luz') ? 1 : 0)} marked={data.hope} lost={data.scars} shape="diamond" label="Pontos de Esperança" tone="hope" onChange={ed ? (n) => set('hope', Math.min(n, hopeMax)) : undefined} />
            {cls && (
              <div className="dh-hopefeat">
                <p><strong>{cls.hopeFeature.name}:</strong> {cls.hopeFeature.text}</p>
                {ed && <button type="button" className="btn" onClick={useHopeFeature} disabled={data.hope < 3}>Gastar 3 Esperança</button>}
              </div>
            )}
          </section>

          <section className="dh-box">
            <Banner right={ed && data.experiences.length < 12 ? <button type="button" className="dh-link" onClick={() => update((d) => ({ ...d, experiences: [...d.experiences, { id: Math.random().toString(36).slice(2, 10), name: '', mod: 2 }] }))}>+ Experiência</button> : null}>Experiência</Banner>
            <ul className="dh-exps">
              {data.experiences.map((e) => (
                <li key={e.id}>
                  <Inline value={e.name} placeholder="Uma palavra ou frase" disabled={!ed} maxLength={120} aria-label="Experiência" onChange={(v) => update((d) => ({ ...d, experiences: d.experiences.map((x) => (x.id === e.id ? { ...x, name: v } : x)) }))} />
                  {ed ? <Stepper value={e.mod} min={-5} max={12} label="Bônus da Experiência" format={signed} onChange={(v) => update((d) => ({ ...d, experiences: d.experiences.map((x) => (x.id === e.id ? { ...x, mod: v } : x)) }))} /> : <b>{signed(e.mod)}</b>}
                  {ed && <button type="button" className="dh-x" aria-label="Remover Experiência" onClick={() => update((d) => ({ ...d, experiences: d.experiences.filter((x) => x.id !== e.id) }))}>×</button>}
                </li>
              ))}
              {data.experiences.length === 0 && <li className="dh-empty">Nenhuma Experiência ainda.</li>}
            </ul>
          </section>

          <section className="dh-box">
            <Banner>Ouro</Banner>
            <div className="dh-gold">
              <div><Slots open={9} total={9} marked={data.gold.handfuls} shape="dot" label="Punhados" onChange={ed ? (n) => set('gold', { ...data.gold, handfuls: n }) : undefined} /><small>Punhados</small></div>
              <div><Slots open={9} total={9} marked={data.gold.bags} shape="dot" label="Sacos" onChange={ed ? (n) => set('gold', { ...data.gold, bags: n }) : undefined} /><small>Sacos</small></div>
              <div><Slots open={1} total={1} marked={data.gold.chests} shape="box" label="Baú" onChange={ed ? (n) => set('gold', { ...data.gold, chests: n }) : undefined} /><small>Baú</small></div>
            </div>
            {ed && <div className="dh-gold__add"><button type="button" className="dh-link" onClick={() => set('gold', addGold(data.gold, 1))}>+ 1 punhado</button><button type="button" className="dh-link" onClick={() => set('gold', addGold(data.gold, -1))}>− 1 punhado</button></div>}
          </section>

          <section className="dh-box">
            <Banner>Habilidade de Classe</Banner>
            {cls && cls.features.map((f) => <div key={f.name} className="dh-feature"><h4>{f.name}</h4><RuleText text={f.text} /></div>)}
            <ClassTrackers data={data} update={update} target={target} canEdit={ed} spellValue={spell ? traitValue(data, spell) : 0} />
            {sub && (
              <details className="dh-sub" open>
                <summary>{sub.name} <small>(carta {subclassStage(data)} de 3)</small></summary>
                {sub.spellcast && <p className="dh-hint">Atributo de conjuração: {TRAIT_INFO[sub.spellcast].label}</p>}
                {sub.foundation.map((f) => <div key={f.name} className="dh-feature"><h4>{f.name}</h4><RuleText text={f.text} /></div>)}
                {subclassStage(data) >= 2 && sub.specialization.map((f) => <div key={f.name} className="dh-feature dh-feature--up"><h4>{f.name} <small>especialização</small></h4><RuleText text={f.text} /></div>)}
                {subclassStage(data) >= 3 && sub.mastery.map((f) => <div key={f.name} className="dh-feature dh-feature--up"><h4>{f.name} <small>maestria</small></h4><RuleText text={f.text} /></div>)}
              </details>
            )}
            {(() => {
              const mc = multiclassPick(data)
              const mcls = mc ? dhClass(mc.classKey) : null
              if (!mc || !mcls) return null
              return (
                <details className="dh-sub">
                  <summary>Multiclasse: {mcls.name}</summary>
                  {mcls.features.map((f) => <div key={f.name} className="dh-feature"><h4>{f.name}</h4><RuleText text={f.text} /></div>)}
                  {mcls.subclasses.find((x) => x.key === mc.subclassKey)?.foundation.map((f) => <div key={f.name} className="dh-feature"><h4>{f.name}</h4><RuleText text={f.text} /></div>)}
                </details>
              )
            })()}
            {ancestryFeatures(data).length > 0 && (
              <details className="dh-sub">
                <summary>Herança</summary>
                {ancestryFeatures(data).map((f) => <div key={f.name} className="dh-feature"><h4>{f.name} <small>{f.from}</small></h4><RuleText text={f.text} /></div>)}
                {(() => { const c = community(data.communityKey); return c ? <div className="dh-feature"><h4>{c.feature.name} <small>{c.name}</small></h4><RuleText text={c.feature.text} /></div> : null })()}
              </details>
            )}
          </section>
        </div>

        {/* ═══ coluna da direita ═══ */}
        <div className="dh-col">
          <section className="dh-box">
            <Banner right={<span className="dh-prof" title="Proficiência: quantos dados de dano da arma você rola"><i>Proficiência</i><Slots open={6} total={6} marked={prof} shape="dot" label="Proficiência" /></span>}>Armas Ativas</Banner>
            {unusedHands && <p className="dh-alert dh-alert--soft">As armas equipadas pedem mais de duas mãos.</p>}
            <WeaponBlock title="Principal" w={data.primary} data={data} canEdit={ed} onPick={() => setPicker({ kind: 'weapon', where: 'primary' })} onRemove={() => weaponSet('primary', null)} onAttack={openAttack} onChange={(w) => weaponSet('primary', w)} />
            <WeaponBlock title="Secundária" w={data.secondary} data={data} canEdit={ed} onPick={() => setPicker({ kind: 'weapon', where: 'secondary' })} onRemove={() => weaponSet('secondary', null)} onAttack={openAttack} onChange={(w) => weaponSet('secondary', w)} />
          </section>

          <section className="dh-box">
            <Banner>Armadura Ativa</Banner>
            {data.armor ? (
              <div className="dh-armorblock">
                <div className="dh-armorblock__row">
                  <b>{data.armor.name}</b>
                  <span>Limiares base {data.armor.major}/{data.armor.severe}</span>
                  <span>Armadura base {data.armor.score}</span>
                </div>
                {data.armor.feature && <p className="dh-hint"><strong>{data.armor.feature.split(':')[0]}:</strong>{data.armor.feature.slice(data.armor.feature.indexOf(':') + 1)}</p>}
                {ed && <div className="dh-actions"><button type="button" className="dh-link" onClick={() => setPicker({ kind: 'armor' })}>Trocar</button><button type="button" className="dh-link" onClick={() => set('armor', null)}>Tirar</button></div>}
              </div>
            ) : (
              <div className="dh-armorblock">
                <p className="dh-hint">Sem armadura: Armadura 0; limiares iguais ao nível ({data.level}) e ao dobro ({data.level * 2}).</p>
                {ed && <button type="button" className="btn" onClick={() => setPicker({ kind: 'armor' })}>Escolher armadura</button>}
              </div>
            )}
          </section>

          <section className="dh-box">
            <Banner>Inventário</Banner>
            <ul className="dh-inv">
              {Array.from({ length: Math.max(INVENTORY_LINES, data.inventory.length + 1) }, (_, i) => (
                <li key={i}>
                  <Inline value={data.inventory[i] ?? ''} disabled={!ed} maxLength={200} placeholder={i === data.inventory.length ? 'Novo item' : ''} aria-label={`Item ${i + 1}`}
                    onChange={(v) => update((d) => { const inv = [...d.inventory]; inv[i] = v; while (inv.length && inv[inv.length - 1] === '') inv.pop(); return { ...d, inventory: inv.map((x) => x ?? '') } })} />
                </li>
              ))}
            </ul>
          </section>

          <section className="dh-box">
            <Banner>Armas de Reserva</Banner>
            <p className="dh-hint">Armas que você carrega sem usar: não dão os benefícios delas.</p>
            {([0, 1] as const).map((i) => (
              <div key={i} className="dh-weapon dh-weapon--inv">
                {data.inventoryWeapons[i] ? (
                  <>
                    <WeaponLine w={data.inventoryWeapons[i]!} />
                    {ed && <div className="dh-actions"><button type="button" className="dh-link" onClick={() => equipFromInventory(i)}>Equipar</button><button type="button" className="dh-link" onClick={() => weaponSet(i === 0 ? 'inv0' : 'inv1', null)}>Descartar</button></div>}
                  </>
                ) : ed ? <button type="button" className="dh-link" onClick={() => setPicker({ kind: 'weapon', where: i === 0 ? 'inv0' : 'inv1' })}>+ Guardar arma</button> : <span className="dh-empty">Vazio</span>}
              </div>
            ))}
          </section>
        </div>
      </div>

      {autoOpen && <DhAutomationPanel data={data} update={update} onClose={() => setAutoOpen(false)} />}
      {roll && <DhRollDialog spec={roll} data={data} update={update} target={target} onClose={() => setRoll(null)} />}
      {picker?.kind === 'armor' && <DhGearPicker kind="armor" tier={tier} onClose={() => setPicker(null)} onPick={(a) => set('armor', a)} />}
      {picker?.kind === 'weapon' && (
        <DhGearPicker kind="weapon" slot={picker.where === 'secondary' ? 'secondary' : picker.where === 'primary' ? 'primary' : 'any'} tier={tier} onClose={() => setPicker(null)} onPick={(w) => weaponSet(picker.where, w)} />
      )}
    </div>
  )
}

function WeaponLine({ w }: { w: DhWeaponSlot }) {
  return (
    <div className="dh-weaponline">
      <b>{w.name}</b>
      <span>{w.trait ? (w.trait === 'conjuracao' ? 'Conjuração' : TRAIT_INFO[w.trait].label) : '—'} {w.range ? RANGE_INFO[w.range].short : ''}</span>
      <span>{w.dice} {w.damageType === 'mag' ? 'mág' : w.damageType === 'ambos' ? 'fís/mág' : 'fís'} · {w.hands === 2 ? 'Duas mãos' : 'Uma mão'}</span>
      {w.feature && <em>{w.feature}</em>}
    </div>
  )
}

interface WeaponBlockProps {
  title: string
  w: DhWeaponSlot | null
  data: DhSheetData
  canEdit: boolean
  onPick: () => void
  onRemove: () => void
  onAttack: (w: DhWeaponSlot) => void
  onChange: (w: DhWeaponSlot) => void
}

function WeaponBlock({ title, w, data, canEdit, onPick, onRemove, onAttack, onChange }: WeaponBlockProps) {
  const prof = proficiency(data)
  return (
    <div className="dh-weapon">
      <h4>{title}</h4>
      {w ? (
        <>
          <WeaponLine w={w} />
          <p className="dh-weapon__calc">
            Ataque <b>{signed(attackModifier(data, w))}</b> · Dano <b>{damageFormula(w.dice, prof)}{flatDamageBonus(data, w.damageType) ? signed(flatDamageBonus(data, w.damageType)) : ''}</b>
          </p>
          <div className="dh-actions">
            <button type="button" className="btn" onClick={() => onAttack(w)}>Atacar</button>
            {canEdit && <button type="button" className="dh-link" onClick={onPick}>Trocar</button>}
            {canEdit && <button type="button" className="dh-link" onClick={onRemove}>Guardar/remover</button>}
            {canEdit && <label className="dh-miniedit">Bônus <Stepper value={w.attackBonus} min={-5} max={10} label="Bônus de ataque" format={signed} onChange={(v) => onChange({ ...w, attackBonus: v })} /></label>}
          </div>
        </>
      ) : canEdit ? (
        <button type="button" className="btn" onClick={onPick}>Escolher arma</button>
      ) : <span className="dh-empty">Sem arma</span>}
    </div>
  )
}

// ── contadores das classes ──────────────────────────────

function ClassTrackers({ data, update, target, canEdit, spellValue }: { data: DhSheetData; update: Props['update']; target: DhRollTarget; canEdit: boolean; spellValue: number }) {
  const t = data.trackers
  const setT = (patch: Partial<DhSheetData['trackers']>) => update((d) => ({ ...d, trackers: { ...d.trackers, ...patch } }))
  const [busy, setBusy] = useState(false)

  async function rollPrayer() {
    setBusy(true)
    try {
      const n = Math.max(1, spellValue)
      const dice: number[] = []
      for (let i = 0; i < n; i++) dice.push(await rollFree({ ...target, label: 'Dado de Oração', formula: '1d4' }))
      setT({ prayer: dice })
    } finally { setBusy(false) }
  }

  switch (data.classKey) {
    case 'bardo': {
      const sides = data.level >= 5 ? 8 : 6
      const mastery = data.subclassKey === 'beletrista' && data.advancements.flatMap((a) => a.picks).filter((p) => p.opt === 'subclass').length >= 2
      return (
        <div className="dh-tracker">
          <strong>Dado de Inspiração: d{mastery ? 10 : sides}</strong>
          <label className="dh-check"><input type="checkbox" checked={t.rallyGiven} disabled={!canEdit} onChange={(e) => setT({ rallyGiven: e.target.checked })} /> Já usei nesta sessão</label>
          {canEdit && <button type="button" className="dh-link" disabled={busy} onClick={() => void rollFree({ ...target, label: 'Dado de Inspiração', formula: `1d${mastery ? 10 : sides}` })}>Rolar</button>}
        </div>
      )
    }
    case 'guardiao': {
      const max = data.level >= 5 ? 6 : 4
      return (
        <div className="dh-tracker">
          <strong>Dado de Determinação: d{max}</strong>
          <span className="dh-seg">
            <button type="button" className={t.unstoppable === 0 ? 'is-on' : ''} disabled={!canEdit} onClick={() => setT({ unstoppable: 0 })}>Inativo</button>
            {Array.from({ length: max }, (_, i) => i + 1).map((n) => <button key={n} type="button" className={t.unstoppable === n ? 'is-on' : ''} disabled={!canEdit} onClick={() => setT({ unstoppable: n })}>{n}</button>)}
          </span>
        </div>
      )
    }
    case 'serafim':
      return (
        <div className="dh-tracker">
          <strong>Dados de Oração (d4)</strong>
          <div className="dh-dicerow">
            {t.prayer.length === 0 && <span className="dh-empty">Nenhum</span>}
            {t.prayer.map((v, i) => <button key={i} type="button" className="dh-die dh-die--prayer" disabled={!canEdit} title="Gastar" onClick={() => setT({ prayer: t.prayer.filter((_, j) => j !== i) })}>{v}</button>)}
          </div>
          {canEdit && <button type="button" className="dh-link" disabled={busy} onClick={() => void rollPrayer()}>Rolar no início da sessão ({Math.max(1, spellValue)}d4)</button>}
        </div>
      )
    case 'guerreiro':
      if (data.subclassKey !== 'escolhido_matanca') return null
      return (
        <div className="dh-tracker">
          <strong>Dados da Matança (d6)</strong>
          <Stepper value={t.slayer} min={0} max={Math.max(1, proficiency(data))} label="Dados da Matança" disabled={!canEdit} onChange={(v) => setT({ slayer: v })} />
          <small>Guarde até {proficiency(data)}.</small>
        </div>
      )
    case 'mago':
      return (
        <div className="dh-tracker">
          <strong>Padrões Estranhos</strong>
          <Stepper value={t.strange} min={1} max={12} label="Número dos Padrões Estranhos" disabled={!canEdit} onChange={(v) => setT({ strange: v })} />
          <small>Ao rolar esse número em um Dado de Dualidade: 1 Esperança ou 1 Fadiga a menos.</small>
        </div>
      )
    case 'patrulheiro':
      return (
        <div className="dh-tracker">
          <strong>Marca da Presa</strong>
          <Inline value={t.focus} onChange={(v) => setT({ focus: v })} disabled={!canEdit} placeholder="Alvo marcado" maxLength={120} aria-label="Alvo marcado" />
        </div>
      )
    case 'feiticeiro':
      return data.subclassKey === 'elementalista' ? (
        <div className="dh-tracker">
          <strong>Elemento</strong>
          <span className="dh-seg">
            {['água', 'ar', 'fogo', 'relâmpago', 'terra'].map((el) => <button key={el} type="button" className={t.choice === el ? 'is-on' : ''} disabled={!canEdit} onClick={() => setT({ choice: el })}>{el}</button>)}
          </span>
        </div>
      ) : null
    default:
      return null
  }
}

