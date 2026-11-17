import { useMemo, useState } from 'react'
import { ARMORS } from '../catalog/armor'
import { CLASSES, dhClass } from '../catalog/classes'
import { ANCESTRIES, COMMUNITIES, ancestry, community } from '../catalog/heritage'
import { DOMAIN_CARDS } from '../catalog/domainCards'
import { DOMAINS, TRAIT_INFO } from '../catalog/rules'
import { WEAPONS, weaponEntry } from '../catalog/weapons'
import { armorEntry } from '../catalog/armor'
import { emptySheet, newId } from '../model/defaults'
import { evasion, hpSlots, stressSlots, thresholds } from '../model/derive'
import { armorToSlot, weaponToSlot } from '../model/gear'
import type { DhClassKey, DhSheetData } from '../model/types'
import { DH_TRAITS } from '../model/types'
import { Banner, RuleText, signed } from './DhUi'

// ────────────────────────────────────────────────────────
// Criação do personagem, na ordem do livro: classe, herança, atributos (+2, +1, +1, 0, 0, −1), equipamento inicial,
// Experiências, cartas de domínio e detalhes. Ao terminar vira uma ficha de nível 1.
// ────────────────────────────────────────────────────────

const STEPS = ['Classe', 'Herança', 'Atributos', 'Equipamento', 'Experiências', 'Cartas', 'Detalhes'] as const
const START = [2, 1, 1, 0, 0, -1]

interface Props {
  initial: DhSheetData
  onDone: (data: DhSheetData) => void
}

export function DhCreator({ initial, onDone }: Props) {
  const [step, setStep] = useState(0)
  const [d, setD] = useState<DhSheetData>(() => ({ ...emptySheet(initial.classKey), ...initial, traits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 } }))
  const [potion, setPotion] = useState(0)
  const [keep, setKeep] = useState(0)
  const [carry, setCarry] = useState('')
  const [exps, setExps] = useState(['', ''])
  const [cards, setCards] = useState<string[]>([])
  const cls = dhClass(d.classKey)
  const set = (patch: Partial<DhSheetData>) => setD((x) => ({ ...x, ...patch }))

  const traitVals = DH_TRAITS.map((t) => d.traits[t])
  const traitsOk = [...traitVals].sort((a, b) => b - a).join() === [...START].sort((a, b) => b - a).join()

  const valid = [
    !!d.classKey && !!d.subclassKey,
    !!d.ancestryKey && !!d.communityKey,
    traitsOk,
    !!d.primary,
    exps.every((e) => e.trim()),
    cards.length === 2,
    true,
  ]

  function applyClass(key: DhClassKey) {
    const c = dhClass(key)!
    setD((x) => ({ ...x, classKey: key, subclassKey: null, traits: { ...c.suggested.traits } }))
    setCards([])
    set2(c)
  }
  function set2(c: NonNullable<typeof cls>) {
    const arm = armorEntry(c.suggested.armor)
    const pri = weaponEntry(c.suggested.primary)
    const sec = c.suggested.secondary ? weaponEntry(c.suggested.secondary) : null
    setD((x) => ({ ...x, armor: arm ? armorToSlot(arm) : null, primary: pri ? weaponToSlot(pri) : null, secondary: sec ? weaponToSlot(sec) : null }))
    setPotion(0); setKeep(0); setCarry('')
  }

  const preview = useMemo(() => ({ ...d, classKey: d.classKey }), [d])

  function finish() {
    if (!cls) return
    const items = [...d.inventory, cls.itemChoices.potion[potion], cls.itemChoices.keepsake[keep]]
    if (cls.itemChoices.carry && carry.trim()) items.push(`Guardo meus feitiços em: ${carry.trim()}`)
    onDone({
      ...d,
      inventory: items,
      experiences: exps.map((n) => ({ id: newId(), name: n.trim(), mod: 2 })),
      loadout: cards,
      vault: [],
      hope: 2,
    })
  }

  const doms: import('../model/types').DhDomain[] = cls?.domains ?? []
  const level1 = DOMAIN_CARDS.filter((c) => doms.includes(c.domain) && c.level === 1)
  const primaries = WEAPONS.filter((w) => w.tier === 1 && w.slot === 'primary')
  const secondaries = WEAPONS.filter((w) => w.tier === 1 && w.slot === 'secondary')

  return (
    <div className="dh-creator">
      <ol className="dh-steps" aria-label="Etapas">
        {STEPS.map((s, i) => <li key={s} className={i === step ? 'is-on' : i < step ? 'is-done' : ''}><button type="button" onClick={() => i <= step && setStep(i)} disabled={i > step}>{i + 1}. {s}</button></li>)}
      </ol>

      <section className="dh-box">
        {step === 0 && (
          <>
            <Banner>Escolha a classe</Banner>
            <div className="dh-classgrid">
              {CLASSES.map((c) => (
                <button key={c.key} type="button" className={`dh-classcard${d.classKey === c.key ? ' is-on' : ''}`} onClick={() => applyClass(c.key)}>
                  <b>{c.name}</b>
                  <small>{c.domains.map((x) => DOMAINS[x].name).join(' & ')}</small>
                  <span>Evasão {c.evasion} · PV {c.hp}</span>
                </button>
              ))}
            </div>
            {cls && (
              <>
                <p className="dh-hint">{cls.description}</p>
                <h4>Subclasse</h4>
                <div className="dh-classgrid">
                  {cls.subclasses.map((s) => (
                    <button key={s.key} type="button" className={`dh-classcard${d.subclassKey === s.key ? ' is-on' : ''}`} onClick={() => set({ subclassKey: s.key })}>
                      <b>{s.name}</b>
                      <small>{s.tagline}</small>
                      {s.foundation.map((f) => <span key={f.name}><strong>{f.name}.</strong> {f.text.split('\n')[0].slice(0, 150)}{f.text.length > 150 ? '…' : ''}</span>)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <Banner>Herança</Banner>
            <div className="dh-form">
              <label>Ancestralidade
                <select value={d.ancestryKey ?? ''} onChange={(e) => set({ ancestryKey: e.target.value || null, ancestry2Key: null })}>
                  <option value="">Escolha…</option>
                  {ANCESTRIES.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
                </select>
              </label>
              <label>Segunda ancestralidade (opcional, mista)
                <select value={d.ancestry2Key ?? ''} disabled={!d.ancestryKey} onChange={(e) => set({ ancestry2Key: e.target.value || null })}>
                  <option value="">Nenhuma</option>
                  {ANCESTRIES.filter((a) => a.key !== d.ancestryKey).map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
                </select>
              </label>
              <label>Comunidade
                <select value={d.communityKey ?? ''} onChange={(e) => set({ communityKey: e.target.value || null })}>
                  <option value="">Escolha…</option>
                  {COMMUNITIES.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
                </select>
              </label>
            </div>
            {ancestry(d.ancestryKey) && (
              <div className="dh-feature-list">
                <p className="dh-hint">{ancestry(d.ancestryKey)!.description}</p>
                {ancestry(d.ancestryKey)!.features.map((f) => <div key={f.name} className="dh-feature"><h4>{f.name}</h4><RuleText text={f.text} /></div>)}
              </div>
            )}
            {community(d.communityKey) && (
              <div className="dh-feature-list">
                <p className="dh-hint">{community(d.communityKey)!.description}</p>
                <div className="dh-feature"><h4>{community(d.communityKey)!.feature.name}</h4><RuleText text={community(d.communityKey)!.feature.text} /></div>
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <Banner>Atributos</Banner>
            <p className="dh-hint">Distribua +2, +1, +1, 0, 0 e −1 pelos seis atributos, em qualquer ordem. Já preenchi a sugestão da sua classe.</p>
            <div className="dh-traitpick">
              {DH_TRAITS.map((t) => (
                <label key={t}>
                  <span>{TRAIT_INFO[t].label}<small>{TRAIT_INFO[t].verbs.join(' · ')}</small></span>
                  <select value={d.traits[t]} onChange={(e) => set({ traits: { ...d.traits, [t]: Number(e.target.value) } })}>
                    {[2, 1, 0, -1].map((v) => <option key={v} value={v}>{signed(v)}</option>)}
                  </select>
                </label>
              ))}
            </div>
            {!traitsOk && <p className="dh-alert dh-alert--soft">Use exatamente: +2, +1, +1, 0, 0, −1.</p>}
            {cls && <button type="button" className="dh-link" onClick={() => set({ traits: { ...cls.suggested.traits } })}>Usar a sugestão da classe</button>}
          </>
        )}

        {step === 3 && cls && (
          <>
            <Banner>Equipamento inicial</Banner>
            <div className="dh-form">
              <label>Arma principal
                <select value={d.primary?.catalogId ?? ''} onChange={(e) => { const w = weaponEntry(e.target.value); set({ primary: w ? weaponToSlot(w) : null, secondary: w && w.hands === 2 ? null : d.secondary }) }}>
                  <option value="">Escolha…</option>
                  {primaries.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.dice}, {w.hands === 2 ? '2 mãos' : '1 mão'}{w.damageType === 'mag' ? ', mágica' : ''})</option>)}
                </select>
              </label>
              <label>Arma secundária (só com principal de uma mão)
                <select value={d.secondary?.catalogId ?? ''} disabled={!d.primary || d.primary.hands === 2} onChange={(e) => { const w = weaponEntry(e.target.value); set({ secondary: w ? weaponToSlot(w) : null }) }}>
                  <option value="">Nenhuma</option>
                  {secondaries.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.dice})</option>)}
                </select>
              </label>
              <label>Armadura
                <select value={d.armor?.catalogId ?? ''} onChange={(e) => { const a = armorEntry(e.target.value); set({ armor: a ? armorToSlot(a) : null }) }}>
                  <option value="">Sem armadura</option>
                  {ARMORS.filter((a) => a.tier === 1).map((a) => <option key={a.id} value={a.id}>{a.name} ({a.major}/{a.severe}, Armadura {a.score})</option>)}
                </select>
              </label>
            </div>
            <p className="dh-hint">Armas mágicas exigem um atributo de conjuração (a subclasse {cls.subclasses.map((s) => `${s.name}: ${s.spellcast ? TRAIT_INFO[s.spellcast].label : 'não conjura'}`).join('; ')}).</p>
            <h4>Itens</h4>
            <p className="dh-hint">Você leva: uma tocha, 15 metros de corda, suprimentos básicos e um punhado de ouro.</p>
            <div className="dh-form">
              <label>Poção
                <select value={potion} onChange={(e) => setPotion(Number(e.target.value))}>{cls.itemChoices.potion.map((p, i) => <option key={p} value={i}>{p}</option>)}</select>
              </label>
              <label>Item de classe
                <select value={keep} onChange={(e) => setKeep(Number(e.target.value))}>{cls.itemChoices.keepsake.map((p, i) => <option key={p} value={i}>{p}</option>)}</select>
              </label>
              {cls.itemChoices.carry && <label>{cls.itemChoices.carry.label} ({cls.itemChoices.carry.examples})<input value={carry} maxLength={120} onChange={(e) => setCarry(e.target.value)} /></label>}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <Banner>Experiências</Banner>
            <p className="dh-hint">Duas Experiências, cada uma com +2. Uma palavra ou frase específica sobre o passado do personagem (sem magias nem habilidades). Gastar 1 Esperança soma o bônus a um teste em que ela se aplique. Ideias: Contrabandista do Porto Velho, Estudos Mágicos, Espadachim, Amigo de Todos.</p>
            {[0, 1].map((i) => (
              <label key={i} className="dh-qa">Experiência {i + 1}
                <input value={exps[i]} maxLength={120} onChange={(e) => setExps((x) => x.map((v, j) => (j === i ? e.target.value : v)))} placeholder="Ex.: Médico de campo" />
              </label>
            ))}
          </>
        )}

        {step === 5 && (
          <>
            <Banner>Cartas de domínio</Banner>
            <p className="dh-hint">Escolha 2 cartas de nível 1 dos domínios {doms.map((x) => DOMAINS[x].name).join(' e ')}: uma de cada ou duas do mesmo. Cada nível novo dá outra carta.</p>
            <div className="dh-cardpick">
              {level1.map((c) => {
                const on = cards.includes(c.id)
                return (
                  <button key={c.id} type="button" className={`dh-cardrow${on ? ' is-on' : ''}`} style={{ '--dh-domain': DOMAINS[c.domain].color } as React.CSSProperties}
                    onClick={() => setCards((x) => (on ? x.filter((i) => i !== c.id) : x.length < 2 ? [...x, c.id] : x))}>
                    <b>{c.name}</b><small>{DOMAINS[c.domain].name} · troca {c.recall}</small>
                    <span>{c.text.slice(0, 170)}{c.text.length > 170 ? '…' : ''}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {step === 6 && (
          <>
            <Banner>Detalhes</Banner>
            <div className="dh-form">
              <label>Nome<input value={d.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} /></label>
              <label>Pronomes<input value={d.pronouns} maxLength={60} onChange={(e) => set({ pronouns: e.target.value })} /></label>
            </div>
            <p className="dh-hint">Pronto: nível 1 · Evasão {evasion(preview)} · PV {hpSlots(preview)} · Fadiga {stressSlots(preview)} · limiares {thresholds(preview).major}/{thresholds(preview).severe} · 2 Pontos de Esperança. A descrição, as perguntas de origem e os vínculos ficam na aba Personagem.</p>
          </>
        )}
      </section>

      <div className="dh-actions dh-creator__nav">
        {step > 0 && <button type="button" className="btn" onClick={() => setStep(step - 1)}>Voltar</button>}
        {step < STEPS.length - 1
          ? <button type="button" className="btn btn-primary" disabled={!valid[step]} onClick={() => setStep(step + 1)}>Continuar</button>
          : <button type="button" className="btn btn-primary" disabled={!valid.every(Boolean)} onClick={finish}>Criar personagem</button>}
      </div>
    </div>
  )
}
