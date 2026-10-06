import type { DndCharacter } from '../mockCharacter'

interface Props { character: DndCharacter }

export function DndResumoTab({ character: c }: Props) {
  return (
    <div className="dnd-tab-content">
      <div className="dnd-resume-grid">
        <div className="dnd-resume-field">
          <p className="dnd-section-title">Traços de Personalidade</p>
          <p className="dnd-text-block">{c.personalityTraits || '-'}</p>
        </div>
        <div className="dnd-resume-field">
          <p className="dnd-section-title">Ideais</p>
          <p className="dnd-text-block">{c.ideals || '-'}</p>
        </div>
        <div className="dnd-resume-field">
          <p className="dnd-section-title">Vínculos</p>
          <p className="dnd-text-block">{c.bonds || '-'}</p>
        </div>
        <div className="dnd-resume-field">
          <p className="dnd-section-title">Fraquezas</p>
          <p className="dnd-text-block">{c.flaws || '-'}</p>
        </div>
        <div className="dnd-resume-field dnd-resume-field--full">
          <p className="dnd-section-title">Aparência</p>
          <p className="dnd-text-block">{c.appearance || '-'}</p>
        </div>
      </div>
    </div>
  )
}
