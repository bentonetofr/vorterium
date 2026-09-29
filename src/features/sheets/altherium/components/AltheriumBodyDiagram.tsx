import { useEffect, useReducer, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'

export type BodyZone = 'db_cabeca' | 'db_bracos' | 'db_tronco' | 'db_pernas'
export type BodyDiagramVariant = 'protecao' | 'dano'
/** Físico do manequim, pela raiz: Berserker musculoso, Runaskin com runas
 *  pelo corpo, Pilar com tranças com física. null = manequim neutro. */
export type BodyBuild = 'berserker' | 'runaskin' | 'pilar' | null

interface AltheriumBodyDiagramProps {
  values:      Record<BodyZone, number>
  onZoneClick?: (zone: BodyZone) => void
  variant?:     BodyDiagramVariant
  /** Teto do gradiente ("100% da cor de destino"). Protecao usa o maior DB
   *  de armadura única do catálogo (16); dano usa a Vitalidade máxima da
   *  ficha, passada pelo chamador. */
  visualMax?:  number
  build?:      BodyBuild
  /** Sem pernas: elas somem e o manequim despenca no chão (easter egg do
   *  nome "Gutris" — ver AltheriumSheetForm). Voltando a false, ele levanta. */
  legless?:    boolean
}

const ZONE_LABELS: Record<BodyZone, string> = {
  db_cabeca: 'Cabeça',
  db_bracos: 'Braços',
  db_tronco: 'Tronco',
  db_pernas: 'Pernas',
}

// Maior DB de armadura única no catálogo do livro (Armadura do Guardião
// de Eryndor, 16DB) — referência pra "totalmente dourado" no gradiente
// da variante de proteção.
const PROTECTION_VISUAL_MAX = 16
const NEUTRAL_RGB:    [number, number, number] = [34, 42, 61]
const PROTECTION_RGB: [number, number, number] = [212, 175, 55]
// --danger-bright (rgba(255, 180, 171, 1)) — mesmo tom de "perigo" já
// usado no resto do app, pra manter a paleta consistente.
const WOUND_RGB:      [number, number, number] = [255, 180, 171]

function lerpColor(ratio: number, targetRgb: [number, number, number]): string {
  const t = Math.max(0, Math.min(1, ratio))
  const [r, g, b] = NEUTRAL_RGB.map((c, i) => Math.round(c + (targetRgb[i] - c) * t))
  return `rgb(${r}, ${g}, ${b})`
}

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
const HEAD     = { x: 100, y: 40 }

// ────────────────────────────────────────────────────────
// Articulações — cadeia cinemática (pai → filho) + física de mola
// ────────────────────────────────────────────────────────

type JointId =
  | 'neck'
  | 'shoulderL' | 'shoulderR'
  | 'elbowL'    | 'elbowR'
  | 'hipL'      | 'hipR'
  | 'kneeL'     | 'kneeR'

// Pivô = centro de rotação real da junta. A alça (handle) fica longe do
// pivô, na ponta do osso — segurar a mão pra girar o cotovelo, não um
// ponto minúsculo bem em cima da própria dobradiça. Isso dá um braço de
// alavanca longo e estável: perto do pivô, um pixel de mouse vira graus
// demais (tremido); longe dele, o controle fica preciso e previsível.
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
// lado e quase não hiperestendem. Ombro e quadril têm alcance maior, mas
// nada de giro livre.
//
// O sinal do ângulo não espelha sozinho: girar +N° em torno do pivô da
// direita e girar +N° em torno do pivô espelhado da esquerda produz o
// MESMO sentido absoluto na tela, não sentidos opostos — por isso o lado
// direito flexiona "pra fora" (longe do tronco) com delta negativo, mas
// esse mesmo delta negativo na esquerda flexiona "pra dentro" (cruzando
// por cima do tronco). O lado direito é a referência; a esquerda usa o
// intervalo espelhado (min/max trocados e invertidos) pra flexionar pro
// mesmo lado relativo ao corpo — pra fora, longe do tronco e da outra perna.
//
// O joelho dobra ao contrário do cotovelo: com a coxa levantada pro lado,
// a canela pende pra baixo (e não sobe como um antebraço). Por isso a
// faixa dele é a do cotovelo invertida.
const JOINT_RANGE: Record<JointId, readonly [number, number]> = {
  neck: [-35, 35],
  shoulderR: [-190, 60], shoulderL: [-60, 190],
  elbowR: [-140, 10],    elbowL: [-10, 140],
  hipR: [-110, 40],      hipL: [-40, 110],
  kneeR: [-5, 140],      kneeL: [-140, 5],
}
function clampToRange(id: JointId, angle: number): number {
  const [min, max] = JOINT_RANGE[id]
  return Math.max(min, Math.min(max, angle))
}

// atan2 salta de +180° pra -180° do outro lado do pivô — um arraste que
// passa por trás do pivô (comum ao levantar bem alto) cruza esse corte e
// fazia o ângulo "dar um 360" antes de bater no limite. Normaliza cada
// passo do arraste pra sempre pegar o caminho mais curto (no máximo 180°).
function normalizeAngleDelta(deg: number): number {
  let d = deg % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

// Mola amortecida — mas agora ela é o ÚNICO motor do ângulo, arrastando
// ou não. Durante o arraste ela persegue o alvo (ponteiro do mouse) com
// resposta ágil e pouco balanço, pra parecer responsivo, não largado. Ao
// soltar, troca pra uma mola mais solta que assenta com uma leve
// oscilação — a sensação de largar um boneco de verdade.
const DRAG_STIFFNESS    = 0.55
const DRAG_DAMPING      = 0.6
const RELEASE_STIFFNESS = 0.08
const RELEASE_DAMPING   = 0.8
const VELOCITY_CLAMP    = 40
const SETTLE_EPSILON    = 0.02

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
      const isDragging = dragging.current === id
      const stiffness = isDragging ? DRAG_STIFFNESS : RELEASE_STIFFNESS
      const damping   = isDragging ? DRAG_DAMPING   : RELEASE_DAMPING
      const angle = angles.current[id]
      const target = targets.current[id]
      let vel = velocities.current[id]
      const accel = (target - angle) * stiffness
      vel = Math.max(-VELOCITY_CLAMP, Math.min(VELOCITY_CLAMP, (vel + accel) * damping))
      const next = clampToRange(id, angle + vel)
      angles.current[id] = next
      velocities.current[id] = vel
      if (!isDragging && Math.abs(vel) < SETTLE_EPSILON && Math.abs(target - next) < SETTLE_EPSILON) {
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
    dragging.current = id
    startSettle(id)

    const pivot = JOINT_PIVOT[id]
    const pointAngle = (clientX: number, clientY: number) => {
      const pt = svg.createSVGPoint()
      pt.x = clientX
      pt.y = clientY
      const p = pt.matrixTransform(svg.getScreenCTM()!.inverse())
      return Math.atan2(p.y - pivot.y, p.x - pivot.x) * (180 / Math.PI)
    }

    // Acompanha o ângulo do ponteiro passo a passo (não a diferença total
    // desde o início do arraste) — cada passo entre dois eventos de
    // pointermove é sempre pequeno, então normalizar por passo nunca perde
    // a intenção de um arraste grande, só corrige o salto do corte de +-180°.
    let lastPointerAngle = pointAngle(startClientX, startClientY)

    function onMove(e: globalThis.PointerEvent) {
      const currentPointerAngle = pointAngle(e.clientX, e.clientY)
      const step = normalizeAngleDelta(currentPointerAngle - lastPointerAngle)
      lastPointerAngle = currentPointerAngle
      targets.current[id] = clampToRange(id, targets.current[id] + step)
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      cleanupDrag.current = null
      dragging.current = null
      bump()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    cleanupDrag.current = onUp
  }

  useEffect(() => () => {
    cleanupDrag.current?.()
    // Zera o id: no modo de desenvolvimento o React desmonta e remonta
    // tudo uma vez; um id velho aqui impedia o laço de voltar a rodar.
    if (rafId.current != null) cancelAnimationFrame(rafId.current)
    rafId.current = null
  }, [])

  /** Leva as juntas até uma pose pela mesma mola de quando se solta um membro. */
  function pose(next: Partial<Record<JointId, number>>) {
    (Object.keys(next) as JointId[]).forEach((id) => {
      targets.current[id] = clampToRange(id, next[id]!)
      startSettle(id)
    })
  }

  return { angles, dragging, beginDrag, pose }
}

// ────────────────────────────────────────────────────────
// Queda sem pernas — tempos batem com @keyframes alth-body-fall
// (AltheriumSheet.css): os braços sobem quando ele começa a cair e se
// apoiam no chão no impacto.
// ────────────────────────────────────────────────────────

const FALL_ARMS_UP_MS = 160
const FALL_IMPACT_MS  = 560
const POSE_FLAILING: Partial<Record<JointId, number>> = { shoulderL: 135, shoulderR: -135, elbowL: 45, elbowR: -45, neck: -8 }
const POSE_ON_FLOOR: Partial<Record<JointId, number>> = { shoulderL: 30, shoulderR: -30, elbowL: 10, elbowR: -10, neck: 10 }
const POSE_REST:     Partial<Record<JointId, number>> = { shoulderL: 0, shoulderR: 0, elbowL: 0, elbowR: 0, neck: 0 }

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

// ────────────────────────────────────────────────────────
// Tranças do Pilar — corda Verlet (pontos + restrição de distância)
// presa atrás das orelhas. Colide com o corpo: não atravessa a cabeça
// (que gira com o pescoço), apoia no ombro e escorrega pela frente do
// peito, e é empurrada pelos braços quando eles passam por ela. Reage ao
// corpo: balança quando a cabeça gira, quando um braço esbarra, quando o
// boneco despenca sem pernas e quando levanta. A ponta de cada trança
// também pode ser agarrada e arrastada. O loop só roda enquanto algo se
// mexe — parado, não gasta nada.
// ────────────────────────────────────────────────────────

type Pt = { x: number; y: number }

const BRAID_SEGMENTS = 9
const BRAID_SEG_LEN  = 7.5
/** Onde cada trança sai da cabeça (atrás da orelha), na pose de descanso. */
const BRAID_ANCHORS: readonly Pt[] = [{ x: 83, y: 50 }, { x: 117, y: 50 }]
const BRAID_GRAVITY  = 0.35
const BRAID_DAMPING  = 0.97
const BRAID_ITERATIONS = 10
const BRAID_SETTLE_FRAMES = 20
/** Metade da grossura desenhada da trança — a colisão usa a borda, não o centro. */
const BRAID_RADIUS = 3
const HEAD_RADIUS  = 17
/** Topo arredondado de cada ombro (o direito é espelhado). A trança cai
 *  por dentro do centro, então apoia e escorrega pro peito, não pro braço. */
const SHOULDER_CAP = { x: 78, y: 76, r: 10 }
/** O braço só colide da metade de cima pra baixo — o alto do ombro é o SHOULDER_CAP. */
const ARM_COLLIDE_FROM = 0.35
/** Passos simulados antes do primeiro desenho: a trança já nasce apoiada. */
const BRAID_PRESETTLE_STEPS = 240

type Circle  = { c: Pt; r: number }
type Capsule = { a: Pt; b: Pt; r: number }

/** Ângulos atuais das juntas que mexem nas tranças (graus). */
interface BraidPose {
  neck: number
  shoulderL: number; elbowL: number
  shoulderR: number; elbowR: number
}

interface BraidBody {
  upperArm: number
  forearm:  number
  hand:     { rx: number; ry: number }
}

function rotateAround(p: Pt, pivot: Pt, deg: number): Pt {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = p.x - pivot.x
  const dy = p.y - pivot.y
  return { x: pivot.x + dx * cos - dy * sin, y: pivot.y + dx * sin + dy * cos }
}

function lerpPt(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/** Empurra p pra fora do círculo (se estiver dentro). */
function outOfCircle(p: Pt, { c, r }: Circle): Pt {
  const dx = p.x - c.x
  const dy = p.y - c.y
  const d = Math.hypot(dx, dy)
  if (d >= r) return p
  if (d < 1e-4) return { x: c.x, y: c.y - r }
  return { x: c.x + (dx / d) * r, y: c.y + (dy / d) * r }
}

/** Empurra p pra fora da cápsula (segmento com raio). */
function outOfCapsule(p: Pt, { a, b, r }: Capsule): Pt {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const len2 = abx * abx + aby * aby || 1e-4
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2))
  return outOfCircle(p, { c: { x: a.x + abx * t, y: a.y + aby * t }, r })
}

function braidAnchors(pose: BraidPose): Pt[] {
  return BRAID_ANCHORS.map((a) => rotateAround(a, NECK_PIVOT, pose.neck))
}

/** Partes do corpo em que a trança bate, na pose atual. */
function braidColliders(pose: BraidPose, body: BraidBody): { circles: Circle[]; capsules: Capsule[] } {
  const circles: Circle[] = [
    { c: rotateAround(HEAD, NECK_PIVOT, pose.neck), r: HEAD_RADIUS + BRAID_RADIUS },
    { c: { x: SHOULDER_CAP.x, y: SHOULDER_CAP.y }, r: SHOULDER_CAP.r + BRAID_RADIUS },
    { c: { x: mirror(SHOULDER_CAP.x), y: SHOULDER_CAP.y }, r: SHOULDER_CAP.r + BRAID_RADIUS },
  ]
  const capsules: Capsule[] = []
  for (const side of ['L', 'R'] as const) {
    const m = (p: Pt) => (side === 'L' ? p : { x: mirror(p.x), y: p.y })
    const shoulderAngle = side === 'L' ? pose.shoulderL : pose.shoulderR
    const elbowAngle    = side === 'L' ? pose.elbowL    : pose.elbowR
    const shoulder = m(SHOULDER)
    const elbow = rotateAround(m(ELBOW), shoulder, shoulderAngle)
    const wrist = rotateAround(rotateAround(m(WRIST), m(ELBOW), elbowAngle), shoulder, shoulderAngle)
    capsules.push(
      { a: lerpPt(shoulder, elbow, ARM_COLLIDE_FROM), b: elbow, r: body.upperArm / 2 + BRAID_RADIUS },
      { a: elbow, b: wrist, r: body.forearm / 2 + BRAID_RADIUS },
    )
    circles.push({ c: { x: wrist.x, y: wrist.y + 3 }, r: Math.max(body.hand.rx, body.hand.ry) + BRAID_RADIUS })
  }
  return { circles, capsules }
}

/** Um passo da física (Verlet + restrições + colisões). Devolve o quanto algo se mexeu. */
function simulateBraids(
  points: Pt[][], previous: Pt[][], anchors: Pt[], pose: BraidPose, body: BraidBody,
  pinned: { braid: number; at: Pt } | null,
): number {
  const { circles, capsules } = braidColliders(pose, body)
  let motion = 0

  points.forEach((P, b) => {
    const Q = previous[b]
    const last = P.length - 1
    const tipPinned = pinned?.braid === b
    // Integra (Verlet): velocidade implícita = posição atual − anterior.
    for (let i = 1; i < P.length; i++) {
      const vx = (P[i].x - Q[i].x) * BRAID_DAMPING
      const vy = (P[i].y - Q[i].y) * BRAID_DAMPING + BRAID_GRAVITY
      Q[i] = { ...P[i] }
      P[i] = { x: P[i].x + vx, y: P[i].y + vy }
    }
    P[0] = anchors[b]
    Q[0] = anchors[b]
    if (tipPinned) P[last] = { ...pinned!.at }

    for (let k = 0; k < BRAID_ITERATIONS; k++) {
      // Corpo — cada gomo sai de dentro da cabeça, ombros, braços e mãos.
      // Vem antes das distâncias: se a trança ficar espremida (braço
      // contra a cabeça), ela encosta de leve em vez de esticar.
      for (let i = 1; i < P.length; i++) {
        if (tipPinned && i === last) continue
        let p = P[i]
        for (const circle of circles) p = outOfCircle(p, circle)
        for (const capsule of capsules) p = outOfCapsule(p, capsule)
        P[i] = p
      }
      // Distância entre gomos — o topo (âncora) e a ponta agarrada não se movem.
      for (let i = 0; i < last; i++) {
        const a = P[i]
        const c = P[i + 1]
        const dx = c.x - a.x
        const dy = c.y - a.y
        const dist = Math.hypot(dx, dy) || 0.0001
        const diff = (dist - BRAID_SEG_LEN) / dist
        const aFixed = i === 0
        const cFixed = tipPinned && i + 1 === last
        if (aFixed && cFixed) continue
        const wa = aFixed ? 0 : cFixed ? 1 : 0.5
        const wc = cFixed ? 0 : aFixed ? 1 : 0.5
        P[i]     = { x: a.x + dx * diff * wa, y: a.y + dy * diff * wa }
        P[i + 1] = { x: c.x - dx * diff * wc, y: c.y - dy * diff * wc }
      }
    }

    for (let i = 1; i < P.length; i++) {
      motion = Math.max(motion, Math.hypot(P[i].x - Q[i].x, P[i].y - Q[i].y))
    }
  })
  return motion
}

function hangingBraid(anchor: Pt): Pt[] {
  return Array.from({ length: BRAID_SEGMENTS + 1 }, (_, i) => ({ x: anchor.x, y: anchor.y + i * BRAID_SEG_LEN }))
}

const REST_POSE: BraidPose = { neck: 0, shoulderL: 0, elbowL: 0, shoulderR: 0, elbowR: 0 }

/** Tranças já assentadas (apoiadas no ombro) na pose de descanso. */
function settledBraids(body: BraidBody): { points: Pt[][]; previous: Pt[][] } {
  const points = BRAID_ANCHORS.map(hangingBraid)
  const previous = BRAID_ANCHORS.map(hangingBraid)
  const anchors = braidAnchors(REST_POSE)
  for (let n = 0; n < BRAID_PRESETTLE_STEPS; n++) simulateBraids(points, previous, anchors, REST_POSE, body, null)
  return { points, previous: points.map((P) => P.map((p) => ({ ...p }))) }
}

function poseKey(pose: BraidPose): string {
  return [pose.neck, pose.shoulderL, pose.elbowL, pose.shoulderR, pose.elbowR].map((n) => n.toFixed(2)).join(',')
}

function useBraids(enabled: boolean, getPose: () => BraidPose, body: BraidBody) {
  const initial  = useRef<ReturnType<typeof settledBraids> | null>(null)
  if (!initial.current) initial.current = settledBraids(body)
  const points   = useRef<Pt[][]>(initial.current.points)
  const previous = useRef<Pt[][]>(initial.current.previous)
  const lastPose = useRef<string | null>(null)
  const stillFrames = useRef(0)
  const rafId    = useRef<number | null>(null)
  const draggingTip = useRef<number | null>(null)
  const tipTarget   = useRef<Pt>({ x: 0, y: 0 })
  const cleanupDrag = useRef<(() => void) | null>(null)
  const bodyRef  = useRef(body)
  bodyRef.current = body
  const [, bump] = useReducer((n: number) => n + 1, 0)

  function step() {
    const pose = getPose()
    const key = poseKey(pose)
    const poseMoved = lastPose.current !== null && lastPose.current !== key
    lastPose.current = key
    const pinned = draggingTip.current != null ? { braid: draggingTip.current, at: tipTarget.current } : null
    const motion = simulateBraids(points.current, previous.current, braidAnchors(pose), pose, bodyRef.current, pinned)

    stillFrames.current = motion < 0.03 && !poseMoved && pinned == null ? stillFrames.current + 1 : 0
    bump()
    rafId.current = stillFrames.current < BRAID_SETTLE_FRAMES ? requestAnimationFrame(step) : null
  }

  function kick() {
    stillFrames.current = 0
    if (rafId.current == null) rafId.current = requestAnimationFrame(step)
  }

  /** Empurrão em todos os gomos (o corpo acelerou pro lado oposto). */
  function impulse(dx: number, dy: number) {
    previous.current.forEach((Q) => {
      for (let i = 1; i < Q.length; i++) Q[i] = { x: Q[i].x - dx, y: Q[i].y - dy }
    })
    kick()
  }

  // Roda depois de cada render: se o pescoço ou um braço mexeu desde o
  // último passo (o rig re-renderiza a cada frame enquanto anima), acorda
  // o loop. Parado e sem mudança, não faz nada.
  useEffect(() => {
    if (!enabled) return
    if (poseKey(getPose()) !== lastPose.current && rafId.current == null) kick()
  })

  useEffect(() => () => {
    cleanupDrag.current?.()
    // Zera o id: no modo de desenvolvimento o React desmonta e remonta
    // tudo uma vez; um id velho aqui impedia o laço de voltar a rodar.
    if (rafId.current != null) cancelAnimationFrame(rafId.current)
    rafId.current = null
  }, [])

  function beginTipDrag(braid: number, svg: SVGSVGElement) {
    const toSvg = (clientX: number, clientY: number): Pt => {
      const pt = svg.createSVGPoint()
      pt.x = clientX
      pt.y = clientY
      const p = pt.matrixTransform(svg.getScreenCTM()!.inverse())
      return { x: p.x, y: p.y }
    }
    draggingTip.current = braid
    tipTarget.current = { ...points.current[braid][BRAID_SEGMENTS] }
    kick()

    function onMove(e: globalThis.PointerEvent) {
      tipTarget.current = toSvg(e.clientX, e.clientY)
      kick()
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      cleanupDrag.current = null
      draggingTip.current = null
      kick()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    cleanupDrag.current = onUp
  }

  return { points, draggingTip, beginTipDrag, impulse }
}

// ────────────────────────────────────────────────────────
// Físico por raiz — espessura dos membros, tronco e detalhes
// ────────────────────────────────────────────────────────

const NEUTRAL_BUILD = {
  upperArm: 14, forearm: 12, thigh: 15, shin: 12,
  hand: { rx: 7, ry: 6 }, foot: { rx: 11, ry: 7 },
  torso: 'M 82 66 Q 79 68 79 80 Q 78 96 84 108 Q 87 112 92 112 L 108 112 Q 113 112 116 108 Q 122 96 121 80 Q 121 68 118 66 Q 109 62 100 62 Q 91 62 82 66 Z',
  neck: { x: 94, width: 12 },
}
// Berserker: ombros largos e cintura estreita (V), membros bem mais
// grossos — a ponta arredondada do braço grosso vira o deltoide.
const MUSCULAR_BUILD = {
  upperArm: 21, forearm: 17, thigh: 21, shin: 16,
  hand: { rx: 9, ry: 8 }, foot: { rx: 12, ry: 8 },
  torso: 'M 80 64 Q 71 67 72 80 Q 74 97 85 109 Q 88 113 93 113 L 107 113 Q 112 113 115 109 Q 126 97 128 80 Q 129 67 120 64 Q 110 59 100 59 Q 90 59 80 64 Z',
  neck: { x: 91, width: 18 },
}

/** Ponto a uma fração t do caminho entre a e b, e o ângulo do segmento (graus). */
function along(a: Pt, b: Pt, t: number): Pt & { angle: number } {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
  }
}

// Runas do Runaskin — uma por segmento de membro, espelhadas; mais uma
// no peito e outra na testa.
const LIMB_RUNES = { upperArm: 'ᚱ', forearm: 'ᛉ', thigh: 'ᚦ', shin: 'ᛒ' } as const

function Rune({ x, y, glyph, size = 10 }: { x: number; y: number; glyph: string; size?: number }) {
  return (
    <text className="alth-body__rune" x={x} y={y} fontSize={size} textAnchor="middle" dominantBaseline="central" aria-hidden="true">
      {glyph}
    </text>
  )
}

// ────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────

interface ZoneStyle extends CSSProperties { '--zone-color'?: string }

export function AltheriumBodyDiagram({ values, onZoneClick, variant = 'protecao', visualMax, build = null, legless = false }: AltheriumBodyDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const rig = useJointRig()
  const shape = build === 'berserker' ? MUSCULAR_BUILD : NEUTRAL_BUILD
  const braids = useBraids(build === 'pilar', () => {
    const a = rig.angles.current
    return { neck: a.neck, shoulderL: a.shoulderL, elbowL: a.elbowL, shoulderR: a.shoulderR, elbowR: a.elbowR }
  }, shape)

  // Levantando de volta (deixou de ser sem pernas) — anima só nessa troca.
  const [rising, setRising] = useState(false)
  const wasLegless = useRef(legless)
  useEffect(() => {
    const before = wasLegless.current
    wasLegless.current = legless
    if (legless) {
      setRising(false)
      if (prefersReducedMotion()) { rig.pose(POSE_ON_FLOOR); return }
      // Tranças: o corpo despenca e elas ficam pra trás (sobem); no
      // impacto, chicoteiam pra baixo.
      braids.impulse(0, -5)
      const up    = window.setTimeout(() => rig.pose(POSE_FLAILING), FALL_ARMS_UP_MS)
      const floor = window.setTimeout(() => { rig.pose(POSE_ON_FLOOR); braids.impulse(0, 7) }, FALL_IMPACT_MS)
      return () => { window.clearTimeout(up); window.clearTimeout(floor) }
    }
    if (before) {
      setRising(true)
      rig.pose(POSE_REST)
      // Levantando: o corpo sobe e as tranças atrasam (caem um pouco).
      if (!prefersReducedMotion()) braids.impulse(0, 4)
    }
    // rig muda de identidade a cada render, mas só guarda refs — basta reagir a `legless`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legless])

  const targetRgb = variant === 'dano' ? WOUND_RGB : PROTECTION_RGB
  const max = visualMax || (variant === 'dano' ? 1 : PROTECTION_VISUAL_MAX)
  function limbColor(value: number): string { return lerpColor(value / max, targetRgb) }
  function jointColor(value: number): string { return lerpColor(1 - value / max, targetRgb) }

  function limbClickProps(zone: BodyZone, shapeClass: 'alth-body__limb' | 'alth-body__mass') {
    const value = values[zone]
    const style: ZoneStyle = { '--zone-color': limbColor(value) }
    const unit = variant === 'dano' ? 'de dano' : 'de proteção'
    return {
      className: `alth-body__zone ${shapeClass}`,
      style,
      onClick: onZoneClick ? () => onZoneClick(zone) : undefined,
      role: onZoneClick ? 'button' : undefined,
      tabIndex: onZoneClick ? 0 : undefined,
      'aria-label': `${ZONE_LABELS[zone]}: ${value > 0 ? `${value} ${unit}` : variant === 'dano' ? 'sem dano' : 'sem armadura'}`,
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

  function handleBraidPointerDown(braid: number) {
    return (e: ReactPointerEvent<SVGCircleElement>) => {
      e.stopPropagation()
      e.preventDefault()
      const svg = svgRef.current
      if (!svg) return
      braids.beginTipDrag(braid, svg)
    }
  }

  function JointHandle({ id, x, y, r = 8 }: { id: JointId; x: number; y: number; r?: number }) {
    const db = values[JOINT_ZONE[id]]
    const isDragging = rig.dragging.current === id
    return (
      <circle
        className={`alth-body__joint${isDragging ? ' alth-body__joint--dragging' : ''}`}
        cx={x} cy={y} r={r}
        style={{ '--zone-color': jointColor(db) } as ZoneStyle}
        onPointerDown={handleJointPointerDown(id)}
        role="slider"
        aria-label={`Articulação: ${id}`}
        aria-valuenow={Math.round(rig.angles.current[id])}
        tabIndex={0}
      />
    )
  }

  /** Bíceps/panturrilha do Berserker — elipse ao longo do segmento. */
  function Bulge({ a, b, t, rx, ry }: { a: Pt; b: Pt; t: number; rx: number; ry: number }) {
    const p = along(a, b, t)
    return <ellipse cx={p.x} cy={p.y} rx={rx} ry={ry} transform={`rotate(${p.angle - 90} ${p.x} ${p.y})`} />
  }

  function LimbRune({ a, b, glyph }: { a: Pt; b: Pt; glyph: string }) {
    const p = along(a, b, 0.5)
    return <Rune x={p.x} y={p.y} glyph={glyph} />
  }

  return (
    <svg
      ref={svgRef}
      className={[
        'alth-body',
        build ? `alth-body--${build}` : '',
        legless ? 'alth-body--legless' : '',
        rising ? 'alth-body--rising' : '',
        rig.dragging.current || braids.draggingTip.current != null ? 'alth-body--dragging' : '',
      ].filter(Boolean).join(' ')}
      viewBox="0 0 200 268"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={`Manequim articulado — arraste as mãos, pés ou a cabeça pra posar, clique nos membros pra editar ${variant === 'dano' ? 'o dano' : 'a proteção'}`}
    >
      {/* Pernas: cadeia quadril → joelho. A alça do quadril fica no joelho
          (gira a perna toda) e a do joelho fica no pé (dobra só a canela) —
          cada uma na ponta do osso que ela controla, não no próprio dobradiço. */}
      {/* Chão e poeira da queda — só existem sem pernas. */}
      {legless && (
        <g className="alth-body__fall-fx" aria-hidden="true">
          <ellipse className="alth-body__floor" cx={100} cy={246} rx={58} ry={5} />
          <circle className="alth-body__dust alth-body__dust--l1" cx={78}  cy={242} r={6} />
          <circle className="alth-body__dust alth-body__dust--l2" cx={66}  cy={244} r={4} />
          <circle className="alth-body__dust alth-body__dust--r1" cx={122} cy={242} r={6} />
          <circle className="alth-body__dust alth-body__dust--r2" cx={134} cy={244} r={4} />
          <circle className="alth-body__poof" cx={HIP.x}         cy={HIP.y + 20} r={10} />
          <circle className="alth-body__poof" cx={mirror(HIP.x)} cy={HIP.y + 20} r={10} />
        </g>
      )}

      <g className="alth-body__legs" aria-hidden={legless || undefined}>
      {(['L', 'R'] as const).map((side) => {
        const hipId = `hip${side}` as JointId
        const kneeId = `knee${side}` as JointId
        const hip   = { x: side === 'L' ? HIP.x : mirror(HIP.x), y: HIP.y }
        const knee  = { x: side === 'L' ? KNEE.x : mirror(KNEE.x), y: KNEE.y }
        const ankle = { x: side === 'L' ? ANKLE.x : mirror(ANKLE.x), y: ANKLE.y }
        const footX = side === 'L' ? ANKLE.x - 4 : mirror(ANKLE.x - 4)
        return (
          <g key={hipId} transform={rotate(hipId)}>
            <g {...limbClickProps('db_pernas', 'alth-body__limb')}>
              <line x1={hip.x} y1={hip.y} x2={knee.x} y2={knee.y} strokeWidth={shape.thigh} />
            </g>
            {build === 'runaskin' && <LimbRune a={hip} b={knee} glyph={LIMB_RUNES.thigh} />}
            <g transform={rotate(kneeId)}>
              <g {...limbClickProps('db_pernas', 'alth-body__limb')}>
                <line x1={knee.x} y1={knee.y} x2={ankle.x} y2={ankle.y} strokeWidth={shape.shin} />
              </g>
              {build === 'berserker' && (
                <g {...limbClickProps('db_pernas', 'alth-body__mass')}>
                  <Bulge a={knee} b={ankle} t={0.3} rx={10} ry={14} />
                </g>
              )}
              {build === 'runaskin' && <LimbRune a={knee} b={ankle} glyph={LIMB_RUNES.shin} />}
              <g {...limbClickProps('db_pernas', 'alth-body__mass')}>
                <ellipse cx={footX} cy={ANKLE.y + 10} rx={shape.foot.rx} ry={shape.foot.ry} />
              </g>
              <JointHandle id={kneeId} x={ankle.x} y={ANKLE.y + 10} />
            </g>
            <JointHandle id={hipId} x={knee.x} y={knee.y} r={7} />
          </g>
        )
      })}
      </g>

      {/* Da cintura pra cima — é esse grupo que despenca quando fica sem pernas. */}
      <g className="alth-body__upper">

      {/* Braços: cadeia ombro → cotovelo. Alça do ombro no cotovelo (gira o
          braço todo), alça do cotovelo na mão (dobra só o antebraço). */}
      {(['L', 'R'] as const).map((side) => {
        const shoulderId = `shoulder${side}` as JointId
        const elbowId = `elbow${side}` as JointId
        const shoulder = { x: side === 'L' ? SHOULDER.x : mirror(SHOULDER.x), y: SHOULDER.y }
        const elbow    = { x: side === 'L' ? ELBOW.x : mirror(ELBOW.x), y: ELBOW.y }
        const wrist    = { x: side === 'L' ? WRIST.x : mirror(WRIST.x), y: WRIST.y }
        return (
          <g key={shoulderId} transform={rotate(shoulderId)}>
            <g {...limbClickProps('db_bracos', 'alth-body__limb')}>
              <line x1={shoulder.x} y1={shoulder.y} x2={elbow.x} y2={elbow.y} strokeWidth={shape.upperArm} />
            </g>
            {build === 'berserker' && (
              <g {...limbClickProps('db_bracos', 'alth-body__mass')}>
                <Bulge a={shoulder} b={elbow} t={0.55} rx={12} ry={14} />
              </g>
            )}
            {build === 'runaskin' && <LimbRune a={shoulder} b={elbow} glyph={LIMB_RUNES.upperArm} />}
            <g transform={rotate(elbowId)}>
              <g {...limbClickProps('db_bracos', 'alth-body__limb')}>
                <line x1={elbow.x} y1={elbow.y} x2={wrist.x} y2={wrist.y} strokeWidth={shape.forearm} />
              </g>
              {build === 'runaskin' && <LimbRune a={elbow} b={wrist} glyph={LIMB_RUNES.forearm} />}
              <g {...limbClickProps('db_bracos', 'alth-body__mass')}>
                <ellipse cx={wrist.x} cy={WRIST.y + 3} rx={shape.hand.rx} ry={shape.hand.ry} />
              </g>
              <JointHandle id={elbowId} x={wrist.x} y={WRIST.y + 3} />
            </g>
            <JointHandle id={shoulderId} x={elbow.x} y={elbow.y} r={7} />
          </g>
        )
      })}

      {/* Tronco: raiz da cadeia, não gira */}
      <g {...limbClickProps('db_tronco', 'alth-body__mass')}>
        <path d={shape.torso} />
        <path d="M 86 110 L 114 110 L 120 122 Q 100 140 80 122 Z" />
      </g>
      {build === 'berserker' && (
        <g className="alth-body__muscles" aria-hidden="true">
          <path d="M 80 82 Q 90 92 100 86 Q 110 92 120 82" />
          <path d="M 100 86 L 100 110" />
          <path d="M 91 96 L 109 96" />
          <path d="M 92 103 L 108 103" />
        </g>
      )}
      {build === 'runaskin' && <Rune x={100} y={88} glyph="ᛟ" size={19} />}

      {/* Tranças do Pilar — atrás da cabeça, por cima dos ombros. Cada gomo
          é uma elipse no ângulo do segmento, alternando pros lados pra ler
          como trança; a ponta tem um laço e é arrastável. */}
      {build === 'pilar' && (
        <g className="alth-body__braids" style={{ '--zone-color': limbColor(values.db_cabeca) } as ZoneStyle}>
          {braids.points.current.map((P, b) => (
            <g key={b}>
              {P.slice(0, -1).map((a, i) => {
                const c = P[i + 1]
                const mx = (a.x + c.x) / 2
                const my = (a.y + c.y) / 2
                const angle = (Math.atan2(c.y - a.y, c.x - a.x) * 180) / Math.PI
                const offset = i % 2 === 0 ? 1.4 : -1.4
                const rad = ((angle + 90) * Math.PI) / 180
                const ox = mx + Math.cos(rad) * offset
                const oy = my + Math.sin(rad) * offset
                return (
                  <ellipse
                    key={i}
                    className="alth-body__braid-knot"
                    cx={ox} cy={oy} rx={BRAID_SEG_LEN * 0.66} ry={3.8 - i * 0.12}
                    transform={`rotate(${angle} ${ox} ${oy})`}
                  />
                )
              })}
              <circle className="alth-body__braid-tie" cx={P[BRAID_SEGMENTS].x} cy={P[BRAID_SEGMENTS].y} r={2.8} />
              <circle
                className="alth-body__braid-grip"
                cx={P[BRAID_SEGMENTS].x} cy={P[BRAID_SEGMENTS].y} r={8}
                onPointerDown={handleBraidPointerDown(b)}
                aria-label={`Trança ${b === 0 ? 'esquerda' : 'direita'} — arraste`}
              />
            </g>
          ))}
        </g>
      )}

      {/* Cabeça: gira em torno da base do pescoço; a alça fica na própria
          cabeça, bem mais longe do pivô do que o pescocinho fino. */}
      <g transform={rotate('neck')}>
        <g {...limbClickProps('db_cabeca', 'alth-body__mass')}>
          <rect x={shape.neck.x} y={56} width={shape.neck.width} height={10} rx={3} />
          <circle cx={HEAD.x} cy={HEAD.y} r={17} />
        </g>
        {build === 'runaskin' && <Rune x={HEAD.x} y={HEAD.y - 10} glyph="ᛉ" size={8} />}
        <JointHandle id="neck" x={HEAD.x} y={HEAD.y} r={6} />
      </g>
      </g>
    </svg>
  )
}
