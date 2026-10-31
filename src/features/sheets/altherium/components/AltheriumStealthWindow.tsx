import { useState, type ReactNode } from 'react'
import type { AltheriumScene } from '../services/altheriumSceneService'
import {
  DISTRACTION_TEXT,
  ENEMY_STATES,
  STEALTH_MODS,
  SURPRISE_TEXT,
  coolState,
  enemyStateDef,
  stealthDice,
  stealthOutcome,
  type EnemyState,
} from '../utils/altheriumStealth'
import { AltheriumTestModal, type AfterCtx, type AltheriumTestSpec } from './AltheriumTestModal'
import type { DomainCheck } from './AltheriumCombatPanel'
import { Chips, Col, Cols, Field, FormulaEditor, Icon, NO_MANUAL, Toggle, Win, toManual, type ManualState } from './AltheriumPlayKit'
import { testPool } from '../utils/altheriumTest'

// ────────────────────────────────────────────────────────
// Janela de Furtividade (livro 2.0, "Furtividade"): o estado dos inimigos
// vem da cena do mestre e define a DT. O teste de Furtividade + Impulso só
// acontece quando a situação muda (aproximar, atravessar área aberta, fazer
// barulho). O resultado diz como fica o estado, e quem testou aplica na
// cena com um toque: falhar sobe o estado pro grupo todo.
// ────────────────────────────────────────────────────────

interface Props {
  campaignId: string
  sheetId:    string
  character:  string
  check:      () => DomainCheck
  scene:      AltheriumScene
  onScene:    (patch: Partial<AltheriumScene>) => Promise<void>
  /** Armadura de 8 DB ou mais, Escudo Pesado ou arma pesada equipada. */
  heavyGear:  boolean
  announce:   (text: string) => void
  onClose:    () => void
  nav?:       ReactNode
}

export function AltheriumStealthWindow({ campaignId, sheetId, character, check, scene, onScene, heavyGear, announce, onClose, nav }: Props) {
  const [state, setState] = useState<EnemyState>(scene.enemy)
  const [mods, setMods] = useState<Set<string>>(() => new Set(heavyGear ? ['peso'] : []))
  const [spec, setSpec] = useState<AltheriumTestSpec | null>(null)
  const [mode, setMode] = useState<'teste' | 'distrair'>('teste')
  const [note, setNote] = useState<string | null>(null)
  const [man, setMan] = useState<ManualState>(NO_MANUAL)
  const [dtText, setDtText] = useState('')

  const stateDt = scene.dts[state]
  const dt = dtText.trim() === '' ? stateDt : Math.max(1, Math.min(40, Math.trunc(Number(dtText)) || stateDt))
  const dice = stealthDice(mods)
  const base = check()
  const autoPool = testPool({ baseDice: base.baseDice, disadvantage: !!base.disadvantage, situational: dice })

  function toggle(id: string, on: boolean) {
    setMods((prev) => {
      const next = new Set(prev)
      const def = STEALTH_MODS.find((m) => m.id === id)
      if (on) {
        // Duas opções do mesmo grupo (luz, ritmo) se excluem.
        for (const m of STEALTH_MODS) if (m.group && m.group === def?.group) next.delete(m.id)
        next.add(id)
      } else next.delete(id)
      return next
    })
  }

  function start() {
    setSpec({
      ...base,
      title: 'Furtividade',
      diceMods: dice !== 0 ? [{ label: 'Situação', value: dice }] : [],
      manual: toManual(man),
      targetLabel: `DT (${enemyStateDef(state).label})`, initialTarget: dt, critSucceeds: true,
      words: ['passou despercebido', 'foi notado'],
      notes: ['O teste só acontece quando a situação muda: ao se aproximar, atravessar uma área aberta ou fazer barulho.'],
    })
  }

  async function cool() {
    const next = coolState(scene.enemy, scene.wasAlert)
    if (next === scene.enemy) { setNote('Já está no estado mais baixo possível nesta cena.'); return }
    await onScene({ enemy: next })
    setState(next)
    setNote(`Esfriou: os inimigos agora estão ${enemyStateDef(next).label}.`)
    announce(`${character} e o grupo passaram cerca de 3 turnos sem ser notados: os inimigos esfriaram para ${enemyStateDef(next).label}.`)
  }

  if (spec) {
    return (
      <AltheriumTestModal
        campaignId={campaignId} sheetId={sheetId} character={character} spec={spec} onClose={onClose} autoRoll noAgain
        after={(ctx) => <StealthResult ctx={ctx} state={state} scene={scene} onScene={onScene} announce={announce} character={character} />}
      />
    )
  }

  return (
    <Win title="Furtividade" wide nav={nav} subtitle={<>Inimigos: <strong>{enemyStateDef(scene.enemy).label}</strong></>} onClose={onClose}>
      <Chips<'teste' | 'distrair'>
        label="O que vai fazer" value={mode} onChange={setMode}
        options={[{ id: 'teste', label: 'Mover-se sem ser visto' }, { id: 'distrair', label: 'Distração' }]}
      />

      {mode === 'distrair' ? (
        <>
          <p className="alth-test__note">{DISTRACTION_TEXT}</p>
          <p className="alth-hint">Alcance do arremesso: Fúria × 2 metros.</p>
          <div className="alth-test__actions">
            <button type="button" className="btn btn-primary" onClick={() => { announce(`${character} arremessou um objeto para fazer barulho: o próximo teste de Furtividade de quem está longe do barulho recebe +1 dado.`); setNote('Distração anunciada no chat.') }}>
              Anunciar a Distração
            </button>
          </div>
          {note && <p className="alth-hint">{note}</p>}
        </>
      ) : (
        <>
          <Cols>
          <Col>
          <Field label="Estado dos inimigos" hint={`${enemyStateDef(state).meaning} O mestre sempre anuncia o estado.`}>
            <Chips<EnemyState>
              label="Estado" value={state} onChange={(id) => { setState(id); setDtText('') }}
              options={ENEMY_STATES.map((s) => ({ id: s.id, label: s.label, sub: `DT ${scene.dts[s.id]}` }))}
            />
            <label className="alth-win__inline">DT deste teste
              <input type="number" className="input alth-win__dtinput" min={1} max={40} inputMode="numeric" value={dtText}
                onChange={(e) => setDtText(e.target.value)} placeholder={String(stateDt)} aria-label="DT do teste" />
            </label>
          </Field>

          <details className="alth-win__details">
            <summary>Ataque Surpresa e Esfriar</summary>
            <p className="alth-hint">{SURPRISE_TEXT}</p>
            <p className="alth-hint">Esfriar: se o grupo passar cerca de 3 turnos sem ser notado, o inimigo desce um estado. Um Alerta volta a Atento, mas nunca a Desatento na mesma cena.</p>
            <button type="button" className="btn btn-ghost" onClick={() => void cool()}>Esfriar a cena</button>
            {note && <p className="alth-hint">{note}</p>}
          </details>
          </Col>
          <Col>
          <Field label="Situação" hint="No máximo 2 dados a mais ou a menos no total.">
            <div className="alth-toggles">
              {STEALTH_MODS.map((m) => (
                <Toggle
                  key={m.id} on={mods.has(m.id)} onChange={(on) => toggle(m.id, on)}
                  label={m.label} delta={`${m.delta > 0 ? '+' : '−'}1 dado`} tone={m.delta > 0 ? 'good' : 'bad'} hint={m.hint}
                />
              ))}
            </div>
          </Field>

          </Col>
          </Cols>

          <FormulaEditor
            dice={autoPool.count} keep={autoPool.keep} bonus={base.attribute + base.flat.reduce((sum, m) => sum + m.value, 0)}
            value={man} onChange={setMan}
            note={`${base.domainLabel} + ${base.attributeLabel} · contra DT ${dt} (${enemyStateDef(state).label})`}
          />


          <div className="alth-test__actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="button" className="btn btn-primary alth-win__go" onClick={start}><Icon name="stealth" /> Testar Furtividade</button>
          </div>
        </>
      )}
    </Win>
  )
}

export function StealthResult({ ctx, state, scene, onScene, announce, character }: {
  ctx: AfterCtx; state: EnemyState; scene: AltheriumScene
  onScene: (patch: Partial<AltheriumScene>) => Promise<void>
  announce: (text: string) => void; character: string
}) {
  const [applied, setApplied] = useState<string | null>(null)
  const dt = ctx.target ?? scene.dts[state]
  const out = stealthOutcome(ctx.reading.total, dt, ctx.reading.crit, state)
  const changes = out.next !== scene.enemy

  async function apply() {
    await onScene({ enemy: out.next, wasAlert: scene.wasAlert || out.next === 'alerta' })
    setApplied(`A cena agora está em ${enemyStateDef(out.next).label}.`)
    announce(`${character}: ${out.label}. Os inimigos agora estão ${enemyStateDef(out.next).label}.`)
  }

  return (
    <div className="alth-finds">
      <p className={`alth-finds__verdict alth-finds__verdict--${out.result}`} role="status">{out.label}</p>
      <p className="alth-test__note">{out.text}</p>
      {changes && !applied && (
        <div className="alth-test__actions alth-test__actions--start">
          <button type="button" className="btn btn-primary" onClick={() => void apply()}>
            Subir a cena para {enemyStateDef(out.next).label}
          </button>
        </div>
      )}
      {applied && <p className="alth-hint">{applied}</p>}
      {out.result === 'descoberto' && <p className="alth-hint">Faça a Iniciativa: o combate começa, sem Surpresa.</p>}
      {out.result === 'perfeita' && <p className="alth-hint">Marque “Sombra Perfeita” no seu próximo teste de Furtividade.</p>}
    </div>
  )
}
