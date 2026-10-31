import { useCallback, useEffect, useMemo, useState } from 'react'
import { Select } from '../../../../shared/components/Select'
import type { AltheriumSheetWithProfile, DiceRoll } from '../../../../shared/types'
import { sendMessage } from '../../../chat/services/chatService'
import { subscribeToRolls } from '../../../dice/services/diceService'
import { DOMAINS } from '../constants/altherium'
import {
  getAltheriumCampaignSagas,
  getCampaignAltheriumSheets,
  setAltheriumCampaignSagas,
  subscribeToCampaignAltheriumSheets,
  updateAltheriumSheet,
  type AltheriumSheetUpdate,
} from '../services/altheriumSheetService'
import {
  closeAltheriumRequest,
  createAltheriumRequest,
  listAltheriumAnswers,
  listOpenAltheriumRequests,
  subscribeToAltheriumRequests,
  type AltheriumRequest,
  type AltheriumRequestKind,
} from '../services/altheriumRequestService'
import { useAltheriumScene } from '../utils/useAltheriumScene'
import { cardsMax } from '../utils/altheriumCalculations'
import { addResource, readResources, readSagas, removeResource, resourceLabel, resourceTotal, RESOURCES, QUALITIES, formatAmount, type Quality, type ResourceId } from '../utils/altheriumCraft'
import { endScene, readCombatState } from '../utils/altheriumCombat'
import { LOCATIONS, cryptoRng, findLabel, locationDef, rollFind, rollRare, storeFind, type Find, type LocationId } from '../utils/altheriumExplore'
import { rest, type RestKind } from '../utils/altheriumRest'
import { HUNGER_MAX, TOKENS_MAX, readSurvival } from '../utils/altheriumSurvival'
import { enemyStateDef } from '../utils/altheriumStealth'
import { AltheriumSceneBar } from './AltheriumSceneBar'
import { Chips, Field, Pips, Toggle } from './AltheriumPlayKit'
import './AltheriumMaster.css'

// ────────────────────────────────────────────────────────
// Painel do mestre de Altherium (botão fixo do canto): escolhe quem recebe
// (todos ou personagem por personagem) e age direto nas fichas: pede testes
// (Furtividade, Equilíbrio ou qualquer domínio, com a DT já preenchida na
// ficha deles), dá Achados (recurso, Hacksilver ou sorteio na tabela do
// Local), faz o Descanso do grupo e ajusta Fichas, Fome, PV e Equilíbrio.
// Tudo que o livro já automatiza vem pronto: o mestre só escolhe e aplica.
// ────────────────────────────────────────────────────────

type Tab = 'testes' | 'achados' | 'descanso' | 'ajustes' | 'cena'

const d = (sides: number) => 1 + Math.floor(cryptoRng() * sides)
const nameOf = (s: AltheriumSheetWithProfile) => s.character_name?.trim() || s.profile?.display_name || 'Sem nome'
const num = (v: string, min: number, max: number, fallback: number) => {
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback
}

export function AltheriumMasterPanel({ campaignId }: { campaignId: string }) {
  const [sheets, setSheets] = useState<AltheriumSheetWithProfile[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)
  const [tab, setTab] = useState<Tab>('testes')
  const [log, setLog] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [scene] = useAltheriumScene(campaignId)

  const load = useCallback(async () => {
    try {
      const list = await getCampaignAltheriumSheets(campaignId)
      setSheets(list)
      // Na primeira carga, todos começam marcados.
      setSelected((prev) => (prev.size ? new Set([...prev].filter((id) => list.some((s) => s.id === id))) : new Set(list.map((s) => s.id))))
    } catch { /* a lista só fica vazia */ } finally { setLoaded(true) }
  }, [campaignId])

  useEffect(() => { void load() }, [load])
  useEffect(() => subscribeToCampaignAltheriumSheets(
    campaignId,
    (updated) => setSheets((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))),
    () => { void load() },
  ), [campaignId, load])

  const targets = useMemo(() => sheets.filter((s) => selected.has(s.id)), [sheets, selected])

  function toggle(id: string) {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  function say(text: string) {
    void sendMessage(campaignId, text).catch(() => { /* só não aparece no chat */ })
  }

  /** Aplica uma mudança em cada personagem marcado e conta como foi com cada um. */
  async function applyEach(fn: (s: AltheriumSheetWithProfile) => { patch: AltheriumSheetUpdate; line: string } | { line: string } | null) {
    if (busy || targets.length === 0) return
    setBusy(true)
    const lines: string[] = []
    for (const s of targets) {
      const r = fn(s)
      if (!r) continue
      if (!('patch' in r)) { lines.push(`${nameOf(s)}: ${r.line}`); continue }
      try {
        const updated = await updateAltheriumSheet(s.id, r.patch)
        setSheets((prev) => prev.map((x) => (x.id === s.id ? { ...x, ...updated } : x)))
        lines.push(`${nameOf(s)}: ${r.line}`)
      } catch {
        lines.push(`${nameOf(s)}: não deu para salvar.`)
      }
    }
    setLog(lines)
    setBusy(false)
  }

  return (
    <div className="alth-master">
      {/* Quem recebe */}
      <section className="alth-master__roster" aria-label="Personagens">
        <div className="alth-master__roster-head">
          <span className="alth-win__label">Quem recebe ({targets.length} de {sheets.length})</span>
          <span className="alth-master__roster-btns">
            <button type="button" className="alth-minibtn" onClick={() => setSelected(new Set(sheets.map((s) => s.id)))}>Todos</button>
            <button type="button" className="alth-minibtn" onClick={() => setSelected(new Set())}>Ninguém</button>
          </span>
        </div>
        {loaded && sheets.length === 0 && <p className="alth-hint">Nenhum jogador criou ficha de Altherium ainda.</p>}
        <ul className="alth-master__list">
          {sheets.map((s) => {
            const surv = readSurvival(s.survival)
            const rations = resourceTotal(readResources(s.resources), 'racao')
            const on = selected.has(s.id)
            return (
              <li key={s.id}>
                <button type="button" className={`alth-master__who${on ? ' alth-master__who--on' : ''}`} aria-pressed={on} onClick={() => toggle(s.id)}>
                  <span className="alth-master__name">{nameOf(s)}</span>
                  <span className="alth-master__stats">
                    <span title="Vitalidade">PV {s.vitality_current}/{s.vitality_max}</span>
                    <span title="Equilíbrio">PE {s.equilibrio_current}/{s.equilibrio_max}</span>
                    <span title="Fichas de Exploração"><Pips value={surv.tokens} max={TOKENS_MAX} label="Fichas" /></span>
                    {surv.hunger > 0 && <span className="alth-master__bad" title="Nível de Fome">Fome {Math.min(surv.hunger, HUNGER_MAX)}</span>}
                    <span title="Rações">Ração {rations ? formatAmount(rations) : '0'}</span>
                    {s.vitality_current === 0 && <span className="alth-master__bad">Caído</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="alth-master__main">
      <Chips<Tab>
        label="O que o mestre faz" value={tab} onChange={(t) => { setTab(t); setLog([]) }}
        options={[
          { id: 'testes', label: 'Pedir teste' },
          { id: 'achados', label: 'Achados' },
          { id: 'descanso', label: 'Descanso' },
          { id: 'ajustes', label: 'Ajustes' },
          { id: 'cena', label: 'Cena' },
        ]}
      />

      {tab === 'testes' && <RequestTab campaignId={campaignId} sheets={sheets} targets={targets} scene={scene} say={say} />}
      {tab === 'achados' && <LootTab campaignId={campaignId} targets={targets} sceneLocation={scene.location} busy={busy} applyEach={applyEach} say={say} />}
      {tab === 'descanso' && <RestTab targets={targets} busy={busy} applyEach={applyEach} say={say} />}
      {tab === 'ajustes' && <AdjustTab targets={targets} busy={busy} applyEach={applyEach} />}
      {tab === 'cena' && <AltheriumSceneBar campaignId={campaignId} />}

      {log.length > 0 && (
        <ul className="alth-master__log" role="status">
          {log.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      )}
      </div>
    </div>
  )
}

type Apply = (fn: (s: AltheriumSheetWithProfile) => { patch: AltheriumSheetUpdate; line: string } | { line: string } | null) => Promise<void>

// ── Pedir teste ──────────────────────────────────────────

function RequestTab({ campaignId, sheets, targets, scene, say }: {
  campaignId: string; sheets: AltheriumSheetWithProfile[]; targets: AltheriumSheetWithProfile[]
  scene: ReturnType<typeof useAltheriumScene>[0]; say: (t: string) => void
}) {
  const [kind, setKind] = useState<AltheriumRequestKind>('stealth')
  const [dt, setDt] = useState('')
  const [amount, setAmount] = useState('4')
  const [label, setLabel] = useState('Algo perturbador')
  const [domain, setDomain] = useState('percepcao')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [open, setOpen] = useState<AltheriumRequest[]>([])
  const [answers, setAnswers] = useState<DiceRoll[]>([])

  const refresh = useCallback(async () => {
    const list = await listOpenAltheriumRequests(campaignId)
    setOpen(list)
    setAnswers(await listAltheriumAnswers(campaignId, list.map((r) => r.id)))
  }, [campaignId])

  useEffect(() => {
    void refresh()
    const off = subscribeToAltheriumRequests(campaignId, () => { void refresh() })
    const offRolls = subscribeToRolls(campaignId, () => { void refresh() })
    return () => { off(); offRolls() }
  }, [campaignId, refresh])

  const stealthDt = scene.dts[scene.enemy]
  const domainLabel = DOMAINS.find((x) => x.id === domain)?.label ?? domain
  const dtValue = dt.trim() === '' ? (kind === 'stealth' ? stealthDt : null) : num(dt, 1, 40, 8)

  async function send() {
    if (sending || targets.length === 0) return
    const title = kind === 'stealth' ? 'Furtividade' : kind === 'equilibrium' ? (label.trim() || 'Algo perturbador') : `Teste de ${domainLabel}`
    if (kind !== 'stealth' && kind !== 'equilibrium' && dtValue == null) { setError('Escolha a DT.'); return }
    setSending(true); setError(null)
    try {
      await createAltheriumRequest({
        campaignId, targets: targets.map((t) => t.user_id), kind, domain: kind === 'domain' ? domain : null,
        label: title, dt: dtValue, amount: kind === 'equilibrium' ? num(amount, 0, 99, 0) : null,
      })
      say(`O mestre pediu: ${title}${dtValue ? ` (DT ${dtValue})` : ''} — ${targets.map(nameOf).join(', ')}. Abra a sua ficha e role.`)
      await refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível pedir o teste.') } finally { setSending(false) }
  }

  const byUser = new Map(sheets.map((s) => [s.user_id, nameOf(s)]))

  return (
    <div className="alth-master__tab">
      <Chips<AltheriumRequestKind>
        label="Tipo de pedido" value={kind} onChange={(k) => { setKind(k); setDt('') }}
        options={[
          { id: 'stealth', label: 'Furtividade', sub: `${enemyStateDef(scene.enemy).label} · DT ${stealthDt}` },
          { id: 'equilibrium', label: 'Equilíbrio', sub: 'algo perturbador' },
          { id: 'domain', label: 'Teste de domínio' },
        ]}
      />
      {kind === 'domain' && (
        <Field label="Domínio">
          <Select value={domain} onChange={setDomain} aria-label="Domínio"
            options={DOMAINS.map((x) => ({ value: x.id, label: x.label }))} />
        </Field>
      )}
      {kind === 'equilibrium' && (
        <div className="alth-win__pair">
          <Field label="O que acontece"><input className="input" maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
          <Field label="Perda" hint="Passou perde metade; falhou perde tudo."><input type="number" className="input" min={0} max={99} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        </div>
      )}
      <Field label="DT" hint={kind === 'stealth' ? `Vazio usa a DT do estado atual (${stealthDt}).` : undefined}>
        <input type="number" className="input alth-master__dt" min={1} max={40} inputMode="numeric" value={dt} onChange={(e) => setDt(e.target.value)} placeholder={kind === 'stealth' ? String(stealthDt) : 'Ex.: 8'} />
      </Field>
      {error && <p className="alth-test__note alth-test__note--warn" role="alert">{error}</p>}
      <button type="button" className="btn btn-primary" disabled={sending || targets.length === 0} onClick={() => void send()}>
        {targets.length === 0 ? 'Marque quem rola' : `Pedir a ${targets.length} ${targets.length === 1 ? 'personagem' : 'personagens'}`}
      </button>

      {open.length > 0 && <span className="alth-win__label">Pedidos abertos</span>}
      <ul className="alth-master__requests">
        {open.map((r) => (
          <li key={r.id} className="alth-master__request">
            <div className="alth-master__request-head">
              <strong>{r.label}{r.dt ? ` · DT ${r.dt}` : ''}</strong>
              <button type="button" className="alth-minibtn" onClick={() => void closeAltheriumRequest(r.id).then(refresh)}>Encerrar</button>
            </div>
            <ul className="alth-master__answers">
              {r.targets.map((uid) => {
                const roll = answers.find((a) => a.user_id === uid && (a.roll_context as { request_id?: string } | null)?.request_id === r.id)
                const ctx = roll?.roll_context as { outcome?: string; crit?: string | null } | null | undefined
                return (
                  <li key={uid} className={roll ? (ctx?.outcome === 'success' ? 'alth-master__ok' : ctx?.outcome === 'failure' ? 'alth-master__fail' : '') : 'alth-master__wait'}>
                    <span>{byUser.get(uid) ?? 'Jogador'}</span>
                    <b>{roll ? `${roll.total_result}${ctx?.crit ? ' · crítico' : ''}${ctx?.outcome === 'success' ? ' · passou' : ctx?.outcome === 'failure' ? ' · falhou' : ''}` : 'esperando…'}</b>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Achados ──────────────────────────────────────────────

function LootTab({ campaignId, targets, sceneLocation, busy, applyEach, say }: {
  campaignId: string; targets: AltheriumSheetWithProfile[]; sceneLocation: LocationId; busy: boolean; applyEach: Apply; say: (t: string) => void
}) {
  const [mode, setMode] = useState<'recurso' | 'moedas' | 'sortear'>('recurso')
  const [resId, setResId] = useState<ResourceId>('racao')
  const [quality, setQuality] = useState<Quality>('comum')
  const [pct, setPct] = useState(100)
  const [coins, setCoins] = useState('100')
  const [location, setLocation] = useState<LocationId>(sceneLocation)
  const [count, setCount] = useState(2)
  const [rare, setRare] = useState(false)
  const def = RESOURCES.find((r) => r.id === resId)!
  useEffect(() => { setLocation(sceneLocation) }, [sceneLocation])
  useEffect(() => { if (!def.fractions.includes(pct)) setPct(def.fractions[def.fractions.length - 1]) }, [def, pct])

  function giveResource(sign: 1 | -1) {
    void applyEach((s) => {
      if (!('resources' in s)) return { line: 'o banco ainda não guarda recursos (migration 20240217).' }
      const stock = readResources(s.resources)
      const q: Quality = def.noQuality ? 'comum' : quality
      if (sign < 0) return { patch: { resources: removeResource(stock, resId, q, pct) }, line: `−${pct}% de ${resourceLabel(resId).toLowerCase()}` }
      const r = addResource(stock, resId, q, pct)
      return { patch: { resources: r.stock }, line: `+${pct - r.overflow}% de ${resourceLabel(resId).toLowerCase()}${r.overflow ? ` (${r.overflow}% não coube)` : ''}` }
    })
    if (sign > 0) say(`O mestre deu ${pct}% de ${resourceLabel(resId).toLowerCase()}${def.noQuality ? '' : ` (${quality})`}: ${targets.map(nameOf).join(', ')}.`)
  }

  function giveCoins() {
    const n = num(coins, -99999, 99999, 0)
    if (!n) return
    void applyEach((s) => ({ patch: { hacksilvers: Math.max(0, s.hacksilvers + n) }, line: `${n > 0 ? '+' : '−'}¤${Math.abs(n)} (agora ¤${Math.max(0, s.hacksilvers + n)})` }))
    say(`O mestre ${n > 0 ? 'deu' : 'tirou'} ¤${Math.abs(n)}: ${targets.map(nameOf).join(', ')}.`)
  }

  async function roll() {
    let sagas = readSagas(await getAltheriumCampaignSagas(campaignId))
    const gains: string[] = []
    await applyEach((s) => {
      if (!('resources' in s)) return { line: 'o banco ainda não guarda recursos (migration 20240217).' }
      const finds: Find[] = Array.from({ length: count }, () => rollFind(location, undefined, sagas))
      if (rare) finds.push(rollRare(undefined, sagas))
      let bag = { stock: readResources(s.resources), hacksilvers: s.hacksilvers }
      const parts: string[] = []
      for (const f of finds) {
        const res = storeFind(f, bag)
        if (res.ok) { bag = res.bag; parts.push(res.text) } else parts.push(`${findLabel(f)}: ${res.text}`)
        if (f.kind === 'raro' && f.rare === 'saga' && f.saga && !sagas.includes(f.saga)) sagas = [...sagas, f.saga]
      }
      gains.push(`${nameOf(s)}: ${finds.map((f) => findLabel(f).toLowerCase()).join('; ')}`)
      return { patch: { resources: bag.stock, hacksilvers: bag.hacksilvers }, line: parts.join(' · ') || 'nada' }
    })
    void setAltheriumCampaignSagas(campaignId, sagas).catch(() => {})
    say(`Achados em ${locationDef(location).label.toLowerCase()}: ${gains.join(' | ')}`.slice(0, 1900))
  }

  return (
    <div className="alth-master__tab">
      <Chips<'recurso' | 'moedas' | 'sortear'>
        label="O que dar" value={mode} onChange={setMode}
        options={[{ id: 'recurso', label: 'Recurso ou Ração' }, { id: 'moedas', label: 'Hacksilvers' }, { id: 'sortear', label: 'Sortear no Local' }]}
      />

      {mode === 'recurso' && (
        <>
          <Field label="Recurso">
            <Select value={resId} onChange={(v) => setResId(v as ResourceId)} aria-label="Recurso" options={RESOURCES.map((r) => ({ value: r.id, label: r.label }))} />
          </Field>
          {!def.noQuality && <Field label="Qualidade"><Chips<Quality> label="Qualidade" value={quality} onChange={setQuality} options={QUALITIES.map((q) => ({ id: q.id, label: q.label }))} /></Field>}
          <Field label="Quantidade">
            <Chips<string> label="Quantidade" value={String(pct)} onChange={(v) => setPct(Number(v))} options={def.fractions.map((f) => ({ id: String(f), label: `${f}%` }))} />
          </Field>
          <div className="alth-test__actions">
            <button type="button" className="btn btn-ghost" disabled={busy || targets.length === 0} onClick={() => giveResource(-1)}>Tirar</button>
            <button type="button" className="btn btn-primary" disabled={busy || targets.length === 0} onClick={() => giveResource(1)}>Dar a {targets.length}</button>
          </div>
        </>
      )}

      {mode === 'moedas' && (
        <>
          <Field label="Hacksilvers (negativo tira)"><input type="number" className="input" value={coins} onChange={(e) => setCoins(e.target.value)} /></Field>
          <div className="alth-test__actions">
            <button type="button" className="btn btn-primary" disabled={busy || targets.length === 0} onClick={giveCoins}>Aplicar a {targets.length}</button>
          </div>
        </>
      )}

      {mode === 'sortear' && (
        <>
          <Field label="Local" hint="Cada personagem recebe o seu próprio sorteio, na tabela do livro.">
            <Chips<LocationId> label="Local" value={location} onChange={setLocation} options={LOCATIONS.map((l) => ({ id: l.id, label: l.label }))} />
          </Field>
          <Field label="Achados por personagem">
            <div className="alth-test__stepper">
              <button type="button" onClick={() => setCount(Math.max(0, count - 1))} disabled={count <= 0} aria-label="Menos um">−</button>
              <span className="alth-test__stepper-value">{count}</span>
              <button type="button" onClick={() => setCount(Math.min(4, count + 1))} disabled={count >= 4} aria-label="Mais um">+</button>
            </div>
          </Field>
          <Toggle on={rare} onChange={setRare} label="Mais 1 Achado Raro (Runa, Saga, material lendário ou Relíquia)" />
          <div className="alth-test__actions">
            <button type="button" className="btn btn-primary" disabled={busy || targets.length === 0 || (count === 0 && !rare)} onClick={() => void roll()}>Sortear para {targets.length}</button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Descanso ─────────────────────────────────────────────

function RestTab({ targets, busy, applyEach, say }: { targets: AltheriumSheetWithProfile[]; busy: boolean; applyEach: Apply; say: (t: string) => void }) {
  const [kind, setKind] = useState<RestKind>('longo')
  const [goodMeal, setGoodMeal] = useState(false)
  const [bad, setBad] = useState(false)
  const [interrupted, setInterrupted] = useState(false)

  function run() {
    void applyEach((s) => {
      const surv = readSurvival(s.survival)
      const stock = readResources(s.resources)
      const combat = readCombatState(s.combat_state)
      const r = rest({
        kind, raiz: s.raiz, genesis: s.genesis ?? '', espirito: s.attr_espirito, destino: s.attr_destino, runico: s.attr_runico,
        vitality: { current: s.vitality_current, max: s.vitality_max },
        equilibrio: { current: s.equilibrio_current, max: s.equilibrio_max },
        fv: { current: s.fv_current, max: s.fv_max ?? 10 }, pr: { current: s.pr_current, max: s.pr_max ?? 10 },
        cards: s.raiz === 'pilar' ? { current: s.cards_current, max: cardsMax(s) ?? 0 } : null,
        survival: surv, hasRation: resourceTotal(stock, 'racao') >= 100, goodMeal, badConditions: bad, interrupted,
        coma: combat.conditions.some((c) => c.id === 'coma'),
      }, d)
      if (!r.allowed) return { line: r.blocked ?? 'não pode descansar.' }
      let nextCombat = { ...combat, conditions: combat.conditions.filter((c) => !r.clearConditions.includes(c.id)) }
      nextCombat = endScene(nextCombat)
      const patch: AltheriumSheetUpdate = {
        vitality_current: r.vitality, equilibrio_current: r.equilibrio, fv_current: r.fv, pr_current: r.pr,
        ...(r.cards != null ? { cards_current: r.cards } : {}),
        ...('survival' in s ? { survival: r.survival } : {}),
        ...('resources' in s && r.consumesRation ? { resources: removeResource(stock, 'racao', 'comum', 100) } : {}),
        ...('combat_state' in s ? { combat_state: nextCombat } : {}),
      }
      const bits = [
        r.benefit === 'nenhum' ? 'interrompido' : r.benefit === 'longo' ? 'Longo completo' : 'só os benefícios de um Curto',
        `PV ${s.vitality_current}→${r.vitality}`,
        `PE ${s.equilibrio_current}→${r.equilibrio}`,
        `Fichas ${r.survival.tokens}`,
        ...(r.survival.hunger !== surv.hunger ? [`Fome ${surv.hunger}→${r.survival.hunger}`] : []),
        ...(r.consumesRation ? ['−1 Ração'] : []),
        ...r.warnings,
      ]
      return { patch, line: bits.join(' · ') }
    })
    say(`O grupo fez um Descanso ${kind === 'curto' ? 'Curto' : 'Longo'}${interrupted ? ' (interrompido)' : ''}: ${targets.map(nameOf).join(', ')}.`)
  }

  return (
    <div className="alth-master__tab">
      <Chips<RestKind>
        label="Tipo de descanso" value={kind} onChange={setKind}
        options={[{ id: 'curto', label: 'Descanso Curto', sub: 'até 2 entre Longos' }, { id: 'longo', label: 'Descanso Longo', sub: '1 Ração de cada um' }]}
      />
      {kind === 'longo' && (
        <>
          <Toggle on={goodMeal} onChange={setGoodMeal} label="Boa refeição antes (conta como Ração, ninguém gasta a sua)" />
          <Toggle on={bad} onChange={setBad} tone="bad" label="Frio extremo ou sem abrigo (só os benefícios do Curto)" />
        </>
      )}
      <Toggle on={interrupted} onChange={setInterrupted} tone="bad" label="Interrompido por combate (ninguém recupera; a Ração não se perde)" />
      <p className="alth-hint">Cada personagem usa os próprios dados: Vitalidade 1d8 + Espírito, Rúnico, Destino, Peregrino, Ração e Fome, tudo como no livro.</p>
      <div className="alth-test__actions">
        <button type="button" className="btn btn-primary" disabled={busy || targets.length === 0} onClick={run}>Descansar {targets.length}</button>
      </div>
    </div>
  )
}

// ── Ajustes ──────────────────────────────────────────────

function AdjustTab({ targets, busy, applyEach }: { targets: AltheriumSheetWithProfile[]; busy: boolean; applyEach: Apply }) {
  const [amount, setAmount] = useState('5')

  function tokens(delta: number) {
    void applyEach((s) => {
      if (!('survival' in s)) return { line: 'o banco ainda não guarda Fichas (migration 20240218).' }
      const v = readSurvival(s.survival)
      const next = Math.max(0, Math.min(TOKENS_MAX, v.tokens + delta))
      return { patch: { survival: { ...v, tokens: next } }, line: `Fichas de Exploração ${v.tokens} → ${next}` }
    })
  }
  function hunger(delta: number) {
    void applyEach((s) => {
      if (!('survival' in s)) return { line: 'o banco ainda não guarda a Fome (migration 20240218).' }
      const v = readSurvival(s.survival)
      const next = Math.max(0, Math.min(HUNGER_MAX + 1, v.hunger + delta))
      return { patch: { survival: { ...v, hunger: next } }, line: `Fome ${v.hunger} → ${next}${next > HUNGER_MAX ? ' (morte por fome)' : ''}` }
    })
  }
  function points(kind: 'pv' | 'pe', sign: 1 | -1) {
    const n = num(amount, 1, 999, 1) * sign
    void applyEach((s) => {
      const cur = kind === 'pv' ? s.vitality_current : s.equilibrio_current
      const max = kind === 'pv' ? s.vitality_max : s.equilibrio_max
      const next = Math.max(0, Math.min(max, cur + n))
      return { patch: kind === 'pv' ? { vitality_current: next } : { equilibrio_current: next }, line: `${kind === 'pv' ? 'PV' : 'Equilíbrio'} ${cur} → ${next}` }
    })
  }

  const off = busy || targets.length === 0
  return (
    <div className="alth-master__tab">
      <Field label="Fichas de Exploração">
        <div className="alth-master__row">
          <button type="button" className="alth-minibtn" disabled={off} onClick={() => tokens(-1)}>−1</button>
          <button type="button" className="alth-minibtn" disabled={off} onClick={() => tokens(1)}>+1</button>
          <button type="button" className="alth-minibtn" disabled={off} onClick={() => tokens(TOKENS_MAX)}>Encher</button>
          <button type="button" className="alth-minibtn alth-minibtn--out" disabled={off} onClick={() => tokens(-TOKENS_MAX)}>Zerar</button>
        </div>
      </Field>
      <Field label="Fome (−1 em todos os testes por nível)">
        <div className="alth-master__row">
          <button type="button" className="alth-minibtn alth-minibtn--out" disabled={off} onClick={() => hunger(1)}>+1 nível</button>
          <button type="button" className="alth-minibtn" disabled={off} onClick={() => hunger(-1)}>−1 nível</button>
          <button type="button" className="alth-minibtn" disabled={off} onClick={() => hunger(-9)}>Tirar a Fome</button>
        </div>
      </Field>
      <Field label="Pontos de vida e Equilíbrio">
        <div className="alth-master__row">
          <input type="number" className="input alth-master__dt" min={1} max={999} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Quantidade" />
          <button type="button" className="alth-minibtn alth-minibtn--out" disabled={off} onClick={() => points('pv', -1)}>Dano em PV</button>
          <button type="button" className="alth-minibtn" disabled={off} onClick={() => points('pv', 1)}>Curar PV</button>
          <button type="button" className="alth-minibtn alth-minibtn--out" disabled={off} onClick={() => points('pe', -1)}>Tirar Equilíbrio</button>
          <button type="button" className="alth-minibtn" disabled={off} onClick={() => points('pe', 1)}>Dar Equilíbrio</button>
        </div>
      </Field>
    </div>
  )
}
