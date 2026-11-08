import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  userId: 'u1' as string | null,
  unlocks: [] as { skin_id: string }[],
  rolls: [] as Record<string, unknown>[],
  total: 0,
  rpc: [] as { name: string; args: Record<string, string> }[],
  rpcResult: true as boolean,
}))

vi.mock('../../shared/lib/supabase', () => {
  const query = (result: unknown) => {
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'limit']) q[m] = () => q
    q.then = (res: (v: unknown) => unknown) => res(result)
    return q
  }
  return {
    uniqueChannel: (b: string) => b,
    supabase: {
      auth: { getSession: async () => ({ data: { session: db.userId ? { user: { id: db.userId } } : null } }) },
      from: (table: string) => ({
        select: (_cols: string, opts?: { head?: boolean }) => {
          if (table === 'dice_skin_unlocks') return query({ data: db.unlocks, error: null })
          return opts?.head ? query({ count: db.total, error: null }) : query({ data: [...db.rolls].reverse(), error: null })
        },
      }),
      rpc: async (name: string, args: Record<string, string>) => { db.rpc.push({ name, args }); return { data: db.rpcResult, error: null } },
    },
  }
})

import { markForcedRoll } from '../owner/ownerTools'
import { noteRoll, onUnlock, resetCollection, type UnlockEvent } from './collectionService'
import type { DiceRoll } from '../../shared/types'

let n = 0
function d20(v: number, over: Partial<DiceRoll> = {}): DiceRoll {
  n += 1
  return {
    id: `roll-${n}`, campaign_id: 'c1', user_id: 'u1', die_type: 'd20', result: v, quantity: 1, modifier: 0, individual_results: [v], total_result: v,
    roll_mode: 'sum', kept_result: null, formula: '1d20', is_private: false, created_at: new Date(2026, 10, 1, 12, 0, n).toISOString(),
    roll_breakdown: [{ type: 'sum', notation: '1d20', quantity: 1, sides: 20, results: [v], subtotal: v }], ...over,
  } as DiceRoll
}
const lite = (r: DiceRoll) => ({ id: r.id, campaign_id: r.campaign_id, die_type: r.die_type, result: r.result, individual_results: r.individual_results, roll_breakdown: r.roll_breakdown, roll_context: r.roll_context ?? null, roll_label: null, created_at: r.created_at })

// o teste roda sem navegador: um localStorage falso em memória (o dono marca as rolagens forçadas nele)
const store = new Map<string, string>()
vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) }, removeItem: (k: string) => { store.delete(k) }, clear: () => store.clear() })

beforeEach(() => {
  resetCollection()
  db.userId = 'u1'; db.unlocks = []; db.rolls = []; db.total = 0; db.rpc = []; db.rpcResult = true
  localStorage.clear()
})

describe('coleção: conferir as conquistas a cada rolagem', () => {
  it('na décima rolagem concede o osso, avisa uma vez e não repete', async () => {
    const earlier = Array.from({ length: 9 }, (_, i) => d20(2 + (i % 7)))
    db.rolls = earlier.map(lite); db.total = 9
    const events: UnlockEvent[] = []
    onUnlock((e) => events.push(e))
    const tenth = d20(7)
    db.rolls.push(lite(tenth)); db.total = 10          // o banco já tem a rolagem nova quando a conta é lida
    await noteRoll(tenth)
    expect(db.rpc).toEqual([{ name: 'unlock_dice_skin', args: { p_skin: 'osso', p_achievement: 'osso-do-oficio' } }])
    expect(events.map((e) => e.skin)).toEqual(['osso'])
    await noteRoll(d20(9))
    expect(db.rpc).toHaveLength(1)
    expect(events).toHaveLength(1)
  })

  it('o que a conta já tem não é concedido de novo', async () => {
    db.unlocks = [{ skin_id: 'osso' }]
    db.rolls = Array.from({ length: 12 }, (_, i) => lite(d20(2 + (i % 7)))); db.total = 12
    await noteRoll(d20(11))
    expect(db.rpc).toEqual([])
  })

  it('um resultado forte concede a argila; rolagem forçada pelo dono não conta', async () => {
    const forced = d20(20)
    markForcedRoll(forced.id)
    db.rolls = [lite(forced)]; db.total = 1
    await noteRoll(forced)
    expect(db.rpc).toEqual([])
    const real = d20(20)
    db.rolls.push(lite(real)); db.total = 2
    await noteRoll(real)
    expect(db.rpc.map((c) => c.args.p_skin)).toEqual(['argila'])
  })

  it('já era da conta (outro aparelho ganhou primeiro): atualiza sem avisar', async () => {
    db.rpcResult = false
    const one = d20(20)
    db.rolls = [lite(one)]; db.total = 1
    const events: UnlockEvent[] = []
    onUnlock((e) => events.push(e))
    await noteRoll(one)
    expect(db.rpc).toHaveLength(1)
    expect(events).toEqual([])
  })

  it('rolagem de outra conta ou sem login não faz nada', async () => {
    db.rolls = [lite(d20(20))]; db.total = 1
    await noteRoll(d20(20, { user_id: 'outro' }))
    db.userId = null
    await noteRoll(d20(20))
    expect(db.rpc).toEqual([])
  })
})
