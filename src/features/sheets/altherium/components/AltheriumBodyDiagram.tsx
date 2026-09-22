import type { KeyboardEvent } from 'react'

export type BodyZone = 'db_cabeca' | 'db_bracos' | 'db_tronco' | 'db_pernas'

interface AltheriumBodyDiagramProps {
  values: Record<BodyZone, number>
  onZoneClick?: (zone: BodyZone) => void
}

const ZONE_LABELS: Record<BodyZone, string> = {
  db_cabeca: 'Cabeça',
  db_bracos: 'Braços',
  db_tronco: 'Tronco',
  db_pernas: 'Pernas',
}

/**
 * Silhueta em pose de braços/pernas abertos, dividida em 4 zonas que
 * espelham exatamente os campos de DB da ficha (cabeça/braços/tronco/
 * pernas) — sem tabela de equipamento própria: a zona "veste armadura"
 * visualmente assim que o DB daquele campo passa de 0. Clicar numa zona
 * leva o foco pro campo numérico correspondente.
 */
export function AltheriumBodyDiagram({ values, onZoneClick }: AltheriumBodyDiagramProps) {
  function zoneProps(zone: BodyZone, extraClass = '') {
    const armored = values[zone] > 0
    return {
      className: `alth-body__zone ${extraClass}${armored ? ' alth-body__zone--armored' : ''}`.trim(),
      onClick: onZoneClick ? () => onZoneClick(zone) : undefined,
      role: onZoneClick ? 'button' : undefined,
      tabIndex: onZoneClick ? 0 : undefined,
      'aria-label': `${ZONE_LABELS[zone]}: ${armored ? `${values[zone]} de proteção` : 'sem armadura'}`,
      onKeyDown: onZoneClick
        ? (e: KeyboardEvent<SVGElement>) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onZoneClick(zone) }
          }
        : undefined,
    }
  }

  return (
    <svg
      className="alth-body"
      viewBox="0 0 200 260"
      xmlns="http://www.w3.org/2000/svg"
      role={onZoneClick ? 'group' : 'img'}
      aria-label="Diagrama de proteção corporal"
    >
      {/* Pernas (1-3) */}
      <g {...zoneProps('db_pernas')}>
        <line x1="92" y1="148" x2="50" y2="244" />
        <line x1="108" y1="148" x2="150" y2="244" />
      </g>

      {/* Braços (4-6) */}
      <g {...zoneProps('db_bracos')}>
        <line x1="88" y1="72" x2="24" y2="44" />
        <line x1="112" y1="72" x2="176" y2="44" />
      </g>

      {/* Tronco (7-9) */}
      <g {...zoneProps('db_tronco')}>
        <line x1="100" y1="64" x2="100" y2="150" />
      </g>

      {/* Cabeça (10) */}
      <circle {...zoneProps('db_cabeca')} cx="100" cy="36" r="20" />
    </svg>
  )
}
