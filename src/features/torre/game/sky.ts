import type { TorreGame } from '../torreService'

// ────────────────────────────────────────────────────────
// O céu e o ritmo do pêndulo, iguais aos do banco (migration 20240180):
//   • as 8 casas do céu onde ficam as estrelas escondidas (e o mapa, que
//     é o céu visto de fora — espelhado);
//   • as 4 cores das estrelas (uma por espelho);
//   • o balanço: 12 s por ciclo, 60 s ao todo, e as janelas dentro do
//     ciclo (4 símbolos, o número, a passagem na frente da estrela).
// Aqui só tem o que é público: o QUE aparece em cada janela vem do banco.
// ────────────────────────────────────────────────────────

/** Céu do telescópio: lente de 128×96, centro (64, 46), raio 42. */
export const LENS = { w: 128, h: 96, cx: 64, cy: 46, r: 42 }

/** As 8 casas das estrelas escondidas, em pares espelhados (s ↔ 7 − s). */
export const SKY_SLOTS: [number, number][] = [
  [36, 20], [44, 44], [30, 58], [52, 30],
  [76, 30], [98, 58], [84, 44], [92, 20],
]

/** As 3 que brilham desde o começo; a [1] é a mais brilhante (a 5ª se esconde atrás dela). */
export const BRIGHT: [number, number][] = [[58, 14], [66, 52], [102, 38]]

/** Onde a 5ª estrela pode estar: 8 pontos em volta da mais brilhante. */
export function fifthXY(s: number, cx = BRIGHT[1][0], cy = BRIGHT[1][1], r = 6): [number, number] {
  const a = (s / 8) * Math.PI * 2 - Math.PI / 2
  return [Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)]
}

/** Onde a constelação (5 pontos numa faixa de 40×18) aparece na lente. */
export const BAND = { x: 44, y: 62 }

export const STAR_COLORS = ['#7fb2ff', '#ff7a7a', '#f2f0ff', '#ffd25a']
export const STAR_NAMES = ['azul', 'vermelha', 'branca', 'dourada']

/** O mapa é o céu visto de fora: a casa s fica no lugar da 7 − s. */
export const mirrorSlot = (s: number) => 7 - s

// ── O pêndulo ───────────────────────────────────────────

export const PERIOD = 12000

/** Começo e fim de cada janela dentro do ciclo (ms). */
export const WINDOWS = [
  [1000, 2200], [3000, 4200], [5000, 6200], [7000, 8200],   // os 4 símbolos
  [9000, 10200],                                            // o número
  [10600, 11400],                                           // a passagem na frente da estrela
]

/** O pêndulo está balançando agora (hora do banco)? */
export function swinging(pend: TorreGame['pend'] | undefined, now: number) {
  return !!pend?.t0 && !!pend.until && now >= pend.t0 && now < pend.until
}

/**
 * Deslocamento do peso agora, de −1 a 1 (0 = parado no meio). Passa pelo
 * meio nas janelas dos símbolos e chega na ponta na do número.
 */
export function swingX(pend: TorreGame['pend'] | undefined, now: number) {
  if (!pend || !swinging(pend, now)) return 0
  const ph = ((now - pend.t0!) % PERIOD) / PERIOD
  const left = (pend.until! - now) / 8000
  return Math.sin(ph * Math.PI * 2 * 3) * Math.min(1, left)   // 3 idas e voltas por ciclo, e para devagar no fim
}

/** Em que janela estamos (índice em WINDOWS) ou null. */
export function windowAt(pend: TorreGame['pend'] | undefined, now: number): number | null {
  if (!pend || !swinging(pend, now)) return null
  const ph = (now - pend.t0!) % PERIOD
  const i = WINDOWS.findIndex(([a, b]) => ph >= a && ph < b)
  return i < 0 ? null : i
}

/** A próxima borda de janela (hora do banco), pra pedir a visão de novo. */
export function nextEdge(pend: TorreGame['pend'] | undefined, now: number): number | null {
  if (!pend || !swinging(pend, now)) return null
  const base = now - ((now - pend.t0!) % PERIOD)
  const edges = WINDOWS.flat().map((e) => base + e).concat(WINDOWS.flat().map((e) => base + PERIOD + e))
  const next = edges.find((e) => e > now)
  return next && next < pend.until! ? next : pend.until
}
