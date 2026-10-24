import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Presence } from '../../../../shared/components/Presence'
import type { DiceRoll, DiceRollContext } from '../../../../shared/types'
import { parseDiceFormula, recordRoll, rollParsedFormula, type RollExtras, type RollResult } from '../../../dice/services/diceService'
import { getMyDiceSkin, onDiceSkinChange } from '../../../dice3d/diceSkinService'
import { DEFAULT_SKIN } from '../../../dice3d/skins'
import { supabase } from '../../../../shared/lib/supabase'
import { listOpenCheckRequests, listRequestAnswers, revealCheckDc, subscribeToCheckRequests, type DndCheckRequest } from '../services/dndCheckService'
import { dismiss, isDismissed, onPendingOpen, sheetListening, specFromRequest, takePending } from './checkRequests'
import type { SheetCtx } from '../components/sheetContext'
import type { CheckSpec } from './checkModel'
import { DndCheckPanel, type CheckDone } from './DndCheckPanel'
import { DndWatchFreePanel } from './DndWatchFreePanel'
import { createPortal } from 'react-dom'

// ────────────────────────────────────────────────────────
// Liga as rolagens à ficha: `check` abre o painel de teste (d20 com CD e
// bônus) e `roll` abre o cartão de rolagem (a mesma moldura, com dano e os
// outros dados rolando no palco). Tudo é gravado em
// dice_rolls com rótulo, contexto e o conjunto de dados de quem rolou, e a
// mesa vê pelo histórico. Sem permissão de editar (ficha de outra pessoa),
// `canRoll` fica false e os botões de rolar não aparecem.
// ────────────────────────────────────────────────────────

export interface DndRollApi {
  canRoll: boolean
  /** Abre o painel de teste. `onResult` recebe o resultado (ex.: aplicar a salvaguarda contra a morte). */
  check:   (spec: CheckSpec, opts?: { onResult?: (done: CheckDone) => void }) => void
  /** Rola a fórmula no cartão de rolagem (dano, dado de vida...). Devolve a rolagem gravada (ou null se deu erro). */
  roll:    (label: string, formula: string, context?: Partial<DiceRollContext>) => Promise<DiceRoll | null>
}

const NOOP: DndRollApi = { canRoll: false, check: () => {}, roll: async () => null }
const RollContext = createContext<DndRollApi>(NOOP)

export const useDndRoll = (): DndRollApi => useContext(RollContext)

export function DndRollProvider({ ctx, children }: { ctx: SheetCtx; children: ReactNode }) {
  const [skin, setSkin] = useState(DEFAULT_SKIN)
  const [open, setOpen] = useState<{ id: number; spec: CheckSpec; onResult?: (d: CheckDone) => void; requestId?: string } | null>(null)
  const openRef = useRef(open)
  openRef.current = open
  const answered = useRef(new Set<string>())
  const derivedRef = useRef(ctx.derived)
  derivedRef.current = ctx.derived
  // o painel continua na tela durante a animação de saída
  const lastOpen = useRef(open)
  if (open) lastOpen.current = open
  const [card, setCard] = useState<DiceRoll | null>(null)
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
        setCard(saved)
        return saved
      } catch (err) {
        report(err instanceof Error ? err.message : 'Não foi possível rolar.')
        return null
      }
    },
  }), [canRoll, campaignId, sheetId, character, skin, report])

  const closeCard = useCallback(() => setCard(null), [])

  // ── Pedidos de teste do mestre: na própria ficha do jogador, o painel abre sozinho ──
  const ownerId = ctx.sheet.user_id
  const isNpc = ctx.sheet.is_npc
  useEffect(() => {
    if (!canRoll || isNpc) return
    let alive = true
    let me: string | null = null
    const stopListening = sheetListening()

    const openRequest = (req: DndCheckRequest) => {
      if (!alive || openRef.current) return
      setOpen({ id: ++trayId.current, spec: specFromRequest(req, derivedRef.current), requestId: req.id, onResult: () => { answered.current.add(req.id) } })
    }
    const consider = async (req: DndCheckRequest, force = false) => {
      if (!me || req.status !== 'open' || !req.targets.includes(me) || answered.current.has(req.id)) return
      if (!force && isDismissed(req.id)) return
      const answers = await listRequestAnswers(campaignId, [req.id])
      if (answers.some((a) => a.user_id === me)) { answered.current.add(req.id); return }
      openRequest(req)
    }

    void supabase.auth.getUser().then(async ({ data }) => {
      me = data.user?.id ?? null
      if (!alive || me !== ownerId) return
      const list = await listOpenCheckRequests(campaignId)
      const wanted = takePending()
      const first = (wanted && list.find((r) => r.id === wanted)) || list.find((r) => !isDismissed(r.id))
      if (first) void consider(first, first.id === wanted)
    }).catch(() => {})

    const unsub = subscribeToCheckRequests(campaignId, (req) => { if (me === ownerId) void consider(req) })
    const unsubPending = onPendingOpen((id) => {
      takePending()
      void listOpenCheckRequests(campaignId).then((list) => { const r = list.find((x) => x.id === id); if (r) void consider(r, true) })
    })
    return () => { alive = false; stopListening(); unsub(); unsubPending() }
  }, [canRoll, isNpc, campaignId, ownerId])

  const closePanel = useCallback(() => {
    const cur = openRef.current
    if (cur?.requestId && !answered.current.has(cur.requestId)) dismiss(cur.requestId)
    setOpen(null)
  }, [])

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
              onResult={lastOpen.current.onResult} onClose={closePanel}
            />
          )}</Presence>
          {/* no body: dentro da ficha (que mede a própria largura) o position: fixed ficaria preso a ela */}
          {card && createPortal(<DndWatchFreePanel key={card.id} roll={card} player={character} hurry={false} mine onDone={closeCard} />, document.body)}
        </>
      )}
    </RollContext.Provider>
  )
}
