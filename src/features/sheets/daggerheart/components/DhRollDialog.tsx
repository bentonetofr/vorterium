import { useEffect, useMemo, useRef, useState } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import { damageFormula, experienceMod, flatDamageBonus, hopeSlots, proficiency } from '../model/derive'
import { dualityEffects, dualityLabel, type DualityResult } from '../model/dice'
import type { DhDamageType, DhSheetData } from '../model/types'
import { rollDamage, rollDualityStaged, type DamageResult, type DhRollTarget } from '../services/dhRolls'
import { useDiceStage } from '../../dnd/rolls/useDiceStage'
import { DH_HOPE_SKIN } from '../../../dice3d/skins'
import type { StageDie } from '../../../dice3d/DiceStage'
import { signed } from './DhUi'

// ────────────────────────────────────────────────────────
// Janela de teste: Dados de Dualidade com os modificadores do livro (atributo, Experiências que gastam Esperança,
// vantagem ou desvantagem, bônus) e, se for um ataque, a rolagem de dano com a Proficiência (crítico = valor máximo dos dados + rolagem).
// O resultado já aplica a Esperança ganha e a Fadiga limpa pelo crítico (teste de reação não gera nada).
// ────────────────────────────────────────────────────────

export interface RollSpec {
  title: string
  /** Texto do histórico da mesa. */
  label: string
  /** Soma fixa (atributo + bônus da arma). */
  modifier: number
  /** De onde vem o modificador, para mostrar. */
  parts: { name: string; value: number }[]
  attack?: { weaponName: string; dice: string; damageType: DhDamageType }
}

interface Props {
  spec: RollSpec
  data: DhSheetData
  update: (fn: (d: DhSheetData) => DhSheetData) => void
  target: DhRollTarget
  onClose: () => void
}

export function DhRollDialog({ spec, data, update, target, onClose }: Props) {
  const [used, setUsed] = useState<string[]>([])
  const [adv, setAdv] = useState<'vantagem' | 'desvantagem' | null>(null)
  const [extra, setExtra] = useState(0)
  const [difficulty, setDifficulty] = useState('')
  const [reaction, setReaction] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<DualityResult | null>(null)
  const [damage, setDamage] = useState<DamageResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hopeD20, setHopeD20] = useState(false)
  const [spin, setSpin] = useState<number | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const { stage, simple } = useDiceStage(stageRef, 'stage')
  useEffect(() => { if (stage && !busy && !result) void stage.idle('d12', DH_HOPE_SKIN) }, [stage, busy, result])

  /** Anima os dados no palco 3D (ou, sem WebGL, um número girando) e só então mostra o resultado. */
  async function play(dice: StageDie[], skin: string, last: number) {
    if (stage) { await stage.roll(dice, { skin }); return }
    await new Promise<void>((resolve) => {
      const end = performance.now() + 900
      const tick = () => { if (performance.now() < end) { setSpin(1 + Math.floor(Math.random() * 12)); requestAnimationFrame(tick) } else { setSpin(last); resolve() } }
      tick()
    })
  }

  const hopeLeft = data.hope - used.length
  const expTotal = useMemo(() => used.reduce((n, id) => n + experienceMod(data, id), 0), [used, data])
  const modifier = spec.modifier + expTotal + extra
  const diff = difficulty.trim() === '' ? null : Number(difficulty)

  function toggleExp(id: string) {
    setUsed((u) => (u.includes(id) ? u.filter((x) => x !== id) : data.hope - u.length > 0 ? [...u, id] : u))
  }

  async function roll() {
    setBusy(true)
    setError(null)
    setDamage(null)
    try {
      const names = used.map((id) => data.experiences.find((e) => e.id === id)?.name).filter(Boolean)
      setResult(null)
      const staged = await rollDualityStaged({
        ...target,
        label: `${spec.label}${names.length ? ` (${names.join(', ')})` : ''}`,
        modifier,
        difficulty: diff !== null && Number.isFinite(diff) ? diff : null,
        advantage: adv,
        hopeSides: hopeD20 ? 20 : 12,
        reaction,
      })
      await play(staged.dice, staged.skin, staged.result.hope)
      const res = staged.result
      setResult(res)
      const fx = reaction ? { hope: 0, clearStress: 0, gmFear: 0 } : dualityEffects(res)
      update((d) => ({
        ...d,
        hope: Math.max(0, Math.min(hopeSlots(d), d.hope - used.length + fx.hope)),
        stressMarked: Math.max(0, d.stressMarked - fx.clearStress),
      }))
      setUsed([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível rolar.')
    } finally {
      setBusy(false)
    }
  }

  async function rollAttackDamage() {
    if (!spec.attack || !result) return
    setBusy(true)
    setError(null)
    try {
      const dmg = await rollDamage({
        ...target,
        label: `Dano: ${spec.attack.weaponName}`,
        dice: spec.attack.dice,
        proficiency: proficiency(data),
        extra: flatDamageBonus(data, spec.attack.damageType),
        critical: result.kind === 'critico',
      })
      await play(dmg.stage, dmg.skin, dmg.total)
      setDamage(dmg)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível rolar o dano.')
    } finally {
      setBusy(false)
    }
  }

  const fx = result && !reaction ? dualityEffects(result) : null
  const hit = result ? (result.success === null ? true : result.success) : false

  return (
    <ModalOverlay onClose={onClose} closeDisabled={busy}>
      <div className="dh-dialog dh-roll" role="dialog" aria-modal="true" aria-label={spec.title}>
        <header className="dh-dialog__head">
          <h3>{spec.title}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </header>

        <p className="dh-roll__sum">
          2d12 {spec.parts.map((p) => `${signed(p.value)} ${p.name}`).join(' ')} {expTotal ? `${signed(expTotal)} Experiências` : ''} {extra ? `${signed(extra)} bônus` : ''}
          <strong> = 2d12{modifier ? signed(modifier) : ''}</strong>
        </p>

        {data.experiences.length > 0 && (
          <fieldset className="dh-roll__exps">
            <legend>Experiências (1 Esperança cada · você tem {hopeLeft})</legend>
            {data.experiences.map((e) => (
              <label key={e.id} className={used.includes(e.id) ? 'is-on' : ''}>
                <input type="checkbox" checked={used.includes(e.id)} onChange={() => toggleExp(e.id)} disabled={!used.includes(e.id) && hopeLeft <= 0} />
                {e.name || 'Sem nome'} <b>{signed(experienceMod(data, e.id))}</b>
              </label>
            ))}
          </fieldset>
        )}

        <div className="dh-roll__opts">
          <span className="dh-seg" role="group" aria-label="Vantagem ou desvantagem">
            <button type="button" className={adv === 'vantagem' ? 'is-on' : ''} onClick={() => setAdv(adv === 'vantagem' ? null : 'vantagem')}>Vantagem</button>
            <button type="button" className={adv === 'desvantagem' ? 'is-on' : ''} onClick={() => setAdv(adv === 'desvantagem' ? null : 'desvantagem')}>Desvantagem</button>
          </span>
          <label>Bônus
            <input type="number" value={extra} onChange={(e) => setExtra(Number(e.target.value) || 0)} />
          </label>
          <label>Dificuldade
            <input type="number" value={difficulty} placeholder="—" onChange={(e) => setDifficulty(e.target.value)} />
          </label>
          <label className="dh-check"><input type="checkbox" checked={hopeD20} onChange={(e) => setHopeD20(e.target.checked)} /> Esperança em d20</label>
          <label className="dh-check"><input type="checkbox" checked={reaction} onChange={(e) => setReaction(e.target.checked)} /> Teste de reação</label>
        </div>

        <button type="button" className="dh-roll__stage" onClick={() => { if (!busy) void roll() }} disabled={busy} aria-label="Rolar os Dados de Dualidade">
          <div ref={stageRef} className="dh-roll__canvas" aria-hidden="true" />
          {simple && <span className="dh-roll__simple" aria-hidden="true">{spin ?? '2d12'}</span>}
          {!busy && !result && <span className="dh-roll__hint">Clique nos dados para rolar</span>}
          <span className="dh-roll__legend" aria-hidden="true"><i className="is-hope" />Esperança<i className="is-fear" />Medo</span>
        </button>

        {error && <p className="sheet-feedback sheet-feedback--error" role="alert">{error}</p>}

        {result && (
          <div className={`dh-result dh-result--${result.kind}`} role="status">
            <div className="dh-result__dice">
              <span className="dh-die dh-die--hope" title="Dado de Esperança">{result.hope}</span>
              <span className="dh-die dh-die--fear" title="Dado de Medo">{result.fear}</span>
              {result.advantageDie > 0 && <span className="dh-die dh-die--adv" title={result.advantage ?? ''}>{result.advantage === 'vantagem' ? '+' : '−'}{result.advantageDie}</span>}
            </div>
            <div className="dh-result__total">{result.total}</div>
            <div className="dh-result__label">{dualityLabel(result)}</div>
            {fx && (
              <p className="dh-result__fx">
                {fx.hope > 0 && 'Você ganha 1 Ponto de Esperança. '}
                {fx.clearStress > 0 && 'Sucesso crítico: você recupera 1 Ponto de Fadiga. '}
                {fx.gmFear > 0 && 'O mestre ganha 1 Ponto de Medo.'}
              </p>
            )}
            {reaction && <p className="dh-result__fx">Teste de reação: não gera Esperança nem Medo.</p>}
          </div>
        )}

        {spec.attack && result && hit && (
          <div className="dh-roll__damage">
            <button type="button" className="btn" onClick={() => void rollAttackDamage()} disabled={busy}>
              Rolar o dano ({damageFormula(spec.attack.dice, proficiency(data))}{flatDamageBonus(data, spec.attack.damageType) ? signed(flatDamageBonus(data, spec.attack.damageType)) : ''}{result.kind === 'critico' ? ', crítico' : ''})
            </button>
            {damage && <p className="dh-roll__dmg">Dano: <strong>{damage.total}</strong> <small>({damage.formula})</small></p>}
          </div>
        )}
      </div>
    </ModalOverlay>
  )
}
