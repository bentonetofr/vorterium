// ────────────────────────────────────────────────────────
// Utilitários de campanha
// ────────────────────────────────────────────────────────

const SYSTEM_LABELS: Record<string, string> = {
  generic:   'Genérico',
  dnd5e:     'D&D 5e',
  altherium: 'Altherium',
  custom:    'Personalizado',
}

export function formatSystem(system: string): string {
  return SYSTEM_LABELS[system] ?? 'Genérico'
}

export function formatRole(role: 'master' | 'player'): string {
  return role === 'master' ? 'Mestre' : 'Jogador'
}
