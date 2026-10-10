import type { TdaInventoryItem } from '../../../../shared/types'
import type { Appearance } from '../../../../vendor/vortable/vortable'

// ────────────────────────────────────────────────────────
// As armas da ficha no boneco do Vortable.
//
// Cada arma do inventário vira um desenho no boneco: na mão, nas costas ou
// no bolso (cintura). Os desenhos são as peças `tlou/weapon_*/<tipo>` do
// catálogo do personagem (geradas por scripts/make-tlou-art.py, ver
// scripts/tlou_art/weapons.py: as listas HAND/LONG/SMALL de lá são estas).
//
// Regra: no máximo uma arma em cada lugar. Quem marca "Onde fica" na arma
// manda; o resto é automático: a primeira arma sem marcação vai pra mão, armas
// compridas vão pras costas e as pequenas pro bolso.
// ────────────────────────────────────────────────────────

export type WeaponKind =
  | 'pistola' | 'revolver' | 'escopeta' | 'rifle' | 'taco' | 'cano' | 'machadinha'
  | 'facao' | 'faca' | 'arco' | 'molotov' | 'granada' | 'lanca-chamas'

export type Carry = 'mao' | 'costas' | 'bolso'

export const CARRY_LABELS: Record<Carry, string> = { mao: 'Na mão', costas: 'Nas costas', bolso: 'No bolso' }

/** Armas que têm desenho de ficar nas costas / no bolso (a mão aceita todas). */
export const LONG: readonly WeaponKind[] = ['escopeta', 'rifle', 'taco', 'cano', 'machadinha', 'facao', 'arco', 'lanca-chamas']
export const SMALL: readonly WeaponKind[] = ['pistola', 'revolver', 'faca', 'machadinha', 'facao', 'molotov', 'granada']

export type WeaponSlot = 'weapon_hand' | 'weapon_back' | 'weapon_hip'
export type WeaponLook = Partial<Record<WeaponSlot, WeaponKind>>

const SLOTS: WeaponSlot[] = ['weapon_hand', 'weapon_back', 'weapon_hip']
const SLOT_PREFIX = 'tlou/'

/** Palavras do nome da arma → tipo de desenho (a ordem importa: "facão" antes de "faca"). */
const KEYWORDS: [RegExp, WeaponKind][] = [
  [/lanca.?chamas|flamethrower|macarico/, 'lanca-chamas'],
  [/molotov|coquetel/, 'molotov'],
  [/granada|\bbombas?\b|dinamite|explosivo/, 'granada'],
  [/revolver|magnum|\.38|calibre 38/, 'revolver'],
  [/pistola|glock|9 ?mm|semiautomatica/, 'pistola'],
  [/escopeta|espingarda|shotgun|calibre 12|cano serrado/, 'escopeta'],
  [/rifle|fuzil|sniper|carabina|\bak\b|ar-?15|\bm4\b|\bcaca\b/, 'rifle'],
  [/\barcos?\b|besta|crossbow|\bbow\b/, 'arco'],
  [/machadinha|machado|\baxe\b|hatchet/, 'machadinha'],
  [/facao|machete|espada|sabre/, 'facao'],
  [/faca|canivete|punhal|adaga|lamina|\bshiv\b/, 'faca'],
  [/taco|bastao|\bpau\b|\bbat\b|clava|martelo|marreta/, 'taco'],
  [/\bcanos?\b|\bbarras?\b|\bferro\b|\bpipe\b|\btubo\b|pe de cabra|chave de roda/, 'cano'],
]

function plain(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Que desenho usar pra essa arma: pelo nome, e se não casar, pelo dano e pelo tipo. */
export function weaponKind(item: Pick<TdaInventoryItem, 'name' | 'level' | 'wtype'>): WeaponKind {
  const name = plain(item.name)
  for (const [re, kind] of KEYWORDS) if (re.test(name)) return kind
  if (item.wtype === 'consumivel') return item.level >= 6 ? 'granada' : 'molotov'
  switch (Math.max(1, Math.min(6, Math.round(item.level) || 1))) {
    case 1: return 'cano'
    case 2: return 'pistola'
    case 3: return 'escopeta'
    case 4: return 'rifle'
    case 5: return 'lanca-chamas'
    default: return 'granada'
  }
}

export function defaultCarry(kind: WeaponKind): Carry {
  return LONG.includes(kind) && !SMALL.includes(kind) ? 'costas' : SMALL.includes(kind) ? 'bolso' : 'mao'
}

interface Candidate { item: TdaInventoryItem; kind: WeaponKind }

/** Escolhe a arma de cada lugar (no máximo uma por lugar). */
export function pickWeaponLook(inventory: TdaInventoryItem[]): WeaponLook {
  const weapons: Candidate[] = inventory
    .filter((i) => i.kind === 'arma' && i.name.trim() && !(i.wtype === 'consumivel' && i.qty < 1))
    .map((item) => ({ item, kind: weaponKind(item) }))

  const look: WeaponLook = {}
  const used = new Set<Candidate>()
  const take = (slot: WeaponSlot, c: Candidate | undefined) => {
    if (!c || look[slot]) return
    look[slot] = c.kind
    used.add(c)
  }
  const free = () => weapons.filter((w) => !used.has(w))

  // mão: a marcada, senão a primeira sem marcação
  take('weapon_hand', free().find((w) => w.item.carry === 'mao') ?? free().find((w) => !w.item.carry))
  // costas: marcada (se couber), senão compridas sem marcação
  take('weapon_back', free().find((w) => w.item.carry === 'costas' && LONG.includes(w.kind))
    ?? free().find((w) => !w.item.carry && LONG.includes(w.kind) && !SMALL.includes(w.kind)))
  // bolso: marcada (se couber), senão pequenas sem marcação
  take('weapon_hip', free().find((w) => w.item.carry === 'bolso' && SMALL.includes(w.kind))
    ?? free().find((w) => !w.item.carry && SMALL.includes(w.kind)))
  // marcações que não couberam no lugar pedido tentam o outro
  take('weapon_hip', free().find((w) => w.item.carry === 'costas' && SMALL.includes(w.kind)))
  take('weapon_back', free().find((w) => w.item.carry === 'bolso' && LONG.includes(w.kind)))
  return look
}

export const weaponItemId = (slot: WeaponSlot, kind: WeaponKind) => `${SLOT_PREFIX}${slot}/${kind}`

/**
 * Põe as armas na aparência do boneco (só mexe nos três espaços de arma).
 * Corpo infantil não carrega arma: os espaços ficam vazios.
 */
export function applyWeaponLook(a: Appearance, look: WeaponLook): Appearance {
  const slots = { ...a.slots }
  for (const slot of SLOTS) {
    const kind = a.body === 'child' ? undefined : look[slot]
    if (kind) slots[slot] = { id: weaponItemId(slot, kind) }
    else delete slots[slot]
  }
  return { ...a, slots }
}
