import { useRef, useState } from 'react'
import { makeCanvas, px, RUNES, type Ctx } from '../game/art'
import type { Sym } from '../livroService'
import { DIGIT_BITS, drawBits, SYMBOL_BITS } from './glyphs'
import { markXY, PixelScene, SymbolIcon, useUiShare, type Pt, type PuzzleProps } from './kit'

// ────────────────────────────────────────────────────────
// O Astrolábio. Quatro encaixes, cada um com uma runa (a mesma de um
// gancho do castiçal). O símbolo certo de cada encaixe é a sombra que cai
// naquele gancho. Certo: o ponteiro gira sozinho e para no ÂNGULO. A tampa
// de baixo abre com a chave de bronze e mostra 4 números.
// ────────────────────────────────────────────────────────

const W = 140
const H = 140
const C = { x: 70, y: 62 }
const SOCKETS: [number, number][] = [[70, 30], [102, 62], [70, 94], [38, 62]]  // N, L, S, O
const RUNE_AT: [number, number][] = [[66, 41], [87, 58], [66, 75], [45, 58]]
const LID = { x: 32, y: 116, w: 76, h: 18 }

function socketAt(p: Pt): number | null {
  for (let k = 0; k < 4; k++) if (Math.hypot(p.x - SOCKETS[k][0], p.y - SOCKETS[k][1]) <= 10) return k
  return null
}
function markAt(p: Pt): number | null {
  for (let m = 1; m <= 8; m++) {
    const [x, y] = markXY(C.x, C.y, 47, m)
    if (Math.hypot(p.x - x, p.y - y) <= 5) return m
  }
  return null
}
// O disco de bronze, desenhado uma vez só.
let disc: HTMLCanvasElement | null = null
function discCanvas() {
  if (disc) return disc
  const [c, ctx] = makeCanvas(105, 105)
  for (let y = -52; y <= 52; y++) for (let x = -52; x <= 52; x++) {
    const d = Math.hypot(x, y)
    if (d > 51.5) continue
    ctx.fillStyle = d > 49 ? '#5a4012' : d > 44 ? (y < -10 && x < 10 ? '#ecc66a' : '#c99a3b') : d > 41 ? '#7a5a1e' : '#3a2c14'
    ctx.fillRect(52 + x, 52 + y, 1, 1)
  }
  disc = c
  return c
}

const inLid = (p: Pt) => p.x >= LID.x && p.x <= LID.x + LID.w && p.y >= LID.y && p.y <= LID.y + LID.h

export function AstroPanel({ g, act, ro, ui }: PuzzleProps) {
  const a = g.astro
  const { put, remote } = useUiShare(ui, ro)
  const live = !ro || !!remote
  const [myPick, setMyPick] = useState<Sym | null>(null)
  // quem assiste vê o símbolo que a pessoa escolheu
  const pick = remote ? (remote.pick as Sym | null) ?? null : myPick
  const setPick = (s: Sym | null) => { setMyPick(s); put({ pick: s }) }
  const angleShown = useRef(a.pointer)
  const hover = useRef<{ socket: number | null; mark: number | null; lid: boolean }>({ socket: null, mark: null, lid: false })

  const draw = (ctx: Ctx, t: number, mouse: Pt | null) => {
    hover.current = { socket: mouse && live ? socketAt(mouse) : null, mark: mouse && live && a.angle === null ? markAt(mouse) : null, lid: !!mouse && live && inLid(mouse) }
    // mesa
    px(ctx, '#3e281a', 0, 0, W, H)
    for (let y = 0; y < H; y += 7) px(ctx, '#46301f', 0, y, W, 1)
    // disco
    ctx.drawImage(discCanvas(), C.x - 52, C.y - 52)
    // marcas (sem números)
    for (let m = 1; m <= 8; m++) {
      const [x, y] = markXY(C.x, C.y, 47, m)
      const on = a.angle === m
      const hot = hover.current.mark === m
      px(ctx, on ? '#fff4c4' : hot ? '#ffe7a3' : '#3a2812', x - 1, y - 1, 3, 3)
      if (on) { ctx.fillStyle = `rgba(255,231,163,${(0.25 + 0.2 * Math.sin(t * 5)).toFixed(2)})`; ctx.fillRect(x - 3, y - 3, 7, 7) }
    }
    // runas e encaixes
    for (let k = 0; k < 4; k++) {
      const rune = RUNES[a.runes[k]] ?? RUNES[0]
      const [rx, ry] = RUNE_AT[k]
      for (let i = 0; i < 9; i++) if (rune[i]) px(ctx, '#b8892f', rx + (i % 3) * 3, ry + Math.floor(i / 3) * 3, 3, 3)
      const [sx, sy] = SOCKETS[k]
      const hot = hover.current.socket === k
      ctx.fillStyle = hot ? '#ffe7a3' : '#7a5a1e'
      ctx.beginPath(); ctx.arc(sx + 0.5, sy + 0.5, 9.4, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#1a1208'
      ctx.beginPath(); ctx.arc(sx + 0.5, sy + 0.5, 7.6, 0, Math.PI * 2); ctx.fill()
      const s = a.slots[k]
      if (s) drawBits(ctx, SYMBOL_BITS[s], sx - 4, sy - 4, a.angle ? '#fff4c4' : '#ecc66a')
    }
    // ponteiro (gira suave até a posição)
    const target = a.angle !== null ? a.angle - 1 : a.pointer
    let cur = angleShown.current
    let diff = target - cur
    if (diff > 4) diff -= 8
    if (diff < -4) diff += 8
    cur += diff * 0.12
    if (Math.abs(diff) < 0.01) cur = target
    angleShown.current = (cur + 8) % 8
    const ang = (angleShown.current / 8) * Math.PI * 2 - Math.PI / 2
    for (let i = 0; i <= 36; i++) {
      const x = C.x + Math.cos(ang) * i
      const y = C.y + Math.sin(ang) * i
      px(ctx, i > 30 ? '#fff4c4' : '#ecc66a', x, y, i > 28 ? 2 : 1, i > 28 ? 2 : 1)
    }
    px(ctx, '#7a5a1e', C.x - 2, C.y - 2, 5, 5)
    px(ctx, '#ecc66a', C.x - 1, C.y - 1, 3, 3)
    // tampa
    if (a.lid && a.seq) {
      px(ctx, '#2a1c10', LID.x, LID.y, LID.w, LID.h)
      px(ctx, '#7a5a1e', LID.x, LID.y - 5, LID.w, 4)
      px(ctx, '#c99a3b', LID.x, LID.y - 5, LID.w, 1)
      a.seq.forEach((n, k) => drawBits(ctx, DIGIT_BITS[n], LID.x + 10 + k * 16, LID.y + 5, '#ecc66a'))
    } else {
      const hot = hover.current.lid
      px(ctx, '#5a4012', LID.x, LID.y, LID.w, LID.h)
      px(ctx, hot ? '#ecc66a' : '#c99a3b', LID.x, LID.y, LID.w, 1)
      for (let k = 0; k < 4; k++) {
        const bx = LID.x + 8 + k * 9
        px(ctx, '#7a5a1e', bx, LID.y + 5, 6, 9)
        px(ctx, '#3a2812', bx + 5, LID.y + 5, 1, 9)
        px(ctx, '#c99a3b', bx + 1, LID.y + 6, 1, 7)
      }
      px(ctx, '#1a1208', LID.x + 56, LID.y + 6, 4, 4)
      px(ctx, '#1a1208', LID.x + 57, LID.y + 10, 2, 4)
    }
  }

  const onDown = (p: Pt) => {
    if (ro) return
    const k = socketAt(p)
    if (k !== null) {
      if (a.angle !== null) return
      if (pick) { void act({ a: 'slot', k, sym: pick }); setPick(null) }
      else if (a.slots[k]) void act({ a: 'slot', k, sym: null })
      return
    }
    const m = markAt(p)
    if (m !== null && a.angle === null) { void act({ a: 'spin', p: m - 1 }); return }
    if (inLid(p) && !a.lid) void act({ a: 'lid' })
  }

  return (
    <>
      <PixelScene
        w={W}
        h={H}
        maxH={430}
        label="O astrolábio"
        draw={draw}
        hot={(p) => !ro && (socketAt(p) !== null || (a.angle === null && markAt(p) !== null) || (inLid(p) && !a.lid))}
        onDown={onDown}
        remoteMouse={remote ? (remote.m as Pt | null) ?? null : undefined}
        onMouse={(m) => put({ m })}
      />
      {a.angle === null && (
        <div className="lb-palette" role="group" aria-label="Símbolos que vocês já viram">
          {a.known.map((s) => (
            <button key={s} type="button" className={`lb-sym${pick === s ? ' is-on' : ''}`} disabled={ro} onClick={() => setPick(pick === s ? null : s)} aria-pressed={pick === s} aria-label={s}>
              <SymbolIcon sym={s} k={3} />
            </button>
          ))}
          {!ro && <span className="lb-palette__tip">{pick ? 'Agora toque num encaixe' : 'Escolha um símbolo'}</span>}
        </div>
      )}
    </>
  )
}
