import { Fragment } from 'react'
import type { DndCharacterSpell } from '../../../../shared/types'
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

/** O mesmo cartão para a magia escrita à mão: escola e nível, os dados que a pessoa preencheu e o texto (com listas "• "). */
export function DndOwnSpellDetails({ spell }: { spell: DndCharacterSpell }) {
  const level = spellLevelLabel(spell.spell_level)
  const school = spell.school.trim()
  const base = spell.spell_level === 0 ? (school ? `Truque de ${school.toLowerCase()}` : 'Truque') : school ? `${school} de ${level}` : level
  const subtitle = spell.ritual ? `${base} (ritual)` : base
  const facts: [string, string][] = ([['Tempo de conjuração', spell.casting_time], ['Alcance', spell.spell_range], ['Duração', spell.duration]] as [string, string][])
    .map(([k, v]): [string, string] => [k, v.trim()]).filter(([, v]) => v)
  const lines = spell.description.split('\n').map((l) => l.trim()).filter(Boolean)
  return (
    <div className="dsh-spelltext">
      <p className="dsh-spelltext__sub">{subtitle}{spell.concentration ? ' · concentração' : ''}</p>
      {facts.length > 0 && (
        <dl className="dsh-facts dsh-facts--tight">
          {facts.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}
        </dl>
      )}
      {blocks(lines).map((b, i) => b.kind === 'p'
        ? <p key={i}>{b.text}</p>
        : <ul key={i}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>)}
    </div>
  )
}
