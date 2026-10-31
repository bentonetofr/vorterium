// ────────────────────────────────────────────────────────
// Cena a dois (quick time event): as contas do minigame, sem rede nem tela.
//
// Aparece uma letra do teclado num ponto qualquer da arena e some em `ms`
// milissegundos: acertar a tecla (ou tocar na letra) antes disso conta ponto;
// tecla errada ou deixar a letra sumir conta uma falha. Três falhas e perde;
// aguentar todas as letras vence. A cada letra o tempo encurta.
//
// O Impulso do personagem decide o tempo: só com Impulso 10 fica
// relativamente tranquilo; com Impulso baixo o jogo é duro de verdade.
// Os dois jogadores recebem a MESMA sequência (letra e lugar, pela semente),
// cada um com o tempo do seu próprio Impulso.
// ────────────────────────────────────────────────────────

/** Falhas que derrubam o jogador. */
export const QTE_LIVES = 3
/** Letras de uma partida (aguentar todas = vencer). */
export const QTE_TOTAL = 30
/** Contagem regressiva antes de começar. */
export const QTE_COUNTDOWN_MS = 3500
/** Tempo máximo de uma partida: passou disso, quem não terminou perdeu (alguém pode ter sumido). */
export const QTE_MAX_RUN_MS = 150_000
/** Impulso máximo que o jogo considera (o teto do livro). */
export const QTE_IMPULSO_MAX = 10

/** Letras que podem sair: começa na fileira do meio e vai abrindo o teclado todo. */
const KEYS_HOME  = 'ASDFJKL'
const KEYS_MID   = 'QWERUIOPGH'
const KEYS_ALL   = 'ZXCVBNMTY'

export interface QtePrompt {
  /** Posição da letra na sequência (0 em diante). */
  i:   number
  /** Tecla esperada, maiúscula. */
  key: string
  /** Posição na arena, de 0 a 1 (já longe das bordas). */
  x:   number
  y:   number
}

/** Gerador pseudo-aleatório com semente (mulberry32): a mesma sequência nos dois navegadores. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Letras sorteáveis na posição `i`: poucas no começo, o teclado inteiro lá pelo meio. */
export function keyPool(i: number): string {
  if (i < 6) return KEYS_HOME
  if (i < 14) return KEYS_HOME + KEYS_MID
  return [...new Set(KEYS_HOME + KEYS_MID + KEYS_ALL)].join('')
}

/** A sequência inteira da partida, igual para quem usar a mesma semente. */
export function buildSequence(seed: number, total = QTE_TOTAL): QtePrompt[] {
  const rng = mulberry32(seed)
  const out: QtePrompt[] = []
  let prev: QtePrompt | null = null
  for (let i = 0; i < total; i++) {
    const pool = keyPool(i)
    let key = pool[Math.floor(rng() * pool.length)]
    // nunca a mesma letra duas vezes seguidas
    for (let guard = 0; prev && key === prev.key && guard < 8; guard++) key = pool[Math.floor(rng() * pool.length)]
    let x = 0.1 + rng() * 0.8
    let y = 0.14 + rng() * 0.72
    // longe da letra anterior (o olho precisa procurar)
    for (let guard = 0; prev && Math.hypot(x - prev.x, (y - prev.y) * 0.6) < 0.22 && guard < 8; guard++) {
      x = 0.1 + rng() * 0.8
      y = 0.14 + rng() * 0.72
    }
    prev = { i, key, x, y }
    out.push(prev)
  }
  return out
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/**
 * Quanto tempo a letra `i` fica na tela, em ms, para um Impulso.
 * Impulso 0: 1100 ms na primeira, caindo até ~450 ms. Impulso 10: 2200 ms
 * caindo até ~900 ms (o que dá para acompanhar com calma). Cai suave: a
 * diferença entre uma letra e a seguinte quase não se nota, a do começo
 * para o fim sim.
 */
export function promptMs(i: number, impulso: number): number {
  const t = clamp(impulso, 0, QTE_IMPULSO_MAX) / QTE_IMPULSO_MAX
  const start = 1100 + 1100 * t
  const floor = 450 + 450 * t
  return Math.round(floor + (start - floor) * Math.exp(-i / 10))
}

/** Pausa entre uma letra e a seguinte: encurta com o ritmo. */
export function gapMs(i: number): number {
  return Math.max(220, 480 - i * 8)
}

// ── Resultado ────────────────────────────────────────────

export type QteResult = 'cleared' | 'lost'

export interface QteOutcome {
  uid:    string
  result: QteResult
  /** Letras acertadas. */
  hits:   number
  /** Falhas que sobraram. */
  lives:  number
}

/**
 * Quem ganhou entre os que jogaram: terminar todas as letras vence quem
 * caiu; entre iguais, mais acertos e depois mais vidas. Empate = null.
 * Sozinho, ganha quem terminou.
 */
export function judge(outcomes: QteOutcome[]): { winner: string | null; tie: boolean } {
  if (outcomes.length === 0) return { winner: null, tie: false }
  if (outcomes.length === 1) return { winner: outcomes[0].result === 'cleared' ? outcomes[0].uid : null, tie: false }
  const score = (o: QteOutcome) => (o.result === 'cleared' ? 1_000_000 : 0) + o.hits * 10 + o.lives
  const ranked = [...outcomes].sort((a, b) => score(b) - score(a))
  if (score(ranked[0]) === score(ranked[1])) return { winner: null, tie: true }
  return { winner: ranked[0].uid, tie: false }
}

/** Texto de apoio do Impulso na tela de preparo. */
export function difficultyLabel(impulso: number): string {
  if (impulso >= 10) return 'Tranquilo (dá para respirar)'
  if (impulso >= 7) return 'Puxado'
  if (impulso >= 4) return 'Difícil'
  return 'Brutal'
}
