import { useState, type ReactNode } from 'react'
import { rest, REST_TABLE, type RestInput, type RestKind, type RestResult } from '../utils/altheriumRest'
import { SHORT_RESTS_MAX, type Survival } from '../utils/altheriumSurvival'
import { cryptoRng } from '../utils/altheriumExplore'
import { formatAmount } from '../utils/altheriumCraft'
import { Chips, Col, Cols, Field, Icon, Toggle, Win } from './AltheriumPlayKit'

// ────────────────────────────────────────────────────────
// Janela de Descanso (livro 2.0, "Descanso"): Curto (~1 hora, até 2 entre
// Longos, sem Ração) ou Longo (uma noite, 1 Ração). Sem Ração o Longo rende
// só o que um Curto rende, e dá +1 nível de Fome. Mostra o que cada descanso
// recupera, rola os dados e devolve o resultado pra ficha aplicar.
// ────────────────────────────────────────────────────────

interface Props {
  character:  string
  base:       Omit<RestInput, 'kind' | 'hasRation' | 'goodMeal' | 'badConditions' | 'interrupted'>
  rationPct:  number
  survival:   Survival
  onApply:    (result: RestResult) => void
  announce:   (text: string) => void
  onClose:    () => void
  nav?:       ReactNode
}

const d = (sides: number) => 1 + Math.floor(cryptoRng() * sides)

export function AltheriumRestWindow({ character, base, rationPct, survival, onApply, announce, onClose, nav }: Props) {
  const [kind, setKind] = useState<RestKind>('longo')
  const [goodMeal, setGoodMeal] = useState(false)
  const [bad, setBad] = useState(false)
  const [interrupted, setInterrupted] = useState(false)
  const [done, setDone] = useState<RestResult | null>(null)

  const hasRation = rationPct >= 100
  const input: RestInput = { ...base, kind, hasRation, goodMeal, badConditions: bad, interrupted }
  const preview = rest(input, () => 0)
  const shortLeft = SHORT_RESTS_MAX - survival.short_rests
  const blocked = preview.blocked ?? null

  function run() {
    const result = rest(input, d)
    if (!result.allowed) return
    onApply(result)
    setDone(result)
    announce(`${character} fez um Descanso ${kind === 'curto' ? 'Curto' : 'Longo'}${interrupted ? ' (interrompido)' : result.benefit === 'curto' && kind === 'longo' ? ' (só com os benefícios de um Curto)' : ''}.`)
  }

  if (done) {
    return (
      <Win title={`Descanso ${kind === 'curto' ? 'Curto' : 'Longo'}`} subtitle="feito" onClose={onClose}>
        <ul className="alth-rest__lines">
          {done.lines.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
        {done.warnings.map((w) => <p key={w} className="alth-test__note alth-test__note--warn" role="alert">{w}</p>)}
        <div className="alth-test__actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>Fechar</button>
        </div>
      </Win>
    )
  }

  return (
    <Win title="Descansar" wide nav={nav} subtitle={`Curtos feitos: ${survival.short_rests} de ${SHORT_RESTS_MAX}`} onClose={onClose}>
      <Chips<RestKind>
        label="Tipo de descanso" value={kind} onChange={setKind}
        options={[
          { id: 'curto', label: 'Descanso Curto', sub: shortLeft > 0 ? 'cerca de 1 hora' : 'sem mais Curtos', disabled: shortLeft <= 0 },
          { id: 'longo', label: 'Descanso Longo', sub: 'uma noite, 1 Ração' },
        ]}
      />

      <Cols>
      <Col>
      <div className="alth-rest__table" role="table" aria-label="O que cada descanso recupera">
        {REST_TABLE.map((row) => (
          <div key={row.label} className="alth-rest__row" role="row">
            <span role="cell">{row.label}</span>
            <span role="cell" className={kind === 'curto' ? 'alth-rest__on' : ''}>{row.curto}</span>
            <span role="cell" className={kind === 'longo' ? 'alth-rest__on' : ''}>{row.longo}</span>
          </div>
        ))}
      </div>

      </Col>
      <Col>
      {kind === 'longo' && (
        <>
          <Field
            label="Comida"
            hint={hasRation ? `Você tem ${formatAmount(rationPct)} de Ração: 1 será consumida.` : `Você tem ${rationPct > 0 ? formatAmount(rationPct) : 'nenhuma Ração'} (precisa de 1 inteira). Sem comida, o descanso rende só o que um Curto rende, com os pontos de triunfo cheios, 2 Fichas e +1 de Fome.`}
          >
            <Toggle on={goodMeal} onChange={setGoodMeal} label="Boa refeição pouco antes (conta como Ração)" hint="Banquete, taverna ou salão: não gasta a sua Ração." />
          </Field>
          <Field label="Condições" hint="O mestre decide quando as condições são ruins. O Reforço Forro de Lã ignora o frio extremo.">
            <Toggle on={bad} onChange={setBad} tone="bad" label="Frio extremo ou sem nenhum abrigo (só os benefícios do Curto, mesmo com comida)" />
          </Field>
        </>
      )}
      <Field label="Durante o descanso">
        <Toggle on={interrupted} onChange={setInterrupted} tone="bad" label="Foi interrompido por combate ou esforço intenso (nenhum benefício; a Ração não se perde)" />
      </Field>

      </Col>
      </Cols>

      {base.survival.hunger > 3 && <p className="alth-test__note alth-test__note--warn">Mais de 3 níveis de Fome: o personagem morre.</p>}
      {blocked && <p className="alth-test__note alth-test__note--warn" role="alert">{blocked}</p>}
      {base.genesis === 'peregrino' && kind === 'curto' && <p className="alth-hint">Gênesis Peregrino: +1d10 em todos os pontos básicos neste descanso.</p>}

      <div className="alth-test__actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn btn-primary alth-win__go" disabled={!preview.allowed} onClick={run}>
          <Icon name="rest" /> {interrupted ? 'Registrar interrupção' : `Fazer o Descanso ${kind === 'curto' ? 'Curto' : 'Longo'}`}
        </button>
      </div>
    </Win>
  )
}
