import type { DndCharacter } from '../mockCharacter'

interface Props { character: DndCharacter }

export function DndAnotacoesTab({ character: c }: Props) {
  return (
    <div className="dnd-tab-content">
      <div className="dnd-notes-field">
        <p className="dnd-section-title">História</p>
        <p className="dnd-text-block">{c.backstory || '-'}</p>
      </div>

      <div className="dnd-notes-field">
        <p className="dnd-section-title">Traços de Personalidade</p>
        <p className="dnd-text-block">{c.personalityTraits || '-'}</p>
      </div>

      <div className="dnd-notes-field">
        <p className="dnd-section-title">Ideais</p>
        <p className="dnd-text-block">{c.ideals || '-'}</p>
      </div>

      <div className="dnd-notes-field">
        <p className="dnd-section-title">Vínculos</p>
        <p className="dnd-text-block">{c.bonds || '-'}</p>
      </div>

      <div className="dnd-notes-field">
        <p className="dnd-section-title">Fraquezas</p>
        <p className="dnd-text-block">{c.flaws || '-'}</p>
      </div>

      <div className="dnd-notes-field">
        <p className="dnd-section-title">Notas Livres</p>
        <p className="dnd-text-block">{c.notes || '-'}</p>
      </div>
    </div>
  )
}
