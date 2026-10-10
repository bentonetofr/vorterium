import type { Appearance, ZoneData, ZoneNpc } from '../../../vendor/vortable/vortable'
import { createWorldStorage, loadEngine, VORTABLE_ASSETS } from '../services/vortableService'
import type { VortableNet } from '../net/VortableNet'
import type { SoundGroupId } from './creatureSounds'

// ────────────────────────────────────────────────────────
// Inimigos do Vortable (infectados no clima de The Last of Us). O mestre coloca na cena pelo painel do
// controle ao vivo: cada um vira um NPC fixo da zona (com a aparência da criatura), e os jogadores da zona
// recarregam e o veem na hora. Os desenhos são peças do catálogo do personagem (scripts/tlou_art/creatures.py).
// ────────────────────────────────────────────────────────

export type CreatureId = 'corredor' | 'espreitador' | 'estalador' | 'tropego' | 'baiacu'

export interface CreatureDef {
  id: CreatureId
  name: string
  /** Frase curta pro mestre. */
  blurb: string
  /** Dano por golpe (as regras da Terra Devastada Adaptada). */
  damage: number
  sound: SoundGroupId
  body: 'male' | 'muscular'
  skin: string
  height?: number
  weight?: -1 | 0 | 1
  slots: Record<string, { id: string; variant?: string; colors?: Record<string, string> }>
  /** Espaços do boneco padrão que somem (cabelo, por exemplo). */
  drop?: string[]
}

export const CREATURES: CreatureDef[] = [
  {
    id: 'corredor', name: 'Corredor', blurb: 'Infectado recente: rápido, ainda enxerga e corre atrás de quem vê.', damage: 1,
    sound: 'corredor', body: 'male', skin: 'zombie',
    slots: {
      clothes: { id: 'tlou/clothes/surrada', variant: 'cinza' }, legs: { id: 'tlou/legs/surrada', variant: 'jeans' },
      infection: { id: 'tlou/infection/veias' }, grime: { id: 'tlou/grime/sujeira', variant: 'pesada' },
    },
  },
  {
    id: 'espreitador', name: 'Espreitador', blurb: 'Silencioso e traiçoeiro: some nas sombras, ataca pelas costas e foge.', damage: 2,
    sound: 'espreitador', body: 'male', skin: 'ashen', drop: ['hair'],
    slots: {
      clothes: { id: 'tlou/clothes/surrada', variant: 'bege' }, legs: { id: 'tlou/legs/surrada', variant: 'preta' },
      infection: { id: 'tlou/infection/espreitador' }, grime: { id: 'tlou/grime/sujeira', variant: 'leve' },
    },
  },
  {
    id: 'estalador', name: 'Estalador', blurb: 'Cego, caça pelo som e ouve tudo. Um golpe de perto é morte na certa.', damage: 3,
    sound: 'estalador', body: 'male', skin: 'zombie_green', drop: ['hair'],
    slots: {
      clothes: { id: 'tlou/clothes/xadrez', variant: 'marrom' }, legs: { id: 'tlou/legs/surrada', variant: 'cargo' },
      infection: { id: 'tlou/infection/estalador' }, grime: { id: 'tlou/grime/sujeira', variant: 'lama' },
    },
  },
  {
    id: 'tropego', name: 'Trôpego', blurb: 'Inchado de bolsas de esporos: lento, resistente, e estoura em nuvem tóxica.', damage: 4,
    sound: 'tropego', body: 'male', skin: 'pale_green', drop: ['hair'], weight: 1,
    slots: {
      clothes: { id: 'tlou/clothes/surrada', variant: 'branca' }, legs: { id: 'tlou/legs/surrada', variant: 'jeans' },
      infection: { id: 'tlou/infection/tropego' }, grime: { id: 'tlou/grime/sujeira', variant: 'leve' },
    },
  },
  {
    id: 'baiacu', name: 'Baiacu', blurb: 'Enorme e blindado de fungo: aguenta tiros, joga esporos e esmaga quem chega perto.', damage: 6,
    sound: 'baiacu', body: 'muscular', skin: 'zombie', drop: ['hair', 'clothes'], height: 1.16, weight: 1,
    slots: {
      legs: { id: 'tlou/legs/surrada', variant: 'cargo' }, infection: { id: 'tlou/infection/baiacu' },
    },
  },
]

export const creatureById = (id: string): CreatureDef | undefined => CREATURES.find((c) => c.id === id)

/** Os NPCs de inimigo têm id `inim-<criatura>-<código>`. */
export function creatureOfNpc(npcId: string): CreatureDef | undefined {
  const m = /^inim-([a-z]+)-/.exec(npcId)
  return m ? creatureById(m[1]) : undefined
}

export async function creatureAppearance(def: CreatureDef): Promise<Appearance> {
  const engine = await loadEngine()
  const data = await engine.loadCharacterData(VORTABLE_ASSETS)
  const base = engine.defaultAppearance(def.body)
  const slots = { ...base.slots }
  for (const k of def.drop ?? []) delete slots[k]
  for (const [k, v] of Object.entries(def.slots)) slots[k] = { ...v }
  const a: Appearance = { ...base, body: def.body, skin: def.skin, slots }
  if (def.height) a.height = def.height
  if (def.weight != null) a.shape = { weight: def.weight }
  return engine.normalizeAppearance(data, a)
}

export type Anchor = { x: number; y: number } | null

export interface PlaceOptions {
  campaignId: string
  worldId: string
  worldName: string
  zoneId: string
  creature: CreatureDef
  count: number
  /** Perto de onde (px). null = no ponto de partida da zona. */
  anchor: Anchor
  /** Quão espalhados (tiles). */
  spread: number
  /** O primeiro fica exatamente no ponto (solto com o mouse); os outros, em volta. */
  exact?: boolean
  net: VortableNet | null
}

function storage(o: { campaignId: string; worldId: string; worldName: string; net: VortableNet | null }) {
  return createWorldStorage(o.campaignId, o.worldId, o.worldName, (id) => {
    // quem joga nesta zona recarrega; a câmera do mestre também
    const msg = { t: 'zone', id }
    o.net?.send(msg)
    o.net?.sink?.(msg)
  })
}

const code = () => Math.random().toString(36).slice(2, 7)

/** Põe os inimigos na zona (grava na zona e avisa os jogadores). Devolve os ids. */
export async function placeEnemies(o: PlaceOptions): Promise<string[]> {
  const worlds = await storage(o)
  const zone = await worlds.load(o.zoneId)
  if (!zone) throw new Error('Não achei esta zona.')
  const appearance = await creatureAppearance(o.creature)
  const base = o.anchor ?? zone.spawn
  const maxX = zone.width * 32 - 20
  const maxY = zone.height * 32 - 20
  const sameKind = (zone.npcs ?? []).filter((n) => n.id.startsWith(`inim-${o.creature.id}-`)).length
  const added: ZoneNpc[] = []
  for (let i = 0; i < o.count; i++) {
    const angle = Math.random() * Math.PI * 2
    const r = o.exact && i === 0 ? 0 : o.count === 1 && o.spread <= 1.5 && !o.exact ? 56 : (Math.max(o.spread, 1.5) * 32) * (0.45 + Math.random() * 0.55)
    const x = Math.max(20, Math.min(maxX, Math.round(base.x + Math.cos(angle) * r)))
    const y = Math.max(40, Math.min(maxY, Math.round(base.y + Math.sin(angle) * r)))
    added.push({
      id: `inim-${o.creature.id}-${code()}`,
      name: `${o.creature.name} ${sameKind + i + 1}`,
      role: `Infectado, dano ${o.creature.damage}`,
      appearance,
      x, y,
      dir: (['down', 'left', 'right', 'up'] as const)[Math.floor(Math.random() * 4)],
    })
  }
  const next: ZoneData = { ...zone, npcs: [...(zone.npcs ?? []), ...added] }
  await worlds.save(next)
  return added.map((n) => n.id)
}

/** Tira inimigos da zona (os ids dados; sem ids, todos os inimigos). */
export async function removeEnemies(o: { campaignId: string; worldId: string; worldName: string; zoneId: string; net: VortableNet | null; ids?: string[] }): Promise<number> {
  const worlds = await storage(o)
  const zone = await worlds.load(o.zoneId)
  if (!zone) throw new Error('Não achei esta zona.')
  const keep = (zone.npcs ?? []).filter((n) => !(o.ids ? o.ids.includes(n.id) : n.id.startsWith('inim-')))
  const removed = (zone.npcs ?? []).length - keep.length
  if (removed > 0) await worlds.save({ ...zone, npcs: keep })
  return removed
}
