import { useCallback, useEffect, useRef, useState } from 'react'
import { parseDiceFormula, recordRoll, rollParsedFormula } from '../../../dice/services/diceService'
import { formatRelativeTime, useRecentRolls } from '../../../dice/useRecentRolls'
import { useRollSkin } from '../../../dice3d/useRollSkin'
import { stageDiceFor } from '../../dnd/rolls/diceKinds'
import { freeLabel, idleKindOf, readFree, resultsText, type FreeReading } from '../../dnd/rolls/freeRoll'
import { markRollBusy } from '../../dnd/rolls/rollActivity'
import { useDiceStage } from '../../dnd/rolls/useDiceStage'
import { DH_HOPE_SKIN } from '../../../dice3d/skins'
import { TRAIT_INFO } from '../catalog/rules'
import { experienceMod, hopeSlots, spellcastTrait, traitValue } from '../model/derive'
import { dualityEffects, dualityLabel, type DualityResult } from '../model/dice'
import type { DhSheetData, DhTrait } from '../model/types'
import { DH_TRAITS } from '../model/types'
import { getMyDhSheet, saveDhSheet, type DhSheet } from '../services/dhSheetService'
import { rollDualityStaged } from '../services/dhRolls'
import './DhDiceCard.css'

// ────────────────────────────────────────────────────────
// O rolador de dados das campanhas de DaggerHeart (a bolinha de dados): painel largo, com o telão 3D à esquerda
// (os dois d12 de Dualidade, Esperança dourado e Medo roxo, rolam ali) e os controles à direita. Com ficha, os atributos
// e as Experiências entram sozinhos no modificador, e a Esperança gasta e ganha vai direto para a ficha.
// ────────────────────────────────────────────────────────

type Tab = 'duality' | 'free'
const DICE = [4, 6, 8, 10, 12, 20] as const
const EXAMPLES = ['2d8+3', '3d6+2', '1d20', '1d12+4']
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`)

interface Props {
  campaignId: string
  currentUserId: string
  onClose: () => void
}

/** Os dois dados de uma rolagem de Dualidade gravada, para os cartões de "recentes". */
function dualityOf(roll: { roll_context?: { system?: string } | null; formula?: string | null; roll_breakdown?: unknown; roll_label?: string | null; result: number }) {
  if (roll.roll_context?.system !== 'daggerheart' || roll.formula !== '2d12') return null
  const t = (roll.roll_breakdown as { results?: number[] }[] | null)?.[0]
  if (!t?.results || t.results.length < 2) return null
  const m = roll.roll_label?.match(/= (-?\d+) ·/)
  return { hope: t.results[0], fear: t.results[1], total: m ? Number(m[1]) : roll.result }
}

export function DhDiceCard({ campaignId, currentUserId, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('duality')
  const [sheet, setSheet] = useState<DhSheet | null>(null)
  const [trait, setTrait] = useState<DhTrait | 'conjuracao' | null>(null)
  const [exps, setExps] = useState<string[]>([])
  const [extra, setExtra] = useState(0)
  const [adv, setAdv] = useState<'vantagem' | 'desvantagem' | null>(null)
  const [diff, setDiff] = useState('')
  const [d20, setD20] = useState(false)
  const [reaction, setReaction] = useState(false)
  const [sides, setSides] = useState<number>(20)
  const [text, setText] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'rolling' | 'done'>('idle')
  const [result, setResult] = useState<DualityResult | null>(null)
  const [free, setFree] = useState<{ reading: FreeReading; formula: string } | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [spin, setSpin] = useState<number | null>(null)

  const stageRef = useRef<HTMLDivElement>(null)
  const { stage, simple } = useDiceStage(stageRef, 'wide')
  const stageNow = useRef(stage)
  stageNow.current = stage
  const simpleNow = useRef(simple)
  simpleNow.current = simple
  const rollSkin = useRollSkin()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const { history, loading: histLoading, reload } = useRecentRolls(campaignId, currentUserId, 3)

  // a ficha de quem joga (o mestre não tem: o painel segue com o modificador à mão)
  useEffect(() => {
    let alive = true
    void getMyDhSheet(campaignId).then((s) => { if (alive && s?.data.classKey) setSheet(s) }).catch(() => {})
    return () => { alive = false }
  }, [campaignId])

  const data: DhSheetData | null = sheet?.data ?? null
  const spell = data ? spellcastTrait(data) : null
  const traitMod = data && trait ? (trait === 'conjuracao' ? (spell ? traitValue(data, spell) : 0) : traitValue(data, trait)) : 0
  const traitName = trait === 'conjuracao' ? 'Conjuração' : trait ? TRAIT_INFO[trait].label : null
  const expTotal = data ? exps.reduce((n, id) => n + experienceMod(data, id), 0) : 0
  const modifier = traitMod + expTotal + extra
  const hopeLeft = data ? data.hope - exps.length : 0

  const idleKind = tab === 'free' ? idleKindOf(text.trim() || `d${sides}`) : 'd12'
  useEffect(() => { if (stage && phase === 'idle') void stage.idle(idleKind, DH_HOPE_SKIN) }, [stage, phase, idleKind])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && phase !== 'rolling') closeRef.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  const play = useCallback(async (dice: Parameters<NonNullable<typeof stage>['roll']>[0], skin: string, last: number) => {
    // o 3D baixa na primeira vez: se a pessoa rolou antes de ele ficar pronto, espera um pouco
    let st = stageNow.current
    for (let i = 0; i < 60 && !st && !simpleNow.current; i++) { await new Promise((r) => setTimeout(r, 75)); st = stageNow.current }
    if (st) { await st.roll(dice, { skin }); return }
    await new Promise<void>((resolve) => {
      const end = performance.now() + 900
      const tick = () => { if (performance.now() < end) { setSpin(1 + Math.floor(Math.random() * 12)); requestAnimationFrame(tick) } else { setSpin(last); resolve() } }
      tick()
    })
  }, [])

  async function rollDuality() {
    setError(null); setNote(null); setPhase('rolling'); setResult(null); setFree(null)
    const release = markRollBusy()
    try {
      const names = data ? exps.map((id) => data.experiences.find((e) => e.id === id)?.name).filter(Boolean) : []
      const d = diff.trim() === '' ? null : Number(diff)
      const staged = await rollDualityStaged({
        campaignId, sheetId: sheet?.id ?? null, character: data?.name.trim() ?? '',
        label: `${traitName ?? 'Dualidade'}${names.length ? ` (${names.join(', ')})` : ''}`,
        modifier, advantage: adv, hopeSides: d20 ? 20 : 12, reaction, difficulty: d !== null && Number.isFinite(d) ? d : null,
      })
      await play(staged.dice, staged.skin, staged.result.hope)
      setResult(staged.result)
      setPhase('done')
      void reload(true)
      // a ficha: gasta a Esperança das Experiências e recebe o que o resultado dá (teste de reação não dá nada)
      if (sheet) {
        const fx = reaction ? { hope: 0, clearStress: 0, gmFear: 0 } : dualityEffects(staged.result)
        try {
          const fresh = (await getMyDhSheet(campaignId)) ?? sheet
          const dd = fresh.data
          const next: DhSheetData = { ...dd, hope: Math.max(0, Math.min(hopeSlots(dd), dd.hope - exps.length + fx.hope)), stressMarked: Math.max(0, dd.stressMarked - fx.clearStress) }
          if (next.hope !== dd.hope || next.stressMarked !== dd.stressMarked) setSheet(await saveDhSheet(fresh.id, next))
          const bits = [
            exps.length ? `−${exps.length} Esperança (Experiências)` : '',
            fx.hope ? '+1 Esperança' : '',
            fx.clearStress ? '−1 Fadiga (crítico)' : '',
            fx.gmFear ? 'O mestre ganha 1 Medo (já somado no contador)' : '',
          ].filter(Boolean)
          setNote(bits.length ? bits.join(' · ') : null)
        } catch { setNote('Não deu para atualizar a ficha: ajuste a Esperança à mão.') }
        setExps([])
      } else if (!reaction) {
        const fx = dualityEffects(staged.result)
        setNote(fx.hope ? 'Você ganha 1 Ponto de Esperança.' : 'O mestre ganha 1 Ponto de Medo.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível rolar.')
      setPhase(result ? 'done' : 'idle')
    } finally { release() }
  }

  const formula = text.trim() || `1d${sides}`
  async function rollFree() {
    try { parseDiceFormula(formula) } catch (err) { setError(err instanceof Error ? err.message : 'Fórmula inválida.'); return }
    setError(null); setNote(null); setPhase('rolling'); setFree(null); setResult(null)
    const release = markRollBusy()
    try {
      const skin = await rollSkin()
      const saved = await recordRoll(campaignId, rollParsedFormula(parseDiceFormula(formula)), isPrivate, {
        label: 'Rolagem livre', skin, context: { system: 'daggerheart', kind: 'custom', key: 'free' },
      })
      const reading = readFree(saved.roll_breakdown ?? [], saved.result)
      await play(stageDiceFor(saved.roll_breakdown ?? [], skin), skin, reading.total)
      setFree({ reading, formula })
      setPhase('done')
      void reload(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível rolar.')
      setPhase('idle')
    } finally { release() }
  }

  const touch = () => { if (phase === 'done') setPhase('idle') }
  const rolling = phase === 'rolling'
  const diceLine = `2d12${modifier ? signed(modifier) : ''}`

  return (
    <div className="dhd-hub">
      <div className="dhd" role="dialog" aria-label="Rolagem de dados">
        <header className="dhd__header">
          <h4 className="dhd__title"><span className="dhd__dots" aria-hidden="true"><i className="is-hope" /><i className="is-fear" /></span>Dados de Dualidade</h4>
          <button type="button" className="dhd__close" onClick={onClose} disabled={rolling} aria-label="Fechar">×</button>
        </header>

        <div className="dhd__main">
          <div className="dhd__telao" aria-live="polite">
            <div ref={stageRef} className="dhd__canvas" data-insets="22,50" data-margin="2" data-xbox="0.99" data-fit="0.4" aria-hidden="true" />
            {simple && <span className="dhd__simple" aria-hidden="true">{spin ?? '2d12'}</span>}
            <span className="dhd__legend" aria-hidden="true"><i className="is-hope" />Esperança<i className="is-fear" />Medo</span>
            {phase === 'idle' && <span className="dhd__hint">{tab === 'duality' ? 'Role os dois d12: o maior diz quem se move' : 'Escolha o dado e role'}</span>}
            {rolling && <span className="dhd__hint">Rolando…</span>}
            {phase === 'done' && result && (
              <div className={`dhd__result dhd__result--${result.kind}`} role="status">
                <span className="dhd__total">{result.total}</span>
                <span className="dhd__what">
                  <b>{dualityLabel(result)}</b>
                  <small><i className="is-hope">{result.hope}</i> + <i className="is-fear">{result.fear}</i>{result.advantageDie > 0 ? ` ${result.advantage === 'vantagem' ? '+' : '−'} ${result.advantageDie}` : ''}{result.modifier ? ` ${signed(result.modifier)}` : ''}{result.difficulty != null ? ` · Dif. ${result.difficulty}` : ''}</small>
                </span>
              </div>
            )}
            {phase === 'done' && free && (
              <div className="dhd__result" role="status">
                <span className="dhd__total">{free.reading.total}</span>
                <span className="dhd__what"><b>{freeLabel(free.formula)}</b>
                  <small>{free.reading.groups.map((g, i) => <span key={`${g.notation}${i}`}>{i > 0 ? ' + ' : ''}[{resultsText(g)}]</span>)}{free.reading.modifier !== 0 && ` ${signed(free.reading.modifier)}`}</small>
                </span>
              </div>
            )}
          </div>

          <div className="dhd__ctl">
            <div className="dhd__tabs" role="tablist" aria-label="Seções do rolador">
              {([['duality', 'Dualidade'], ['free', 'Outros dados']] as const).map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} className={`dhd__tab${tab === id ? ' is-on' : ''}`} onClick={() => { setTab(id); touch() }}>{label}</button>
              ))}
            </div>

            {tab === 'duality' ? (
              <>
                {data && (
                  <div className="dhd__group">
                    <span className="dhd__label">Atributo <small>Esperança {hopeLeft}/{hopeSlots(data)}</small></span>
                    <div className="dhd__chips">
                      {DH_TRAITS.map((t) => (
                        <button key={t} type="button" className={`dhd__chip${trait === t ? ' is-on' : ''}`} disabled={rolling} aria-pressed={trait === t} onClick={() => { setTrait(trait === t ? null : t); touch() }}>
                          {TRAIT_INFO[t].label} <b>{signed(traitValue(data, t))}</b>
                        </button>
                      ))}
                      {spell && <button type="button" className={`dhd__chip${trait === 'conjuracao' ? ' is-on' : ''}`} disabled={rolling} onClick={() => { setTrait(trait === 'conjuracao' ? null : 'conjuracao'); touch() }}>Conjuração <b>{signed(traitValue(data, spell))}</b></button>}
                    </div>
                  </div>
                )}

                {data && data.experiences.length > 0 && (
                  <div className="dhd__group">
                    <span className="dhd__label">Experiências <small>1 Esperança cada</small></span>
                    <div className="dhd__chips">
                      {data.experiences.map((e) => {
                        const on = exps.includes(e.id)
                        return (
                          <button key={e.id} type="button" className={`dhd__chip${on ? ' is-on' : ''}`} disabled={rolling || (!on && hopeLeft <= 0)} aria-pressed={on}
                            onClick={() => { setExps(on ? exps.filter((x) => x !== e.id) : [...exps, e.id]); touch() }}>
                            {e.name || 'Sem nome'} <b>{signed(experienceMod(data, e.id))}</b>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="dhd__group">
                  <span className="dhd__label">Como rolar</span>
                  <div className="dhd__seg" role="group" aria-label="Vantagem ou desvantagem">
                    {([[null, 'Normal'], ['vantagem', 'Vantagem'], ['desvantagem', 'Desvantagem']] as const).map(([id, label]) => (
                      <button key={label} type="button" className={adv === id ? 'is-on' : ''} disabled={rolling} onClick={() => { setAdv(id); touch() }}>{label}</button>
                    ))}
                  </div>
                </div>

                <div className="dhd__row">
                  <label className="dhd__num">{data ? 'Bônus extra' : 'Modificador'}
                    <span className="dhd__step">
                      <button type="button" onClick={() => { setExtra((n) => Math.max(-9, n - 1)); touch() }} aria-label="Diminuir">−</button>
                      <output>{signed(extra)}</output>
                      <button type="button" onClick={() => { setExtra((n) => Math.min(20, n + 1)); touch() }} aria-label="Aumentar">+</button>
                    </span>
                  </label>
                  <label className="dhd__num">Dificuldade
                    <input type="number" inputMode="numeric" value={diff} placeholder="—" disabled={rolling} onChange={(e) => setDiff(e.target.value)} />
                  </label>
                </div>

                <div className="dhd__row dhd__row--checks">
                  <label><input type="checkbox" checked={d20} onChange={(e) => setD20(e.target.checked)} /> Esperança em d20</label>
                  <label><input type="checkbox" checked={reaction} onChange={(e) => setReaction(e.target.checked)} /> Teste de reação</label>
                </div>

                <button type="button" className="btn btn-primary dhd__go" onClick={() => void rollDuality()} disabled={rolling}>
                  {rolling ? 'Rolando…' : phase === 'done' && result ? `Rolar de novo (${diceLine})` : `Rolar ${diceLine}`}
                </button>
                {note && <p className="dhd__note dhd__note--fx" role="status">{note}</p>}
                {error && <p className="dhd__note dhd__note--warn" role="alert">{error}</p>}
                {!data && <p className="dhd__note">Sem ficha de DaggerHeart aqui: some o atributo no modificador e anote a Esperança à mão.</p>}
              </>
            ) : (
              <>
                <div className="dhd__group">
                  <span className="dhd__label">Rolagem rápida</span>
                  <div className="dhd__chips">
                    {DICE.map((d) => (
                      <button key={d} type="button" className={`dhd__chip${!text.trim() && sides === d ? ' is-on' : ''}`} disabled={rolling} onClick={() => { setSides(d); setText(''); touch() }}>d{d}</button>
                    ))}
                  </div>
                </div>
                <div className="dhd__group">
                  <label className="dhd__label" htmlFor="dhd-formula">Fórmula</label>
                  <div className="dhd__formula">
                    <input id="dhd-formula" type="text" className="input" value={text} maxLength={80} placeholder="2d8+3" disabled={rolling}
                      onChange={(e) => { setText(e.target.value); setError(null); touch() }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !rolling) void rollFree() }} />
                    <button type="button" className="btn btn-primary dhd__gofree" onClick={() => void rollFree()} disabled={rolling}>{rolling ? 'Rolando…' : 'Rolar'}</button>
                  </div>
                  {text.trim() === '' && <span className="dhd__note">Vai rolar {freeLabel(formula)}. Ou escreva uma fórmula (dano é a Proficiência em dados: 2d8+3).</span>}
                  {text.trim() === '' && <span className="dhd__examples">{EXAMPLES.map((ex) => <button key={ex} type="button" onClick={() => { setText(ex); touch() }}>{ex}</button>)}</span>}
                  {error && <p className="dhd__note dhd__note--warn" role="alert">{error}</p>}
                </div>
                <label className="dhd__row dhd__row--checks"><span><input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} /> Rolagem privada (só você e o mestre veem)</span></label>
              </>
            )}
          </div>
        </div>

        <footer className="dhd__recent">
          <span className="dhd__label">Recentes</span>
          <div className="dhd__rcards">
            {!histLoading && history.length === 0 && <span className="dhd__note">Ninguém rolou ainda.</span>}
            {history.map((r) => {
              const dd = dualityOf(r)
              return (
                <span key={r.id} className={`dhd__rcard${r.user_id === currentUserId ? ' is-own' : ''}`}
                  title={`${r.user_id === currentUserId ? 'Você' : r.profile?.display_name ?? 'Usuário removido'} · ${formatRelativeTime(r.created_at)}${r.roll_label ? ` · ${r.roll_label}` : ''}${r.is_private ? ' · privada' : ''}`}>
                  <strong>{dd ? dd.total : r.result}</strong>
                  {dd ? <small className="dhd__pair"><i className="is-hope">{dd.hope}</i><i className="is-fear">{dd.fear}</i></small> : <small>{r.formula ?? r.die_type}</small>}
                </span>
              )
            })}
          </div>
          <button type="button" className="dhd__link" onClick={() => void reload(true)}>Atualizar</button>
        </footer>
      </div>
    </div>
  )
}
