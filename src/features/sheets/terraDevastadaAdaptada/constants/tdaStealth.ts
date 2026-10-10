// ────────────────────────────────────────────────────────
// Furtividade da Terra Devastada Adaptada: o Alerta da cena (controlado
// pelo mestre) e os modificadores do teste de furtividade.
// ────────────────────────────────────────────────────────

export interface AlertLevel {
  id:     number
  label:  string
  effect: string
}

export const ALERT_LEVELS: AlertLevel[] = [
  { id: 0, label: 'Oculto',    effect: 'Ninguém sabe que vocês estão aqui. Dá pra surpreender com golpe furtivo.' },
  { id: 1, label: 'Suspeito',  effect: 'Alguém ouviu algo e está olhando. O golpe furtivo ainda vale.' },
  { id: 2, label: 'Alertado',  effect: 'Sabem que há intrusos, mas não onde. Acabou o golpe furtivo.' },
  { id: 3, label: 'Caçado',    effect: 'Todos sabem onde vocês estão e vêm atrás.' },
]

export function alertLevel(id: number): AlertLevel {
  return ALERT_LEVELS.find((a) => a.id === id) ?? ALERT_LEVELS[0]
}

/** Dados de bônus (+) ou de penalidade (−) que a cena dá ao teste de furtividade. */
export interface StealthMod {
  id:    string
  label: string
  delta: number
}

export const STEALTH_MODS: StealthMod[] = [
  { id: 'cobertura', label: 'Mato alto ou cobertura', delta: 1 },
  { id: 'agachado',  label: 'Agachado',               delta: 1 },
  { id: 'correndo',  label: 'Correndo',               delta: -1 },
  { id: 'luz',       label: 'Luz forte',              delta: -1 },
  { id: 'cao',       label: 'Cão rastreando',         delta: -1 },
]
