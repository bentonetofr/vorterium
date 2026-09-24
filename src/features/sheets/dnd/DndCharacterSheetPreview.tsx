import { useState } from 'react'
import { MOCK_CHARACTER } from './mockCharacter'
import { DndSheetHeader }    from './DndSheetHeader'
import { DndQuickStats }     from './DndQuickStats'
import { DndAbilitiesPanel } from './DndAbilitiesPanel'
import { DndResumoTab }      from './tabs/DndResumoTab'
import { DndCombateTab }     from './tabs/DndCombateTab'
import { DndMagiasTab }      from './tabs/DndMagiasTab'
import { DndInventarioTab }  from './tabs/DndInventarioTab'
import { DndTraitosTab }     from './tabs/DndTraitosTab'
import { DndAnotacoesTab }   from './tabs/DndAnotacoesTab'
import './DndCharacterSheet.css'

// ────────────────────────────────────────────────────────
// Abas internas
// ────────────────────────────────────────────────────────

type InnerTab = 'resumo' | 'atributos' | 'combate' | 'magias' | 'inventario' | 'tracos' | 'anotacoes'

const INNER_TABS: { id: InnerTab; label: string }[] = [
  { id: 'resumo',     label: 'Resumo'     },
  { id: 'atributos',  label: 'Atributos'  },
  { id: 'combate',    label: 'Combate'    },
  { id: 'magias',     label: 'Magias'     },
  { id: 'inventario', label: 'Inventário' },
  { id: 'tracos',     label: 'Traços'     },
  { id: 'anotacoes',  label: 'Anotações'  },
]

// ────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────

export function DndCharacterSheetPreview() {
  const [tab, setTab] = useState<InnerTab>('resumo')
  const character = MOCK_CHARACTER

  function renderTabContent() {
    switch (tab) {
      case 'resumo':     return <DndResumoTab     character={character} />
      case 'atributos':  return <DndAbilitiesTab  character={character} />
      case 'combate':    return <DndCombateTab     character={character} />
      case 'magias':     return <DndMagiasTab      character={character} />
      case 'inventario': return <DndInventarioTab  character={character} />
      case 'tracos':     return <DndTraitosTab     character={character} />
      case 'anotacoes':  return <DndAnotacoesTab   character={character} />
    }
  }

  return (
    <div className="dnd-sheet">
      {/* Banner de prévia */}
      <div className="dnd-preview-banner" role="status">
        ⚗ Prévia visual — dados de demonstração · salvamento no banco em breve
      </div>

      {/* Cabeçalho */}
      <DndSheetHeader character={character} />

      {/* Corpo — 3 colunas em tela larga */}
      <div className="dnd-body">
        {/* Coluna esquerda — stats rápidos */}
        <DndQuickStats character={character} />

        {/* Coluna central — atributos e perícias (visível apenas na aba atributos ou em tela larga) */}
        <div className="dnd-center-col-wrapper">
          <DndAbilitiesPanel character={character} />
        </div>

        {/* Coluna direita — abas de conteúdo */}
        <div className="dnd-right-col">
          <nav className="dnd-tabs-nav" role="tablist" aria-label="Seções da ficha">
            {INNER_TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={`dnd-tab-btn ${tab === t.id ? 'dnd-tab-btn--active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div key={tab} className="anim-tab-panel">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Aba Atributos inline — mostra AbilitiesPanel em tela pequena
// (em tela larga está sempre visível como coluna central)
// ────────────────────────────────────────────────────────

function DndAbilitiesTab({ character }: { character: typeof MOCK_CHARACTER }) {
  return (
    <div className="dnd-tab-content">
      <DndAbilitiesPanel character={character} />
    </div>
  )
}
