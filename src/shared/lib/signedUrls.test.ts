import { beforeEach, describe, expect, it, vi } from 'vitest'

const createSignedUrls = vi.fn()
vi.mock('./supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrls }) } },
}))

import { resetSignedUrlCache, signedUrl, signedUrls } from './signedUrls'

const answer = (paths: string[], tag = 'a') => ({
  data: paths.map((p) => ({ path: p, signedUrl: `https://x/${p}?t=${tag}`, error: null })),
})

describe('signedUrls', () => {
  beforeEach(() => {
    createSignedUrls.mockReset()
    resetSignedUrlCache()
  })

  it('reaproveita o link do mesmo arquivo em vez de pedir outro', async () => {
    createSignedUrls.mockImplementation(async (paths: string[]) => answer(paths))
    const first = await signedUrls('b', ['1.png', '2.png'])
    const second = await signedUrls('b', ['1.png', '2.png'])
    expect(second.get('1.png')).toBe(first.get('1.png'))
    expect(createSignedUrls).toHaveBeenCalledTimes(1)
  })

  it('só pede os arquivos que ainda não têm link', async () => {
    createSignedUrls.mockImplementation(async (paths: string[]) => answer(paths))
    await signedUrls('b', ['1.png'])
    await signedUrls('b', ['1.png', '2.png'])
    expect(createSignedUrls).toHaveBeenLastCalledWith(['2.png'], expect.any(Number))
  })

  it('separa buckets com o mesmo caminho', async () => {
    createSignedUrls.mockImplementation(async (paths: string[]) => answer(paths))
    await signedUrls('b1', ['1.png'])
    await signedUrls('b2', ['1.png'])
    expect(createSignedUrls).toHaveBeenCalledTimes(2)
  })

  it('devolve null quando não deu pra gerar', async () => {
    createSignedUrls.mockResolvedValue({ data: null })
    expect(await signedUrl('b', 'x.png')).toBeNull()
  })
})
