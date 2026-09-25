// ────────────────────────────────────────────────────────
// Cartas do Pilar (livro, p. 31–32).
//
// O número de um triunfo é quantas COMBINAÇÕES DE NAIPE ele exige. O
// jogador escolhe um naipe e vira cartas do baralho até juntar essa
// quantidade — toda carta puxada gasta 1 das cartas do Pilar (13 × nível,
// só voltam no descanso). Ele puxa uma por vez e pode desistir; se
// desistir ou as cartas acabarem, o triunfo falha e as puxadas se perdem.
//
//   carta do naipe escolhido → 1 combinação
//   Ás do naipe escolhido    → 2 combinações
//   coringa                  → vale como qualquer carta (1 combinação)
//   Ás de espadas            → sucesso na hora
//
// Baralho: 52 cartas + 2 coringas. Códigos: "AS" (Ás de espadas),
// "10H" (10 de copas), "QD", "7C", "JK" (coringa).
// ────────────────────────────────────────────────────────

export type Suit = 'S' | 'H' | 'D' | 'C'

export const SUITS: { id: Suit; symbol: string; label: string; red: boolean }[] = [
  { id: 'S', symbol: '♠', label: 'Espadas', red: false },
  { id: 'H', symbol: '♥', label: 'Copas',   red: true  },
  { id: 'D', symbol: '♦', label: 'Ouros',   red: true  },
  { id: 'C', symbol: '♣', label: 'Paus',    red: false },
]

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
export const JOKER = 'JK'
export const DECK_SIZE = 54

export function suitInfo(suit: Suit) {
  return SUITS.find((s) => s.id === suit)!
}

export function fullDeck(): string[] {
  const cards: string[] = []
  for (const suit of SUITS) for (const rank of RANKS) cards.push(`${rank}${suit.id}`)
  cards.push(JOKER, JOKER)
  return cards
}

/** Embaralha (Fisher–Yates com o sorteio do navegador). */
export function shuffle(cards: string[]): string[] {
  const out = [...cards]
  const random = new Uint32Array(out.length)
  crypto.getRandomValues(random)
  for (let i = out.length - 1; i > 0; i--) {
    const j = random[i] % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export interface ParsedCard {
  code:  string
  rank:  string | null
  suit:  Suit | null
  joker: boolean
}

export function parseCard(code: string): ParsedCard {
  if (code === JOKER) return { code, rank: null, suit: null, joker: true }
  return { code, rank: code.slice(0, -1), suit: code.slice(-1) as Suit, joker: false }
}

/** Quanto uma carta rende pro naipe escolhido. */
export function cardValue(code: string, suit: Suit): { combos: number; instant: boolean } {
  const card = parseCard(code)
  if (card.joker) return { combos: 1, instant: false }
  if (card.rank === 'A' && card.suit === 'S') return { combos: 0, instant: true }
  if (card.suit !== suit) return { combos: 0, instant: false }
  return { combos: card.rank === 'A' ? 2 : 1, instant: false }
}

export function cardLabel(code: string): string {
  const card = parseCard(code)
  if (card.joker) return 'Coringa'
  const names: Record<string, string> = { A: 'Ás', J: 'Valete', Q: 'Dama', K: 'Rei' }
  return `${names[card.rank!] ?? card.rank} de ${suitInfo(card.suit!).label.toLowerCase()}`
}

/**
 * Puxa UMA carta do topo do baralho (modo "puxar e decidir"). Baralho
 * vazio ou null começa/reembaralha um novo.
 */
export function drawOne(deck: string[] | null): { card: string; deck: string[]; reshuffled: boolean } {
  const pile = deck && deck.length > 0 ? [...deck] : shuffle(fullDeck())
  const reshuffled = deck != null && deck.length === 0
  const card = pile.shift()!
  return { card, deck: pile, reshuffled }
}
