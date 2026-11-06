import { useCallback, useEffect, useRef, useState } from 'react'
import { parseDiceFormula, recordRoll, rollParsedFormula } from '../../../dice/services/diceService'
import { formatRelativeTime, useRecentRolls } from '../../../dice/useRecentRolls'
import { getMyDiceSkin, onDiceSkinChange, peekMyDiceSkin, setMyDiceSkin } from '../../../dice3d/diceSkinService'
import { DEFAULT_SKIN, getSkin, skinsFor } from '../../../dice3d/skins'
import type { DiceShowcase } from '../../../dice3d/DiceShowcase'
import { useFeatureAccess } from '../../../control/siteFeatures'
import { useRollSkin } from '../../../dice3d/useRollSkin'
import { stageDiceFor } from '../../dnd/rolls/diceKinds'
import { freeContext, freeLabel, idleKindOf, readFree, resultsText, type FreeReading } from '../../dnd/rolls/freeRoll'
import { markRollBusy } from '../../dnd/rolls/rollActivity'
import { useDiceStage } from '../../dnd/rolls/useDiceStage'
import './AltheriumPlay.css'
import './AltheriumDiceCard.css'
import './AltheriumMotion.css'

// ────────────────────────────────────────────────────────
// O rolador de dados das campanhas de Altherium (a bolinha de dados): um
// painel largo, no visual plano da janela de teste. À esquerda o telão: o seu
// dado 3D, na skin que você escolheu, girando até você rolar — e é ali mesmo
// que os dados rolam e o total aparece. À direita os controles: dado,
// "como rolar" (normal, vantagem, desvantagem), fórmula e rolagem privada.
// Embaixo, as últimas rolagens da mesa. Não escurece o fundo.
// ────────────────────────────────────────────────────────

type Tab = 'roll' | 'skins'
type How = 'normal' | 'vant' | 'desv'

const DICE = [4, 6, 8, 10, 12, 20, 100] as const
const EXAMPLES = ['2d6+3', '2#d20', '2@d20', '1#d3+4']
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`)

/** O dado e o "como rolar" viram a fórmula: 1d20, 2#d20 (maior de dois) ou 2@d20 (menor de dois). */
function quickFormula(sides: number, how: How): string {
  return how === 'vant' ? `2#d${sides}` : how === 'desv' ? `2@d${sides}` : `1d${sides}`
}

interface Props {
  campaignId:    string
  currentUserId: string
  onClose:       () => void
}

export function AltheriumDiceCard({ campaignId, currentUserId, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('roll')
  const [sides, setSides] = useState<number>(20)
  const [how, setHow] = useState<How>('normal')
  const [text, setText] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [skin, setSkin] = useState(() => peekMyDiceSkin() ?? DEFAULT_SKIN)
  const [skinError, setSkinError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'rolling' | 'done'>('idle')
  const [done, setDone] = useState<{ reading: FreeReading; formula: string } | null>(null)
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

  // A fórmula escrita vale mais que o dado escolhido.
  const formula = text.trim() || quickFormula(sides, how)

  useEffect(() => {
    let alive = true
    void getMyDiceSkin().then((s) => { if (alive) setSkin(s) }).catch(() => { /* fica o padrão */ })
    const off = onDiceSkinChange((s) => { if (alive) setSkin(s) })
    return () => { alive = false; off() }
  }, [])

  // Antes de rolar: o dado girando no telão, na skin escolhida (o da fórmula, ou o do botão tocado).
  const idleKind = text.trim() ? idleKindOf(text) : (`d${sides}` as ReturnType<typeof idleKindOf>)
  useEffect(() => { if (stage && phase === 'idle') void stage.idle(idleKind, skin) }, [stage, phase, idleKind, skin])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && phase !== 'rolling') closeRef.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  async function pickSkin(id: string) {
    if (id === skin) return
    const before = skin
    setSkin(id)
    setSkinError(null)
    try { await setMyDiceSkin(id) } catch (err) { setSkin(before); setSkinError(err instanceof Error ? err.message : 'Não foi possível salvar.') }
  }

  const roll = useCallback(async () => {
    try { parseDiceFormula(formula) } catch (err) { setError(err instanceof Error ? err.message : 'Fórmula inválida.'); return }
    setError(null)
    setPhase('rolling')
    setDone(null)
    const release = markRollBusy()   // o lobo do crítico espera os dados pararem
    try {
      // o conjunto escolhido agora, lido na hora de rolar
      const useSkin = await rollSkin()
      const saved = await recordRoll(campaignId, rollParsedFormula(parseDiceFormula(formula)), isPrivate, {
        label: 'Rolagem livre', skin: useSkin, context: freeContext('', 'altherium'),
      })
      const reading = readFree(saved.roll_breakdown ?? [], saved.result)
      const dice = stageDiceFor(saved.roll_breakdown ?? [], useSkin)
      // o 3D baixa na primeira vez: se a pessoa rolou antes de ele ficar pronto, espera um pouco
      let st = stageNow.current
      for (let i = 0; i < 60 && !st && !simpleNow.current; i++) { await new Promise((r) => setTimeout(r, 75)); st = stageNow.current }
      if (st) await st.roll(dice, { skin: useSkin })
      else await new Promise<void>((resolve) => {
        const end = performance.now() + 900
        const tick = () => { if (performance.now() < end) { setSpin(1 + Math.floor(Math.random() * 20)); requestAnimationFrame(tick) } else { setSpin(reading.total); resolve() } }
        tick()
      })
      setDone({ reading, formula })
      setPhase('done')
      void reload(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível rolar.')
      setPhase(done ? 'done' : 'idle')
    } finally {
      release()
    }
  }, [formula, campaignId, isPrivate, rollSkin, reload, done])

  /** Mexer nos controles depois de rolar traz o dado girando de volta. */
  function touch() { if (phase === 'done') setPhase('idle') }

  const rolling = phase === 'rolling'
  const reading = done?.reading
  return (
    <div className="alth-dicehub">
      <div className="alth-dice" role="dialog" aria-label="Rolagem de dados">
        <header className="alth-dice__header">
          <h4 className="alth-dice__title">Rolagem de dados <small>rolagem livre</small></h4>
          <button type="button" className="alth-dice__close" onClick={onClose} disabled={rolling} aria-label="Fechar">×</button>
        </header>

        <div className="alth-dice__main">
          <div className="alth-dice__telao" aria-live="polite">
            <div ref={stageRef} className="alth-dice__canvas" data-insets="22,50" data-margin="2" data-xbox="0.99" data-fit="0.4" aria-hidden="true" />
            {simple && <span className="alth-dice__simple" aria-hidden="true">{spin ?? idleKind}</span>}
            <span className="alth-dice__skin">Seu dado: {getSkin(skin).name}</span>
            {phase === 'idle' && <span className="alth-dice__hint">{tab === 'skins' ? 'Escolha o seu conjunto de dados' : 'O dado gira até você rolar'}</span>}
            {rolling && <span className="alth-dice__hint">Rolando…</span>}
            {phase === 'done' && reading && (
              <div className="alth-dice__result" role="status">
                <span className="alth-dice__total">{reading.total}</span>
                <span className="alth-dice__sum">
                  {freeLabel(done.formula)}
                  {' · '}
                  {reading.groups.map((g, i) => (
                    <span key={`${g.notation}${i}`} title={resultsText(g)}>
                      {i > 0 ? ' + ' : ''}[{resultsText(g)}]{g.keep ? ` fica ${g.subtotal}` : ''}
                    </span>
                  ))}
                  {reading.modifier !== 0 && ` ${signed(reading.modifier)}`}
                </span>
              </div>
            )}
          </div>

          <div className="alth-dice__ctl">
            <div className="alth-dice__tabs" role="tablist" aria-label="Seções do rolador">
              {([['roll', 'Rolagem'], ['skins', 'Meus dados']] as const).map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} className={`alth-dice__tab${tab === id ? ' is-on' : ''}`} onClick={() => setTab(id)}>{label}</button>
              ))}
            </div>

            {tab === 'roll' ? (
              <>
                <div className="alth-dice__group">
                  <span className="alth-dice__label">Rolagem rápida</span>
                  <div className="alth-dice__chips">
                    {DICE.map((d) => (
                      <button key={d} type="button" className={`alth-dice__chip${!text.trim() && sides === d ? ' is-on' : ''}`} disabled={rolling}
                        aria-pressed={!text.trim() && sides === d} onClick={() => { setSides(d); setText(''); touch() }}>
                        d{d}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="alth-dice__group">
                  <span className="alth-dice__label">Como rolar</span>
                  <div className="alth-dice__seg" role="group" aria-label="Como rolar">
                    {([['normal', 'Normal'], ['vant', 'Vantagem'], ['desv', 'Desvantagem']] as const).map(([id, label]) => (
                      <button key={id} type="button" className={how === id ? 'is-on' : ''} disabled={rolling || !!text.trim()}
                        title={id === 'vant' ? 'Rola 2 dados e fica o maior (2#dX)' : id === 'desv' ? 'Rola 2 dados e fica o menor (2@dX)' : undefined}
                        onClick={() => { setHow(id); touch() }}>{label}</button>
                    ))}
                  </div>
                </div>

                <div className="alth-dice__group">
                  <label className="alth-dice__label" htmlFor="alth-dice-formula">Fórmula</label>
                  <div className="alth-dice__formula">
                    <input
                      id="alth-dice-formula" type="text" className="input" value={text} maxLength={80} placeholder="2d6+3"
                      disabled={rolling}
                      onChange={(e) => { setText(e.target.value); setError(null); touch() }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !rolling) void roll() }}
                    />
                    <button type="button" className="btn btn-primary alth-dice__go" onClick={() => void roll()} disabled={rolling}>
                      {rolling ? 'Rolando…' : phase === 'done' ? 'Rolar de novo' : 'Rolar'}
                    </button>
                  </div>
                  {text.trim() === '' && <span className="alth-dice__note">Vai rolar {freeLabel(formula)}. Ou escreva uma fórmula.</span>}
                  {text.trim() === '' && (
                    <span className="alth-dice__examples">
                      {EXAMPLES.map((ex) => <button key={ex} type="button" onClick={() => { setText(ex); touch() }}>{ex}</button>)}
                    </span>
                  )}
                  {error && <span className="alth-test__note alth-test__note--warn" role="alert">{error}</span>}
                </div>

                <label className="alth-bill__line alth-switch">
                  <span title="Só você e o mestre veem a rolagem.">Rolagem privada</span>
                  <input type="checkbox" className="alth-switch__input" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
                  <span className="alth-switch__track" aria-hidden="true" />
                </label>
              </>
            ) : (
              <SkinList skin={skin} error={skinError} onPick={(id) => void pickSkin(id)} />
            )}
          </div>
        </div>

        <footer className="alth-dice__recent">
          <span className="alth-dice__label">Recentes</span>
          <div className="alth-dice__rcards">
            {!histLoading && history.length === 0 && <span className="alth-dice__note">Ninguém rolou ainda.</span>}
            {history.map((r) => (
              <span key={r.id} className={`alth-dice__rcard${r.user_id === currentUserId ? ' is-own' : ''}`}
                title={`${r.user_id === currentUserId ? 'Você' : r.profile?.display_name ?? 'Usuário removido'} · ${formatRelativeTime(r.created_at)}${r.is_private ? ' · privada' : ''}`}>
                <strong>{r.result}</strong>
                <small>{r.formula ?? r.die_type}</small>
              </span>
            ))}
          </div>
          <button type="button" className="alth-test__link" onClick={() => void reload(true)}>Atualizar</button>
        </footer>
      </div>
    </div>
  )
}

// ── Meus dados: a lista dos conjuntos (o telão mostra o escolhido, girando) ──

function SkinList({ skin, error, onPick }: { skin: string; error: string | null; onPick: (id: string) => void }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const pedestals = useRef(new Map<string, HTMLElement>())
  const showcase = useRef<DiceShowcase | null>(null)
  const [simple, setSimple] = useState(false)
  // os de todos e os exclusivos liberados para esta conta
  const skins = skinsFor(useFeatureAccess())
  const skinKey = skins.map((k) => k.id).join(',')

  // Os dados de verdade: um canvas só sobre a lista, com um d20 de cada conjunto girando no lugar do marcador.
  useEffect(() => {
    let alive = true
    let made: DiceShowcase | null = null
    void Promise.all([import('../../../dice3d/DiceStage'), import('../../../dice3d/DiceShowcase')]).then(([stageMod, showMod]) => {
      if (!alive || !hostRef.current) return
      if (!stageMod.diceStageSupported()) { setSimple(true); return }
      try {
        made = new showMod.DiceShowcase(hostRef.current)
        showcase.current = made
        const items = skinKey.split(',').flatMap((id) => { const el = pedestals.current.get(id); return el ? [{ id, el }] : [] })
        void made.show(items)
      } catch { setSimple(true) }
    }).catch(() => { if (alive) setSimple(true) })
    return () => { alive = false; showcase.current = null; made?.dispose() }
  }, [skinKey])

  const hover = (id: string | null) => showcase.current?.setHover(id)

  return (
    <div className="alth-dice__skins" ref={hostRef}>
      <p className="alth-dice__note">É com o conjunto escolhido que os seus dados rolam, e é assim que os outros jogadores os veem. O dado do telão já mostra a sua escolha.</p>
      <ul className="alth-dice__skinlist" role="radiogroup" aria-label="Conjuntos de dados">
        {skins.map((k) => (
          <li key={k.id}>
            <button type="button" role="radio" aria-checked={skin === k.id} className={`alth-dice__skin-row${skin === k.id ? ' is-on' : ''}`} onClick={() => onPick(k.id)}
              onMouseEnter={() => hover(k.id)} onMouseLeave={() => hover(null)} onFocus={() => hover(k.id)} onBlur={() => hover(null)}>
              <span className="alth-dice__skin-die" ref={(el) => { if (el) pedestals.current.set(k.id, el); else pedestals.current.delete(k.id) }}>
                {simple && (
                  <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
                    <polygon points="20,3 35,11 35,29 20,37 5,29 5,11" fill={k.body} stroke={k.bodyEdge} strokeWidth="2" />
                    <text x="20" y="25" textAnchor="middle" fontSize="10" fontWeight="700" fill={k.ink} fontFamily="Georgia, serif">20</text>
                  </svg>
                )}
              </span>
              <span className="alth-dice__skin-name">{k.name}</span>
              {k.exclusive && <span className="alth-dice__tag">Exclusivo</span>}
              <span className="alth-dice__skin-state">{skin === k.id ? 'Em uso' : 'Usar'}</span>
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="alth-test__note alth-test__note--warn" role="alert">{error}</p>}
    </div>
  )
}
