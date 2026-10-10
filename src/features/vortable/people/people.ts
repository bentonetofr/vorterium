import type { Appearance, ZoneNpc } from '../../../vendor/vortable/vortable'
import { loadEngine, VORTABLE_ASSETS } from '../services/vortableService'
import type { VortableNet } from '../net/VortableNet'
import { applyWeaponLook, type WeaponKind, type WeaponLook } from '../../sheets/terraDevastadaAdaptada/utils/tdaWeaponLook'
import { announceAdd, announceRemove, zoneStorage } from '../enemies/enemies'

// ────────────────────────────────────────────────────────
// Gerador de pessoas (NPCs) do Vortable no clima de The Last of Us: sobreviventes, soldados da FEDRA, Vagalumes,
// saqueadores, caçadores, médicos e contrabandistas, com roupa, chapéu, mochila e armas que fazem sentido pra cada um.
// Cada sorteio é uma pessoa pronta (nome, função, aparência e armas); o mestre solta no mapa e ela vira um NPC fixo da zona.
// ────────────────────────────────────────────────────────

export type ArchetypeId = 'sobrevivente' | 'soldado' | 'oficial' | 'vagalume' | 'saqueador' | 'cacador' | 'medico' | 'contrabandista'
export type ArmsMode = 'auto' | 'none' | 'always'

export interface Archetype {
  id: ArchetypeId
  label: string
  blurb: string
}

export const ARCHETYPES: Archetype[] = [
  { id: 'sobrevivente', label: 'Sobrevivente', blurb: 'Gente comum que ainda está de pé: roupa surrada, mochila, às vezes uma arma improvisada.' },
  { id: 'soldado', label: 'Soldado da FEDRA', blurb: 'Farda camuflada, colete tático, capacete ou boné, às vezes máscara de gás. Quase sempre com rifle.' },
  { id: 'oficial', label: 'Oficial da FEDRA', blurb: 'Camuflado com boina ou boné, pistola na cintura. Dá as ordens.' },
  { id: 'vagalume', label: 'Vagalume', blurb: 'Milícia rebelde: xadrez e colete, boné ou bandana, rifle, escopeta ou arco.' },
  { id: 'saqueador', label: 'Saqueador', blurb: 'Bandido de estrada: bandana ou máscara, roupa suja, taco, machadinha ou escopeta.' },
  { id: 'cacador', label: 'Caçador', blurb: 'Vive na mata: camuflado ou xadrez, chapéu de aba, barba, rifle ou arco.' },
  { id: 'medico', label: 'Médico', blurb: 'Jaleco sujo, máscara e óculos. Quase nunca armado.' },
  { id: 'contrabandista', label: 'Contrabandista', blurb: 'Negocia de tudo: chapéu, mochila grande, pistola ou escopeta escondida.' },
]

export interface Person {
  /** Id do sorteio (pra arrastar). */
  key: string
  name: string
  role: string
  archetype: ArchetypeId
  appearance: Appearance
  look: WeaponLook
  /** As armas em texto, pro painel. */
  gear: string
}

type Slot = { id: string; variant?: string; colors?: Record<string, string> }

const rnd = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)]
const chance = (p: number) => Math.random() < p
const code = () => Math.random().toString(36).slice(2, 7)
function pickW<T>(items: readonly [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0)
  let r = Math.random() * total
  for (const [v, w] of items) { r -= w; if (r <= 0) return v }
  return items[0][0]
}

const SKINS = ['light', 'fair', 'peach', 'beige', 'tan', 'honey', 'caramel', 'amber', 'olive', 'bronze', 'brown', 'mocha', 'cocoa_skin', 'espresso_skin']
const HAIR_COLORS = ['black', 'dark_brown', 'chestnut', 'light_brown', 'dirty_blonde', 'auburn', 'gray', 'castanho-cinza', 'ruivo-queimado', 'grisalho-sujo', 'dark_gray']
const HAIR_M = ['hair/short/hair_messy1', 'hair/short/hair_messy2', 'hair/short/hair_parted', 'hair/bald/hair_buzzcut', 'hair/bald/hair_high_and_tight',
  'hair/short/hair_plain', 'hair/short/hair_cowlick', 'hair/short/hair_bedhead', 'hair/short/hair_unkempt', 'hair/curly/hair_curly_short', 'hair/afro/hair_natural', 'hair/short/hair_swoop']
const HAIR_F = ['hair/long/hair_long', 'hair/braids/hair_ponytail', 'hair/braids/hair_ponytail2', 'hair/bob/hair_bob', 'hair/long/hair_wavy', 'hair/short/hair_pixie',
  'hair/braids/hair_braid', 'hair/long/hair_long_straight', 'hair/long/hair_loose', 'hair/braids/hair_high_ponytail', 'hair/short/hair_messy1']
const BEARDS = ['hair/beards/beards_5oclock_shadow', 'hair/beards/beards_beard', 'hair/beards/beards_medium', 'hair/beards/beards_trimmed']
const STACHES = ['hair/mustaches/beards_mustache', 'hair/mustaches/beards_chevron', 'hair/mustaches/beards_horseshoe', 'hair/mustaches/beards_handlebar']

const NAMES_M = ['James', 'Marcus', 'Daniel', 'Tommy', 'Ray', 'Henry', 'Luke', 'Victor', 'Carl', 'Ben', 'Eli', 'Dean', 'Jesse', 'Walt', 'Sam', 'Nico', 'Frank', 'Owen', 'Mateo', 'Andre']
const NAMES_F = ['Maria', 'Tess', 'Anna', 'Claire', 'Nora', 'Lena', 'Rosa', 'Kate', 'June', 'Iris', 'Ellen', 'Dana', 'Mia', 'Sofia', 'Joan', 'Ruth', 'Carla', 'Bea', 'Hana', 'Vera']
const SURNAMES = ['Miller', 'Reyes', 'Cole', 'Walker', 'Brooks', 'Hayes', 'Torres', 'Novak', 'Dixon', 'Murphy', 'Foster', 'Kim', 'Ortiz', 'Price', 'Grant', 'Lowe', 'Rivera', 'Stone', 'Bell', 'Webb']

const WEAPON_LABEL: Record<WeaponKind, string> = {
  pistola: 'pistola', revolver: 'revólver', escopeta: 'escopeta', rifle: 'rifle', taco: 'taco', cano: 'cano de ferro', machadinha: 'machadinha',
  facao: 'facão', faca: 'faca', arco: 'arco', molotov: 'coquetel molotov', granada: 'granada', 'lanca-chamas': 'lança-chamas',
}

interface Arms { hand?: readonly [WeaponKind, number][]; back?: readonly [WeaponKind, number][]; hip?: readonly [WeaponKind, number][]; handP: number; backP: number; hipP: number }

const ARMS: Record<ArchetypeId, Arms> = {
  sobrevivente: { handP: 0.5, hand: [['faca', 3], ['cano', 3], ['taco', 3], ['pistola', 3], ['revolver', 1], ['machadinha', 2]], backP: 0.12, back: [['arco', 2], ['taco', 1]], hipP: 0.3, hip: [['faca', 3], ['pistola', 2]] },
  soldado: { handP: 1, hand: [['rifle', 6], ['escopeta', 2], ['pistola', 1]], backP: 0.35, back: [['rifle', 2], ['escopeta', 1]], hipP: 0.8, hip: [['pistola', 6], ['faca', 3], ['granada', 1]] },
  oficial: { handP: 1, hand: [['pistola', 5], ['revolver', 3]], backP: 0, hipP: 0.4, hip: [['faca', 1]] },
  vagalume: { handP: 1, hand: [['rifle', 4], ['escopeta', 3], ['pistola', 2], ['arco', 2]], backP: 0.4, back: [['rifle', 2], ['arco', 2], ['taco', 1]], hipP: 0.6, hip: [['pistola', 3], ['faca', 3], ['molotov', 1]] },
  saqueador: { handP: 1, hand: [['taco', 4], ['cano', 3], ['machadinha', 3], ['facao', 2], ['escopeta', 3], ['molotov', 1]], backP: 0.2, back: [['arco', 1], ['rifle', 1]], hipP: 0.5, hip: [['faca', 3], ['pistola', 2]] },
  cacador: { handP: 1, hand: [['rifle', 4], ['arco', 4], ['escopeta', 1]], backP: 0.4, back: [['escopeta', 1], ['arco', 1]], hipP: 0.8, hip: [['faca', 5], ['facao', 2]] },
  medico: { handP: 0.08, hand: [['faca', 1]], backP: 0, hipP: 0.25, hip: [['faca', 2], ['pistola', 2]] },
  contrabandista: { handP: 0.8, hand: [['pistola', 4], ['escopeta', 3], ['revolver', 2]], backP: 0.25, back: [['taco', 1], ['arco', 1]], hipP: 0.5, hip: [['faca', 3], ['pistola', 2]] },
}
const ANY_HAND: readonly [WeaponKind, number][] = [['faca', 2], ['cano', 2], ['taco', 2], ['pistola', 3], ['machadinha', 1]]

function rollLook(arch: ArchetypeId, mode: ArmsMode): WeaponLook {
  if (mode === 'none') return {}
  const a = ARMS[arch]
  const look: WeaponLook = {}
  if (a.hand && chance(a.handP)) look.weapon_hand = pickW(a.hand)
  if (a.back && chance(a.backP)) look.weapon_back = pickW(a.back)
  if (a.hip && chance(a.hipP)) look.weapon_hip = pickW(a.hip)
  // não repete o mesmo desenho na mão e no bolso, e as longas só vão nas costas
  if (look.weapon_hip && look.weapon_hip === look.weapon_hand) delete look.weapon_hip
  if (look.weapon_back && (look.weapon_back === look.weapon_hand)) delete look.weapon_back
  if (mode === 'always' && !look.weapon_hand) look.weapon_hand = pickW(ANY_HAND)
  return look
}

function gearText(look: WeaponLook): string {
  const parts: string[] = []
  if (look.weapon_hand) parts.push(`${WEAPON_LABEL[look.weapon_hand]} na mão`)
  if (look.weapon_back) parts.push(`${WEAPON_LABEL[look.weapon_back]} nas costas`)
  if (look.weapon_hip) parts.push(`${WEAPON_LABEL[look.weapon_hip]} na cintura`)
  return parts.length ? parts.join(', ') : 'desarmado'
}

// ── Roupas por tipo ──────────────────────────────────────

const cloth = (id: string, color: string): Slot => ({ id, colors: { color } })
const SHIRTS_CASUAL = (): Slot => pickW<Slot>([
  [{ id: 'tlou/clothes/xadrez', variant: rnd(['vermelha', 'verde', 'azul', 'marrom']) }, 4],
  [{ id: 'tlou/clothes/surrada', variant: rnd(['cinza', 'bege', 'branca']) }, 4],
  [cloth('torso/shirts/shortsleeve/torso_clothes_tshirt', rnd(['gray', 'olive', 'brown', 'navy', 'maroon', 'tan', 'forest', 'black'])), 3],
  [cloth('torso/shirts/longsleeve/torso_clothes_longsleeve', rnd(['gray', 'brown', 'forest', 'navy', 'tan', 'charcoal'])), 3],
  [cloth('torso/shirts/longsleeve/torso_clothes_longsleeve2_polo', rnd(['navy', 'maroon', 'gray', 'forest'])), 1],
])
const PANTS_CASUAL = (): Slot => pickW<Slot>([
  [{ id: 'tlou/legs/surrada', variant: rnd(['jeans', 'cargo', 'preta']) }, 5],
  [cloth('legs/pants/legs_pants', rnd(['navy', 'brown', 'charcoal', 'olive', 'khaki', 'black'])), 4],
])
const SHIRT_CAMO = (): Slot => ({ id: 'tlou/clothes/camuflada', variant: rnd(['floresta', 'floresta', 'urbana', 'deserto']) })
const PANTS_CAMO = (): Slot => ({ id: 'tlou/legs/camuflada', variant: rnd(['floresta', 'floresta', 'urbana', 'deserto']) })
const BOOTS = (): Slot => cloth(rnd(['feet/boots/feet_boots_basic', 'feet/boots/feet_boots_rim', 'feet/boots/feet_boots_fold']), rnd(['black', 'brown', 'espresso', 'charcoal']))
const SHOES = (): Slot => cloth(rnd(['feet/shoes/feet_shoes_basic', 'feet/boots/feet_boots_basic']), rnd(['brown', 'black', 'gray', 'tan']))
const VEST = (v: string[]): Slot => ({ id: 'tlou/armour/colete-tatico', variant: rnd(v) })
const HAT = (slug: string, v: string[]): Slot => ({ id: `tlou/hat/${slug}`, variant: rnd(v) })
const BANDANA = (): Slot => cloth(rnd(['headwear/coverings/bandana/hat_bandana', 'headwear/coverings/bandana/hat_bandana2']), rnd(['red', 'black', 'forest', 'brown', 'charcoal', 'olive']))
const GAS_MASK: Slot = { id: 'tlou/mask/mascara-gas' }
const PLAIN_MASK: Slot = { id: 'headwear/accessories/facial_mask_plain' }
const BACKPACK: Slot = { id: 'torso/backpack/backpack' }

interface Style {
  role: string[]
  slots: Record<string, Slot>
  /** Rank/título na frente do nome. */
  title?: string
  grime: [string, number][]
}

function style(arch: ArchetypeId, female: boolean): Style {
  const grime: [string, number][] = [['', 3], ['leve', 3], ['pesada', 2], ['lama', 1]]
  switch (arch) {
    case 'soldado': {
      const slots: Record<string, Slot> = { clothes: SHIRT_CAMO(), legs: PANTS_CAMO(), shoes: BOOTS(), armour: VEST(['oliva', 'preto', 'caqui']) }
      if (chance(0.62)) slots.hat = HAT('capacete', ['oliva', 'oliva', 'preto', 'camuflado'])
      else if (chance(0.5)) slots.hat = HAT('bone', ['oliva', 'camuflado', 'preto'])
      if (chance(0.25)) slots.mask = GAS_MASK
      if (chance(0.3)) slots.backpack = BACKPACK
      return { role: ['Soldado da FEDRA', 'Patrulha da FEDRA', 'Guarda do posto', 'Sentinela da FEDRA'], slots, title: rnd(['Sd.', 'Cb.', 'Sgt.']), grime: [['', 5], ['leve', 3], ['pesada', 1]] }
    }
    case 'oficial': {
      const slots: Record<string, Slot> = { clothes: SHIRT_CAMO(), legs: PANTS_CAMO(), shoes: BOOTS() }
      slots.hat = chance(0.6) ? HAT('boina', ['preto', 'oliva', 'vinho']) : HAT('bone', ['oliva', 'preto'])
      if (chance(0.5)) slots.armour = VEST(['preto', 'oliva'])
      return { role: ['Oficial da FEDRA', 'Comandante do posto', 'Capitão da FEDRA', 'Tenente da FEDRA'], slots, title: rnd(['Ten.', 'Cap.', 'Maj.']), grime: [['', 7], ['leve', 2]] }
    }
    case 'vagalume': {
      const slots: Record<string, Slot> = { clothes: SHIRTS_CASUAL(), legs: PANTS_CASUAL(), shoes: BOOTS() }
      if (chance(0.7)) slots.armour = VEST(['preto', 'oliva', 'caqui'])
      const r = Math.random()
      if (r < 0.4) slots.hat = HAT('bone', ['preto', 'vermelho', 'oliva', 'azul'])
      else if (r < 0.7) slots.hat = BANDANA()
      else if (r < 0.8) slots.hat = HAT('gorro', ['preto', 'cinza'])
      if (chance(0.6)) slots.backpack = BACKPACK
      return { role: ['Vagalume', 'Vagalume (batedor)', 'Vagalume (atirador)', 'Combatente dos Vagalumes'], slots, grime }
    }
    case 'saqueador': {
      const slots: Record<string, Slot> = { clothes: SHIRTS_CASUAL(), legs: PANTS_CASUAL(), shoes: BOOTS() }
      const r = Math.random()
      if (r < 0.45) slots.hat = BANDANA()
      else if (r < 0.7) slots.hat = HAT('gorro', ['preto', 'cinza', 'vermelho', 'verde'])
      if (chance(0.3)) slots.mask = PLAIN_MASK
      else if (chance(0.15)) slots.mask = GAS_MASK
      if (chance(0.35)) slots.armour = VEST(['preto', 'caqui'])
      return { role: ['Saqueador', 'Bandido de estrada', 'Assaltante', 'Predador'], slots, grime: [['pesada', 5], ['lama', 3], ['leve', 1]] }
    }
    case 'cacador': {
      const slots: Record<string, Slot> = { clothes: chance(0.5) ? SHIRT_CAMO() : SHIRTS_CASUAL(), legs: chance(0.5) ? PANTS_CAMO() : PANTS_CASUAL(), shoes: BOOTS() }
      slots.hat = chance(0.65) ? HAT('chapeu', ['marrom', 'caqui', 'preto']) : HAT('bone', ['oliva', 'camuflado', 'caqui'])
      if (chance(0.5)) slots.backpack = BACKPACK
      return { role: ['Caçador', 'Rastreador', 'Batedor da mata'], slots, grime: [['leve', 3], ['pesada', 3], ['lama', 2], ['', 1]] }
    }
    case 'medico': {
      const slots: Record<string, Slot> = { clothes: { id: 'tlou/clothes/surrada', variant: 'branca' }, legs: chance(0.5) ? { id: 'tlou/legs/surrada', variant: 'preta' } : PANTS_CASUAL(), shoes: SHOES() }
      slots.mask = chance(0.6) ? GAS_MASK : PLAIN_MASK
      if (chance(0.55)) slots.facial = { id: 'headwear/accessories/glasses/facial_glasses_round' }
      if (chance(0.5)) slots.backpack = BACKPACK
      return { role: ['Médico', 'Enfermeira de campo', 'Cientista', 'Paramédico'], slots, title: chance(0.4) ? (female ? 'Dra.' : 'Dr.') : undefined, grime: [['', 4], ['leve', 4], ['pesada', 1]] }
    }
    case 'contrabandista': {
      const slots: Record<string, Slot> = { clothes: SHIRTS_CASUAL(), legs: PANTS_CASUAL(), shoes: BOOTS() }
      slots.hat = chance(0.55) ? HAT('chapeu', ['marrom', 'preto', 'caqui']) : HAT('boina', ['preto', 'oliva', 'vinho'])
      slots.backpack = BACKPACK
      if (chance(0.3)) slots.facial = { id: 'headwear/accessories/glasses/facial_glasses_sunglasses' }
      return { role: ['Contrabandista', 'Mercador clandestino', 'Atravessador'], slots, grime: [['leve', 4], ['', 3], ['pesada', 2]] }
    }
    default: {
      const slots: Record<string, Slot> = { clothes: SHIRTS_CASUAL(), legs: PANTS_CASUAL(), shoes: SHOES() }
      if (chance(0.3)) slots.hat = chance(0.5) ? HAT('bone', ['preto', 'vermelho', 'azul', 'caqui']) : HAT('gorro', ['preto', 'cinza', 'vermelho', 'verde', 'azul'])
      if (chance(0.45)) slots.backpack = BACKPACK
      if (chance(0.15)) slots.facial = { id: 'headwear/accessories/glasses/facial_glasses' }
      return { role: ['Sobrevivente', 'Sobrevivente (viajante)', 'Morador do abrigo', 'Catador de suprimentos', 'Sobrevivente (ferido)'], slots, grime }
    }
  }
}

/** Sorteia uma pessoa do tipo pedido (sem tipo, qualquer uma). */
export async function rollPerson(arch: ArchetypeId | null, arms: ArmsMode = 'auto'): Promise<Person> {
  const type: ArchetypeId = arch ?? pickW<ArchetypeId>([['sobrevivente', 5], ['soldado', 3], ['vagalume', 2], ['saqueador', 2], ['cacador', 1], ['medico', 1], ['contrabandista', 1], ['oficial', 1]])
  const engine = await loadEngine()
  const data = await engine.loadCharacterData(VORTABLE_ASSETS)
  const female = chance(type === 'soldado' ? 0.25 : type === 'saqueador' ? 0.3 : 0.45)
  const body = female ? 'female' : 'male'
  const base = engine.defaultAppearance(body)
  const st = style(type, female)
  const hairColor = rnd(HAIR_COLORS)
  const slots: Record<string, Slot> = { ...base.slots }
  slots.hair = { id: rnd(female ? HAIR_F : HAIR_M), colors: { color: hairColor } }
  if (!female) {
    const beardP = type === 'cacador' ? 0.7 : type === 'saqueador' ? 0.5 : type === 'sobrevivente' ? 0.35 : type === 'oficial' ? 0.2 : 0.3
    if (chance(beardP)) slots.beard = { id: rnd(BEARDS), colors: { color: hairColor } }
    else if (chance(0.12)) slots.mustache = { id: rnd(STACHES), colors: { color: hairColor } }
  }
  Object.assign(slots, st.slots)
  const g = pickW(st.grime)
  if (g) slots.grime = { id: 'tlou/grime/sujeira', variant: g }
  const look = rollLook(type, arms)
  const named = applyWeaponLook({ ...base, body, skin: rnd(SKINS), slots }, look)
  const appearance = engine.normalizeAppearance(data, named)
  const first = rnd(female ? NAMES_F : NAMES_M)
  const name = st.title ? `${st.title} ${rnd(SURNAMES)}` : `${first} ${rnd(SURNAMES)}`
  return { key: code(), name, role: rnd(st.role), archetype: type, appearance, look, gear: gearText(look) }
}

export async function rollPeople(arch: ArchetypeId | null, n: number, arms: ArmsMode = 'auto'): Promise<Person[]> {
  return Promise.all(Array.from({ length: n }, () => rollPerson(arch, arms)))
}

export interface PlacePeopleOptions {
  campaignId: string
  worldId: string
  worldName: string
  zoneId: string
  people: Person[]
  anchor: { x: number; y: number } | null
  spread: number
  /** A primeira pessoa fica exatamente no ponto (solto com o mouse). */
  exact?: boolean
  showName: boolean
  net: VortableNet | null
}

/** Põe as pessoas na zona como NPCs fixos (grava e avisa os jogadores). Devolve os ids. */
export async function placePeople(o: PlacePeopleOptions): Promise<string[]> {
  const worlds = await zoneStorage(o)
  const zone = await worlds.load(o.zoneId)
  if (!zone) throw new Error('Não achei esta zona.')
  const base = o.anchor ?? zone.spawn
  const maxX = zone.width * 32 - 20
  const maxY = zone.height * 32 - 20
  const added: ZoneNpc[] = o.people.map((p, i) => {
    const angle = Math.random() * Math.PI * 2
    const r = o.exact && i === 0 ? 0 : (Math.max(o.spread, 1.5) * 32) * (0.45 + Math.random() * 0.55)
    return {
      id: `pess-${p.archetype}-${code()}`,
      name: p.name,
      role: p.gear === 'desarmado' ? p.role : `${p.role}, ${p.gear}`,
      appearance: p.appearance,
      x: Math.max(20, Math.min(maxX, Math.round(base.x + Math.cos(angle) * r))),
      y: Math.max(40, Math.min(maxY, Math.round(base.y + Math.sin(angle) * r))),
      dir: rnd(['down', 'left', 'right', 'up'] as const),
      showName: o.showName,
    }
  })
  announceAdd(o.net, o.zoneId, added)      // aparece na hora; a gravação vem em seguida
  await worlds.save({ ...zone, npcs: [...(zone.npcs ?? []), ...added] })
  return added.map((n) => n.id)
}

/** Tira as pessoas geradas da zona (os ids dados; sem ids, todas as geradas). */
export async function removePeople(o: { campaignId: string; worldId: string; worldName: string; zoneId: string; net: VortableNet | null; ids?: string[] }): Promise<number> {
  const worlds = await zoneStorage(o)
  const zone = await worlds.load(o.zoneId)
  if (!zone) throw new Error('Não achei esta zona.')
  const keep = (zone.npcs ?? []).filter((n) => !(o.ids ? o.ids.includes(n.id) : n.id.startsWith('pess-')))
  const gone = (zone.npcs ?? []).filter((n) => !keep.includes(n)).map((n) => n.id)
  if (gone.length > 0) { announceRemove(o.net, o.zoneId, gone); await worlds.save({ ...zone, npcs: keep }) }
  return gone.length
}
