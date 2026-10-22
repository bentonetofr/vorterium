import type { SpellEntry } from '../catalog/types'
import { SPELL_SCHOOL_LABEL, spellComponentsLabel, spellLevelLabel } from '../catalog/spellUtils'

// ────────────────────────────────────────────────────────
// Texto completo de uma magia do catálogo: tempo, alcance, componentes,
// duração, descrição (com listas) e o que muda em níveis superiores.
// ────────────────────────────────────────────────────────

/** "Evocação de 3º nível (ritual)" no estilo do livro. */
export function spellSubtitle(s: SpellEntry): string {
  const base = s.level === 0 ? `Truque de ${SPELL_SCHOOL_LABEL[s.school].toLowerCase()}` : `${SPELL_SCHOOL_LABEL[s.school]} de ${spellLevelLabel(s.level)}`
  return s.ritual ? `${base} (ritual)` : base
}

/** Agrupa linhas "• " seguidas numa lista; o resto são parágrafos. */
function blocks(lines: readonly string[]): ({ kind: 'p'; text: string } | { kind: 'ul'; items: string[] })[] {
  const out: ({ kind: 'p'; text: string } | { kind: 'ul'; items: string[] })[] = []
  for (const line of lines) {
    if (line.startsWith('• ')) {
      const last = out[out.length - 1]
      if (last?.kind === 'ul') last.items.push(line.slice(2))
      else out.push({ kind: 'ul', items: [line.slice(2)] })
    } else out.push({ kind: 'p', text: line })
  }
  return out
}

export function DndSpellDetails({ spell }: { spell: SpellEntry }) {
  return (
    <div className="dsh-spelltext">
      <p className="dsh-spelltext__sub">{spellSubtitle(spell)}</p>
      <dl className="dsh-facts dsh-facts--tight">
        <dt>Tempo de conjuração</dt><dd>{spell.castingTime}</dd>
        <dt>Alcance</dt><dd>{spell.range}</dd>
        <dt>Componentes</dt><dd>{spellComponentsLabel(spell.components)}</dd>
        <dt>Duração</dt><dd>{spell.duration}</dd>
      </dl>
      {blocks(spell.text).map((b, i) => b.kind === 'p'
        ? <p key={i}>{b.text}</p>
        : <ul key={i}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>)}
      {spell.higher && <p><strong>Em níveis superiores.</strong> {spell.higher}</p>}
    </div>
  )
}
