// ────────────────────────────────────────────────────────
// Peças de WebRTC da transmissão da Mesa (sem React).
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

/**
 * Opus em estéreo e 128 kbps — o padrão do navegador é mono e ~32 kbps,
 * ótimo pra voz e ruim pra música de fundo. Vale nas duas pontas
 * (offer do mestre e answer do jogador).
 */
export function withStereoOpus(sdp: string): string {
  const match = /a=rtpmap:(\d+) opus\/48000\/2/i.exec(sdp)
  if (!match) return sdp
  const pt = match[1]
  const fmtp = new RegExp(`a=fmtp:${pt} ([^\\r\\n]*)`)
  const extra = 'stereo=1;sprop-stereo=1;maxaveragebitrate=128000'
  if (fmtp.test(sdp)) {
    return sdp.replace(fmtp, (_line, params: string) => {
      const kept = params.split(';').filter((p) => !/^(stereo|sprop-stereo|maxaveragebitrate)=/.test(p.trim()))
      return `a=fmtp:${pt} ${[...kept, extra].filter(Boolean).join(';')}`
    })
  }
  return sdp.replace(match[0], `${match[0]}\r\na=fmtp:${pt} ${extra}`)
}

/** Teto de qualidade do vídeo por jogador (upload do mestre ≈ isso × jogadores). */
export const VIDEO_MAX_BITRATE = 2_500_000
export const VIDEO_MAX_FPS     = 30

export async function capVideoBitrate(pc: RTCPeerConnection): Promise<void> {
  for (const sender of pc.getSenders()) {
    if (sender.track?.kind !== 'video') continue
    try {
      const params = sender.getParameters()
      if (!params.encodings || params.encodings.length === 0) params.encodings = [{}]
      params.encodings[0].maxBitrate   = VIDEO_MAX_BITRATE
      params.encodings[0].maxFramerate = VIDEO_MAX_FPS
      await sender.setParameters(params)
    } catch {
      // Navegador sem suporte — segue com o padrão dele.
    }
  }
}

/** O navegador deixa capturar a tela? (celulares e alguns navegadores não.) */
export function canShareScreen(): boolean {
  return typeof navigator !== 'undefined'
    && !!navigator.mediaDevices
    && typeof navigator.mediaDevices.getDisplayMedia === 'function'
}

/**
 * Abre a janela do navegador pra escolher tela/janela/aba — com som.
 * Som: no Chrome/Edge, aba transmite o som da aba e "Tela inteira"
 * transmite o som do sistema (Windows). Firefox e Safari não mandam som.
 */
export async function captureScreen(): Promise<MediaStream> {
  const options = {
    video: { frameRate: { ideal: VIDEO_MAX_FPS, max: VIDEO_MAX_FPS } },
    audio: {
      // Música e efeitos: sem os filtros de chamada de voz.
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl:  false,
    },
    systemAudio:        'include',
    surfaceSwitching:   'include',
    selfBrowserSurface: 'exclude',
  } as DisplayMediaStreamOptions
  return navigator.mediaDevices.getDisplayMedia(options)
}

/** Mensagem amigável pros erros do getDisplayMedia. */
export function captureErrorMessage(err: unknown): string | null {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError' || name === 'AbortError') return null // cancelou a janela
  if (name === 'NotFoundError') return 'Nenhuma tela disponível para transmitir.'
  if (name === 'NotReadableError') return 'O sistema bloqueou a captura da tela. Verifique as permissões de gravação de tela.'
  return 'Não foi possível iniciar a transmissão.'
}
