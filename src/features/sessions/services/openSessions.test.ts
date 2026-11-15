import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../shared/lib/supabase', () => ({ supabase: {} }))

import { parseOpenSessions, reconcileAnnounced, type OpenSession } from './openSessions'

const open = (id: string, over: Partial<OpenSession> = {}): OpenSession => ({ campaignId: id, campaignName: `Campanha ${id}`, role: 'player', reason: 'together', ...over })

describe('sessões abertas das minhas campanhas', () => {
  it('lê o que o banco devolve e descarta o que não tem campanha ou motivo conhecido', () => {
    const out = parseOpenSessions([
      { campaign_id: 'a', campaign_name: 'Reino', role: 'player', reason: 'manual' },
      { campaign_id: 'b', campaign_name: 'Torre', role: 'master', reason: 'scheduled' },
      { campaign_id: 'd', campaign_name: 'Fim', role: 'player', reason: 'ending' },
      { campaign_id: 'c', campaign_name: 'Sem motivo', role: 'player', reason: null },
      { campaign_name: 'Sem id', role: 'player', reason: 'together' },
      null,
    ])
    expect(out.map((o) => [o.campaignId, o.role, o.reason])).toEqual([['a', 'player', 'manual'], ['b', 'master', 'scheduled'], ['d', 'player', 'ending']])
    expect(parseOpenSessions('lixo')).toEqual([])
    expect(parseOpenSessions(null)).toEqual([])
  })

  it('avisa uma vez por abertura: a que já foi anunciada não repete', () => {
    const first = reconcileAnnounced(new Set(), [open('a'), open('b')])
    expect(first.announce.map((o) => o.campaignId)).toEqual(['a', 'b'])
    const second = reconcileAnnounced(first.announced, [open('a'), open('b')])
    expect(second.announce).toEqual([])
  })

  it('a sessão "encerrando" não é abertura nova: não avisa, e se o mestre mandar continuar também não avisa de novo', () => {
    const ending = reconcileAnnounced(new Set(), [open('a', { reason: 'ending' })])
    expect(ending.announce).toEqual([])
    const resumed = reconcileAnnounced(ending.announced, [open('a', { reason: 'manual' })])
    expect(resumed.announce).toEqual([])
    // se fechou de verdade (saiu da lista), uma abertura nova volta a ser anunciada
    const closed = reconcileAnnounced(resumed.announced, [])
    expect(reconcileAnnounced(closed.announced, [open('a')]).announce.map((o) => o.campaignId)).toEqual(['a'])
  })

  it('só a nova é anunciada, e quem fechou sai da lista: se abrir de novo, avisa de novo', () => {
    const first = reconcileAnnounced(new Set(), [open('a')])
    const withNew = reconcileAnnounced(first.announced, [open('a'), open('b')])
    expect(withNew.announce.map((o) => o.campaignId)).toEqual(['b'])
    const closed = reconcileAnnounced(withNew.announced, [open('b')])
    expect(closed.announce).toEqual([])
    expect([...closed.announced]).toEqual(['b'])
    const reopened = reconcileAnnounced(closed.announced, [open('a'), open('b')])
    expect(reopened.announce.map((o) => o.campaignId)).toEqual(['a'])
  })
})
