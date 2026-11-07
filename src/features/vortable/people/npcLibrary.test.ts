import { beforeEach, describe, expect, it, vi } from 'vitest'

type Res = { data: unknown; error: { code?: string; message?: string } | null }
const state = { select: { data: [], error: null } as Res, insert: { data: [], error: null } as Res, removed: [] as string[] }

vi.mock('../../../shared/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: async () => state.select }),
      insert: () => ({ select: async () => state.insert }),
      delete: () => ({ eq: async (_c: string, id: string) => { state.removed.push(id); return { error: null } } }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
}))

import { addToLibrary, listLibrary, removeFromLibrary, tableMissing } from './npcLibrary'

/** localStorage mínimo (o ambiente de teste é node). */
const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  get length() { return store.size },
  key: (i: number) => [...store.keys()][i] ?? null,
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
  clear: () => store.clear(),
})

const look = { version: 2, body: 'male', skin: 'light', slots: {} } as never
const MISSING = { code: '42P01', message: 'relation "public.vortable_npc_library" does not exist' }

describe('biblioteca de NPCs do mestre', () => {
  beforeEach(() => {
    localStorage.clear()
    state.select = { data: [], error: null }
    state.insert = { data: [], error: null }
    state.removed = []
  })

  it('reconhece "a tabela ainda não existe"', () => {
    expect(tableMissing(MISSING)).toBe(true)
    expect(tableMissing({ code: 'PGRST205', message: 'Could not find the table' })).toBe(true)
    expect(tableMissing({ code: '23505', message: 'duplicate' })).toBe(false)
    expect(tableMissing(null)).toBe(false)
  })

  it('lê a biblioteca da conta', async () => {
    state.select = { data: [{ id: 'a', name: 'Maria', role: 'Sobrevivente', gear: 'taco', appearance: look }], error: null }
    const lib = await listLibrary()
    expect(lib.cloud).toBe(true)
    expect(lib.npcs.map((n) => n.name)).toEqual(['Maria'])
  })

  it('sem a tabela, guarda e lê só neste navegador, sem perder nada', async () => {
    state.select = { data: null, error: MISSING }
    state.insert = { data: null, error: MISSING }
    const added = await addToLibrary([{ name: 'João', role: 'Importado', gear: 'do arquivo', appearance: look }])
    expect(added.cloud).toBe(false)
    expect(added.npcs[0].id.startsWith('local-')).toBe(true)
    const lib = await listLibrary()
    expect(lib.cloud).toBe(false)
    expect(lib.npcs.map((n) => n.name)).toEqual(['João'])
    await removeFromLibrary(added.npcs[0].id)
    expect((await listLibrary()).npcs).toHaveLength(0)
  })

  it('sobe os importados antigos do navegador (de todas as campanhas) uma vez, sem repetir', async () => {
    localStorage.setItem('vortable:importados:c1', JSON.stringify([{ name: 'Ana', appearance: look }]))
    localStorage.setItem('vortable:importados:c2', JSON.stringify([{ name: 'Ana', appearance: look }, { name: 'Beto', appearance: look }]))
    state.select = { data: [], error: null }
    state.insert = { data: [{ id: 'n1', name: 'Ana', role: 'Importado', gear: 'do arquivo', appearance: look }, { id: 'n2', name: 'Beto', role: 'Importado', gear: 'do arquivo', appearance: look }], error: null }
    const lib = await listLibrary()
    expect(lib.cloud).toBe(true)
    expect(lib.npcs.map((n) => n.name).sort()).toEqual(['Ana', 'Beto'])
    expect(localStorage.getItem('vortable:importados:c1')).toBeNull()
    expect(localStorage.getItem('vortable:importados:c2')).toBeNull()
  })

  it('apagar um da conta chama o banco com o id', async () => {
    await removeFromLibrary('abc')
    expect(state.removed).toEqual(['abc'])
  })
})
