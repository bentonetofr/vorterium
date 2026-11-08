import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../../shared/lib/supabase'
import { isForcedRoll } from '../owner/ownerTools'
import type { DiceRoll } from '../../shared/types'
import { ACHIEVEMENTS, satisfied, type Achievement, type History, type RollLite } from './achievements'
import { isCollectionSkin } from '../dice3d/skins'

// ────────────────────────────────────────────────────────
// A coleção de dados da conta: quais conjuntos já foram ganhos (tabela dice_skin_unlocks, migration 20240229) e a conferência
// das conquistas a cada rolagem gravada. Lê as rolagens da própria conta uma vez (as últimas 1500, mais a contagem total),
// guarda em memória e soma cada rolagem nova. Sem a migration ou sem rede, não faz nada (um erro nunca atrapalha a rolagem).
// ────────────────────────────────────────────────────────

const HISTORY_LIMIT = 1500

/**
 * O prêmio vale daqui pra frente: só contam as rolagens feitas depois deste instante (08/11/2026, 17:20, horário de Brasília,
 * quando a coleção foi reiniciada do zero). O que a conta rolou antes não vira dado, pra ninguém ganhar de uma vez por causa do histórico.
 */
export const COLLECTION_START = '2026-11-08T17:20:00-03:00'
const START_MS = Date.parse(COLLECTION_START)

export interface UnlockEvent { skin: string; achievement: string; title: string; at: number }

interface Store { userId: string | null; loaded: boolean; unlocked: ReadonlySet<string> }

let store: Store = { userId: null, loaded: false, unlocked: new Set() }
const storeListeners = new Set<() => void>()
const unlockListeners = new Set<(e: UnlockEvent) => void>()

function setStore(next: Store) {
  store = next
  storeListeners.forEach((l) => l())
}

/** As conquistas novas chegam aqui (o aviso na tela escuta). */
export function onUnlock(fn: (e: UnlockEvent) => void): () => void {
  unlockListeners.add(fn)
  return () => { unlockListeners.delete(fn) }
}

/** Os conjuntos da coleção que a conta já tem (e se já carregou). */
export function useCollection(): { unlocked: ReadonlySet<string>; loaded: boolean } {
  // quem mostra a coleção garante que ela foi lida (o aviso de conquista, no layout, também lê)
  useEffect(() => { void loadCollection() }, [])
  return useSyncExternalStore(
    (l) => { storeListeners.add(l); return () => { storeListeners.delete(l) } },
    () => store,
  )
}

async function currentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user?.id ?? null
}

/** Lê a coleção da conta logada (de novo, se trocou de conta). Devolve false se não deu (sem a migration, sem rede). */
export async function loadCollection(force = false): Promise<boolean> {
  const userId = await currentUserId()
  if (!userId) { if (store.userId) setStore({ userId: null, loaded: false, unlocked: new Set() }); return false }
  if (!force && store.userId === userId && store.loaded) return true
  if (store.userId !== userId) { history = null; setStore({ userId, loaded: false, unlocked: new Set() }) }
  const { data, error } = await supabase.from('dice_skin_unlocks').select('skin_id').eq('user_id', userId)
  if (error) return false
  setStore({ userId, loaded: true, unlocked: new Set((data as { skin_id: string }[]).map((r) => r.skin_id).filter(isCollectionSkin)) })
  return true
}

// ── Histórico de rolagens ───────────────────────────────

let history: { userId: string; rolls: RollLite[]; total: number } | null = null

const COLUMNS = 'id, campaign_id, die_type, result, individual_results, roll_breakdown, roll_context, roll_label, created_at'

async function loadHistory(userId: string): Promise<boolean> {
  const [rows, count] = await Promise.all([
    supabase.from('dice_rolls').select(COLUMNS).eq('user_id', userId).gte('created_at', COLLECTION_START).order('created_at', { ascending: false }).limit(HISTORY_LIMIT),
    supabase.from('dice_rolls').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', COLLECTION_START),
  ])
  if (rows.error || count.error) return false
  const rolls = (rows.data as unknown as RollLite[]).reverse()
  history = { userId, rolls, total: Math.max(count.count ?? 0, rolls.length) }
  return true
}

const lite = (r: DiceRoll): RollLite => ({
  id: r.id, campaign_id: r.campaign_id, die_type: r.die_type, result: r.result, individual_results: r.individual_results,
  roll_breakdown: r.roll_breakdown, roll_context: r.roll_context ?? null, roll_label: r.roll_label ?? null, created_at: r.created_at,
})

function view(): History {
  const h = history!
  // só rolagens a partir do corte (a consulta já filtra; aqui é uma segunda trava) e sem as forçadas pelo dono
  const since = h.rolls.filter((r) => Date.parse(r.created_at) >= START_MS)
  const rolls = since.filter((r) => !isForcedRoll(r.id))
  return { rolls, total: Math.min(h.total, Math.max(since.length, h.total - (h.rolls.length - since.length))), campaigns: new Set(since.map((r) => r.campaign_id)).size }
}

// ── A cada rolagem ──────────────────────────────────────

let chain: Promise<void> = Promise.resolve()

/** Chamado depois de cada rolagem gravada da própria conta: confere as conquistas e concede os conjuntos novos. */
export function noteRoll(roll: DiceRoll): Promise<void> {
  chain = chain.then(() => check(roll)).catch((err) => console.warn('[coleção] não deu pra conferir as conquistas', err))
  return chain
}

async function check(roll: DiceRoll): Promise<void> {
  const userId = await currentUserId()
  if (!userId || roll.user_id !== userId) return
  if (!(await loadCollection())) return
  if (!history || history.userId !== userId) { if (!(await loadHistory(userId))) return }
  const h = history
  if (!h) return
  // a rolagem que acabou de chegar pode já estar no que foi lido do banco (ou não ter chegado): garante que esteja uma vez só
  if (!h.rolls.some((r) => r.id === roll.id)) {
    h.rolls.push(lite(roll))
    h.total += 1
    if (h.rolls.length > HISTORY_LIMIT) h.rolls.splice(0, h.rolls.length - HISTORY_LIMIT)
  }
  const fresh = satisfied(view()).filter((a) => !store.unlocked.has(a.skin))
  for (const a of fresh) await grant(a)
}

async function grant(a: Achievement): Promise<void> {
  const { data, error } = await supabase.rpc('unlock_dice_skin', { p_skin: a.skin, p_achievement: a.id })
  if (error) return
  setStore({ ...store, unlocked: new Set([...store.unlocked, a.skin]) })
  // false = já era da conta (outro aparelho ganhou primeiro): só atualiza a lista, sem aviso
  if (data === true) unlockListeners.forEach((fn) => fn({ skin: a.skin, achievement: a.id, title: a.title, at: Date.now() }))
}

/** Só pra testes. */
export function resetCollection(): void {
  history = null
  chain = Promise.resolve()
  store = { userId: null, loaded: false, unlocked: new Set() }
}

export const TOTAL_SKINS = ACHIEVEMENTS.length
