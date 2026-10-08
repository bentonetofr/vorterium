// ────────────────────────────────────────────────────────
// Peças de WebRTC da Mesa (sem React). A transmissão de tela saiu; sobram os
// servidores de rede, que o multiplayer do Vortable usa.
// ────────────────────────────────────────────────────────

/**
 * STUN públicos resolvem a maioria das redes domésticas. Redes mais
 * fechadas (4G com CGNAT, empresa, faculdade) precisam de um servidor
 * TURN — configurável pelo .env, sem mexer no código:
 *   VITE_TURN_URLS=turn:turn.exemplo.com:3478,turns:turn.exemplo.com:5349
 *   VITE_TURN_USERNAME=...
 *   VITE_TURN_CREDENTIAL=...
 */
export function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ]
  const turnUrls = (import.meta.env.VITE_TURN_URLS as string | undefined)?.trim()
  if (turnUrls) {
    servers.push({
      urls:       turnUrls.split(',').map((u) => u.trim()).filter(Boolean),
      username:   import.meta.env.VITE_TURN_USERNAME as string | undefined,
      credential: import.meta.env.VITE_TURN_CREDENTIAL as string | undefined,
    })
  }
  return servers
}

/** Há um servidor TURN configurado (VITE_TURN_URLS)? */
export function hasTurnServer(): boolean {
  return Boolean((import.meta.env.VITE_TURN_URLS as string | undefined)?.trim())
}
