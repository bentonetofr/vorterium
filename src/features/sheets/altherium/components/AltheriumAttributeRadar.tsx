import { useEffect, useId, useRef, useState } from 'react'
import { ATTRIBUTE_MAX_AT_CREATION } from '../constants/altherium'

// ────────────────────────────────────────────────────────
// Radar dos atributos — pentágono (hexágono com Rúnico) com o perfil do
// personagem preenchido em dourado. Um eixo por atributo visível; a
// escala acompanha o maior valor (mínimo 6, o teto da criação), então um
// personagem novo ocupa bem o gráfico e um evoluído não estoura a borda.
// Os valores deslizam até o novo formato quando um atributo muda.
// ────────────────────────────────────────────────────────

export interface RadarAxis {
  id:          string
  label:       string
  value:       number
  description: string
}

// viewBox mais largo que alto: os rótulos das laterais ("ESTRATÉGIA")
// precisam de espaço pro lado, os de cima/baixo não.
const WIDTH   = 440
const HEIGHT  = 360
const CX      = WIDTH / 2
const CY      = HEIGHT / 2
const RADIUS  = 112               // raio da borda externa
const LABEL_R = RADIUS + 30       // distância dos rótulos
const TWEEN_MS = 520

function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** Valores que deslizam até o alvo (easeOutCubic); começam em 0 ao montar. */
function useTweened(target: number[]): number[] {
  const [shown, setShown] = useState<number[]>(() => (reducedMotion() ? target : target.map(() => 0)))
  const from = useRef(shown)
  const key = target.join(',')

  useEffect(() => {
    const start = target.map((_, i) => from.current[i] ?? 0)
    if (reducedMotion()) { from.current = target; setShown(target); return }
    const began = performance.now()
    let frame = 0
    function tick(now: number) {
      const t = Math.min(1, (now - began) / TWEEN_MS)
      const eased = 1 - (1 - t) ** 3
      const next = target.map((v, i) => start[i] + (v - start[i]) * eased)
      from.current = next
      setShown(next)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // `key` resume o conteúdo de `target` — o array em si é novo a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return shown
}

/** Ponto no eixo `i` de `n`, a `r` do centro — o 1º eixo aponta pra cima. */
function point(i: number, n: number, r: number): [number, number] {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)]
}

function polygon(n: number, radiusOf: (i: number) => number): string {
  return Array.from({ length: n }, (_, i) => point(i, n, radiusOf(i)).map((c) => c.toFixed(1)).join(',')).join(' ')
}

export function AltheriumAttributeRadar({ axes }: { axes: RadarAxis[] }) {
  const n = axes.length
  const values = useTweened(axes.map((a) => a.value))
  const highest = Math.max(0, ...axes.map((a) => a.value))
  // Escala em números pares, pros anéis caírem em valores inteiros.
  const scale = Math.max(ATTRIBUTE_MAX_AT_CREATION, Math.ceil(highest / 2) * 2)
  // Um anel a cada 2 pontos (2, 4, 6…); em escalas grandes, 4 anéis.
  const rings = scale <= 12 ? scale / 2 : 4
  const radiusOf = (i: number) => (Math.max(0, values[i] ?? 0) / scale) * RADIUS
  const strongest = highest > 0 ? axes.filter((a) => a.value === highest) : []
  const fillId = `alth-radar-fill-${useId().replace(/:/g, '')}`

  if (n < 3) return null

  return (
    <figure className="alth-radar">
      <svg
        className="alth-radar__svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Perfil de atributos: ${axes.map((a) => `${a.label} ${a.value}`).join(', ')}`}
      >
        <defs>
          <radialGradient id={fillId} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   style={{ stopColor: 'var(--gilded-bright)', stopOpacity: 0.12 }} />
            <stop offset="100%" style={{ stopColor: 'var(--gilded-bright)', stopOpacity: 0.42 }} />
          </radialGradient>
        </defs>

        {/* Grade: anéis + eixos */}
        {Array.from({ length: rings }, (_, k) => (
          <polygon
            key={k}
            className={`alth-radar__ring${k === rings - 1 ? ' alth-radar__ring--outer' : ''}`}
            points={polygon(n, () => (RADIUS * (k + 1)) / rings)}
          />
        ))}
        {axes.map((a, i) => {
          const [x, y] = point(i, n, RADIUS)
          return <line key={a.id} className="alth-radar__axis" x1={CX} y1={CY} x2={x} y2={y} />
        })}

        {/* Valores dos anéis, no eixo de cima */}
        {Array.from({ length: rings }, (_, k) => (
          <text
            key={k}
            className="alth-radar__tick"
            x={CX + 4}
            y={CY - (RADIUS * (k + 1)) / rings + 3}
          >
            {Math.round((scale * (k + 1)) / rings)}
          </text>
        ))}

        {/* Perfil */}
        <polygon className="alth-radar__shape" points={polygon(n, radiusOf)} fill={`url(#${fillId})`} />
        {axes.map((a, i) => {
          const [x, y] = point(i, n, radiusOf(i))
          const top = strongest.includes(a)
          return (
            <circle key={a.id} className={`alth-radar__dot${top ? ' alth-radar__dot--top' : ''}`} cx={x} cy={y} r={top ? 5 : 3.5}>
              <title>{`${a.label}: ${a.value}`}</title>
            </circle>
          )
        })}

        {/* Rótulos: nome + valor na ponta de cada eixo */}
        {axes.map((a, i) => {
          const [x, y] = point(i, n, LABEL_R)
          const anchor = Math.abs(x - CX) < 8 ? 'middle' : x > CX ? 'start' : 'end'
          const top = strongest.includes(a)
          return (
            <g key={a.id} className={`alth-radar__label${top ? ' alth-radar__label--top' : ''}`}>
              <title>{a.description}</title>
              <text x={x} y={y - 2} textAnchor={anchor} className="alth-radar__label-name">{a.label}</text>
              <text x={x} y={y + 16} textAnchor={anchor} className="alth-radar__label-value">{a.value}</text>
            </g>
          )
        })}
      </svg>

      {strongest.length > 0 && (
        <figcaption className="alth-radar__caption">
          Ponto forte: <strong>{strongest.map((a) => a.label).join(' e ')}</strong>
        </figcaption>
      )}
    </figure>
  )
}
