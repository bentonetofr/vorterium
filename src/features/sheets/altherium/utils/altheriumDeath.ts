// ────────────────────────────────────────────────────────
// Morte e Recuperação (livro 2.0):
//   - 0 PV: Estado Caído;
//   - 2 turnos para sobreviver, +1 a cada 2 pontos de Espírito (máximo 5);
//   - no início de cada turno: 1d10 + bônus de Determinação contra DT 7;
//   - bônus: 0 pontos 0, 1 ponto +1, 2 pontos +2; outras fontes (Gênesis
//     Determinado) somam até no máximo +3; cai 1 a cada novo turno caído;
//   - 10 natural é sucesso automático (aqui o 1 não anula nada);
//   - Medicina de um aliado: +1 a cada 5 pontos no teste, até +2; crítico +2;
//   - sucesso estabiliza; a consequência vem das falhas acumuladas.
// ────────────────────────────────────────────────────────

export const DEATH_DT = 7
export const DEATH_TURNS_MAX = 5

export interface DyingState {
  /** Testes já feitos (o próximo é o turno `rolls + 1`). */
  rolls:    number
  failures: number
  /** Bônus de Medicina esperando o próximo teste (0 a 2). */
  medicine: number
  /** Corda das Nornas (Pilar): +1 em todos os Testes de Morte, fora do limite da Medicina. */
  nornas:   boolean
  result:   'stable' | 'dead' | null
}

export const NEW_DYING: DyingState = { rolls: 0, failures: 0, medicine: 0, nornas: false, result: null }

export function readDying(raw: unknown): DyingState | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<DyingState>
  const n = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.trunc(Number(v) || 0)))
  return {
    rolls:    n(r.rolls, DEATH_TURNS_MAX),
    failures: n(r.failures, DEATH_TURNS_MAX),
    medicine: n(r.medicine, 2),
    nornas:   !!r.nornas,
    result:   r.result === 'stable' || r.result === 'dead' ? r.result : null,
  }
}

/** Turnos para sobreviver: 2 + 1 a cada 2 pontos de Espírito, no máximo 5. */
export function deathTurns(espirito: number): number {
  return Math.min(DEATH_TURNS_MAX, 2 + Math.floor(Math.max(0, espirito) / 2))
}

/** Bônus de Determinação no 1º turno: pontos no domínio (0 a 2) + outras fontes, até +3. */
export function determinationBonus(points: number, otherSources: number): number {
  return Math.min(3, Math.max(0, Math.min(2, points)) + Math.max(0, otherSources))
}

/** O bônus cai 1 a cada novo turno caído (não fica negativo). */
export function bonusOnTurn(base: number, rollsDone: number): number {
  return Math.max(0, base - rollsDone)
}

/** Medicina de um aliado: +1 a cada 5 pontos no resultado, até +2; crítico dá +2. */
export function medicineBonus(result: number, crit: boolean): number {
  return crit ? 2 : Math.max(0, Math.min(2, Math.floor(result / 5)))
}

export function deathSuccess(natural: number, total: number): boolean {
  return natural === 10 || total >= DEATH_DT
}

/** Depois de um Teste de Morte: estabiliza, morre (3 falhas ou todos os turnos falhos) ou segue caído. */
export function afterDeathRoll(state: DyingState, success: boolean, turns: number): DyingState {
  const rolls = state.rolls + 1
  if (success) return { ...state, rolls, medicine: 0, result: 'stable' }
  const failures = state.failures + 1
  const dead = failures >= 3 || rolls >= turns
  return { ...state, rolls, failures, medicine: 0, result: dead ? 'dead' : null }
}

export interface Consequence {
  label:  string
  detail: string
  /** Precisa rolar 1d4 − 2 sessões de coma. */
  coma?:  boolean
  dead?:  boolean
}

/** Consequência pelas falhas acumuladas quando o personagem estabiliza. */
export function deathConsequence(failures: number, espirito: number): Consequence {
  if (failures <= 0) return { label: 'Recupera normalmente', detail: 'Inconsciente até acordar, sem penalidade adicional.' }
  if (failures === 1) return { label: 'Incapacitado', detail: 'Ao acordar, fica incapacitado por 1 Descanso Longo após a cena.' }
  if (failures === 2) {
    if (espirito <= 0) return { label: 'Morte', detail: 'Com 0 de Espírito, 2 falhas acumuladas matam.', dead: true }
    return { label: 'Coma', detail: 'Ao acordar, fica em coma por 1d4 − 2 sessões após a cena.', coma: true }
  }
  return { label: 'Morte permanente', detail: '3 falhas acumuladas: o personagem morre.', dead: true }
}

/** Sessões de coma: 1d4 − 2, sem ficar negativo (0 = acorda logo). */
export function comaSessions(d4: number): number {
  return Math.max(0, d4 - 2)
}
