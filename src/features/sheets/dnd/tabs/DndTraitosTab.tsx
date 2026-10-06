import type { DndCharacter } from '../mockCharacter'

interface Props { character: DndCharacter }

export function DndTraitosTab({ character: c }: Props) {
  return (
    <div className="dnd-tab-content">
      {/* Habilidades de classe */}
      <div>
        <p className="dnd-section-title">Habilidades e Traços</p>
        <div className="dnd-features-list">
          {c.features.map((feat, i) => (
            <div key={i} className="dnd-feature-item">{feat}</div>
          ))}
        </div>
      </div>

      {/* Proficiências */}
      <div>
        <p className="dnd-section-title">Proficiências</p>
        <p className="dnd-text-block">{c.proficienciesText || '-'}</p>
      </div>

      {/* Idiomas */}
      <div>
        <p className="dnd-section-title">Idiomas</p>
        <div className="dnd-tags">
          {c.languages.map((lang) => (
            <span key={lang} className="dnd-tag">{lang}</span>
          ))}
        </div>
      </div>

      {/* Ferramentas */}
      {c.toolProficiencies.length > 0 && (
        <div>
          <p className="dnd-section-title">Ferramentas</p>
          <div className="dnd-tags">
            {c.toolProficiencies.map((tool) => (
              <span key={tool} className="dnd-tag">{tool}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
