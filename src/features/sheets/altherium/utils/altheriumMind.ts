// ────────────────────────────────────────────────────────
// Equilíbrio de Altherium (livro 2.0): perda diante do perturbador, Acalmar,
// Ritos, o que acontece quando zera (tabela de 1d10), Cicatriz do
// Crepúsculo e Traumas. Só contas: a tela é AltheriumMindModal.
// ────────────────────────────────────────────────────────

/** Vontade (maior dado) + Espírito contra a DT do evento: passou, perde metade (para baixo); falhou, perde tudo. */
export function equilibriumLoss(amount: number, passed: boolean): number {
  const n = Math.max(0, Math.trunc(amount))
  return passed ? Math.floor(n / 2) : n
}

/** Acalmar: Persuasão + Destino do aliado; 1 ponto a cada 5 no resultado. O Crítico dobra. */
export function calmAmount(total: number, crit: boolean): number {
  const base = Math.max(0, Math.floor(total / 5))
  return crit ? base * 2 : base
}

/** Cicatriz do Crepúsculo: cada vez que o Equilíbrio zera, o máximo cai 2 (nunca abaixo de 1). */
export const SCAR_LOSS = 2
export function scarredMax(max: number): number {
  return Math.max(1, max - SCAR_LOSS)
}

// ── Ritos de Altherium (um por Descanso Longo, o Juramento não conta) ──

export type RiteId = 'banquete' | 'oferenda' | 'juramento' | 'confissao'

export interface RiteDef {
  id:      RiteId
  label:   string
  what:    string
  effect:  string
  /** Conta no limite de um rito por Descanso Longo? */
  counts:  boolean
  cost?:   number
}

export const RITES: RiteDef[] = [
  { id: 'banquete',  label: 'Banquete no Salão',  what: 'Hidromel, canções e companheiros.', effect: 'Recupera +1d6. Custa ¤100.', counts: true, cost: 100 },
  { id: 'oferenda',  label: 'Oferenda aos Deuses', what: 'Teste de Religião + Destino.', effect: 'Passou: +2d4. Falhou: +1.', counts: true },
  { id: 'juramento', label: 'Juramento Cumprido', what: 'Cumprir uma promessa importante.', effect: 'Recupera +1d8 na hora. Não conta no limite de ritos.', counts: false },
  { id: 'confissao', label: 'Confissão',          what: 'Contar a um aliado o que atormenta, em cena interpretada.', effect: 'Recupera +1d6. O aliado faz Vontade + Espírito (DT 11): se falhar, perde 1 de Equilíbrio.', counts: true },
]

export function riteDef(id: RiteId): RiteDef {
  return RITES.find((r) => r.id === id)!
}

export const CONFESSION_DT = 11

// ── Equilíbrio zerado (1d10) ──

export interface BreakdownDef { roll: number; name: string; effect: string; dice?: number; permanent?: boolean }

export const BREAKDOWNS: BreakdownDef[] = [
  { roll: 1,  name: 'Frenesi Cego',        effect: 'Ataca quem estiver mais próximo por 1d4 turnos, amigo ou inimigo.', dice: 4 },
  { roll: 2,  name: 'Colapso Catatônico',  effect: 'Cai no chão, imóvel e em choque por 1d6 turnos. Não pode agir nem reagir.', dice: 6 },
  { roll: 3,  name: 'Riso da Loucura',     effect: 'Começa a rir de forma incontrolável. Não pode usar triunfos por 1d4 turnos.', dice: 4 },
  { roll: 4,  name: 'Paranoia Sangrenta',  effect: 'Passa a desconfiar de todos e considera aliados ameaças até que provem o contrário (o mestre decide).' },
  { roll: 5,  name: 'Visões de Níðhöggr',  effect: 'Enxerga algo horrendo que não está ali. −2 na Defesa por 1d4 turnos.', dice: 4 },
  { roll: 6,  name: 'Autopunição',         effect: 'Sente culpa ou impureza: 1d4 de dano por turno até alguém impedir.' },
  { roll: 7,  name: 'Vozes do Abismo',     effect: 'Ouve sussurros constantes. Perde 1 ação de movimento por 1d4 turnos.', dice: 4 },
  { roll: 8,  name: 'Tremor Profano',      effect: 'O corpo falha. −2 em todos os testes físicos por 1d4 turnos.', dice: 4 },
  { roll: 9,  name: 'Juramento Obsessivo', effect: 'Fixa-se numa ideia (vingança, proteção, fuga). Só pode agir em direção a esse objetivo por 1d4 turnos.', dice: 4 },
  { roll: 10, name: 'Marca da Ruptura',    effect: 'Ganha um trauma permanente. Não se cura com descanso nem com ritos: exige uma missão pessoal definida pelo mestre.', permanent: true },
]

export function breakdownFor(d10: number): BreakdownDef {
  return BREAKDOWNS[Math.max(1, Math.min(10, Math.trunc(d10))) - 1]
}
