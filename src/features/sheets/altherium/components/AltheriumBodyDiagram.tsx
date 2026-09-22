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

function lerpColor(ratio: number): string {
  const t = Math.max(0, Math.min(1, ratio))
  const [r, g, b] = BARE_RGB.map((c, i) => Math.round(c + (ARMORED_RGB[i] - c) * t))
  return `rgb(${r}, ${g}, ${b})`
}

/** Cor do segmento: mais dourado quanto mais DB naquela zona. */
function limbColor(db: number): string {
  return lerpColor(db / DB_VISUAL_MAX)
}

/**
 * Cor da junta (cotovelo/joelho): o INVERSO do segmento que ela conecta —
 * é assim na referência que o usuário mandou (cotovelo dourado com braço
 * cru, joelho cru com perna dourada), como se a esfera da junta fosse de
 * um material diferente da "manga".
 */
function jointColor(db: number): string {
  return lerpColor(1 - db / DB_VISUAL_MAX)
}

// Pontos do lado esquerdo (visão de quem olha o boneco de frente); o
// direito é o espelho em x=100. Coordenadas extraídas proporcionalmente
// da referência enviada pelo usuário (imagem 1086×1448 → viewBox 200×268).
const CENTER_X = 100
const mirror = (x: number) => CENTER_X * 2 - x

const SHOULDER = { x: 73, y: 68 }
const ELBOW    = { x: 62, y: 108 }
const WRIST    = { x: 57, y: 144 }
const HIP      = { x: 86, y: 126 }
const KNEE     = { x: 83, y: 175 }
const ANKLE    = { x: 82, y: 227 }

interface ZoneStyle extends CSSProperties { '--zone-color'?: string }

export function AltheriumBodyDiagram({ values, onZoneClick }: AltheriumBodyDiagramProps) {
  function limbProps(zone: BodyZone, shapeClass: 'alth-body__limb' | 'alth-body__mass') {
    const db = values[zone]
    const style: ZoneStyle = { '--zone-color': limbColor(db) }
    return groupProps(zone, db, shapeClass, style)
  }
  function jointProps(zone: BodyZone, shapeClass: 'alth-body__limb' | 'alth-body__mass') {
    const db = values[zone]
    const style: ZoneStyle = { '--zone-color': jointColor(db) }
    return groupProps(zone, db, shapeClass, style)
  }
  function groupProps(zone: BodyZone, db: number, shapeClass: string, style: ZoneStyle) {
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

  return (
    <svg
      className="alth-body"
      viewBox="0 0 200 268"
      xmlns="http://www.w3.org/2000/svg"
      role={onZoneClick ? 'group' : 'img'}
      aria-label="Diagrama de proteção corporal"
    >
      {/* Pernas: coxa + canela douram com o DB; joelho é o inverso */}
      <g {...limbProps('db_pernas', 'alth-body__limb')}>
        <line x1={HIP.x} y1={HIP.y} x2={KNEE.x} y2={KNEE.y} strokeWidth={15} />
        <line x1={mirror(HIP.x)} y1={HIP.y} x2={mirror(KNEE.x)} y2={KNEE.y} strokeWidth={15} />
        <line x1={KNEE.x} y1={KNEE.y} x2={ANKLE.x} y2={ANKLE.y} strokeWidth={12} />
        <line x1={mirror(KNEE.x)} y1={KNEE.y} x2={mirror(ANKLE.x)} y2={ANKLE.y} strokeWidth={12} />
      </g>
      <g {...jointProps('db_pernas', 'alth-body__mass')}>
        <circle cx={KNEE.x} cy={KNEE.y} r={7} />
        <circle cx={mirror(KNEE.x)} cy={KNEE.y} r={7} />
      </g>
      <g {...limbProps('db_pernas', 'alth-body__mass')}>
        <ellipse cx={ANKLE.x - 4} cy={ANKLE.y + 10} rx={11} ry={7} />
        <ellipse cx={mirror(ANKLE.x - 4)} cy={ANKLE.y + 10} rx={11} ry={7} />
      </g>

      {/* Braços: braço + antebraço douram com o DB; cotovelo é o inverso */}
      <g {...limbProps('db_bracos', 'alth-body__limb')}>
        <line x1={SHOULDER.x} y1={SHOULDER.y} x2={ELBOW.x} y2={ELBOW.y} strokeWidth={14} />
        <line x1={mirror(SHOULDER.x)} y1={SHOULDER.y} x2={mirror(ELBOW.x)} y2={ELBOW.y} strokeWidth={14} />
        <line x1={ELBOW.x} y1={ELBOW.y} x2={WRIST.x} y2={WRIST.y} strokeWidth={12} />
        <line x1={mirror(ELBOW.x)} y1={ELBOW.y} x2={mirror(WRIST.x)} y2={WRIST.y} strokeWidth={12} />
      </g>
      <g {...jointProps('db_bracos', 'alth-body__mass')}>
        <circle cx={ELBOW.x} cy={ELBOW.y} r={6} />
        <circle cx={mirror(ELBOW.x)} cy={ELBOW.y} r={6} />
      </g>
      <g {...limbProps('db_bracos', 'alth-body__mass')}>
        <ellipse cx={WRIST.x} cy={WRIST.y + 3} rx={7} ry={6} />
        <ellipse cx={mirror(WRIST.x)} cy={WRIST.y + 3} rx={7} ry={6} />
      </g>

      {/* Tronco: caixa torácica + pélvis */}
      <g {...limbProps('db_tronco', 'alth-body__mass')}>
        <path d="M 82 66 Q 79 68 79 80 Q 78 96 84 108 Q 87 112 92 112 L 108 112 Q 113 112 116 108 Q 122 96 121 80 Q 121 68 118 66 Q 109 62 100 62 Q 91 62 82 66 Z" />
        <path d="M 86 110 L 114 110 L 120 122 Q 100 140 80 122 Z" />
      </g>

      {/* Cabeça: crânio + pescoço */}
      <g {...limbProps('db_cabeca', 'alth-body__mass')}>
        <rect x={94} y={56} width={12} height={10} rx={3} />
        <circle cx={100} cy={40} r={17} />
      </g>
    </svg>
  )
}
