import { useMemo, useState, type ReactNode } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import { ARMORS } from '../catalog/armor'
import { CLASSES, dhClass } from '../catalog/classes'
import { DOMAIN_CARDS } from '../catalog/domainCards'
import { ANCESTRIES, COMMUNITIES } from '../catalog/heritage'
import { DOMAINS, EXPERIENCE_EXAMPLES, TRAIT_INFO } from '../catalog/rules'
import { WEAPONS, weaponEntry } from '../catalog/weapons'
import { evasion, hpSlots, stressSlots, thresholds } from '../model/derive'
import { applyAdvancement } from '../model/levelUp'
import { MAX_LEVEL } from '../model/defaults'
import { buildQuickSheet, emptyAnswers, suggestedFor, traitsValid, type QuickAnswers } from '../model/quick'
import type { DhDomain, DhSheetData } from '../model/types'
import { DH_TRAITS } from '../model/types'
import { DhLevelWizard } from './DhLevelWizard'
import { signed, DhSelect } from './DhUi'

// ────────────────────────────────────────────────────────
// Ficha rápida: uma janela no centro com UMA pergunta por vez, na ordem do livro (quem é, classe, herança, atributos,
// equipamento, Experiências, cartas). Quem entra em nível mais alto passa pelas subidas, uma janela por nível.
// No fim cria a ficha; tudo continua editável nela.
// ────────────────────────────────────────────────────────

interface Props {
  onDone: (data: DhSheetData) => void
  onCancel: () => void
}

interface Step {
  id: string
  question: string
  hint?: string
  valid: boolean
  body: ReactNode
  /** Passo de subida de nível: tem os próprios botões. */
  own?: boolean
}

function Choice<T extends string>({ items, value, onPick, cols = 1 }: { items: { id: T; label: string; sub?: string; extra?: string }[]; value: T | ''; onPick: (id: T) => void; cols?: 1 | 2 }) {
  return (
    <div className={`dh-q__choices dh-q__choices--${cols}`} role="radiogroup">
      {items.map((it) => (
        <button key={it.id} type="button" role="radio" aria-checked={value === it.id} className={`dh-q__choice${value === it.id ? ' is-on' : ''}`} onClick={() => onPick(it.id)}>
          <b>{it.label}</b>
          {it.sub && <small>{it.sub}</small>}
          {it.extra && <span>{it.extra}</span>}
        </button>
      ))}
    </div>
  )
}

export function DhQuickForm({ onDone, onCancel }: Props) {
  const [a, setA] = useState<QuickAnswers>(emptyAnswers)
  const [i, setI] = useState(0)
  /** Fichas depois de cada subida já aplicada (a primeira é a de nível 1). */
  const [states, setStates] = useState<DhSheetData[]>([])
  const set = (patch: Partial<QuickAnswers>) => { setA((x) => ({ ...x, ...patch })); setStates([]) }
  const cls = dhClass(a.classKey)
  const sub = cls?.subclasses.find((s) => s.key === a.subclassKey)
  const base = useMemo(() => buildQuickSheet(a), [a])
  const current = states.length ? states[states.length - 1] : base
  const pri = weaponEntry(a.primaryId)
  const levelSteps = Array.from({ length: Math.max(0, a.level - 1) }, (_, k) => k + 2)

  const steps: Step[] = []
  steps.push({
    id: 'nome', question: 'Qual é o nome do personagem?', hint: 'Pode ser mudado depois.', valid: a.name.trim().length > 0,
    body: <input autoFocus className="dh-q__input" value={a.name} maxLength={120} placeholder="Nome" onChange={(e) => set({ name: e.target.value })} />,
  })
  steps.push({
    id: 'pronomes', question: 'Quais são os pronomes dele?', hint: 'Opcional.', valid: true,
    body: <input autoFocus className="dh-q__input" value={a.pronouns} maxLength={60} placeholder="Ele/Dele, Ela/Dela, Elu/Delu…" onChange={(e) => set({ pronouns: e.target.value })} />,
  })
  steps.push({
    id: 'nivel', question: 'Em que nível ele começa?', hint: 'A maioria das mesas começa no nível 1. Se for mais alto, depois das perguntas você escolhe as subidas de cada nível.', valid: a.level >= 1 && a.level <= MAX_LEVEL,
    body: <Choice cols={2} value={String(a.level)} onPick={(id) => { set({ level: Number(id) }); setStates([]) }} items={Array.from({ length: MAX_LEVEL }, (_, k) => ({ id: String(k + 1), label: `Nível ${k + 1}`, sub: k === 0 ? 'Começo da campanha' : undefined }))} />,
  })
  steps.push({
    id: 'classe', question: 'Qual é a classe?', hint: 'Cada classe usa dois domínios de cartas.', valid: !!a.classKey,
    body: <Choice cols={2} value={a.classKey ?? ''} onPick={(k) => set({ classKey: k, subclassKey: null, cards: [], ...suggestedFor(k) })}
      items={CLASSES.map((c) => ({ id: c.key, label: c.name, sub: c.domains.map((d) => DOMAINS[d].name).join(' & '), extra: `Evasão ${c.evasion} · Vida ${c.hp}` }))} />,
  })
  steps.push({
    id: 'subclasse', question: `Qual é a subclasse de ${cls?.name ?? 'sua classe'}?`, hint: 'Define o estilo e o atributo de conjuração.', valid: !!a.subclassKey,
    body: <Choice value={a.subclassKey ?? ''} onPick={(k) => set({ subclassKey: k })}
      items={(cls?.subclasses ?? []).map((s) => ({ id: s.key, label: s.name, sub: s.tagline, extra: s.foundation.map((f) => f.name).join(' · ') }))} />,
  })
  steps.push({
    id: 'anc', question: 'Qual é a ancestralidade?', hint: 'Dá duas habilidades.', valid: !!a.ancestryKey,
    body: <Choice cols={2} value={a.ancestryKey ?? ''} onPick={(k) => set({ ancestryKey: k, ancestry2Key: a.ancestry2Key === k ? null : a.ancestry2Key })}
      items={ANCESTRIES.map((x) => ({ id: x.key, label: x.name, sub: x.features.map((f) => f.name).join(' · ') }))} />,
  })
  steps.push({
    id: 'mista', question: 'Quer misturar com uma segunda ancestralidade?', hint: 'Opcional. Ancestralidade mista: a 1ª habilidade vem de uma e a 2ª da outra.', valid: true,
    body: <Choice cols={2} value={a.ancestry2Key ?? 'nao'} onPick={(k) => set({ ancestry2Key: k === 'nao' ? null : k })}
      items={[{ id: 'nao', label: 'Não, só uma', sub: 'As duas habilidades vêm da mesma' }, ...ANCESTRIES.filter((x) => x.key !== a.ancestryKey).map((x) => ({ id: x.key, label: x.name, sub: x.features[1].name }))]} />,
  })
  steps.push({
    id: 'com', question: 'De que comunidade ele vem?', hint: 'Onde cresceu. Dá uma habilidade.', valid: !!a.communityKey,
    body: <Choice cols={2} value={a.communityKey ?? ''} onPick={(k) => set({ communityKey: k })}
      items={COMMUNITIES.map((c) => ({ id: c.key, label: c.name, sub: c.feature.name }))} />,
  })
  steps.push({
    id: 'attrs', question: 'Como ficam os atributos?', hint: 'Use +2, +1, +1, 0, 0 e −1 em qualquer ordem. Já vem a sugestão da classe.', valid: traitsValid(a.traits),
    body: (
      <>
        <div className="dh-q__traits">
          {DH_TRAITS.map((t) => (
            <label key={t}><span>{TRAIT_INFO[t].label}<small>{TRAIT_INFO[t].verbs.join(' · ')}</small></span>
              <DhSelect label={TRAIT_INFO[t].label} value={String(a.traits[t])} onChange={(v) => set({ traits: { ...a.traits, [t]: Number(v) } })}
                options={[2, 1, 0, -1].map((v) => ({ value: String(v), label: signed(v) }))} />
            </label>
          ))}
        </div>
        {!traitsValid(a.traits) && <p className="dh-alert dh-alert--soft">Falta usar exatamente +2, +1, +1, 0, 0 e −1.</p>}
        {a.classKey && <button type="button" className="dh-link" onClick={() => set({ traits: suggestedFor(a.classKey!).traits })}>Voltar à sugestão da classe</button>}
      </>
    ),
  })
  steps.push({
    id: 'arma', question: 'Qual é a arma principal?', hint: 'Armas mágicas pedem um atributo de conjuração (subclasse que conjura). Você rola um dado de dano por ponto de Proficiência.', valid: !!pri,
    body: <Choice value={a.primaryId} onPick={(id) => set({ primaryId: id, secondaryId: weaponEntry(id)?.hands === 2 ? '' : a.secondaryId })}
      items={WEAPONS.filter((w) => w.tier === 1 && w.slot === 'primary').map((w) => ({ id: w.id, label: w.name, sub: `${w.dice} ${w.damageType === 'mag' ? 'mágico' : 'físico'} · ${w.hands === 2 ? 'duas mãos' : 'uma mão'}`, extra: w.featureName ? `${w.featureName}: ${w.feature}` : undefined }))} cols={2} />,
  })
  if (pri && pri.hands === 1) {
    steps.push({
      id: 'sec', question: 'Quer uma arma secundária?', hint: 'Escudos, adagas e afins (a principal tem uma mão só).', valid: true,
      body: <Choice value={a.secondaryId || 'nenhuma'} onPick={(id) => set({ secondaryId: id === 'nenhuma' ? '' : id })}
        items={[{ id: 'nenhuma', label: 'Nenhuma' }, ...WEAPONS.filter((w) => w.tier === 1 && w.slot === 'secondary').map((w) => ({ id: w.id, label: w.name, sub: `${w.dice} · ${w.featureName ?? ''}`, extra: w.feature }))]} cols={2} />,
    })
  }
  steps.push({
    id: 'armadura', question: 'Qual armadura ele usa?', hint: 'Mais proteção costuma custar Evasão.', valid: true,
    body: <Choice value={a.armorId || 'nenhuma'} onPick={(id) => set({ armorId: id === 'nenhuma' ? '' : id })}
      items={[{ id: 'nenhuma', label: 'Sem armadura', sub: 'Armadura 0; limiares iguais ao nível' }, ...ARMORS.filter((x) => x.tier === 1).map((x) => ({ id: x.id, label: x.name, sub: `Limiares ${x.major}/${x.severe} · Armadura ${x.score}`, extra: x.featureName ? `${x.featureName}: ${x.feature}` : undefined }))]} cols={2} />,
  })
  if (cls) {
    steps.push({
      id: 'itens', question: 'O que mais ele carrega?', hint: 'Além de tocha, corda, suprimentos e um punhado de ouro.', valid: true,
      body: (
        <div className="dh-q__items">
          <p><b>Uma poção</b></p>
          <Choice value={String(a.potion)} onPick={(id) => set({ potion: Number(id) })} items={cls.itemChoices.potion.map((p, k) => ({ id: String(k), label: p }))} />
          <p><b>Um item de classe</b></p>
          <Choice value={String(a.keepsake)} onPick={(id) => set({ keepsake: Number(id) })} items={cls.itemChoices.keepsake.map((p, k) => ({ id: String(k), label: p }))} />
          {cls.itemChoices.carry && (
            <label className="dh-q__carry">{cls.itemChoices.carry.label} <small>({cls.itemChoices.carry.examples})</small>
              <input className="dh-q__input" value={a.carry} maxLength={120} onChange={(e) => set({ carry: e.target.value })} />
            </label>
          )}
        </div>
      ),
    })
  }
  for (const n of [0, 1] as const) {
    steps.push({
      id: `exp${n}`, question: n === 0 ? 'Qual é a primeira Experiência dele?' : 'E a segunda Experiência?',
      hint: n === 0 ? 'Uma palavra ou frase específica sobre o passado (sem magias ou habilidades). Vale +2 quando você gasta 1 Esperança. Sugestão: uma que ajude em combate.' : 'Sugestão: uma que ajude fora de combate.',
      valid: a.experiences[n].trim().length > 0,
      body: (
        <>
          <input autoFocus className="dh-q__input" value={a.experiences[n]} maxLength={120} placeholder="Ex.: Médico de campo"
            onChange={(e) => { const ex: [string, string] = [...a.experiences]; ex[n] = e.target.value; set({ experiences: ex }) }} />
          <div className="dh-chips">{EXPERIENCE_EXAMPLES[n === 0 ? 2 : 3].items.slice(0, 10).map((it) => (
            <button key={it} type="button" onClick={() => { const ex: [string, string] = [...a.experiences]; ex[n] = it; set({ experiences: ex }) }}>{it}</button>
          ))}</div>
        </>
      ),
    })
  }
  const doms: DhDomain[] = cls?.domains ?? []
  steps.push({
    id: 'cartas', question: 'Quais são as 2 cartas de domínio?', hint: `Duas cartas de nível 1 de ${doms.map((d) => DOMAINS[d].name).join(' e ')}: uma de cada ou as duas do mesmo. Cada nível novo dá outra.`, valid: a.cards.length === 2,
    body: (
      <div className="dh-q__choices dh-q__choices--1" role="group">
        {DOMAIN_CARDS.filter((c) => doms.includes(c.domain) && c.level === 1).map((c) => {
          const on = a.cards.includes(c.id)
          return (
            <button key={c.id} type="button" aria-pressed={on} className={`dh-q__choice${on ? ' is-on' : ''}`} style={{ '--dh-domain': DOMAINS[c.domain].color } as React.CSSProperties}
              onClick={() => setA((x) => ({ ...x, cards: x.cards.includes(c.id) ? x.cards.filter((y) => y !== c.id) : x.cards.length < 2 ? [...x.cards, c.id] : x.cards }))}>
              <b>{c.name}</b><small>{DOMAINS[c.domain].name} · custo de troca {c.recall}</small><span>{c.text.slice(0, 190)}{c.text.length > 190 ? '…' : ''}</span>
            </button>
          )
        })}
      </div>
    ),
  })
  levelSteps.forEach((lvl, k) => {
    const done = states.length - 1
    steps.push({
      id: `n${lvl}`, own: true, valid: true,
      question: `Nível ${lvl}: o que ele escolheu ao subir?`, hint: 'Duas opções do quadro do patamar e uma carta de domínio.',
      body: done >= k + 1
        ? <p className="dh-hint">Subida do nível {lvl} registrada.</p>
        : <DhLevelWizard bare data={states[k] ?? base} applyLabel={`Registrar o nível ${lvl}`} onApply={(adv, name) => { setStates((s) => [...(s.length ? s : [base]).slice(0, k + 1), applyAdvancement(s[k] ?? base, adv, name)]); setI((x) => x + 1) }} />,
    })
  })
  steps.push({
    id: 'resumo', question: 'Tudo certo?', hint: 'É só isso. Depois de criada, você pode mudar qualquer coisa na ficha.', valid: true,
    body: (
      <ul className="dh-q__sum">
        <li><b>{current.name || 'Sem nome'}</b> {current.pronouns && `(${current.pronouns})`} · {cls?.name} {sub && `(${sub.name})`} · nível {current.level}</li>
        <li>Evasão {evasion(current)} · Vida {hpSlots(current)} · Fadiga {stressSlots(current)} · limiares {thresholds(current).major}/{thresholds(current).severe}</li>
        <li>{current.primary?.name ?? 'Sem arma'}{current.secondary ? ` + ${current.secondary.name}` : ''} · {current.armor?.name ?? 'sem armadura'}</li>
        <li>Experiências: {current.experiences.map((e) => e.name).join(', ')}</li>
        <li>{current.loadout.length + current.vault.length} cartas de domínio</li>
      </ul>
    ),
  })

  const step = steps[Math.min(i, steps.length - 1)]
  const last = i >= steps.length - 1

  function back() {
    if (i === 0) { onCancel(); return }
    const prev = steps[i - 1]
    if (prev.own) {
      // voltar para uma subida desfaz o registro dela
      const k = levelSteps.indexOf(Number(prev.id.slice(1)))
      setStates((s) => s.slice(0, k + 1))
    }
    setI(i - 1)
  }

  function next() {
    if (!step.valid) return
    if (last) { onDone(current); return }
    setI(i + 1)
  }

  const pct = Math.round((i / (steps.length - 1)) * 100)
  return (
    <ModalOverlay onClose={onCancel}>
      <div className="dh-dialog dh-q" role="dialog" aria-modal="true" aria-label="Ficha rápida">
        <div className="dh-q__progress" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
        <p className="dh-q__count">Pergunta {i + 1} de {steps.length}</p>
        <h3 className="dh-q__title">{step.question}</h3>
        {step.hint && <p className="dh-hint">{step.hint}</p>}
        <div className="dh-q__body" onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') next() }}>{step.body}</div>
        <footer className="dh-dialog__foot">
          <button type="button" className="btn" onClick={back}>{i === 0 ? 'Cancelar' : 'Voltar'}</button>
          {!step.own && <button type="button" className="btn btn-primary" disabled={!step.valid} onClick={next}>{last ? 'Criar ficha' : 'Continuar'}</button>}
          {step.own && states.length - 1 >= levelSteps.indexOf(Number(step.id.slice(1))) + 1 && <button type="button" className="btn btn-primary" onClick={() => setI(i + 1)}>Continuar</button>}
        </footer>
      </div>
    </ModalOverlay>
  )
}
