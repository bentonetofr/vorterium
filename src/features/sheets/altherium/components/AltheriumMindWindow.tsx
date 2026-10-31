import { useState, type ReactNode } from 'react'
import { BREAKDOWNS, CONFESSION_DT, RITES, breakdownFor, calmAmount, equilibriumLoss, riteDef, scarredMax, type BreakdownDef, type RiteId } from '../utils/altheriumMind'
import { cryptoRng } from '../utils/altheriumExplore'
import type { Survival } from '../utils/altheriumSurvival'
import { AltheriumTestModal, type AfterCtx, type AltheriumTestSpec } from './AltheriumTestModal'
import type { DomainCheck } from './AltheriumCombatPanel'
import { Chips, Col, Cols, Field, Icon, Win } from './AltheriumPlayKit'

// ────────────────────────────────────────────────────────
// Janela do Equilíbrio (livro 2.0, "Equilíbrio"): a perda diante de algo
// perturbador (Vontade + Espírito contra a DT do evento: passou, perde
// metade; falhou, perde tudo), o Acalmar dos aliados, os Ritos de Altherium
// e o que acontece quando o Equilíbrio zera (tabela de 1d10, Cicatriz do
// Crepúsculo e Traumas).
// ────────────────────────────────────────────────────────

interface Props {
  campaignId: string
  sheetId:    string
  character:  string
  check:      (domain: 'vontade' | 'religiao') => DomainCheck
  equilibrio: { current: number; max: number }
  /** Muda o Equilíbrio atual (e, na Cicatriz, o máximo). */
  onEquilibrio: (patch: { current?: number; max?: number }) => void
  hacksilvers: number
  onSpendCoins: (n: number) => void
  survival:   Survival
  onSurvival: (patch: Partial<Survival>) => void
  announce:   (text: string) => void
  onClose:    () => void
  nav?:       ReactNode
}

type Tab = 'perda' | 'recuperar' | 'zerado'
const d = (sides: number) => 1 + Math.floor(cryptoRng() * sides)

export function AltheriumMindWindow(props: Props) {
  const { equilibrio, survival } = props
  const [tab, setTab] = useState<Tab>('perda')
  const [amount, setAmount] = useState('')
  const [dt, setDt] = useState('')
  const [spec, setSpec] = useState<{ spec: AltheriumTestSpec; after: (ctx: AfterCtx) => ReactNode } | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [calm, setCalm] = useState('')
  const [calmCrit, setCalmCrit] = useState(false)
  const [breakdown, setBreakdown] = useState<BreakdownDef | null>(null)

  const say = (line: string) => setLog((l) => [...l, line])
  const clamp = (n: number) => Math.max(0, Math.min(equilibrio.max, n))

  /** Aplica uma mudança no Equilíbrio; se zerar, a janela vai pra tabela. */
  function lose(n: number, why: string) {
    if (n <= 0) { say(`${why}: não perdeu nada.`); return }
    const next = clamp(equilibrio.current - n)
    props.onEquilibrio({ current: next })
    say(`${why}: −${n} de Equilíbrio (${equilibrio.current} → ${next}).`)
    props.announce(`${props.character} perdeu ${n} de Equilíbrio (${next}/${equilibrio.max}).`)
    if (next === 0) { say('O Equilíbrio zerou: role a tabela.'); setTab('zerado') }
  }

  function gain(n: number, why: string) {
    const next = clamp(equilibrio.current + n)
    props.onEquilibrio({ current: next })
    say(`${why}: +${next - equilibrio.current} de Equilíbrio (${equilibrio.current} → ${next}).`)
  }

  // ── Perda ──
  function startLoss() {
    const n = Math.max(0, Math.trunc(Number(amount)) || 0)
    const target = Math.max(1, Math.trunc(Number(dt)) || 8)
    const base = props.check('vontade')
    setSpec({
      spec: {
        ...base, title: 'Perturbador: Vontade + Espírito', targetLabel: 'DT do evento', initialTarget: target,
        words: ['resistiu', 'abalou'],
        notes: [`Passou: perde metade (${equilibriumLoss(n, true)}). Falhou: perde tudo (${n}).`],
      },
      after: (ctx) => <LossResult ctx={ctx} amount={n} onApply={(x) => lose(x, 'Perturbador')} />,
    })
  }

  // ── Ritos ──
  const riteBlocked = (id: RiteId) => riteDef(id).counts && survival.rite_used

  function rite(id: RiteId) {
    const def = riteDef(id)
    if (riteBlocked(id)) return
    if (id === 'oferenda') {
      const base = props.check('religiao')
      setSpec({
        spec: { ...base, title: 'Oferenda aos Deuses', targetLabel: 'DT (opcional)', words: ['agradou', 'não agradou'], notes: ['Religião + Destino. Passou: +2d4. Falhou: +1.'] },
        after: (ctx) => <OfferingResult ctx={ctx} onApply={(pass) => {
          const n = pass ? d(4) + d(4) : 1
          props.onSurvival({ rite_used: true })
          gain(n, `Oferenda aos Deuses (${pass ? '2d4' : 'falhou'})`)
        }} />,
      })
      return
    }
    if (id === 'banquete' && props.hacksilvers < 100) { say('Faltam Hacksilvers: o Banquete custa ¤100.'); return }
    const n = id === 'juramento' ? d(8) : d(6)
    if (id === 'banquete') props.onSpendCoins(100)
    if (def.counts) props.onSurvival({ rite_used: true })
    gain(n, `${def.label} (${id === 'juramento' ? '1d8' : '1d6'} = ${n})`)
    props.announce(`${props.character} participou de um rito: ${def.label}.`)
    if (id === 'confissao') say(`O aliado faz Vontade + Espírito (DT ${CONFESSION_DT}): se falhar, perde 1 ponto de Equilíbrio.`)
  }

  // ── Zerado ──
  function rollBreakdown() {
    const roll = d(10)
    const b = breakdownFor(roll)
    setBreakdown(b)
    props.onEquilibrio({ current: 0, max: scarredMax(equilibrio.max) })
    say(`Cicatriz do Crepúsculo: o Equilíbrio máximo caiu de ${equilibrio.max} para ${scarredMax(equilibrio.max)}.`)
    props.announce(`O Equilíbrio de ${props.character} zerou: ${b.roll}. ${b.name}.`)
    if (b.permanent) props.onSurvival({ traumas: [...survival.traumas, 'Marca da Ruptura'].slice(0, 6) })
  }

  if (spec) {
    return (
      <AltheriumTestModal
        campaignId={props.campaignId} sheetId={props.sheetId} character={props.character} spec={spec.spec}
        onClose={() => setSpec(null)} after={spec.after} autoRoll noAgain
      />
    )
  }

  return (
    <Win title="Equilíbrio" wide nav={props.nav} subtitle={`${equilibrio.current} de ${equilibrio.max}`} onClose={props.onClose}>
      <Chips<Tab>
        label="O que fazer" value={tab} onChange={setTab}
        options={[
          { id: 'perda', label: 'Algo perturbador' },
          { id: 'recuperar', label: 'Recuperar' },
          { id: 'zerado', label: 'Zerou', sub: equilibrio.current === 0 ? 'agora' : undefined },
        ]}
      />

      {tab === 'perda' && (
        <>
          <p className="alth-hint">Vontade (maior dado) + Espírito contra a DT do evento. Passou: perde metade, arredondada para baixo. Falhou: perde o valor total.</p>
          <div className="alth-win__pair">
            <Field label="Perda do evento">
              <input type="number" className="input" min={0} max={99} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Pontos" />
            </Field>
            <Field label="DT do evento">
              <input type="number" className="input" min={1} max={30} inputMode="numeric" value={dt} onChange={(e) => setDt(e.target.value)} placeholder="Ex.: 8" />
            </Field>
          </div>
          <div className="alth-test__actions">
            <button type="button" className="btn btn-ghost" onClick={() => lose(Math.max(0, Math.trunc(Number(amount)) || 0), 'Perda direta')} disabled={!amount}>
              Aplicar sem teste
            </button>
            <button type="button" className="btn btn-primary alth-win__go" onClick={startLoss} disabled={!amount}>
              <Icon name="mind" /> Resistir (Vontade + Espírito)
            </button>
          </div>
        </>
      )}

      {tab === 'recuperar' && (
        <>
          <p className="alth-hint">O Descanso Curto não recupera Equilíbrio. O Longo recupera 1d4 + Destino. O Soro de Idunn recupera 1d8 como Ação Bônus (item do inventário).</p>
          <Cols>
          <Col>
          <Field label="Acalmar (um aliado em Toque, Ação Padrão)" hint="O aliado faz Persuasão + Destino em você: 1 ponto a cada 5 no resultado; no Crítico, o dobro. Uma vez por cena.">
            <div className="alth-win__pair">
              <input type="number" className="input" min={0} max={99} inputMode="numeric" value={calm} onChange={(e) => setCalm(e.target.value)} placeholder="Resultado do aliado" />
              <label className="alth-test__check"><input type="checkbox" checked={calmCrit} onChange={(e) => setCalmCrit(e.target.checked)} /> Crítico</label>
              <button type="button" className="btn btn-primary" disabled={!calm} onClick={() => { gain(calmAmount(Math.trunc(Number(calm)) || 0, calmCrit), 'Acalmar'); setCalm(''); setCalmCrit(false) }}>
                Receber
              </button>
            </div>
          </Field>

          </Col>
          <Col>
          <Field label="Ritos de Altherium" hint={survival.rite_used ? 'O Rito deste descanso já foi usado (o Juramento Cumprido não conta no limite).' : 'Um por Descanso Longo. O mestre decide se o rito está disponível no local.'}>
            <ul className="alth-rites">
              {RITES.map((r) => (
                <li key={r.id} className="alth-rites__row">
                  <div>
                    <strong>{r.label}</strong>
                    <small>{r.what} {r.effect}</small>
                  </div>
                  <button type="button" className="btn btn-ghost" disabled={riteBlocked(r.id)} onClick={() => rite(r.id)}>Fazer</button>
                </li>
              ))}
            </ul>
          </Field>
          </Col>
          </Cols>
        </>
      )}

      {tab === 'zerado' && (
        <>
          <p className="alth-hint">Cada vez que o Equilíbrio zera, o máximo cai 2 para sempre (Cicatriz do Crepúsculo). Role 1d10 para a condição.</p>
          {!breakdown ? (
            <>
              <ul className="alth-finds__table alth-finds__table--wide">
                {BREAKDOWNS.map((b) => <li key={b.roll}><b>{b.roll}</b> {b.name}</li>)}
              </ul>
              <div className="alth-test__actions">
                <button type="button" className="btn btn-primary alth-win__go" onClick={rollBreakdown}><Icon name="death" /> Rolar 1d10</button>
              </div>
            </>
          ) : (
            <div className="alth-finds__card">
              <p className="alth-test__note"><strong>{breakdown.roll}. {breakdown.name}.</strong> {breakdown.effect}</p>
              {breakdown.permanent && <p className="alth-test__note alth-test__note--warn">Trauma permanente registrado na ficha. Só uma missão pessoal combinada com o mestre o cura.</p>}
              <button type="button" className="btn btn-ghost" onClick={() => setBreakdown(null)}>Rolar de novo (correção)</button>
            </div>
          )}
        </>
      )}

      {survival.traumas.length > 0 && (
        <p className="alth-test__note alth-test__note--warn">Traumas: {survival.traumas.join(', ')}.</p>
      )}
      {log.length > 0 && <ul className="alth-combat__lines">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>}
    </Win>
  )
}

export function LossResult({ ctx, amount, onApply }: { ctx: AfterCtx; amount: number; onApply: (n: number) => void }) {
  const [done, setDone] = useState(false)
  const passed = ctx.outcome ? ctx.outcome.success : true
  const n = equilibriumLoss(amount, passed)
  return (
    <div className="alth-finds">
      <p className="alth-test__note">{passed ? `Resistiu: perde metade, ${n}.` : `Abalou: perde tudo, ${n}.`}</p>
      {!done
        ? <button type="button" className="btn btn-primary" onClick={() => { onApply(n); setDone(true) }}>Aplicar −{n} de Equilíbrio</button>
        : <p className="alth-hint">Aplicado na ficha.</p>}
    </div>
  )
}

function OfferingResult({ ctx, onApply }: { ctx: AfterCtx; onApply: (pass: boolean) => void }) {
  const [done, setDone] = useState(false)
  const known = ctx.outcome ? ctx.outcome.success : null
  return (
    <div className="alth-finds">
      <p className="alth-test__note">Resultado {ctx.reading.total}. Confirme com o mestre se os deuses aceitaram.</p>
      {!done ? (
        <div className="alth-test__actions alth-test__actions--start">
          <button type="button" className={`btn ${known === true || known === null ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { onApply(true); setDone(true) }}>Passou (+2d4)</button>
          <button type="button" className={`btn ${known === false ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { onApply(false); setDone(true) }}>Falhou (+1)</button>
        </div>
      ) : <p className="alth-hint">Aplicado na ficha.</p>}
    </div>
  )
}
