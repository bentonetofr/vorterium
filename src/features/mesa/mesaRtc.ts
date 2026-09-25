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

/**
 * Vídeo da Mesa: 30 fps fixos. Captura de tela no Chrome vem marcada como
 * "detalhe" — sob pouca banda ele derruba os QUADROS pra manter a
 * nitidez (medido: 15 fps em 1080p). Aqui é o contrário: a trava é nos
 * 30 fps e, se faltar banda, cai a resolução. Teto de 1080p na captura
 * (tela 1440p/4K a 30 fps pesa demais no codificador do mestre).
 */
export const VIDEO_FPS         = 30
export const VIDEO_MAX_WIDTH   = 1920
export const VIDEO_MAX_HEIGHT  = 1080
/** Por jogador — o upload do mestre ≈ isso × jogadores. */
export const VIDEO_MAX_BITRATE = 4_000_000

/** Prioriza fluidez no codificador (antes e depois de conectar). */
export async function tuneVideoSender(pc: RTCPeerConnection): Promise<void> {
  for (const sender of pc.getSenders()) {
    if (sender.track?.kind !== 'video') continue
    try {
      const params = sender.getParameters() as RTCRtpSendParameters & { degradationPreference?: string }
      if (!params.encodings || params.encodings.length === 0) params.encodings = [{}]
      params.encodings[0].maxBitrate   = VIDEO_MAX_BITRATE
      params.encodings[0].maxFramerate = VIDEO_FPS
      params.degradationPreference     = 'maintain-framerate'
      await sender.setParameters(params)
    } catch {
      // Navegador sem suporte — segue com o padrão dele.
    }
  }
}

/** Banda com que o vídeo começa (kbps) — o padrão (~300) deixa os primeiros segundos borrados. */
export const VIDEO_START_KBPS = 2500

/**
 * Faz o vídeo já começar com banda boa em vez de subir aos poucos
 * (parâmetro do Chrome; os outros navegadores ignoram). Vai na resposta
 * do jogador, antes do mestre aplicá-la — é de lá que o codificador lê.
 */
export function withVideoStartBitrate(sdp: string): string {
  const lines = sdp.split('\r\n')
  let inVideo = false
  const videoPts = new Set<string>()
  // 1ª passada: payloads de vídeo (VP8/VP9/H264/AV1) da seção m=video.
  for (const line of lines) {
    if (line.startsWith('m=')) inVideo = line.startsWith('m=video')
    const m = inVideo && /^a=rtpmap:(\d+) (VP8|VP9|H264|AV1)\//i.exec(line)
    if (m) videoPts.add(m[1])
  }
  // 2ª: soma o parâmetro no fmtp de cada um (ou cria o fmtp, como no VP8).
  const out: string[] = []
  for (const line of lines) {
    const f = /^a=fmtp:(\d+) /.exec(line)
    if (f && videoPts.has(f[1])) {
      out.push(line.includes('x-google-start-bitrate') ? line : `${line};x-google-start-bitrate=${VIDEO_START_KBPS}`)
      continue
    }
    out.push(line)
    const r = /^a=rtpmap:(\d+) /.exec(line)
    if (r && videoPts.has(r[1]) && !lines.some((l) => l.startsWith(`a=fmtp:${r[1]} `))) {
      out.push(`a=fmtp:${r[1]} x-google-start-bitrate=${VIDEO_START_KBPS}`)
    }
  }
  return out.join('\r\n')
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
    video: {
      frameRate: { ideal: VIDEO_FPS, max: VIDEO_FPS },
      width:     { max: VIDEO_MAX_WIDTH },
      height:    { max: VIDEO_MAX_HEIGHT },
    },
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
  const stream = await navigator.mediaDevices.getDisplayMedia(options)
  // "motion": o codificador segura os quadros e abre mão de nitidez.
  const video = stream.getVideoTracks()[0]
  if (video && 'contentHint' in video) video.contentHint = 'motion'
  return stream
}

/** Mensagem amigável pros erros do getDisplayMedia. */
export function captureErrorMessage(err: unknown): string | null {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError' || name === 'AbortError') return null // cancelou a janela
  if (name === 'NotFoundError') return 'Nenhuma tela disponível para transmitir.'
  if (name === 'NotReadableError') return 'O sistema bloqueou a captura da tela. Verifique as permissões de gravação de tela.'
  return 'Não foi possível iniciar a transmissão.'
}
