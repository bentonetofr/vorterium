import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => ({ calls: [] as string[], result: { data: null as unknown, error: null as unknown } }))
vi.mock('../../../shared/lib/supabase', () => ({
  supabase: { rpc: async (name: string) => { rpc.calls.push(name); return rpc.result } },
}))

import { parseLiveSession, refreshLiveSession, resetLiveSessions, useLiveSession } from './liveSession'

beforeEach(() => { resetLiveSessions(); rpc.calls = []; rpc.result = { data: null, error: null } })

describe('estado da sessão da campanha', () => {
  it('lê o que o banco devolve: aberta por horário, aberta por mesa reunida ou fechada', () => {
    expect(parseLiveSession({ open: true, reason: 'scheduled', next_at: null })).toMatchObject({ open: true, reason: 'scheduled', known: true })
    expect(parseLiveSession({ open: true, reason: 'together', next_at: null })).toMatchObject({ open: true, reason: 'together' })
    expect(parseLiveSession({ open: false, reason: null, next_at: '2026-11-15T23:00:00Z' })).toMatchObject({ open: false, nextAt: '2026-11-15T23:00:00Z' })
  })

  it('só vale como aberta com um motivo conhecido; lixo vira fechada', () => {
    expect(parseLiveSession({ open: true, reason: 'sorte' }).open).toBe(false)
    expect(parseLiveSession({ open: true }).open).toBe(false)
    expect(parseLiveSession(null)).toMatchObject({ open: false, reason: null, nextAt: null })
  })

  it('pergunta ao banco uma vez por vez, e com erro (sem a migration) fica fechada', async () => {
    rpc.result = { data: null, error: { message: 'function does not exist' } }
    await Promise.all([refreshLiveSession('c1'), refreshLiveSession('c1')])
    expect(rpc.calls).toEqual(['campaign_session_status'])
  })

  it('o hook existe e não pergunta sem campanha', () => {
    expect(typeof useLiveSession).toBe('function')
    expect(rpc.calls).toEqual([])
  })
})
