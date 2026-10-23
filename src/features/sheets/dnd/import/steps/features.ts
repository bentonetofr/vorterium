import type { DndFeatureSource } from '../../../../../shared/types'
import { availableFeatures, type CatalogFeatureRef } from '../../model/features'
import type { Ctx } from '../ctx'
import { clip, similarity, splitFeatureBlocks } from '../text'
import type { DraftFeature } from '../types'

// ────────────────────────────────────────────────────────
// Etapa 8: as características (talentos, raça, classe, antecedente e as
// extras) e os textos de personagem (traços, ideais, aparência, história). O
// texto de cada campo é dividido em blocos por título; os que são do catálogo
// entram ligados a ele, os outros como características livres com o texto do
// PDF. A pessoa confirma a lista de uma vez; o que for desmarcado não entra.
// ────────────────────────────────────────────────────────

interface Block {
  source: DndFeatureSource
  title: string
  body: string
  match: CatalogFeatureRef | null
  origin: string
}

/** Outros nomes (traduções oficiais do livro) de características do catálogo, vistos em fichas reais. */
const ALIASES: Record<string, string[]> = {
  bard__jack_of_all_trades: ['Versatilidade'],
  bard__expertise: ['Aptidão', 'Especialista'],
}

/** De quais origens do catálogo cada campo de texto do PDF pode ser (talentos não vêm do catálogo). */
const ALLOWED: Record<string, DndFeatureSource[] | null> = {
  feat: [], race: ['race', 'subrace'], class: ['class', 'subclass'], background: ['background'], manual: null,
}

const ORIGIN: Record<string, string> = { feat: 'Talentos', race: 'Traços raciais', class: 'Características de classe', background: 'Traço do antecedente', manual: 'Características adicionais' }

function blocks(c: Ctx): Block[] {
  const t = c.read.texts
  const available = availableFeatures(
    c.draft.classes.map((x) => ({ class_key: x.class_key, level: x.level, subclass_key: x.subclass_key })),
    c.draft.form.race_key || null, c.draft.form.subrace_key || null, c.draft.form.background_key || null,
  )
  const used = new Set<string>()
  const out: Block[] = []
  const add = (source: DndFeatureSource, text: string, bucket: string) => {
    const allowed = ALLOWED[source]
    for (const b of splitFeatureBlocks(text)) {
      const title = b.title.trim()
      let match: CatalogFeatureRef | null = null
      if (title) {
        const pool = available.filter((f) => !used.has(f.key) && (allowed == null || allowed.includes(f.source)))
        const best = pool.map((f) => ({ f, s: Math.max(...[f.name, f.original, ...(ALIASES[f.key] ?? [])].map((n) => similarity(title, n))) })).sort((a, z) => z.s - a.s)[0]
        if (best && best.s >= 0.85) { match = best.f; used.add(best.f.key) }
      }
      out.push({ source: match?.source ?? source, title, body: b.body, match, origin: bucket })
    }
  }
  add('feat', t.feats, ORIGIN.feat)
  add('race', t.racialTraits, ORIGIN.race)
  add('class', t.classFeatures, ORIGIN.class)
  add('background', t.backgroundFeature, ORIGIN.background)
  add('manual', t.additionalFeatures, ORIGIN.manual)
  // a tabela de habilidades da primeira página: só entra o que os textos acima ainda não cobrem
  for (const row of c.read.featureRows) {
    if (out.some((b) => b.title && similarity(b.title, row.name) >= 0.8)) continue
    const bits = [row.total ? `Dado ou total: ${row.total}` : '', row.left ? `Restantes: ${row.left}` : '', row.shortRest ? 'Recarrega em descanso curto' : '', row.longRest ? 'Recarrega em descanso longo' : '', row.dawn ? 'Recarrega ao amanhecer' : ''].filter(Boolean)
    out.push({ source: 'manual', title: row.name, body: bits.join('. '), match: null, origin: 'Tabela de habilidades' })
  }
  return out
}

function features(c: Ctx): void {
  const list = blocks(c)
  const out: DraftFeature[] = []
  if (list.length > 0) {
    const chosen = new Set(c.askMulti({
      id: 'features', section: 'Características', kind: 'multi',
      title: 'Estas são as características do personagem. Está certo?',
      body: 'Dividi os textos de características do PDF em blocos pelo título. As que reconheci do catálogo entram ligadas a ele; as outras entram com o texto do PDF. Desmarque o que não deve entrar.',
      options: list.map((b, i) => ({
        value: String(i), checked: true,
        label: b.match ? b.match.name : b.title || `(sem título) ${clip(b.body, 40)}`,
        hint: [b.match ? `do catálogo (${b.match.origin})` : 'texto do PDF', b.origin, b.match ? '' : clip(b.body, 80)].filter(Boolean).join(' · '),
      })),
    }))
    list.forEach((b, i) => {
      if (!chosen.has(String(i))) return
      if (b.match) out.push({ source: b.match.source, feature_key: b.match.key, name: b.match.name, level: b.match.level, notes: '' })
      else out.push({ source: b.source, feature_key: null, name: (b.title || clip(b.body, 60)).slice(0, 120), level: null, notes: (b.title ? b.body : '').slice(0, 2000) })
    })
  }
  c.draft.features = out
  if (out.length) c.note(`Características: ${out.length} (${out.filter((f) => f.feature_key).length} do catálogo)`)
}

// ── Textos do personagem ────────────────────────────────

function texts(c: Ctx): void {
  const { texts: t, bio } = c.read
  const f = c.draft.form
  const cap = (s: string, n: number) => s.slice(0, n)
  if (t.personality) f.personality_traits = cap(t.personality, 2000)
  if (t.ideals) f.ideals = cap(t.ideals, 2000)
  if (t.bonds) f.bonds = cap(t.bonds, 2000)
  if (t.flaws) f.flaws = cap(t.flaws, 2000)

  const history: string[] = []
  const notes: string[] = []
  const place = (id: string, title: string, label: string, text: string) => {
    const dest = c.askChoice({
      id, section: 'Textos', kind: 'choice', title, body: `${label}: "${clip(text, 140)}"`,
      options: [
        { value: 'history', label: 'Aba História', hint: 'No fim do texto da história do personagem.' },
        { value: 'notes', label: 'Anotações', hint: 'No campo de anotações da ficha.' },
        { value: 'skip', label: 'Não importar' },
      ],
      recommended: 'history',
    })
    if (dest === 'history') history.push(`${label}\n${text}`)
    else if (dest === 'notes') notes.push(`${label}\n${text}`)
  }
  if (t.appearance) place('dest:appearance', 'Onde coloco o texto de "Aparência do personagem"?', 'Aparência / anotações do PDF', t.appearance)
  const physical = [bio.age && `Idade: ${bio.age}`, bio.height && `Altura: ${bio.height}`, bio.weight && `Peso: ${bio.weight}`, bio.eyes && `Olhos: ${bio.eyes}`, bio.skin && `Pele: ${bio.skin}`, bio.hair && `Cabelo: ${bio.hair}`, bio.faction && `Facção: ${bio.faction}`].filter(Boolean).join(' · ')
  if (physical) place('dest:bio', 'Onde coloco a idade, a altura e os outros dados físicos?', 'Dados do personagem', physical)
  if (t.allies) place('dest:allies', 'Onde coloco "Aliados e organizações"?', 'Aliados e organizações', t.allies)
  if (t.madness) place('dest:madness', 'Onde coloco o texto de "Loucura"?', 'Loucura', t.madness)

  // o que já está escrito na ficha fica; o do PDF entra embaixo, sob uma linha de marcação
  const append = (old: string, added: string[]) => cap([old.trim() ? `${old.trim()}\n\n— Importado do PDF —` : '', ...added].filter(Boolean).join('\n\n'), 12000)
  if (history.length) f.backstory = append(f.backstory, history)
  if (notes.length) f.notes = append(f.notes, notes)
}

export const FEATURE_STEPS = [features, texts]
