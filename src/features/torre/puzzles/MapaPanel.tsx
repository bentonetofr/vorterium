import { useRef, useState } from 'react'
import { px, seeded, type Ctx } from '../../livro/game/art'
import { BAND, LENS, SKY_SLOTS, STAR_COLORS, STAR_NAMES } from '../game/sky'
import { drawPattern, GlyphIcon, Hint, PixelScene, useTick, type Pt, type TorrePuzzleProps } from './kit'

// ────────────────────────────────────────────────────────
// O Mapa Estelar (em cima). Um disco com o céu desenhado — a constelação
// de ouro é a que o telescópio precisa encontrar — e 4 buracos. Cada
// estrela já vista vira um marcador da cor dela. O mapa é o céu visto de
// FORA: o buraco de cada estrela é o lugar espelhado.
// Com os 4 certos o mapa gira: a borda ganha 4 casas (que acendem quando
// a sombra do pêndulo passa) e uma seta aponta 2 runas.
// ────────────────────────────────────────────────────────

const S = 116
const C = { x: 58, y: 58, r: 52 }
/** Do céu da lente pro disco do mapa. */
const toMap = (x: number, y: number): [number, number] => [Math.round(C.x + (x - LENS.cx) * 1.12), Math.round(C.y + (y - LENS.cy) * 1.12)]
/** As 4 casas da borda (depois que o mapa gira), no alto do disco. */
const CASAS: [number, number][] = [-150, -110, -70, -30].map((deg) => {
  const a = (deg * Math.PI) / 180
  return [Math.round(C.x + Math.cos(a) * (C.r - 5)), Math.round(C.y + Math.sin(a) * (C.r - 5))]
})

function holeAt(p: Pt, holes: number[]): number | null {
  for (const h of holes) {
    const [x, y] = toMap(...SKY_SLOTS[h])
    if (Math.abs(p.x - x) <= 5 && Math.abs(p.y - y) <= 5) return h
  }
  return null
}

export function MapaPanel({ g, act, ro, clock }: TorrePuzzleProps) {
  useTick(400)
  const map = g.map!
  const [pick, setPick] = useState<number | null>(null)
  const hover = useRef<number | null>(null)
  const placed = new Set(map.markers.filter((m): m is number => m !== null))

  const draw = (ctx: Ctx, _t: number, mouse: Pt | null) => {
    hover.current = mouse && !ro && !map.turned ? holeAt(mouse, map.holes) : null
    px(ctx, '#1b1524', 0, 0, S, S)
    // disco (gira um pouco quando abre)
    for (let y = -C.r - 3; y <= C.r + 3; y++) {
      for (let x = -C.r - 3; x <= C.r + 3; x++) {
        const d = Math.hypot(x, y)
        if (d > C.r + 3) continue
        px(ctx, d > C.r ? (y < 0 ? '#d29a48' : '#5e3d16') : d > C.r - 9 && map.turned ? '#22180c' : '#1a2446', C.x + x, C.y + y)
      }
    }
    // constelações desenhadas (enfeite) e a de ouro
    const rnd = seeded(11)
    for (let i = 0; i < 40; i++) {
      const a = rnd() * Math.PI * 2
      const d = Math.sqrt(rnd()) * (C.r - 12)
      px(ctx, '#33427a', Math.round(C.x + Math.cos(a) * d), Math.round(C.y + Math.sin(a) * d))
    }
    const [bx, by] = toMap(BAND.x, BAND.y)
    drawPattern(ctx, map.pattern, bx, by, '#ffd25a', '#8a6a24', 1.12)
    // os buracos e os marcadores
    for (const h of map.holes) {
      const [x, y] = toMap(...SKY_SLOTS[h])
      const m = map.markers[h]
      px(ctx, '#05050a', x - 2, y - 2, 5, 5)
      px(ctx, '#5e3d16', x - 2, y + 3, 5, 1)
      if (m !== null && m !== undefined) {
        px(ctx, STAR_COLORS[m], x - 1, y - 1, 3, 3)
        px(ctx, '#ffffff', x, y - 1)
      }
      if (hover.current === h) {
        px(ctx, '#ffe7a3', x - 3, y - 3, 7, 1); px(ctx, '#ffe7a3', x - 3, y + 3, 7, 1)
        px(ctx, '#ffe7a3', x - 3, y - 3, 1, 7); px(ctx, '#ffe7a3', x + 3, y - 3, 1, 7)
      }
    }
    // a borda, depois de girar: 4 casas e a seta
    if (map.turned) {
      const now = clock()
      CASAS.forEach(([x, y], i) => {
        const on = map.rim && map.rim.casa === i && now < map.rim.until
        px(ctx, '#0d0a06', x - 3, y - 3, 7, 7)
        px(ctx, on ? '#ffe7a3' : '#3a2810', x - 2, y - 2, 5, 5)
        if (on) { ctx.globalAlpha = 0.35; px(ctx, '#ffe7a3', x - 5, y - 5, 11, 11); ctx.globalAlpha = 1 }
      })
      // a seta, embaixo, apontando pra fora
      px(ctx, '#ecc66a', C.x, C.y + C.r - 12, 1, 8)
      px(ctx, '#ecc66a', C.x - 2, C.y + C.r - 6, 5, 1)
      px(ctx, '#ecc66a', C.x - 1, C.y + C.r - 5, 3, 1)
    }
  }

  const down = (p: Pt) => {
    if (ro || map.turned) return
    const h = holeAt(p, map.holes)
    if (h === null) return
    if (pick !== null) { void act({ a: 'marker', pos: h, k: pick }); setPick(null) }
    else if (map.markers[h] !== null) void act({ a: 'marker', pos: h, k: null })
  }

  return (
    <>
      <PixelScene w={S} h={S} maxH={380} draw={draw} onDown={down} hot={(p) => !ro && !map.turned && holeAt(p, map.holes) !== null} label="O mapa estelar" />
      {!map.turned && (
        map.colors.length === 0
          ? <Hint>Quatro buracos vazios. Nenhuma estrela pra marcar ainda.</Hint>
          : (
            <div className="lb-palette" role="group" aria-label="Marcadores">
              {map.colors.map((k) => (
                <button key={k} type="button" className={`lb-sym tor-marker${pick === k ? ' is-on' : ''}${placed.has(k) ? ' is-used' : ''}`} disabled={ro}
                  onClick={() => setPick(pick === k ? null : k)} aria-pressed={pick === k} title={`Estrela ${STAR_NAMES[k]}`}>
                  <span className="tor-marker__dot" style={{ background: STAR_COLORS[k] }} />
                </button>
              ))}
              <span className="lb-palette__tip">{pick !== null ? `Agora toque num buraco pra pôr a ${STAR_NAMES[pick]}.` : 'Escolha um marcador e toque num buraco.'}</span>
            </div>
          )
      )}
      {map.turned && map.runes && (
        <div className="tor-runes">
          <span className="lb-muted">A seta aponta duas runas:</span>
          <span className="tor-runes__pair"><GlyphIcon g={map.runes[0]} k={4} /><GlyphIcon g={map.runes[1]} k={4} /></span>
        </div>
      )}
      {map.turned && <Hint>Quatro casas na borda, apagadas. Às vezes uma acende por um instante.</Hint>}
    </>
  )
}
