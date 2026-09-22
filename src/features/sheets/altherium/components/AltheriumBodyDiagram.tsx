import type { CSSProperties, KeyboardEvent } from 'react'

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

// Maior DB de armadura única no catálogo do livro (Armadura do Guardião
// de Eryndor, 16DB) — referência pra "totalmente dourado" no gradiente.
// Acima disso (armadura + escudo empilhados) só satura no máximo.
const DB_VISUAL_MAX = 16

// Cores espelhando --bg-overlay (sem armadura) e --gilded-bright (armadura
// máxima) de index.css — hardcoded aqui porque a interpolação acontece em
// JS, não dá pra fazer contas em cima de var() diretamente.
const BARE_RGB:    [number, number, number] = [34, 42, 61]
const ARMORED_RGB: [number, number, number] = [212, 175, 55]

function armorColor(db: number): string {
  const ratio = Math.max(0, Math.min(1, db / DB_VISUAL_MAX))
  const [r, g, b] = BARE_RGB.map((c, i) => Math.round(c + (ARMORED_RGB[i] - c) * ratio))
  return `rgb(${r}, ${g}, ${b})`
}

// Pontos do lado esquerdo (visão de quem olha o boneco de frente); o
// direito é o espelho em x=100, garantindo simetria sem duplicar números.
const CENTER_X = 100
const mirror = (x: number) => CENTER_X * 2 - x

const SHOULDER = { x: 60, y: 94 }
const ELBOW    = { x: 34, y: 180 }
const WRIST    = { x: 38, y: 282 }
const HIP      = { x: 82, y: 222 }
const KNEE     = { x: 70, y: 318 }
const ANKLE    = { x: 76, y: 392 }

interface ZoneStyle extends CSSProperties { '--zone-color'?: string }

export function AltheriumBodyDiagram({ values, onZoneClick }: AltheriumBodyDiagramProps) {
  function zoneProps(zone: BodyZone, shapeClass: 'alth-body__limb' | 'alth-body__mass') {
    const db = values[zone]
    const style: ZoneStyle = { '--zone-color': armorColor(db) }
    return {
      className: `alth-body__zone ${shapeClass}`,
      style,
      onClick: onZoneClick ? () => onZoneClick(zone) : undefined,
      role: onZoneClick ? 'button' : undefined,
      tabIndex: onZoneClick ? 0 : undefined,
      'aria-label': `${ZONE_LABELS[zone]}: ${db > 0 ? `${db} de proteção` : 'sem armadura'}`,
      onKeyDown: onZoneClick
        ? (e: KeyboardEvent<SVGElement>) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onZoneClick(zone) }
          }
        : undefined,
    }
  }

  const limb = (zone: BodyZone) => zoneProps(zone, 'alth-body__limb')
  const mass = (zone: BodyZone) => zoneProps(zone, 'alth-body__mass')

  return (
    <svg
      className="alth-body"
      viewBox="0 0 200 400"
      xmlns="http://www.w3.org/2000/svg"
      role={onZoneClick ? 'group' : 'img'}
      aria-label="Diagrama de proteção corporal"
    >
      {/* Pernas: coxa, joelho, canela, pé — em par espelhado */}
      <g {...limb('db_pernas')}>
        <line x1={HIP.x} y1={HIP.y} x2={KNEE.x} y2={KNEE.y} strokeWidth={30} />
        <line x1={mirror(HIP.x)} y1={HIP.y} x2={mirror(KNEE.x)} y2={KNEE.y} strokeWidth={30} />
        <line x1={KNEE.x} y1={KNEE.y} x2={ANKLE.x} y2={ANKLE.y} strokeWidth={24} />
        <line x1={mirror(KNEE.x)} y1={KNEE.y} x2={mirror(ANKLE.x)} y2={ANKLE.y} strokeWidth={24} />
      </g>
      <g {...mass('db_pernas')}>
        <circle cx={KNEE.x} cy={KNEE.y} r={16} />
        <circle cx={mirror(KNEE.x)} cy={KNEE.y} r={16} />
        <rect x={ANKLE.x - 18} y={ANKLE.y - 4} width={36} height={16} rx={8} />
        <rect x={mirror(ANKLE.x) - 18} y={ANKLE.y - 4} width={36} height={16} rx={8} />
      </g>

      {/* Braços: braço, cotovelo, antebraço, mão — em par espelhado */}
      <g {...limb('db_bracos')}>
        <line x1={SHOULDER.x} y1={SHOULDER.y} x2={ELBOW.x} y2={ELBOW.y} strokeWidth={26} />
        <line x1={mirror(SHOULDER.x)} y1={SHOULDER.y} x2={mirror(ELBOW.x)} y2={ELBOW.y} strokeWidth={26} />
        <line x1={ELBOW.x} y1={ELBOW.y} x2={WRIST.x} y2={WRIST.y} strokeWidth={22} />
        <line x1={mirror(ELBOW.x)} y1={ELBOW.y} x2={mirror(WRIST.x)} y2={WRIST.y} strokeWidth={22} />
      </g>
      <g {...mass('db_bracos')}>
        <circle cx={ELBOW.x} cy={ELBOW.y} r={14} />
        <circle cx={mirror(ELBOW.x)} cy={ELBOW.y} r={14} />
        <ellipse cx={WRIST.x} cy={WRIST.y + 12} rx={15} ry={19} />
        <ellipse cx={mirror(WRIST.x)} cy={WRIST.y + 12} rx={15} ry={19} />
      </g>

      {/* Tronco: caixa torácica + pélvis */}
      <g {...mass('db_tronco')}>
        <path d="M 66 86 Q 64 80 76 78 L 124 78 Q 136 80 134 86 L 138 180 Q 138 196 122 200 L 78 200 Q 62 196 62 180 Z" />
        <path d="M 78 198 L 122 198 L 128 226 Q 100 240 72 226 Z" />
      </g>

      {/* Cabeça: crânio + pescoço */}
      <g {...mass('db_cabeca')}>
        <rect x={90} y={66} width={20} height={18} rx={6} />
        <circle cx={100} cy={42} r={30} />
      </g>
    </svg>
  )
}
