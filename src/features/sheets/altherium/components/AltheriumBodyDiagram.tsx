import { useEffect, useReducer, useRef } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'

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
const DB_VISUAL_MAX = 16
const BARE_RGB:    [number, number, number] = [34, 42, 61]
const ARMORED_RGB: [number, number, number] = [212, 175, 55]

function lerpColor(ratio: number): string {
  const t = Math.max(0, Math.min(1, ratio))
  const [r, g, b] = BARE_RGB.map((c, i) => Math.round(c + (ARMORED_RGB[i] - c) * t))
  return `rgb(${r}, ${g}, ${b})`
}
function limbColor(db: number): string { return lerpColor(db / DB_VISUAL_MAX) }
function jointColor(db: number): string { return lerpColor(1 - db / DB_VISUAL_MAX) }

// Pontos do lado esquerdo; o direito é o espelho em x=100. Coordenadas
// proporcionais à referência do usuário (imagem 1086×1448 → viewBox 200×268).
const CENTER_X = 100
const mirror = (x: number) => CENTER_X * 2 - x

const NECK_PIVOT = { x: 100, y: 64 }
const SHOULDER = { x: 73, y: 68 }
const ELBOW    = { x: 62, y: 108 }
const WRIST    = { x: 57, y: 144 }
const HIP      = { x: 86, y: 126 }
const KNEE     = { x: 83, y: 175 }
const ANKLE    = { x: 82, y: 227 }

// ────────────────────────────────────────────────────────
// Articulações — cadeia cinemática (pai → filho) + física de mola
// ────────────────────────────────────────────────────────

type JointId =
  | 'neck'
  | 'shoulderL' | 'shoulderR'
  | 'elbowL'    | 'elbowR'
  | 'hipL'      | 'hipR'
  | 'kneeL'     | 'kneeR'

const JOINT_PIVOT: Record<JointId, { x: number; y: number }> = {
  neck: NECK_PIVOT,
  shoulderL: SHOULDER,               shoulderR: { x: mirror(SHOULDER.x), y: SHOULDER.y },
  elbowL: ELBOW,                     elbowR: { x: mirror(ELBOW.x), y: ELBOW.y },
  hipL: HIP,                         hipR: { x: mirror(HIP.x), y: HIP.y },
  kneeL: KNEE,                       kneeR: { x: mirror(KNEE.x), y: KNEE.y },
}
const JOINT_ZONE: Record<JointId, BodyZone> = {
  neck: 'db_cabeca',
  shoulderL: 'db_bracos', shoulderR: 'db_bracos', elbowL: 'db_bracos', elbowR: 'db_bracos',
  hipL: 'db_pernas',      hipR: 'db_pernas',      kneeL: 'db_pernas',  kneeR: 'db_pernas',
}
const JOINT_IDS = Object.keys(JOINT_PIVOT) as JointId[]

// Amplitude de movimento humana (graus, delta a partir da pose de descanso
// já desenhada = 0). Cotovelo e joelho são dobradiças: só flexionam pra um
// lado (valor negativo = flexiona, nesta convenção de eixo) e quase não
// hiperestendem. Ombro e quadril têm alcance maior, mas nada de giro livre.
const JOINT_RANGE: Record<JointId, readonly [number, number]> = {
  neck: [-35, 35],
  shoulderL: [-190, 60], shoulderR: [-190, 60],
  elbowL: [-140, 10],    elbowR: [-140, 10],
  hipL: [-110, 40],      hipR: [-110, 40],
  kneeL: [-140, 5],      kneeR: [-140, 5],
}
function clampToRange(id: JointId, angle: number): number {
  const [min, max] = JOINT_RANGE[id]
  return Math.max(min, Math.min(max, angle))
}

// Mola amortecida: ao soltar, a junta oscila em volta de onde parou e
// assenta — não é uma simulação de corpo inteiro, só "física de brinquedo".
const SPRING_STIFFNESS = 0.06
const SPRING_DAMPING   = 0.82
const VELOCITY_CLAMP   = 14
const SETTLE_EPSILON   = 0.03

function useJointRig() {
  const angles     = useRef<Record<JointId, number>>(Object.fromEntries(JOINT_IDS.map((j) => [j, 0])) as Record<JointId, number>)
  const velocities = useRef<Record<JointId, number>>(Object.fromEntries(JOINT_IDS.map((j) => [j, 0])) as Record<JointId, number>)
  const targets    = useRef<Record<JointId, number>>(Object.fromEntries(JOINT_IDS.map((j) => [j, 0])) as Record<JointId, number>)
  const settling   = useRef<Set<JointId>>(new Set())
  const dragging   = useRef<JointId | null>(null)
  const rafId      = useRef<number | null>(null)
  const cleanupDrag = useRef<(() => void) | null>(null)
  const [, bump] = useReducer((n: number) => n + 1, 0)

  function tick() {
    let stillActive = false
    settling.current.forEach((id) => {
      const angle = angles.current[id]
      const target = targets.current[id]
      let vel = velocities.current[id]
      const accel = (target - angle) * SPRING_STIFFNESS
      vel = (vel + accel) * SPRING_DAMPING
      const next = clampToRange(id, angle + vel)
      angles.current[id] = next
      velocities.current[id] = vel
      if (Math.abs(vel) < SETTLE_EPSILON && Math.abs(target - next) < SETTLE_EPSILON) {
        angles.current[id] = target
        velocities.current[id] = 0
        settling.current.delete(id)
      } else {
        stillActive = true
      }
    })
    bump()
    rafId.current = stillActive ? requestAnimationFrame(tick) : null
  }

  function startSettle(id: JointId) {
    settling.current.add(id)
    if (rafId.current == null) rafId.current = requestAnimationFrame(tick)
  }

  function beginDrag(id: JointId, svg: SVGSVGElement, startClientX: number, startClientY: number) {
    settling.current.delete(id)
    velocities.current[id] = 0
    dragging.current = id
    bump()

    const pivot = JOINT_PIVOT[id]
    const pointAngle = (clientX: number, clientY: number) => {
      const pt = svg.createSVGPoint()
      pt.x = clientX
      pt.y = clientY
      const p = pt.matrixTransform(svg.getScreenCTM()!.inverse())
      return Math.atan2(p.y - pivot.y, p.x - pivot.x) * (180 / Math.PI)
    }

    const startPointerAngle = pointAngle(startClientX, startClientY)
    const startJointAngle = angles.current[id]
    let lastAngle = startJointAngle
    let lastTime = performance.now()

    function onMove(e: globalThis.PointerEvent) {
      const delta = pointAngle(e.clientX, e.clientY) - startPointerAngle
      const nextAngle = clampToRange(id, startJointAngle + delta)
      angles.current[id] = nextAngle

      const now = performance.now()
      const dt = Math.max(1, now - lastTime)
      const rawVel = ((nextAngle - lastAngle) / dt) * 16
      velocities.current[id] = Math.max(-VELOCITY_CLAMP, Math.min(VELOCITY_CLAMP, rawVel))
      lastAngle = nextAngle
      lastTime = now
      bump()
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      cleanupDrag.current = null
      dragging.current = null
      targets.current[id] = angles.current[id]
      startSettle(id)
      bump()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    cleanupDrag.current = onUp
  }

  useEffect(() => () => {
    cleanupDrag.current?.()
    if (rafId.current != null) cancelAnimationFrame(rafId.current)
  }, [])

  return { angles, dragging, beginDrag }
}

// ────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────

interface ZoneStyle extends CSSProperties { '--zone-color'?: string }

export function AltheriumBodyDiagram({ values, onZoneClick }: AltheriumBodyDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const rig = useJointRig()

  function limbClickProps(zone: BodyZone, shapeClass: 'alth-body__limb' | 'alth-body__mass', colorFn: (db: number) => string) {
    const db = values[zone]
    const style: ZoneStyle = { '--zone-color': colorFn(db) }
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

  function rotate(id: JointId): string {
    const { x, y } = JOINT_PIVOT[id]
    return `rotate(${rig.angles.current[id]} ${x} ${y})`
  }

  function handleJointPointerDown(id: JointId) {
    return (e: ReactPointerEvent<SVGCircleElement>) => {
      e.stopPropagation()
      e.preventDefault()
      const svg = svgRef.current
      if (!svg) return
      rig.beginDrag(id, svg, e.clientX, e.clientY)
    }
  }

  function JointHandle({ id }: { id: JointId }) {
    const { x, y } = JOINT_PIVOT[id]
    const db = values[JOINT_ZONE[id]]
    const isDragging = rig.dragging.current === id
    return (
      <circle
        className={`alth-body__joint${isDragging ? ' alth-body__joint--dragging' : ''}`}
        cx={x} cy={y} r={id.startsWith('shoulder') || id.startsWith('hip') ? 5.5 : id === 'neck' ? 5 : 6.5}
        style={{ '--zone-color': jointColor(db) } as ZoneStyle}
        onPointerDown={handleJointPointerDown(id)}
        role="slider"
        aria-label={`Articulação: ${id}`}
        aria-valuenow={Math.round(rig.angles.current[id])}
        tabIndex={0}
      />
    )
  }

  return (
    <svg
      ref={svgRef}
      className={`alth-body${rig.dragging.current ? ' alth-body--dragging' : ''}`}
      viewBox="0 0 200 268"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Manequim articulado — arraste as articulações pra posar, clique nos membros pra editar a proteção"
    >
      {/* Pernas: cadeia quadril → joelho, cada lado com sua própria rotação aninhada */}
      {(['L', 'R'] as const).map((side) => {
        const hipId = `hip${side}` as JointId
        const kneeId = `knee${side}` as JointId
        const hipX = side === 'L' ? HIP.x : mirror(HIP.x)
        const kneeX = side === 'L' ? KNEE.x : mirror(KNEE.x)
        const ankleX = side === 'L' ? ANKLE.x : mirror(ANKLE.x)
        const footX = side === 'L' ? ANKLE.x - 4 : mirror(ANKLE.x - 4)
        return (
          <g key={hipId} transform={rotate(hipId)}>
            <g {...limbClickProps('db_pernas', 'alth-body__limb', limbColor)}>
              <line x1={hipX} y1={HIP.y} x2={kneeX} y2={KNEE.y} strokeWidth={15} />
            </g>
            <g transform={rotate(kneeId)}>
              <g {...limbClickProps('db_pernas', 'alth-body__limb', limbColor)}>
                <line x1={kneeX} y1={KNEE.y} x2={ankleX} y2={ANKLE.y} strokeWidth={12} />
              </g>
              <g {...limbClickProps('db_pernas', 'alth-body__mass', limbColor)}>
                <ellipse cx={footX} cy={ANKLE.y + 10} rx={11} ry={7} />
              </g>
              <JointHandle id={kneeId} />
            </g>
          </g>
        )
      })}

      {/* Braços: cadeia ombro → cotovelo */}
      {(['L', 'R'] as const).map((side) => {
        const shoulderId = `shoulder${side}` as JointId
        const elbowId = `elbow${side}` as JointId
        const shoulderX = side === 'L' ? SHOULDER.x : mirror(SHOULDER.x)
        const elbowX = side === 'L' ? ELBOW.x : mirror(ELBOW.x)
        const wristX = side === 'L' ? WRIST.x : mirror(WRIST.x)
        return (
          <g key={shoulderId} transform={rotate(shoulderId)}>
            <g {...limbClickProps('db_bracos', 'alth-body__limb', limbColor)}>
              <line x1={shoulderX} y1={SHOULDER.y} x2={elbowX} y2={ELBOW.y} strokeWidth={14} />
            </g>
            <g transform={rotate(elbowId)}>
              <g {...limbClickProps('db_bracos', 'alth-body__limb', limbColor)}>
                <line x1={elbowX} y1={ELBOW.y} x2={wristX} y2={WRIST.y} strokeWidth={12} />
              </g>
              <g {...limbClickProps('db_bracos', 'alth-body__mass', limbColor)}>
                <ellipse cx={wristX} cy={WRIST.y + 3} rx={7} ry={6} />
              </g>
              <JointHandle id={elbowId} />
            </g>
          </g>
        )
      })}

      {/* Tronco: raiz da cadeia, não gira */}
      <g {...limbClickProps('db_tronco', 'alth-body__mass', limbColor)}>
        <path d="M 82 66 Q 79 68 79 80 Q 78 96 84 108 Q 87 112 92 112 L 108 112 Q 113 112 116 108 Q 122 96 121 80 Q 121 68 118 66 Q 109 62 100 62 Q 91 62 82 66 Z" />
        <path d="M 86 110 L 114 110 L 120 122 Q 100 140 80 122 Z" />
      </g>

      {/* Cabeça: gira em torno da base do pescoço */}
      <g transform={rotate('neck')}>
        <g {...limbClickProps('db_cabeca', 'alth-body__mass', limbColor)}>
          <rect x={94} y={56} width={12} height={10} rx={3} />
          <circle cx={100} cy={40} r={17} />
        </g>
      </g>
      <JointHandle id="neck" />

      {/* Alças de ombro/quadril — pontos fixos, não se movem ao girar em torno de si mesmas */}
      <JointHandle id="shoulderL" />
      <JointHandle id="shoulderR" />
      <JointHandle id="hipL" />
      <JointHandle id="hipR" />
    </svg>
  )
}
