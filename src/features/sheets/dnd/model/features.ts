import type { DndFeatureSource } from '../../../../shared/types'
import { BACKGROUNDS, CLASSES, RACES, getBackground, getClass, getRace } from '../catalog'
import { CLASS_OPTIONS, CLASS_OPTION_LABEL, classOptionFeatureKey, type ClassOptionKind } from '../catalog/classOptions'

// ────────────────────────────────────────────────────────
// Características que o catálogo dá ao personagem: de classe e subclasse (até
// o nível em que ele está), de raça e sub-raça e do antecedente. A chave
// gravada na ficha é única por origem (`fighter__second_wind`), pra duas
// classes com a mesma característica (Ataque Extra, Conjuração) não colidirem.
// ────────────────────────────────────────────────────────

export interface CatalogFeatureRef {
  source:   DndFeatureSource
  /** Chave gravada na ficha (feature_key). */
  key:      string
  name:     string
  original: string
  level:    number
  summary:  string
  /** Quem dá: "Guerreiro", "Anão", "Acólito"... */
  origin:   string
}

/** Aumento de Atributo e escolha de subclasse entram em outros fluxos (criador e subida de nível). */
const SKIPPED = new Set(['ability_score_improvement'])

export function featureKey(...parts: string[]): string {
  return parts.join('__').slice(0, 80)
}

export interface ClassRowLike { class_key: string; level: number; subclass_key: string | null }

/** Tudo que o catálogo dá a este personagem agora, ordenado por origem e nível. */
export function availableFeatures(
  classes: readonly ClassRowLike[],
  raceKey: string | null,
  subraceKey: string | null,
  backgroundKey: string | null,
): CatalogFeatureRef[] {
  const out: CatalogFeatureRef[] = []

  for (const row of classes) {
    const def = getClass(row.class_key)
    if (!def) continue
    for (const f of def.features) {
      if (f.level > row.level || SKIPPED.has(f.key)) continue
      out.push({ source: 'class', key: featureKey(def.key, f.key), name: f.name, original: f.original, level: f.level, summary: f.summary, origin: def.name })
    }
    const sub = row.subclass_key ? def.subclasses.find((s) => s.key === row.subclass_key) : undefined
    if (sub) {
      for (const f of sub.features) {
        if (f.level > row.level) continue
        out.push({ source: 'subclass', key: featureKey(def.key, sub.key, f.key), name: f.name, original: f.original, level: f.level, summary: f.summary, origin: sub.name })
      }
    }
  }

  const race = raceKey ? getRace(raceKey) : undefined
  if (race) {
    for (const t of race.traits) out.push({ source: 'race', key: featureKey('race', race.key, t.key), name: t.name, original: t.original, level: 1, summary: t.summary, origin: race.name })
    const sub = subraceKey ? race.subraces.find((s) => s.key === subraceKey) : undefined
    if (sub) for (const t of sub.traits) out.push({ source: 'subrace', key: featureKey('subrace', sub.key, t.key), name: t.name, original: t.original, level: 1, summary: t.summary, origin: sub.name })
  }

  const background = backgroundKey ? getBackground(backgroundKey) : undefined
  if (background?.feature) {
    const f = background.feature
    out.push({ source: 'background', key: featureKey('background', background.key, f.key), name: f.name, original: f.original, level: 1, summary: f.summary, origin: background.name })
  }

  const order: DndFeatureSource[] = ['race', 'subrace', 'background', 'class', 'subclass']
  return out.sort((a, b) => order.indexOf(a.source) - order.indexOf(b.source) || a.origin.localeCompare(b.origin, 'pt-BR') || a.level - b.level)
}

let registry: Map<string, CatalogFeatureRef> | null = null

/** Procura uma característica gravada na ficha no catálogo inteiro (pra mostrar o resumo). */
export function findCatalogFeature(source: DndFeatureSource, key: string): CatalogFeatureRef | undefined {
  if (!registry) {
    registry = new Map()
    for (const c of CLASSES) {
      const all = availableFeatures([{ class_key: c.key, level: 20, subclass_key: null }], null, null, null)
      for (const f of all) registry.set(`${f.source}:${f.key}`, f)
      for (const s of c.subclasses) {
        for (const f of availableFeatures([{ class_key: c.key, level: 20, subclass_key: s.key }], null, null, null)) registry.set(`${f.source}:${f.key}`, f)
      }
    }
    for (const o of CLASS_OPTIONS) {
      const def = getClass(o.classKey)
      registry.set(`class:${classOptionFeatureKey(o)}`, {
        source: 'class', key: classOptionFeatureKey(o), name: o.name, original: o.original, level: o.minLevel ?? 1,
        summary: o.prerequisite ? `Pré-requisito: ${o.prerequisite}. ${o.summary}` : o.summary,
        origin: `${def?.name ?? o.classKey} (${CLASS_OPTION_LABEL[o.kind]})`,
      })
    }
    for (const r of RACES) {
      for (const f of availableFeatures([], r.key, null, null)) registry.set(`${f.source}:${f.key}`, f)
      for (const s of r.subraces) for (const f of availableFeatures([], r.key, s.key, null)) registry.set(`${f.source}:${f.key}`, f)
    }
    for (const b of BACKGROUNDS) for (const f of availableFeatures([], null, null, b.key)) registry.set(`${f.source}:${f.key}`, f)
  }
  return registry.get(`${source}:${key}`)
}

/** As do catálogo que a ficha ainda não tem gravadas. */
export function missingFeatures(available: readonly CatalogFeatureRef[], have: readonly { source: DndFeatureSource; feature_key: string | null }[]): CatalogFeatureRef[] {
  const owned = new Set(have.filter((h) => h.feature_key).map((h) => `${h.source}:${h.feature_key}`))
  return available.filter((f) => !owned.has(`${f.source}:${f.key}`))
}

const ALLOWANCE_COLUMN: Record<ClassOptionKind, { classKey: string; column: string }> = {
  metamagic:  { classKey: 'sorcerer', column: 'metamagic_known' },
  invocation: { classKey: 'warlock',  column: 'invocations_known' },
}

/** Quantas opções (Metamagia, Invocações Místicas) a classe permite neste nível dela; 0 se a ficha não tem a classe. */
export function classOptionAllowance(kind: ClassOptionKind, classes: readonly ClassRowLike[]): number {
  const { classKey, column } = ALLOWANCE_COLUMN[kind]
  const row = classes.find((c) => c.class_key === classKey)
  const col = getClass(classKey)?.progression.find((p) => p.key === column)
  if (!row || !col) return 0
  return Number(col.values[Math.max(1, Math.min(20, row.level)) - 1]) || 0
}
