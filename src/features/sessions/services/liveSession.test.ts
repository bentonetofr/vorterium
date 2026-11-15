import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => ({ calls: [] as string[], result: { data: null as unknown, error: null as unknown } }))
vi.mock('../../../shared/lib/supabase', () => ({
  supabase: { rpc: async (name: string) => { rpc.calls.push(name); return rpc.result } },
}))

import { closedReason, parseLiveSession, playersNeeded, refreshLiveSession, resetLiveSessions, setCampaignSession, useLiveSession } from './liveSession'

beforeEach(() => { resetLiveSessions(); rpc.calls = []; rpc.result = { data: null, error: null } })

describe('estado da sessão da campanha', () => {
  it('lê o que o banco devolve: aberta pelo mestre, por horário, por mesa reunida ou fechada', () => {
    expect(parseLiveSession({ open: true, reason: 'manual', next_at: null, override: 'open' })).toMatchObject({ open: true, reason: 'manual', override: 'open' })
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

  it('lê quem está online e o que o mestre decidiu à mão', () => {
    const s = parseLiveSession({ open: false, reason: null, override: 'closed', master_online: true, players_online: 2, players_total: 4 })
    expect(s).toMatchObject({ open: false, override: 'closed', masterOnline: true, playersOnline: 2, playersTotal: 4 })
    // números fora do esperado viram 0 e a decisão desconhecida vira nenhuma
    expect(parseLiveSession({ players_online: -3, players_total: 'x', override: 'talvez' })).toMatchObject({ playersOnline: 0, playersTotal: 0, override: null })
  })

  it('a metade dos jogadores, arredondando pra cima: 4 = 2, 3 = 2, 2 = 1, 1 = 1, nenhum = 0', () => {
    expect([4, 3, 2, 1, 0, 6, 5].map(playersNeeded)).toEqual([2, 2, 1, 1, 0, 3, 3])
  })

  it('o mestre abre, encerra e volta ao automático pelo banco; sem permissão ou sem a migration, avisa', async () => {
    const calls: unknown[] = []
    rpc.result = { data: null, error: null }
    const original = rpc.calls.push.bind(rpc.calls)
    rpc.calls.push = (...args: string[]) => { calls.push(args[0]); return original(...args) }
    await setCampaignSession('c1', 'open')
    await setCampaignSession('c1', 'close')
    await setCampaignSession('c1', 'auto')
    expect(calls.filter((c) => c === 'set_campaign_session')).toHaveLength(3)
    rpc.result = { data: null, error: { message: 'Só o mestre da campanha abre ou encerra a sessão.' } }
    await expect(setCampaignSession('c1', 'open')).rejects.toThrow(/20240234/)
  })

  it('explica por que a sessão está fechada: encerrada, sem o mestre ou faltando jogador', () => {
    const base = { open: false, reason: null, master_online: true, players_online: 1, players_total: 4 }
    expect(closedReason(parseLiveSession({ ...base, master_online: false }))).toBe('aguardando o mestre')
    expect(closedReason(parseLiveSession(base))).toBe('faltam 1 jogador online')
    expect(closedReason(parseLiveSession({ ...base, players_online: 0 }))).toBe('faltam 2 jogadores online')
    expect(closedReason(parseLiveSession({ ...base, override: 'closed' }))).toBe('encerrada pelo mestre')
    // mestre online e jogadores suficientes, mas fechada: não há o que dizer (o horário ou o botão do mestre decidem)
    expect(closedReason(parseLiveSession({ ...base, players_online: 2 }))).toBe('')
  })

  it('sem resposta do banco o estado é marcado como falha (e não diz que aguarda o mestre)', async () => {
    rpc.result = { data: null, error: { message: 'function does not exist' } }
    await refreshLiveSession('c9')
    const failed = { ...parseLiveSession(null), failed: true }
    expect(closedReason(failed)).toBe('')
    expect(parseLiveSession(null).failed).toBe(false)
  })

  it('o hook existe e não pergunta sem campanha', () => {
    expect(typeof useLiveSession).toBe('function')
    expect(rpc.calls).toEqual([])
  })
})
