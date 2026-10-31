import { useMemo, useRef, useState, type MutableRefObject } from 'react'
import type { AltheriumRaiz } from '../constants/altherium'
import type { AltheriumDomain, AltheriumAttribute } from '../constants/altherium'
import {
  COMPLICATIONS,
  EXPLORE_CONDITIONS,
  LOCATIONS,
  SCARCITY,
  complicationFor,
  conditionDice,
  exploreOutcome,
  findHint,
  findLabel,
  locationDef,
  loseQuarter,
  rollFind,
  rollRare,
  scarcityDef,
  storeFind,
  type ComplicationDef,
  type Find,
  type LocationId,
  type LootBag,
  type ScarcityId,
} from '../utils/altheriumExplore'
import type { ResourceStock, SagaId } from '../utils/altheriumCraft'
import { TOKENS_MAX, type Survival } from '../utils/altheriumSurvival'
import type { AltheriumScene } from '../services/altheriumSceneService'
import { AltheriumTestModal, type AfterCtx, type AltheriumTestSpec } from './AltheriumTestModal'
import type { DomainCheck } from './AltheriumCombatPanel'
import { Chips, Field, Formula, Icon, Pips, Toggle, Win } from './AltheriumPlayKit'

// ────────────────────────────────────────────────────────
// Janela de Explorar (livro 2.0, "Exploração"). Passo 1: Local, Escassez e
// Condições (já vêm da cena do mestre). Passo 2: o teste, com os dados 3D,
// contra a DT da Escassez; gasta 1 Ficha de Exploração. Depois do resultado:
// os Achados sorteados na tabela do Local, cada um com Guardar ou Deixar, as
// Complicações e as habilidades de raiz que mexem na exploração (Faro do Lobo,
// Cofre Cheio, Mapa das Estrelas).
// ────────────────────────────────────────────────────────

interface Props {
  campaignId: string
  sheetId:    string
  character:  string
  raiz:       AltheriumRaiz | null
  check:      (domain: AltheriumDomain, attribute?: AltheriumAttribute) => DomainCheck
  scene:      AltheriumScene
  survival:   Survival
  onSurvival: (patch: Partial<Survival>) => void
  stock:      ResourceStock
  hacksilvers: number
  onLoot:     (bag: LootBag) => void
  sagas:      SagaId[]
  onSaga:     (id: SagaId) => void
  fv:         number
  onSpendFv:  (cost: number, what: string) => void
  /** Tira PV (Armadilha). */
  onDamage:   (amount: number) => void
  onBleed:    () => void
  announce:   (text: string) => void
  onClose:    () => void
}

type Kit = 'sobrevivencia' | 'investigacao' | 'percepcao'

export function AltheriumExploreWindow(props: Props) {
  const { check, scene, survival, raiz, fv } = props
  const [location, setLocation] = useState<LocationId>(scene.location)
  const [scarcity, setScarcity] = useState<ScarcityId>(scene.scarcity === 'abundante' || scene.scarcity === 'normal' || locationDef(scene.location).id !== 'fenda' ? scene.scarcity : 'escasso')
  const [kit, setKit] = useState<Kit>('investigacao')
  const [conds, setConds] = useState<Set<string>>(() => new Set(scene.weather))
  const [faro, setFaro] = useState(false)
  const [cofre, setCofre] = useState(false)
  const [spec, setSpec] = useState<AltheriumTestSpec | null>(null)

  const loc = locationDef(location)
  const fenda = location === 'fenda'
  const nature = loc.kind === 'natureza'
  const scar = scarcityDef(fenda && (scarcity === 'abundante' || scarcity === 'normal') ? 'escasso' : scarcity)
  const dice = conditionDice(conds)
  const noTokens = survival.tokens < 1
  const faroOk = raiz === 'berserker' && nature && fv >= 4

  const domain: AltheriumDomain = nature ? 'sobrevivencia' : kit === 'percepcao' ? 'percepcao' : 'investigacao'
  const attribute: AltheriumAttribute | undefined = nature && faro ? 'furia' : undefined
  const base = check(domain, attribute)

  function toggle(id: string, on: boolean) {
    setConds((prev) => {
      const next = new Set(prev)
      // O clima é um só: nevasca e chuva se excluem.
      if (on) {
        if (id === 'chuva') next.delete('tempestade')
        if (id === 'tempestade') next.delete('chuva')
        next.add(id)
      } else next.delete(id)
      return next
    })
  }

  function start() {
    if (faro) props.onSpendFv(4, 'Faro do Lobo')
    setSpec({
      ...base,
      title: `Explorar: ${loc.label}`,
      diceMods: dice !== 0 ? [{ label: 'Condições da exploração', value: dice }] : [],
      targetLabel: `DT (${scar.label})`, initialTarget: scar.dt, critSucceeds: true,
      words: ['encontrou algo', 'não achou'],
      notes: [
        `${nature ? 'Natureza' : 'Construção'}: ${base.domainLabel} + ${base.attributeLabel}${faro ? ' (Faro do Lobo)' : ''}. Gasta 1 Ficha de Exploração (rolar de novo gasta outra).`,
      ],
    })
  }

  if (spec) {
    return (
      <AltheriumTestModal
        campaignId={props.campaignId} sheetId={props.sheetId} character={props.character} spec={spec}
        onClose={props.onClose}
        onRolled={() => props.onSurvival({ tokens: Math.max(0, survival.tokens - 1) })}
        after={(ctx) => (
          <Finds
            ctx={ctx} props={props} location={location} fenda={fenda} faro={faro} cofre={cofre}
            scarcityLabel={scar.label} dt={scar.dt}
          />
        )}
      />
    )
  }

  return (
    <Win title="Explorar" subtitle={<>Fichas <Pips value={survival.tokens} max={TOKENS_MAX} label="Fichas de Exploração" /></>} onClose={props.onClose}>
      <Field label="Onde está?" hint={loc.hint}>
        <Chips
          label="Local" value={location}
          onChange={(id) => { setLocation(id); if (id === 'fenda' && (scarcity === 'abundante' || scarcity === 'normal')) setScarcity('escasso') }}
          options={LOCATIONS.map((l) => ({ id: l.id, label: l.label }))}
        />
      </Field>

      <Field label="Escassez" hint={`${scar.example}. A DT é ${scar.dt}.${fenda ? ' Fendas de Eryndor são sempre Escassas ou Devastadas.' : ''}`}>
        <Chips
          label="Escassez" value={scar.id} onChange={setScarcity}
          options={SCARCITY.map((s) => ({ id: s.id, label: s.label, sub: `DT ${s.dt}`, disabled: fenda && (s.id === 'abundante' || s.id === 'normal') }))}
        />
      </Field>

      {!nature && (
        <Field label="Como procura?" hint="O mestre escolhe entre os dois testes.">
          <Chips<Kit>
            label="Teste" value={kit === 'percepcao' ? 'percepcao' : 'investigacao'} onChange={setKit}
            options={[
              { id: 'investigacao', label: 'Investigação', sub: '+ Estratégia' },
              { id: 'percepcao',    label: 'Percepção',    sub: '+ Destino' },
            ]}
          />
        </Field>
      )}

      <Field label="Condições" hint="Somando tudo, no máximo 2 dados a mais ou a menos. A Fome entra como −1 por nível no total.">
        <div className="alth-toggles">
          {EXPLORE_CONDITIONS.map((c) => (
            <Toggle
              key={c.id} on={conds.has(c.id)} onChange={(on) => toggle(c.id, on)}
              label={c.label} delta={`${c.delta > 0 ? '+' : '−'}${Math.abs(c.delta)} ${Math.abs(c.delta) === 1 ? 'dado' : 'dados'}`}
              tone={c.delta > 0 ? 'good' : 'bad'}
            />
          ))}
        </div>
      </Field>

      {raiz === 'berserker' && nature && (
        <Field label="Triunfo do Berserker">
          <Toggle
            on={faro} onChange={setFaro} disabled={!faroOk && !faro}
            label="Faro do Lobo: Fúria no lugar de Estratégia, e toda Ração vem com +25%" delta="−4 FV"
            hint={fv < 4 ? 'Precisa de 4 de Força de Vontade.' : undefined}
          />
        </Field>
      )}
      {raiz === 'pilar' && (
        <Field label="Triunfo do Pilar" hint="Os Hacksilvers desta exploração vêm dobrados. Gaste a carta na aba Triunfos.">
          <Toggle on={cofre} onChange={setCofre} label="Cofre Cheio: todo Hacksilver encontrado vem dobrado" />
        </Field>
      )}

      <Formula
        dice={Math.max(1, base.baseDice + dice)} keep={base.disadvantage ? 'lowest' : 'highest'}
        bonus={base.attribute + base.flat.reduce((s, m) => s + m.value, 0)}
        note={`${base.domainLabel} + ${base.attributeLabel} · contra DT ${scar.dt} (${scar.label})${base.flat.length ? ` · ${base.flat.map((m) => `${m.label} ${m.value}`).join(', ')}` : ''}`}
      />

      {noTokens && <p className="alth-test__note alth-test__note--warn">Sem Fichas de Exploração: descanse para explorar de novo.</p>}

      <div className="alth-test__actions">
        <button type="button" className="btn btn-ghost" onClick={props.onClose}>Cancelar</button>
        <button type="button" className="btn btn-primary alth-win__go" disabled={noTokens} onClick={start}>
          <Icon name="explore" /> Explorar (gasta 1 Ficha)
        </button>
      </div>
    </Win>
  )
}

// ────────────────────────────────────────────────────────
// Depois do teste: Achados, Complicação e o que fazer com cada um.
// ────────────────────────────────────────────────────────

interface Row {
  find:  Find
  state: 'pendente' | 'guardado' | 'deixado' | 'erro'
  note:  string
  /** Já sorteou de novo com o Mapa das Estrelas. */
  rerolled: boolean
}

function Finds({ ctx, props, location, fenda, faro, cofre, scarcityLabel, dt }: {
  ctx: AfterCtx; props: Props; location: LocationId; fenda: boolean; faro: boolean; cofre: boolean; scarcityLabel: string; dt: number
}) {
  const { reading, rollExtra, busy } = ctx
  const outcome = useMemo(() => exploreOutcome(reading.total, dt, reading.crit, fenda), [reading.total, reading.crit, dt, fenda])
  const [rows, setRows] = useState<Row[] | null>(null)
  const [complication, setComplication] = useState<{ def: ComplicationDef; line: string | null } | null>(null)
  const [mapUsed, setMapUsed] = useState(false)
  const bag = useRef<LootBag>({ stock: props.stock, hacksilvers: props.hacksilvers })
  const sagas = useRef<SagaId[]>(props.sagas)
  const announced = useRef(false)

  function draw() {
    if (rows) return
    const list: Find[] = Array.from({ length: outcome.finds }, () => rollFind(location, undefined, sagas.current))
    if (outcome.rare) list.push(rollRare(undefined, sagas.current))
    setRows(list.map((find) => ({ find, state: 'pendente', note: '', rerolled: false })))
    if (!announced.current) {
      announced.current = true
      const names = list.map((f) => findLabel(f).toLowerCase())
      props.announce(`🧭 ${props.character} explorou ${locationDef(location).label.toLowerCase()} (${scarcityLabel}, DT ${dt}) e ${names.length ? `achou: ${names.join('; ')}` : 'não achou nada'}.`)
    }
  }

  function store(i: number) {
    if (!rows) return
    const row = rows[i]
    const res = storeFind(row.find, bag.current, { faro, cofre })
    if (!res.ok) {
      setRows(rows.map((r, idx) => (idx === i ? { ...r, state: 'erro', note: res.text } : r)))
      return
    }
    bag.current = res.bag
    props.onLoot(res.bag)
    if (row.find.kind === 'raro') {
      if (row.find.rare === 'saga' && row.find.saga) { sagas.current = [...sagas.current, row.find.saga]; props.onSaga(row.find.saga) }
      else if (row.find.rare !== 'lendario') props.announce(`✦ ${props.character} encontrou ${findLabel(row.find)}.`)
    }
    setRows(rows.map((r, idx) => (idx === i ? { ...r, state: 'guardado', note: res.text } : r)))
  }

  function storeAll() {
    if (!rows) return
    let next = rows
    rows.forEach((row, i) => {
      if (row.state !== 'pendente') return
      const res = storeFind(row.find, bag.current, { faro, cofre })
      if (!res.ok) { next = next.map((r, idx) => (idx === i ? { ...r, state: 'erro', note: res.text } : r)); return }
      bag.current = res.bag
      if (row.find.kind === 'raro') {
        if (row.find.rare === 'saga' && row.find.saga) { sagas.current = [...sagas.current, row.find.saga]; props.onSaga(row.find.saga) }
        else if (row.find.rare !== 'lendario') props.announce(`✦ ${props.character} encontrou ${findLabel(row.find)}.`)
      }
      next = next.map((r, idx) => (idx === i ? { ...r, state: 'guardado', note: res.text } : r))
    })
    props.onLoot(bag.current)
    setRows(next)
  }

  function leave(i: number) {
    setRows((prev) => prev && prev.map((r, idx) => (idx === i ? { ...r, state: 'deixado', note: 'Deixou pra trás' } : r)))
  }

  function reroll(i: number) {
    if (mapUsed) return
    setMapUsed(true)
    setRows((prev) => prev && prev.map((r, idx) => (idx === i ? { find: rollFind(location, undefined, sagas.current), state: 'pendente', note: 'Sorteado de novo (Mapa das Estrelas)', rerolled: true } : r)))
  }

  async function rollComplication() {
    const r = await rollExtra('1d6', 'Complicação da exploração')
    if (!r) return
    setComplication({ def: complicationFor(r.result), line: null })
  }

  const pending = rows ? rows.filter((r) => r.state === 'pendente').length : 0

  return (
    <div className="alth-finds">
      <p className={`alth-finds__verdict alth-finds__verdict--${outcome.tier}`} role="status">{outcome.label}</p>

      {!rows && outcome.finds > 0 && (
        <div className="alth-test__actions alth-test__actions--start">
          <button type="button" className="btn btn-primary" onClick={draw} disabled={busy}>Ver o que achou</button>
        </div>
      )}

      {rows && (
        <ul className="alth-loot">
          {rows.map((row, i) => (
            <li key={i} className={`alth-loot__row alth-loot__row--${row.state}${row.find.kind === 'raro' ? ' alth-loot__row--rare' : ''}`}>
              <div className="alth-loot__info">
                <strong>{findLabel(row.find)}</strong>
                <small>{findHint(row.find)}</small>
                {row.note && <small className={row.state === 'erro' ? 'alth-loot__warn' : 'alth-loot__ok'}>{row.note}</small>}
              </div>
              {(row.state === 'pendente' || row.state === 'erro') && (
                <div className="alth-loot__actions">
                  <button type="button" className="btn btn-primary" onClick={() => store(i)}>{row.state === 'erro' ? 'Tentar de novo' : 'Guardar'}</button>
                  <button type="button" className="btn btn-ghost" onClick={() => leave(i)}>Deixar</button>
                  {props.raiz === 'pilar' && !mapUsed && !row.rerolled && row.state === 'pendente' && (
                    <button type="button" className="btn btn-ghost" onClick={() => reroll(i)} title="Mapa das Estrelas (Pilar): sorteie de novo um dos Achados e fique com o que preferir.">Sortear de novo</button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {rows && pending > 1 && (
        <div className="alth-test__actions alth-test__actions--start">
          <button type="button" className="btn btn-primary" onClick={storeAll}>Guardar tudo que couber</button>
        </div>
      )}

      {rows && rows.length === 0 && <p className="alth-hint">Nada encontrado.</p>}

      {outcome.complication && (
        <div className="alth-finds__complication">
          {!complication ? (
            <>
              <p className="alth-test__note alth-test__note--warn">
                {fenda && outcome.tier !== 'complicacao' ? '' : fenda ? 'Falha numa Fenda de Eryndor: ' : 'Falhou por 5 ou mais: '}role na tabela de Complicações.
              </p>
              <ul className="alth-finds__table">
                {COMPLICATIONS.map((c) => <li key={c.range}><b>{c.range}</b> {c.def.label}</li>)}
              </ul>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void rollComplication()}>Rolar Complicação (1d6)</button>
            </>
          ) : (
            <ComplicationCard
              def={complication.def} busy={busy} props={props} bag={bag}
              onLine={(line) => setComplication({ ...complication, line })}
              line={complication.line} rollExtra={rollExtra}
            />
          )}
        </div>
      )}
    </div>
  )
}

function ComplicationCard({ def, busy, props, bag, onLine, line, rollExtra }: {
  def: ComplicationDef; busy: boolean; props: Props; bag: MutableRefObject<LootBag>
  onLine: (line: string) => void; line: string | null
  rollExtra: AfterCtx['rollExtra']
}) {
  async function apply() {
    if (def.id === 'armadilha') {
      const r = await rollExtra('1d6', 'Armadilha: dano')
      if (r) { props.onDamage(r.result); onLine(`Sofreu ${r.result} de dano.`) }
    } else if (def.id === 'ferimento') {
      props.onBleed()
      onLine('Sangrando marcado na ficha.')
    } else if (def.id === 'perda') {
      const res = loseQuarter(bag.current.stock)
      bag.current = { ...bag.current, stock: res.stock }
      props.onLoot(bag.current)
      onLine(res.text)
    } else if (def.id === 'barulho') {
      onLine('A próxima exploração aqui tem −1 dado (marque "Barulho" nas condições).')
    } else {
      onLine('O mestre define quem aparece.')
    }
  }
  const label = def.id === 'armadilha' ? 'Rolar o dano (1d6)' : def.id === 'ferimento' ? 'Marcar Sangrando' : def.id === 'perda' ? 'Aplicar a perda' : 'Entendido'
  return (
    <div className="alth-finds__card">
      <p className="alth-test__note"><strong>{def.label}.</strong> {def.effect}</p>
      {!line
        ? <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void apply()}>{label}</button>
        : <p className="alth-hint">{line}</p>}
    </div>
  )
}
