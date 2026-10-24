import { afterEach, describe, expect, it, vi } from 'vitest'
import { isAllowedRequest, isCampaignView, isObserver, observerFetch, setObserver } from './observer'

const API = 'https://x.supabase.co'

describe('modo observador (conta dev só lê)', () => {
  afterEach(() => { setObserver(false); vi.unstubAllGlobals() })

  it('leitura passa; escrita no banco não', () => {
    expect(isAllowedRequest('GET', `${API}/rest/v1/campaigns?select=*`)).toBe(true)
    expect(isAllowedRequest('HEAD', `${API}/rest/v1/campaigns`)).toBe(true)
    for (const m of ['POST', 'PATCH', 'PUT', 'DELETE']) expect(isAllowedRequest(m, `${API}/rest/v1/dice_rolls`), m).toBe(false)
  })

  it('funções do banco: só as que leem', () => {
    expect(isAllowedRequest('POST', `${API}/rest/v1/rpc/is_developer`)).toBe(true)
    expect(isAllowedRequest('POST', `${API}/rest/v1/rpc/get_private_message_unread_counts`)).toBe(true)
    for (const fn of ['delete_campaign', 'create_campaign', 'touch_campaign_presence', 'add_campaign_player', 'advance_initiative_turn', 'tor_play']) {
      expect(isAllowedRequest('POST', `${API}/rest/v1/rpc/${fn}`), fn).toBe(false)
    }
  })

  it('login, link assinado de arquivo e status do feedback passam; subir arquivo não', () => {
    expect(isAllowedRequest('POST', `${API}/auth/v1/token?grant_type=refresh_token`)).toBe(true)
    expect(isAllowedRequest('POST', `${API}/auth/v1/logout`)).toBe(true)
    expect(isAllowedRequest('POST', `${API}/storage/v1/object/sign/docs/a.png`)).toBe(true)
    expect(isAllowedRequest('PATCH', `${API}/rest/v1/site_feedback?id=eq.1`)).toBe(true)
    expect(isAllowedRequest('POST', `${API}/storage/v1/object/portraits/a.png`)).toBe(false)
    expect(isAllowedRequest('DELETE', `${API}/storage/v1/object/portraits`)).toBe(false)
    expect(isAllowedRequest('PATCH', `${API}/rest/v1/campaigns?id=eq.1`)).toBe(false)
  })

  it('a conta dev só entra nas campanhas, não no resto do site', () => {
    for (const ok of ['/campanhas/abc', '/campanhas/abc/', '/campanhas/abc/visao-geral', '/campanhas/abc/mesa-sessao']) expect(isCampaignView(ok), ok).toBe(true)
    for (const no of ['/campanhas', '/campanhas/', '/campanhas/nova', '/campanhas/abc/vortable', '/perfil', '/minhas-fichas', '/']) expect(isCampaignView(no), no).toBe(false)
  })

  it('com o modo ligado, o fetch devolve 403 e não chama a rede; desligado, deixa passar', async () => {
    const net = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', net)
    setObserver(true)
    expect(isObserver()).toBe(true)
    const blocked = await observerFetch(`${API}/rest/v1/dice_rolls`, { method: 'POST', body: '{}' })
    expect(blocked.status).toBe(403)
    expect((await blocked.json()).code).toBe('OBSERVER_READ_ONLY')
    expect(net).not.toHaveBeenCalled()

    await observerFetch(`${API}/rest/v1/campaigns`)
    expect(net).toHaveBeenCalledTimes(1)

    setObserver(false)
    await observerFetch(`${API}/rest/v1/dice_rolls`, { method: 'POST', body: '{}' })
    expect(net).toHaveBeenCalledTimes(2)
  })
})
