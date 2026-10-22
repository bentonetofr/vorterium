import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Presence } from '../../../../shared/components/Presence'
import type { DiceRoll, DiceRollContext } from '../../../../shared/types'
import { parseDiceFormula, recordRoll, rollParsedFormula, type RollExtras, type RollResult } from '../../../dice/services/diceService'
import { getMyDiceSkin, onDiceSkinChange } from '../../../dice3d/diceSkinService'
import { DEFAULT_SKIN } from '../../../dice3d/skins'
import { revealCheckDc } from '../services/dndCheckService'
import type { SheetCtx } from '../components/sheetContext'
import type { CheckSpec } from './checkModel'
import { DndCheckPanel, type CheckDone } from './DndCheckPanel'
import { DndDiceTray, type TrayJob } from './DndDiceTray'

// ────────────────────────────────────────────────────────
// Liga as rolagens à ficha: `check` abre o painel de teste (d20 com CD e
// bônus) e `roll` joga dano e outros dados na bandeja. Tudo é gravado em
// dice_rolls com rótulo, contexto e o conjunto de dados de quem rolou, e a
// mesa vê pelo histórico. Sem permissão de editar (ficha de outra pessoa),
// `canRoll` fica false e os botões de rolar não aparecem.
// ────────────────────────────────────────────────────────

export interface DndRollApi {
  canRoll: boolean
  /** Abre o painel de teste. `onResult` recebe o resultado (ex.: aplicar a salvaguarda contra a morte). */
  check:   (spec: CheckSpec, opts?: { onResult?: (done: CheckDone) => void }) => void
  /** Joga a fórmula na bandeja (dano, dado de vida...). Devolve a rolagem gravada (ou null se deu erro). */
  roll:    (label: string, formula: string, context?: Partial<DiceRollContext>) => Promise<DiceRoll | null>
}

const NOOP: DndRollApi = { canRoll: false, check: () => {}, roll: async () => null }
const RollContext = createContext<DndRollApi>(NOOP)

export const useDndRoll = (): DndRollApi => useContext(RollContext)

export function DndRollProvider({ ctx, children }: { ctx: SheetCtx; children: ReactNode }) {
  const [skin, setSkin] = useState(DEFAULT_SKIN)
  const [open, setOpen] = useState<{ id: number; spec: CheckSpec; onResult?: (d: CheckDone) => void } | null>(null)
  // o painel continua na tela durante a animação de saída
  const lastOpen = useRef(open)
  if (open) lastOpen.current = open
  const [tray, setTray] = useState<TrayJob | null>(null)
  const trayId = useRef(0)
  const canRoll = !ctx.readOnly && !!ctx.campaignId
  const character = ctx.form.character_name.trim() || 'Personagem'

  useEffect(() => {
    if (!canRoll) return
    void getMyDiceSkin().then(setSkin).catch(() => {})
    return onDiceSkinChange(setSkin)
  }, [canRoll])

  const report = ctx.report
  const campaignId = ctx.campaignId
  const sheetId = ctx.sheet.id

  const perform = useCallback(async (formula: string, build: (rolled: RollResult) => RollExtras) => {
    const rolled = rollParsedFormula(parseDiceFormula(formula), { floor: false })
    return recordRoll(campaignId, rolled, false, build(rolled))
  }, [campaignId])

  const api = useMemo<DndRollApi>(() => ({
    canRoll,
    check: (spec, opts) => { if (canRoll) setOpen({ id: ++trayId.current, spec, onResult: opts?.onResult }) },
    roll: async (label, formula, context) => {
      if (!canRoll) return null
      try {
        const rolled = rollParsedFormula(parseDiceFormula(formula))
        const saved = await recordRoll(campaignId, rolled, false, {
          label, skin, context: { system: 'dnd5e', sheet_id: sheetId, character, ...context },
        })
        setTray({ id: ++trayId.current, label, roll: saved, skin })
        return saved
      } catch (err) {
        report(err instanceof Error ? err.message : 'Não foi possível rolar.')
        return null
      }
    },
  }), [canRoll, campaignId, sheetId, character, skin, report])

  const closeTray = useCallback(() => setTray(null), [])

  return (
    <RollContext.Provider value={api}>
      {children}
      {canRoll && (
        <>
          <Presence show={!!open}>{() => lastOpen.current && (
            <DndCheckPanel
              key={lastOpen.current.id}
              spec={lastOpen.current.spec} character={character} sheetId={sheetId} skin={skin} perform={perform} revealDc={revealCheckDc}
              inspiration={{ has: ctx.form.inspiration, spend: () => ctx.set('inspiration', false) }}
              onResult={lastOpen.current.onResult} onClose={() => setOpen(null)}
            />
          )}</Presence>
          <DndDiceTray job={tray} onDone={closeTray} />
        </>
      )}
    </RollContext.Provider>
  )
}
