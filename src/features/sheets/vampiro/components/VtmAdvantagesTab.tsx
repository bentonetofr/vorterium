import { useMemo, useState } from 'react'
import type { VtmAdvantage } from '../../../../shared/types'
import { VTM_ADVANTAGES, VTM_ADV_BY_KEY, VTM_ADV_KIND_LABEL, type VtmAdvDef, type VtmAdvKind } from '../constants/vtmAdvantages'
import { VTM_BOOKS } from '../constants/vtmPowers'
import { newId } from '../utils/vampiroRules'
import { advantageTotals } from '../utils/vtmProgress'
import { Dots } from './VtmControls'
import type { VtmForm, VtmUpdate } from './vtmForm'

// ────────────────────────────────────────────────────────
// Aba Vantagens: Antecedentes, Méritos e Defeitos, com o limite da
// criação (7 pontos de vantagem e 2 de defeito, ou 9 e 4 pra ancilla). O
// que veio do tipo de predador ou foi comprado com XP não conta no limite.
// ────────────────────────────────────────────────────────

const SOURCE_LABEL: Record<VtmAdvantage['source'], string> = { criacao: 'criação', predador: 'predador', xp: 'XP' }
const SOURCES: VtmAdvantage['source'][] = ['criacao', 'predador', 'xp']

const pontos = (n: number) => `${n} ${n === 1 ? 'ponto' : 'pontos'}`

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function VtmAdvantagesTab({ form, update }: { form: VtmForm; update: VtmUpdate }) {
  const totals = advantageTotals(form)
  const thin = form.generation >= 14
  const { budget } = totals
  const overMerits = totals.merits > budget.advantages
  const flawsOff = totals.flaws !== budget.flaws

  function patch(id: string, p: Partial<VtmAdvantage>) {
    update((prev) => ({ ...prev, advantages: prev.advantages.map((a) => (a.id === id ? { ...a, ...p } : a)) }))
  }
  function remove(id: string) {
    update((prev) => ({ ...prev, advantages: prev.advantages.filter((a) => a.id !== id) }))
  }
  function add(a: Omit<VtmAdvantage, 'id'>) {
    update((prev) => ({ ...prev, advantages: [...prev.advantages, { ...a, id: newId() }] }))
  }

  const groups: { kind: VtmAdvKind; title: string }[] = [
    { kind: 'background', title: 'Antecedentes' },
    { kind: 'merit', title: 'Méritos' },
    { kind: 'flaw', title: 'Defeitos' },
  ]

  return (
    <div className="vtm-tab-panel anim-tab-panel">
      <section className="vtm-card">
        <div className="vtm-card__header">
          <h4 className="vtm-card__title">Vantagens e Defeitos</h4>
          <div className="vtm-seg" role="radiogroup" aria-label="Idade na criação">
            {(['neonato', 'ancilla'] as const).map((t) => (
              <button
                key={t} type="button" role="radio" aria-checked={form.creation_tier === t}
                className={`vtm-seg__btn${form.creation_tier === t ? ' is-on' : ''}`}
                onClick={() => update((p) => ({ ...p, creation_tier: t }))}
              >
                {t === 'neonato' ? 'Neonato ou criança' : 'Ancilla'}
              </button>
            ))}
          </div>
        </div>
        <div className="vtm-budget">
          <span className={`vtm-badge${overMerits ? ' vtm-badge--bad' : totals.merits === budget.advantages ? ' vtm-badge--ok' : ''}`}>
            Vantagens da criação: {totals.merits}/{budget.advantages}
          </span>
          <span className={`vtm-badge${flawsOff ? (totals.flaws > budget.flaws ? ' vtm-badge--bad' : '') : ' vtm-badge--ok'}`}>
            Defeitos da criação: {totals.flaws}/{budget.flaws}
          </span>
          {thin && (
            <span className={`vtm-badge${totals.thinMerits === totals.thinFlaws && totals.thinMerits >= 1 && totals.thinMerits <= 3 ? ' vtm-badge--ok' : ' vtm-badge--bad'}`}>
              Sangue-ralo: {totals.thinMerits} mérito(s) e {totals.thinFlaws} defeito(s)
            </span>
          )}
        </div>
        {overMerits && <p className="vtm-warn">Passou do limite da criação em {totals.merits - budget.advantages} ponto(s) de vantagem.</p>}
        {totals.flaws > budget.flaws && <p className="vtm-warn">Defeitos acima do previsto na criação ({budget.flaws}); combine com o Narrador.</p>}
        {totals.flaws < budget.flaws && <p className="vtm-muted">Faltam {budget.flaws - totals.flaws} ponto(s) de defeito pra fechar a criação.</p>}
        {thin && <p className="vtm-muted">Sangue-ralo pega de 1 a 3 Méritos de sangue-ralo e o mesmo número de Defeitos de sangue-ralo, fora do limite acima.</p>}
        <p className="vtm-muted">O que veio do tipo de predador ou foi comprado com XP não conta no limite.</p>
      </section>

      {groups.map((g) => {
        const list = form.advantages.filter((a) => a.kind === g.kind)
        return (
          <section key={g.kind} className="vtm-card">
            <div className="vtm-card__header">
              <h4 className="vtm-card__title">{g.title}</h4>
              <span className="vtm-counter">{pontos(list.reduce((n, a) => n + a.dots, 0))}</span>
            </div>
            {list.length === 0 && <p className="vtm-muted">Nenhum.</p>}
            <ul className="vtm-advs">
              {list.map((a) => <AdvantageRow key={a.id} a={a} onPatch={(p) => patch(a.id, p)} onRemove={() => remove(a.id)} />)}
            </ul>
          </section>
        )
      })}

      <AdvantagePicker form={form} onAdd={add} />
    </div>
  )
}

function AdvantageRow({ a, onPatch, onRemove }: { a: VtmAdvantage; onPatch: (p: Partial<VtmAdvantage>) => void; onRemove: () => void }) {
  const def = VTM_ADV_BY_KEY.get(a.key)
  const max = def ? Math.max(...def.dots) : 5
  const allowed = def ? def.dots.includes(a.dots) : true
  return (
    <li className="vtm-adv">
      <div className="vtm-adv__main">
        {def ? (
          <span className="vtm-adv__name">{a.name} <span className="vtm-faint">{def.en}</span></span>
        ) : (
          <input className="vtm-adv__name-input" value={a.name} maxLength={60} aria-label="Nome"
            onChange={(e) => onPatch({ name: e.target.value })} />
        )}
        <Dots value={a.dots} max={Math.max(max, a.dots)} min={1} size="sm" label={a.name} onChange={(v) => onPatch({ dots: v })} />
        <select className="vtm-source" value={a.source} onChange={(e) => onPatch({ source: e.target.value as VtmAdvantage['source'] })}
          aria-label="De onde veio" title="De onde veio: só a criação conta no limite">
          {SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
        </select>
        <button type="button" className="vtm-x" onClick={onRemove} aria-label={`Tirar ${a.name}`}>×</button>
      </div>
      <input
        className="vtm-adv__note" value={a.note} maxLength={120} placeholder={def?.hint ? `Anotação: ${def.hint}` : 'Anotação'}
        onChange={(e) => onPatch({ note: e.target.value })} aria-label={`Anotação de ${a.name}`}
      />
      {!allowed && def && <p className="vtm-warn">{a.name} vale {def.dots.join(' ou ')} ponto(s).</p>}
    </li>
  )
}

function AdvantagePicker({ form, onAdd }: { form: VtmForm; onAdd: (a: Omit<VtmAdvantage, 'id'>) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [customName, setCustomName] = useState('')
  const [customKind, setCustomKind] = useState<VtmAdvKind>('merit')
  const thin = form.generation >= 14
  const caitiff = form.clan === 'caitiff'

  const visible = useMemo(() => {
    const nq = normalize(q.trim())
    return VTM_ADVANTAGES.filter((d) =>
      (!d.only || (d.only === 'caitiff' && caitiff) || (d.only === 'sangue_ralo' && thin))
      && (!nq || normalize(`${d.name} ${d.en} ${d.category}`).includes(nq)))
  }, [q, thin, caitiff])

  const categories = useMemo(() => {
    const out = new Map<string, VtmAdvDef[]>()
    for (const d of visible) out.set(d.category, [...(out.get(d.category) ?? []), d])
    return [...out.entries()]
  }, [visible])

  function addDef(d: VtmAdvDef) {
    onAdd({ key: d.key, kind: d.kind, name: d.name, dots: d.dots[0], note: '', source: 'criacao' })
  }

  return (
    <section className="vtm-card">
      <div className="vtm-card__header"><h4 className="vtm-card__title">Adicionar</h4></div>
      <input className="input" placeholder="Buscar (ex.: Rebanho, Belo, Exclusão de Presa)…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="vtm-adv-cats">
        {categories.map(([category, defs]) => {
          const expanded = open === category || q.trim().length > 0
          return (
            <div key={category} className="vtm-adv-cat">
              <button type="button" className="vtm-adv-cat__head" onClick={() => setOpen(open === category ? null : category)} aria-expanded={expanded}>
                <span>{category}</span><span className="vtm-faint">{defs.length}</span>
              </button>
              {expanded && (
                <div className="vtm-picker__chips">
                  {defs.map((d) => (
                    <button key={d.key} type="button" className={`vtm-pick vtm-pick--chip vtm-pick--${d.kind}`} onClick={() => addDef(d)}
                      title={`${d.en} · ${VTM_ADV_KIND_LABEL[d.kind]} · ${d.books.map((b) => VTM_BOOKS[b]).join(', ')}`}>
                      + {d.name} <span className="vtm-faint">{d.dots.length > 1 ? `${d.dots[0]} a ${d.dots[d.dots.length - 1]}` : d.dots[0]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="vtm-add-row">
        <input className="input" placeholder="Outro (Loresheet, homebrew…)" value={customName} maxLength={60} onChange={(e) => setCustomName(e.target.value)} />
        <select className="vtm-source" value={customKind} onChange={(e) => setCustomKind(e.target.value as VtmAdvKind)} aria-label="Tipo">
          {(Object.keys(VTM_ADV_KIND_LABEL) as VtmAdvKind[]).map((k) => <option key={k} value={k}>{VTM_ADV_KIND_LABEL[k]}</option>)}
        </select>
        <button type="button" className="vtm-chip" disabled={!customName.trim()}
          onClick={() => { onAdd({ key: 'custom', kind: customKind, name: customName.trim(), dots: 1, note: '', source: 'criacao' }); setCustomName('') }}>
          Adicionar
        </button>
      </div>
    </section>
  )
}
