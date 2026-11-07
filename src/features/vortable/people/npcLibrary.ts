import type { Appearance } from '../../../vendor/vortable/vortable'
import { supabase } from '../../../shared/lib/supabase'

// ────────────────────────────────────────────────────────
// Biblioteca de NPCs do mestre (migration 20240227): os personagens importados de arquivo e os que o gerador
// sorteou e o mestre guardou. Vive na CONTA (vale em todas as campanhas e navegadores). Enquanto a migration não
// rodou, cai num guardado do navegador (só neste aparelho) pra não perder o uso. Os "importados" que versões
// antigas guardavam por campanha no navegador sobem sozinhos pra biblioteca na primeira vez.
// ────────────────────────────────────────────────────────

export interface LibraryNpc {
  id: string
  name: string
  role: string
  gear: string
  appearance: Appearance
}

export type NewLibraryNpc = Omit<LibraryNpc, 'id'>

const LOCAL_KEY = 'vortable:biblioteca-npcs'
const LEGACY_PREFIX = 'vortable:importados:'

/** O erro é "a tabela ainda não existe" (a migration não rodou)? */
export function tableMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache|could not find the table/i.test(error.message ?? '')
}

const cleanName = (s: string) => (s.trim().slice(0, 60) || 'Sem nome')

// ── Guardado do navegador (enquanto a tabela não existe) ──

function readLocal(): LibraryNpc[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]') as Partial<LibraryNpc>[]
    return Array.isArray(raw)
      ? raw.filter((n): n is LibraryNpc => !!n && typeof n.id === 'string' && typeof n.name === 'string' && !!n.appearance).map((n) => ({ ...n, role: n.role ?? '', gear: n.gear ?? '' }))
      : []
  } catch { return [] }
}

function writeLocal(list: LibraryNpc[]) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)) } catch { /* sem storage: só não lembra */ }
}

/** Importados antigos (um guardado por campanha), de todas as campanhas deste navegador. */
function readLegacy(): { key: string; npcs: NewLibraryNpc[] }[] {
  const out: { key: string; npcs: NewLibraryNpc[] }[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(LEGACY_PREFIX)) continue
      const raw = JSON.parse(localStorage.getItem(key) ?? '[]') as { name?: unknown; appearance?: unknown }[]
      if (!Array.isArray(raw)) continue
      const npcs = raw.filter((s) => s && typeof s.name === 'string' && s.appearance && typeof s.appearance === 'object')
        .map((s) => ({ name: cleanName(s.name as string), role: 'Importado', gear: 'do arquivo', appearance: s.appearance as Appearance }))
      out.push({ key, npcs })
    }
  } catch { /* sem storage */ }
  return out
}

const same = (a: NewLibraryNpc, b: NewLibraryNpc) => a.name === b.name && JSON.stringify(a.appearance) === JSON.stringify(b.appearance)

// ── API ──

export interface Library {
  npcs: LibraryNpc[]
  /** true = na conta (nuvem); false = só neste navegador (migration pendente). */
  cloud: boolean
}

function fromRow(r: { id: string; name: string; role: string | null; gear: string | null; appearance: Appearance }): LibraryNpc {
  return { id: r.id, name: r.name, role: r.role ?? '', gear: r.gear ?? '', appearance: r.appearance }
}

export async function listLibrary(): Promise<Library> {
  const { data, error } = await supabase.from('vortable_npc_library').select('id, name, role, gear, appearance').order('created_at', { ascending: false })
  if (error) {
    if (tableMissing(error)) return { npcs: readLocal(), cloud: false }
    throw new Error('Não deu pra carregar a biblioteca de NPCs.')
  }
  let npcs = (data ?? []).map(fromRow)
  // sobe os importados antigos deste navegador (uma vez; depois some do navegador)
  const legacy = readLegacy()
  if (legacy.length) {
    const fresh: NewLibraryNpc[] = []
    for (const g of legacy) for (const n of g.npcs) if (![...npcs, ...fresh].some((x) => same(x, n))) fresh.push(n)
    try {
      if (fresh.length) npcs = [...(await addToLibrary(fresh)).npcs.slice(0, fresh.length), ...npcs]
      for (const g of legacy) localStorage.removeItem(g.key)
    } catch { /* tenta de novo da próxima vez */ }
  }
  return { npcs, cloud: true }
}

/** Guarda NPCs novos. Devolve só os que entraram (com os ids da biblioteca). */
export async function addToLibrary(list: NewLibraryNpc[]): Promise<Library> {
  if (list.length === 0) return { npcs: [], cloud: true }
  const rows = list.map((n) => ({ name: cleanName(n.name), role: n.role.slice(0, 120), gear: n.gear.slice(0, 120), appearance: n.appearance }))
  const { data, error } = await supabase.from('vortable_npc_library').insert(rows).select('id, name, role, gear, appearance')
  if (error) {
    if (tableMissing(error)) {
      const added = rows.map((r) => ({ ...r, id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}` }))
      writeLocal([...added, ...readLocal()])
      return { npcs: added, cloud: false }
    }
    throw new Error('Não deu pra guardar na biblioteca de NPCs.')
  }
  return { npcs: (data ?? []).map(fromRow), cloud: true }
}

export async function removeFromLibrary(id: string): Promise<void> {
  if (id.startsWith('local-')) { writeLocal(readLocal().filter((n) => n.id !== id)); return }
  const { error } = await supabase.from('vortable_npc_library').delete().eq('id', id)
  if (error) throw new Error('Não deu pra tirar da biblioteca de NPCs.')
}

export async function renameLibraryNpc(id: string, name: string): Promise<void> {
  const next = cleanName(name)
  if (id.startsWith('local-')) { writeLocal(readLocal().map((n) => (n.id === id ? { ...n, name: next } : n))); return }
  const { error } = await supabase.from('vortable_npc_library').update({ name: next }).eq('id', id)
  if (error) throw new Error('Não deu pra renomear o NPC.')
}
