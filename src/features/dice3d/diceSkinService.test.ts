import { beforeEach, describe, expect, it, vi } from 'vitest'

// Banco falso: o que `profiles.dice_skin` guarda e se a próxima leitura falha.
const db = { skin: 'granito' as string | null, failRead: false, updatedRows: 1, reads: 0 }

vi.mock('../../shared/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
      getUser: async () => ({ data: { user: { id: 'u1' } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            db.reads++
            return db.failRead ? { data: null, error: { message: 'rede' } } : { data: { dice_skin: db.skin }, error: null }
          },
        }),
      }),
      update: (patch: { dice_skin: string }) => ({
        eq: () => ({
          select: async () => {
            await new Promise((r) => setTimeout(r, 20))
            if (db.updatedRows > 0) db.skin = patch.dice_skin
            return { data: Array.from({ length: db.updatedRows }, () => ({ id: 'u1' })), error: null }
          },
        }),
      }),
    }),
  },
}))

async function load() {
  vi.resetModules()
  return import('./diceSkinService')
}

beforeEach(() => {
  db.skin = 'granito'; db.failRead = false; db.updatedRows = 1; db.reads = 0
})

describe('skin dos dados', () => {
  it('lê a escolhida e guarda em memória', async () => {
    const s = await load()
    expect(await s.getMyDiceSkin()).toBe('granito')
    expect(await s.getMyDiceSkin()).toBe('granito')
    expect(db.reads).toBe(1)
    expect(s.peekMyDiceSkin()).toBe('granito')
  })

  it('um erro de leitura vale o padrão só dessa vez, sem ficar guardado', async () => {
    const s = await load()
    db.failRead = true
    expect(await s.getMyDiceSkin()).toBe('madeira')
    expect(s.peekMyDiceSkin()).toBeNull()
    db.failRead = false
    expect(await s.getMyDiceSkin()).toBe('granito')
  })

  it('"fresh" lê o banco de novo (a skin pode ter sido trocada em outro aparelho)', async () => {
    const s = await load()
    expect(await s.getMyDiceSkin()).toBe('granito')
    db.skin = 'plastico'
    expect(await s.getMyDiceSkin()).toBe('granito')
    expect(await s.getMyDiceSkin({ fresh: true })).toBe('plastico')
  })

  it('erro numa leitura "fresh" mantém a última skin conhecida, não o padrão', async () => {
    const s = await load()
    await s.getMyDiceSkin()
    db.failRead = true
    expect(await s.getMyDiceSkin({ fresh: true })).toBe('granito')
  })

  it('quem vai rolar espera a troca de skin terminar de gravar', async () => {
    const s = await load()
    await s.getMyDiceSkin()
    const saving = s.setMyDiceSkin('plastico')
    // rolou antes de a gravação acabar: ainda assim sai a skin nova
    expect(await s.getMyDiceSkin({ fresh: true })).toBe('plastico')
    await saving
  })

  it('avisa quem está com a tela aberta quando a skin muda', async () => {
    const s = await load()
    const seen: string[] = []
    s.onDiceSkinChange((x) => seen.push(x))
    await s.setMyDiceSkin('plastico')
    expect(seen).toEqual(['plastico'])
  })

  it('gravação que não alterou nenhuma linha dá erro (não finge que trocou)', async () => {
    const s = await load()
    db.updatedRows = 0
    await expect(s.setMyDiceSkin('plastico')).rejects.toThrow(/perfil/)
    expect(s.peekMyDiceSkin()).toBeNull()
  })
})
