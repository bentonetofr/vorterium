// ────────────────────────────────────────────────────────
// Utilitários de campanha
// ────────────────────────────────────────────────────────

export { getSystemLabel, getSystemDescription, getSystemStatus, isSupportedSystem } from '../constants/systems'

// Mantido para retrocompatibilidade — usar getSystemLabel de systems.ts
export function formatSystem(system: string): string {
  const labels: Record<string, string> = {
    generic:   'Genérico',
    dnd5e:     'D&D 5e',
    altherium: 'Altherium',
  }
  return labels[system] ?? 'Sistema desconhecido'
}

export function formatRole(role: 'master' | 'player'): string {
  return role === 'master' ? 'Mestre' : 'Jogador'
}

// ── Status da campanha ───────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  active:   'Ativa',
  paused:   'Pausada',
  archived: 'Arquivada',
}

/** Retorna o rótulo em português para um status de campanha. */
export function getCampaignStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? 'Ativa'
}

/** Retorna o modificador de classe CSS correspondente ao status. */
export function getCampaignStatusClass(status: string): string {
  const map: Record<string, string> = {
    active:   'campaign-status--active',
    paused:   'campaign-status--paused',
    archived: 'campaign-status--archived',
  }
  return map[status] ?? 'campaign-status--active'
}
