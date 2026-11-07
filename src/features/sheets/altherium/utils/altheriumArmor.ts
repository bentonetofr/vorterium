import type { AltheriumInventoryItem } from '../../../../shared/types'
import { findArmor } from '../constants/altheriumItems'
import { applyWear, armorDbWithIntegrity, readReinforcements } from './altheriumCraft'

// ────────────────────────────────────────────────────────
// Armadura por parte do corpo (livro 2.0, "Integridade": "toda parte de
// armadura possui Integridade"). Cada parte do corpo tem o seu encaixe: a
// peça vestida ali guarda a própria Integridade e se desgasta sozinha.
//
// Onde fica guardado: a linha do inventário tem `worn`, a lista das
// peças dessa armadura que estão no corpo ({ zona, integridade }). Uma
// armadura de quantidade 3 pode vestir 3 partes, cada uma com seu desgaste.
// As unidades que ficaram na mochila usam o `integrity` da própria linha.
// O DB da ficha (db_*) agora é só o BÔNUS (Robusto etc.): o DB de cada
// parte é calculado aqui, das peças vestidas.
// ────────────────────────────────────────────────────────

export type BodyZoneId = 'db_pernas' | 'db_bracos' | 'db_tronco' | 'db_cabeca'

export const BODY_ZONE_IDS: BodyZoneId[] = ['db_cabeca', 'db_bracos', 'db_tronco', 'db_pernas']

export const BODY_ZONE_LABELS: Record<BodyZoneId, string> = {
  db_pernas: 'Pernas',
  db_bracos: 'Braços',
  db_tronco: 'Tronco',
  db_cabeca: 'Cabeça',
}

/** Quanto a peça perde quando o dano não passa do DB. */
export const ARMOR_WEAR_PERCENT = 10

/** Uma peça de armadura no corpo. */
export interface WornPiece {
  zone:      BodyZoneId
  integrity: number
}

/** O que dá pra mudar numa linha do inventário (equipar, desgastar, reparar). */
export interface InventoryPatch {
  integrity?:      number
  reinforcements?: string[]
  worn?:           WornPiece[]
  equipped?:       boolean
  equipped_zone?:  BodyZoneId | null
}

export interface ItemPatch { id: string; patch: InventoryPatch }

const isZone = (z: unknown): z is BodyZoneId => typeof z === 'string' && (BODY_ZONE_IDS as string[]).includes(z)
const clampPct = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 100)

/**
 * As peças vestidas de uma armadura. Sem a coluna nova (banco antigo), a
 * armadura equipada numa zona vira uma peça só, com a Integridade da linha.
 */
export function readWorn(inv: AltheriumInventoryItem): WornPiece[] {
  if (inv.item_type !== 'armadura') return []
  const out: WornPiece[] = []
  if (Array.isArray(inv.worn)) {
    for (const x of inv.worn) {
      const { zone, integrity } = (x ?? {}) as { zone?: unknown; integrity?: unknown }
      if (isZone(zone) && !out.some((p) => p.zone === zone)) out.push({ zone, integrity: clampPct(integrity) })
    }
    return out.slice(0, Math.max(1, inv.quantity))
  }
  if (inv.equipped && inv.equipped_zone) out.push({ zone: inv.equipped_zone, integrity: clampPct(inv.integrity ?? 100) })
  return out
}

/** DB cheio da peça (catálogo ou personalizada). */
export function armorBaseDb(inv: AltheriumInventoryItem): number {
  return inv.custom_name !== null ? (inv.custom_db ?? 0) : (findArmor(inv.item_id)?.db ?? 0)
}

export function armorName(inv: AltheriumInventoryItem): string {
  return inv.custom_name ?? findArmor(inv.item_id)?.name ?? 'Armadura'
}

/** Armadura vestida numa parte: de qual linha é, quanto resta de Integridade e o DB que ainda dá. */
export interface ArmorPiece {
  inv:       AltheriumInventoryItem
  zone:      BodyZoneId
  integrity: number
  /** DB cheio da peça. */
  db:        number
  /** DB de agora: a Integridade gasta tira, as Placas Costuradas somam +2. */
  dbNow:     number
  notes:     string[]
}

export function pieceOf(inv: AltheriumInventoryItem, worn: WornPiece): ArmorPiece {
  const db = armorBaseDb(inv)
  const now = armorDbWithIntegrity(db, worn.integrity)
  const notes: string[] = []
  if (db - now) notes.push(`Integridade −${db - now}`)
  let dbNow = now
  if (readReinforcements(inv.reinforcements).includes('placas_costuradas')) { dbNow += 2; notes.push('Placas Costuradas +2') }
  return { inv, zone: worn.zone, integrity: worn.integrity, db, dbNow, notes }
}

/** Todas as peças de armadura no corpo. */
export function armorPieces(inventory: AltheriumInventoryItem[]): ArmorPiece[] {
  return inventory.flatMap((inv) => readWorn(inv).map((w) => pieceOf(inv, w)))
}

/** A armadura vestida naquela parte (a de mais DB, se um dado antigo tiver duas). */
export function zonePiece(inventory: AltheriumInventoryItem[], zone: BodyZoneId): ArmorPiece | null {
  const here = armorPieces(inventory).filter((p) => p.zone === zone)
  return here.sort((a, b) => b.dbNow - a.dbNow)[0] ?? null
}

/** Escudos equipados: cobrem todas as partes, cada um com a sua Integridade. */
export function equippedShields(inventory: AltheriumInventoryItem[]): AltheriumInventoryItem[] {
  return inventory.filter((i) => i.item_type === 'escudo' && i.equipped)
}

export interface ZoneDefense {
  /** DB total da parte: bônus + armadura vestida ali + escudos. */
  total:   number
  bonus:   number
  piece:   ArmorPiece | null
  notes:   string[]
  /** A peça da parte é Armadura do guardião de Eryndor (protege normal contra Rúnico). */
  eryndor: boolean
}

export function zoneDefense(inventory: AltheriumInventoryItem[], zone: BodyZoneId, bonus: number): ZoneDefense {
  const piece = zonePiece(inventory, zone)
  const notes = piece ? [...piece.notes] : []
  let total = Math.max(0, bonus) + (piece?.dbNow ?? 0)
  for (const s of equippedShields(inventory)) {
    const db = armorBaseDb(s)
    const now = armorDbWithIntegrity(db, s.integrity ?? 100)
    total += now
    if (db - now) notes.push(`Escudo −${db - now} (Integridade)`)
  }
  return { total, bonus, piece, notes, eryndor: piece?.inv.item_id === 'armadura_guardiao_eryndor' }
}

/** O DB de cada parte (o que a ficha mostra e o combate usa). */
export function zoneDbTotals(inventory: AltheriumInventoryItem[], bonuses: Record<BodyZoneId, number>): Record<BodyZoneId, number> {
  const out = {} as Record<BodyZoneId, number>
  for (const z of BODY_ZONE_IDS) out[z] = zoneDefense(inventory, z, bonuses[z] ?? 0).total
  return out
}

// ── Equipar, tirar, desgastar, reparar ───────────────────

interface RowState { worn: WornPiece[]; integrity: number }

/** Tira a peça da parte; ela volta pra mochila (a menor Integridade vale pro monte). */
function takeOff(inv: AltheriumInventoryItem, state: RowState, zone: BodyZoneId): RowState {
  const piece = state.worn.find((p) => p.zone === zone)
  if (!piece) return state
  const worn = state.worn.filter((p) => p !== piece)
  const inBag = Math.max(1, inv.quantity) - worn.length
  return { worn, integrity: inBag <= 1 ? piece.integrity : Math.min(state.integrity, piece.integrity) }
}

/** `equipped` e `equipped_zone` seguem a lista: o resto do app (Furtividade, histórico) ainda lê os dois. */
function rowPatch(state: RowState): InventoryPatch {
  return {
    worn: state.worn,
    equipped: state.worn.length > 0,
    equipped_zone: state.worn[0]?.zone ?? null,
    integrity: state.integrity,
  }
}

const startState = (inv: AltheriumInventoryItem): RowState => ({ worn: readWorn(inv), integrity: inv.integrity ?? 100 })

/**
 * Veste uma unidade da armadura numa parte. Quem já estava ali volta pra
 * mochila (uma parte, uma peça). Devolve o texto do problema se não dá.
 */
export function planEquipPiece(inventory: AltheriumInventoryItem[], inv: AltheriumInventoryItem, zone: BodyZoneId): ItemPatch[] | string {
  if (inv.item_type !== 'armadura') return 'Só armaduras vão numa parte do corpo.'
  const patches = new Map<string, RowState>()
  const stateOf = (row: AltheriumInventoryItem) => patches.get(row.id) ?? startState(row)

  // Quem ocupa a parte (de qualquer linha) sai primeiro.
  for (const row of inventory) {
    if (row.item_type !== 'armadura') continue
    if (readWorn(row).some((p) => p.zone === zone)) patches.set(row.id, takeOff(row, stateOf(row), zone))
  }

  // Uma peça só e já vestida em outra parte: ela muda de parte.
  const before = stateOf(inv)
  if (before.worn.length >= Math.max(1, inv.quantity) && before.worn.length === 1) {
    patches.set(inv.id, takeOff(inv, before, before.worn[0].zone))
  }

  const mine = stateOf(inv)
  if (mine.worn.length >= Math.max(1, inv.quantity)) {
    return `Todas as ${inv.quantity > 1 ? `${inv.quantity} peças` : 'peças'} de ${armorName(inv)} já estão vestidas. Tire uma antes, ou aumente a quantidade.`
  }
  patches.set(inv.id, { worn: [...mine.worn, { zone, integrity: mine.integrity }], integrity: mine.integrity })

  return [...patches.entries()].map(([id, state]) => ({ id, patch: rowPatch(state) }))
}

/** Tira a peça daquela parte e devolve pra mochila. */
export function planUnequipPiece(inv: AltheriumInventoryItem, zone: BodyZoneId): ItemPatch[] {
  if (!readWorn(inv).some((p) => p.zone === zone)) return []
  return [{ id: inv.id, patch: rowPatch(takeOff(inv, startState(inv), zone)) }]
}

/** Depois de mexer na quantidade: não dá pra ter mais peças no corpo do que unidades. */
export function planTrimWorn(inv: AltheriumInventoryItem, quantity: number): InventoryPatch | null {
  const worn = readWorn(inv)
  const max = Math.max(0, quantity)
  if (worn.length <= max) return null
  const kept = worn.slice(0, max)
  return { worn: kept, equipped: kept.length > 0, equipped_zone: kept[0]?.zone ?? null }
}

/** Desgaste do combate: o dano não passou do DB, a peça daquela parte perde 10%. */
export function planArmorWear(inventory: AltheriumInventoryItem[], zone: BodyZoneId, amount = ARMOR_WEAR_PERCENT): ItemPatch | null {
  const piece = zonePiece(inventory, zone)
  if (!piece) return null
  const worn = readWorn(piece.inv).map((p) => (p.zone === zone ? { ...p, integrity: applyWear(p.integrity, amount) } : p))
  return { id: piece.inv.id, patch: { worn } }
}

/** Reparo de uma peça vestida: só a Integridade daquela parte muda. */
export function planRepairPiece(inv: AltheriumInventoryItem, zone: BodyZoneId, to: number): InventoryPatch {
  return { worn: readWorn(inv).map((p) => (p.zone === zone ? { ...p, integrity: clampPct(to) } : p)) }
}

/** Unidades de uma armadura que estão na mochila (as que usam o `integrity` da linha). */
export function unwornCount(inv: AltheriumInventoryItem): number {
  return Math.max(0, Math.max(1, inv.quantity) - readWorn(inv).length)
}
