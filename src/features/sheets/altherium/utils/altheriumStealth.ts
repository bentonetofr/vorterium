// ────────────────────────────────────────────────────────
// Furtividade de Altherium (livro 2.0): todo inimigo (ou grupo) está
// Desatento, Atento ou Alerta, e o estado define a DT do teste de
// Furtividade + Impulso. O livro deixa as DTs em aberto ("?"), então o mestre
// define as três na cena (padrão 6, 8 e 10). O teste só acontece quando a
// situação muda. Só contas: a tela é AltheriumStealthModal.
// ────────────────────────────────────────────────────────

export type EnemyState = 'desatento' | 'atento' | 'alerta'

export interface EnemyStateDef {
  id:        EnemyState
  label:     string
  meaning:   string
  defaultDt: number
}

export const ENEMY_STATES: EnemyStateDef[] = [
  { id: 'desatento', label: 'Desatento', meaning: 'Não desconfia de nada.',                         defaultDt: 6 },
  { id: 'atento',    label: 'Atento',    meaning: 'Ouviu algo e está prestando atenção.',           defaultDt: 8 },
  { id: 'alerta',    label: 'Alerta',    meaning: 'Sabe que tem alguém ali e está procurando.',     defaultDt: 10 },
]

export function enemyStateDef(id: string): EnemyStateDef {
  return ENEMY_STATES.find((s) => s.id === id) ?? ENEMY_STATES[0]
}

export interface StealthDts { desatento: number; atento: number; alerta: number }

export const DEFAULT_DTS: StealthDts = { desatento: 6, atento: 8, alerta: 10 }

/** Os estados sobem sempre nesta ordem; Alerta é o teto. */
export function raiseState(state: EnemyState): EnemyState {
  return state === 'desatento' ? 'atento' : 'alerta'
}

/**
 * Esfriar (cerca de 3 turnos sem ser notado): o inimigo desce um estado. Um
 * Alerta volta a Atento, mas nunca a Desatento na mesma cena.
 */
export function coolState(state: EnemyState, wasAlert: boolean): EnemyState {
  if (state === 'alerta') return 'atento'
  if (state === 'atento' && !wasAlert) return 'desatento'
  return state
}

// ── Modificadores (dados; no máximo ±2 no total) ──

export interface StealthMod {
  id:    string
  label: string
  delta: number
  /** Dois do mesmo grupo se excluem. */
  group?: 'luz' | 'ritmo'
  hint?: string
}

export const STEALTH_MODS: StealthMod[] = [
  { id: 'sombra',    label: 'Escuro ou penumbra',      delta: 1,  group: 'luz' },
  { id: 'luz',       label: 'Sob luz forte',           delta: -1, group: 'luz' },
  { id: 'devagar',   label: 'Devagar (metade do movimento)', delta: 1, group: 'ritmo' },
  { id: 'correndo',  label: 'Correndo ou Disparar',    delta: -1, group: 'ritmo' },
  { id: 'peso',      label: 'Peso (armadura de 8 DB ou mais, Escudo Pesado ou arma pesada)', delta: -1 },
  { id: 'cobertura', label: 'Cobertura (arbustos, chuva, multidão, carroça)', delta: 1, hint: 'O mestre concede se você descrever algo útil.' },
  { id: 'fumaca',    label: 'Pó de Fumaça ou nuvem de Fumaça', delta: 1 },
  { id: 'fantasma',  label: 'Passo Fantasma (Pilar)',  delta: 1 },
  { id: 'distracao', label: 'Distração (quem está longe do barulho)', delta: 1 },
  { id: 'perfeita',  label: 'Sombra Perfeita (do último teste)', delta: 1 },
]

export const STEALTH_DICE_LIMIT = 2

export function stealthDice(active: Iterable<string>): number {
  const ids = new Set(active)
  const total = STEALTH_MODS.filter((m) => ids.has(m.id)).reduce((s, m) => s + m.delta, 0)
  return Math.max(-STEALTH_DICE_LIMIT, Math.min(STEALTH_DICE_LIMIT, total))
}

// ── Resultado ──

export type StealthResult = 'perfeita' | 'sucesso' | 'falha' | 'descoberto'

export interface StealthOutcome {
  result:  StealthResult
  label:   string
  text:    string
  /** Estado do inimigo depois do teste (Descoberto: o combate começa, sem Surpresa). */
  next:    EnemyState
}

export function stealthOutcome(total: number, dt: number, crit: boolean, state: EnemyState): StealthOutcome {
  const diff = total - dt
  if (crit || diff >= 5) {
    return { result: 'perfeita', label: 'Sombra Perfeita', next: state, text: 'O inimigo continua no mesmo estado, e o seu próximo teste de Furtividade recebe +1 dado.' }
  }
  if (diff >= 0) return { result: 'sucesso', label: 'Passou despercebido', next: state, text: 'O inimigo continua no mesmo estado.' }
  if (diff <= -5 || state === 'alerta') {
    return { result: 'descoberto', label: 'Descoberto', next: 'alerta', text: 'O combate começa normalmente, sem Surpresa.' }
  }
  return { result: 'falha', label: 'Fez barulho', next: raiseState(state), text: `O inimigo sobe para ${enemyStateDef(raiseState(state)).label}.` }
}

/** Ataque Surpresa: o alvo fica Surpreendido, e os outros inimigos em Curto ficam Alerta. */
export const SURPRISE_TEXT =
  'Atacar quem ainda não descobriu você deixa o alvo Surpreendido (sem Reações até o fim do primeiro turno dele). Depois do ataque, todos os outros inimigos a até alcance Curto ficam Alerta.'

export const DISTRACTION_TEXT =
  'Arremesse um objeto (Fúria × 2 metros) para fazer barulho em outro ponto. Os inimigos perto do barulho olham pra lá, e o próximo teste de Furtividade de quem está longe dele recebe +1 dado.'
