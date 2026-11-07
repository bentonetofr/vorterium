import type { Appearance, ZoneNpc } from '../../../vendor/vortable/vortable'
import { loadEngine, VORTABLE_ASSETS } from '../services/vortableService'
import type { VortableNet } from '../net/VortableNet'
import { announceAdd, announceRemove, zoneStorage } from '../enemies/enemies'

// ────────────────────────────────────────────────────────
// Animais do Vortable: cavalos (6 pelagens) e cachorros (4). O mestre põe na cena pelo painel "Animais" do controle ao vivo;
// cada um vira um NPC fixo da zona (id `anim-<bicho>-<pelagem>-<código>`) com o corpo de animal no lugar do corpo humano
// (peças `tlou/body/cavalo` e `tlou/body/cachorro`, desenhadas em scripts/tlou_art). Dá pra controlar como um NPC.
// ────────────────────────────────────────────────────────

export type SpeciesId = 'cavalo' | 'cachorro'

export interface Coat {
  id: string
  label: string
  /** Frase curta pro cartão. */
  blurb: string
}

export interface Species {
  id: SpeciesId
  label: string
  /** Id da peça de corpo no catálogo do personagem. */
  body: string
  role: string
  coats: Coat[]
  names: string[]
}

export const SPECIES: Species[] = [
  {
    id: 'cavalo', label: 'Cavalo', body: 'tlou/body/cavalo', role: 'Cavalo',
    coats: [
      { id: 'preto', label: 'Preto', blurb: 'Todo preto, brilhante.' },
      { id: 'malhado', label: 'Branco malhado', blurb: 'Branco com manchas laranja pelo corpo.' },
      { id: 'alazao', label: 'Alazão', blurb: 'Marrom meio alaranjado, crina escura.' },
      { id: 'palomino', label: 'Palomino', blurb: 'Dourado, de crina e rabo claros.' },
      { id: 'tordilho', label: 'Tordilho', blurb: 'Cinza rodado, de crina escura.' },
      { id: 'castanho', label: 'Castanho', blurb: 'Marrom-escuro, estrela na testa e meias brancas.' },
    ],
    names: ['Eclipse', 'Chama', 'Brasa', 'Sol', 'Neblina', 'Trovão', 'Relâmpago', 'Tempestade', 'Aurora', 'Sombra', 'Ferrugem', 'Vento', 'Lua', 'Centelha'],
  },
  {
    id: 'cachorro', label: 'Cachorro', body: 'tlou/body/cachorro', role: 'Cachorro',
    coats: [
      { id: 'classico', label: 'Clássico', blurb: 'Pastor alemão de sela preta e marrom.' },
      { id: 'preto', label: 'Preto', blurb: 'Pastor alemão preto.' },
      { id: 'sable', label: 'Sable', blurb: 'Pastor alemão marrom com o lombo escuro.' },
      { id: 'branco', label: 'Branco', blurb: 'Pastor alemão branco.' },
    ],
    names: ['Rex', 'Thor', 'Duque', 'Luna', 'Nina', 'Max', 'Bolt', 'Zeus', 'Mel', 'Trovão', 'Sombra', 'Fera', 'Apolo', 'Kira', 'Hugo', 'Bella', 'Rocky', 'Lobo'],
  },
]

export const speciesById = (id: string): Species | undefined => SPECIES.find((s) => s.id === id)

/** O NPC é um animal colocado pelo painel? (id `anim-<bicho>-<pelagem>-<código>`) */
export const isAnimalNpc = (id: string) => id.startsWith('anim-')

/** A aparência de um animal: o corpo dele e a cabeça vazia (que ocupa o lugar da cabeça humana). */
export async function animalAppearance(species: Species, coat: Coat): Promise<Appearance> {
  const engine = await loadEngine()
  const data = await engine.loadCharacterData(VORTABLE_ASSETS)
  const base = engine.defaultAppearance('male')
  const look = engine.normalizeAppearance(data, { ...base, slots: { body: { id: species.body, variant: coat.id }, head: { id: 'tlou/head/nenhuma' } } })
  // catálogo sem a arte do bicho (site desatualizado): o motor trocaria pelo corpo humano; melhor avisar
  if (look.slots.body?.id !== species.body) throw new Error(`Este site ainda não tem a arte de ${species.label.toLowerCase()} (catálogo de personagem desatualizado). Atualize o site e tente de novo.`)
  return look
}

export interface PlaceAnimalsOptions {
  campaignId: string
  worldId: string
  worldName: string
  zoneId: string
  species: Species
  coat: Coat
  count: number
  /** Perto de onde (px). null = no ponto de partida da zona. */
  anchor: { x: number; y: number } | null
  /** Quão espalhados (tiles). */
  spread: number
  /** O primeiro fica exatamente no ponto (solto com o mouse). */
  exact?: boolean
  /** Mostra o nome sobre a cabeça. */
  showName: boolean
  net: VortableNet | null
}

const code = () => Math.random().toString(36).slice(2, 7)
const rnd = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)]

/** Põe os animais na zona (grava na zona e avisa os jogadores). Devolve os ids. */
export async function placeAnimals(o: PlaceAnimalsOptions): Promise<string[]> {
  const worlds = await zoneStorage(o)
  const zone = await worlds.load(o.zoneId)
  if (!zone) throw new Error('Não achei esta zona.')
  const appearance = await animalAppearance(o.species, o.coat)
  const base = o.anchor ?? zone.spawn
  const maxX = zone.width * 32 - 20
  const maxY = zone.height * 32 - 20
  const taken = new Set((zone.npcs ?? []).map((n) => n.name))
  const added: ZoneNpc[] = []
  for (let i = 0; i < o.count; i++) {
    const angle = Math.random() * Math.PI * 2
    const r = o.exact && i === 0 ? 0 : o.count === 1 && o.spread <= 1.5 && !o.exact ? 56 : (Math.max(o.spread, 1.5) * 32) * (0.45 + Math.random() * 0.55)
    // nome do bicho: um que ainda não está em uso (se acabarem os da lista, numera)
    const free = o.species.names.filter((n) => !taken.has(n))
    const name = free.length ? rnd(free) : `${o.species.label} ${taken.size + 1}`
    taken.add(name)
    added.push({
      id: `anim-${o.species.id}-${o.coat.id}-${code()}`,
      name,
      role: `${o.species.role} (${o.coat.label.toLowerCase()})`,
      appearance,
      x: Math.max(20, Math.min(maxX, Math.round(base.x + Math.cos(angle) * r))),
      y: Math.max(40, Math.min(maxY, Math.round(base.y + Math.sin(angle) * r))),
      dir: rnd(['down', 'left', 'right', 'up'] as const),
      ...(o.showName ? { showName: true } : {}),
    })
  }
  announceAdd(o.net, o.zoneId, added)      // aparece na hora; a gravação vem em seguida
  await worlds.save({ ...zone, npcs: [...(zone.npcs ?? []), ...added] })
  return added.map((n) => n.id)
}

/** Tira animais da zona (os ids dados; sem ids, todos os animais). */
export async function removeAnimals(o: { campaignId: string; worldId: string; worldName: string; zoneId: string; net: VortableNet | null; ids?: string[] }): Promise<number> {
  const worlds = await zoneStorage(o)
  const zone = await worlds.load(o.zoneId)
  if (!zone) throw new Error('Não achei esta zona.')
  const keep = (zone.npcs ?? []).filter((n) => !(o.ids ? o.ids.includes(n.id) : isAnimalNpc(n.id)))
  const gone = (zone.npcs ?? []).filter((n) => !keep.includes(n)).map((n) => n.id)
  if (gone.length > 0) { announceRemove(o.net, o.zoneId, gone); await worlds.save({ ...zone, npcs: keep }) }
  return gone.length
}
