import { useEffect, useRef, useState, type RefObject } from 'react'
import { useMesaStream } from '../MesaStreamProvider'
import { canShareScreen } from '../mesaRtc'
import type { MesaViewer } from '../mesaSession'
import './MesaPanel.css'

// ────────────────────────────────────────────────────────
// Aba "Mesa" da Sessão: o mestre transmite a tela (com som) e os
// jogadores assistem. A conexão mora no MesaStreamProvider — esta aba só
// desenha o vídeo e os controles.
// ────────────────────────────────────────────────────────

function StreamVideo({ stream, className }: { stream: MediaStream; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const video = ref.current
    if (!video) return
    video.srcObject = stream
    video.play().catch(() => { /* mudo: autoplay sempre liberado */ })
  }, [stream])
  // Sempre mudo: o som vem do <audio> do provider (continua fora da aba).
  return <video ref={ref} className={className} autoPlay playsInline muted />
}

function useFullscreen(target: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false)
  useEffect(() => {
    const onChange = () => setActive(document.fullscreenElement === target.current && target.current != null)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [target])
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void target.current?.requestFullscreen?.()
  }
  return { active, toggle, supported: typeof document !== 'undefined' && document.fullscreenEnabled }
}

// ── Ícones ───────────────────────────────────────────────

function IconScreen() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="mesa-icon">
      <rect x="5" y="8" width="38" height="25" rx="3" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M17 40h14M24 33v7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M20 16.5v8l7-4z" fill="currentColor" />
    </svg>
  )
}

function IconSpeaker({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      {muted ? (
        <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      ) : (
        <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      )}
    </svg>
  )
}

function IconFullscreen({ exit }: { exit: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {exit
        ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
        : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
    </svg>
  )
}

// ── Mestre ───────────────────────────────────────────────

const VIEWER_STATE_LABEL: Partial<Record<RTCPeerConnectionState, string>> = {
  new:          'conectando',
  connecting:   'conectando',
  connected:    'assistindo',
  disconnected: 'instável',
}

function ViewerChip({ viewer }: { viewer: MesaViewer }) {
  const label = VIEWER_STATE_LABEL[viewer.state] ?? viewer.state
  return (
    <li className={`mesa-viewer mesa-viewer--${viewer.state}`}>
      <span className="mesa-viewer__dot" aria-hidden="true" />
      <span className="mesa-viewer__name">{viewer.name}</span>
      <span className="mesa-viewer__state">{label}</span>
    </li>
  )
}

function MasterView() {
  const mesa = useMesaStream()
  const stageRef = useRef<HTMLDivElement>(null)
  const fullscreen = useFullscreen(stageRef)
  const stream = mesa.localStream
  const hasAudio = (stream?.getAudioTracks().length ?? 0) > 0
  // Várias abas do mesmo jogador contam uma vez só.
  const watching = new Set(mesa.viewers.filter((v) => v.state === 'connected').map((v) => v.id.split(':')[0])).size

  if (!canShareScreen()) {
    return (
      <div className="mesa-stage mesa-stage--empty">
        <IconScreen />
        <p className="mesa-stage__title">Transmissão indisponível neste aparelho</p>
        <p className="mesa-stage__text">Para transmitir a tela, abra o Vorterium no Chrome ou no Edge de um computador.</p>
      </div>
    )
  }

  if (!stream) {
    return (
      <>
        <div className="mesa-stage mesa-stage--empty">
          <IconScreen />
          <p className="mesa-stage__title">Transmita sua tela para os jogadores</p>
          <p className="mesa-stage__text">
            Mapas, imagens, vídeos e música: o que estiver na tela escolhida aparece aqui para todos da campanha, com som.
          </p>
          <button type="button" className="btn btn-primary mesa-stage__cta" onClick={() => void mesa.startShare()} disabled={mesa.starting}>
            {mesa.starting ? 'Escolhendo a tela…' : 'Transmitir tela'}
          </button>
        </div>
        {mesa.shareError && <p className="mesa-msg mesa-msg--error" role="alert">{mesa.shareError}</p>}
        <p className="mesa-hint">
          Para o som ir junto, marque <strong>Compartilhar áudio</strong> na janela do navegador. Uma
          <strong> aba</strong> transmite o som dela; a <strong>tela inteira</strong> transmite o som do
          computador (Windows). Chrome e Edge mandam som; Firefox e Safari, só a imagem.
        </p>
      </>
    )
  }

  return (
    <>
      <div ref={stageRef} className="mesa-stage mesa-stage--live">
        <StreamVideo stream={stream} className="mesa-stage__video" />
        <span className="mesa-live-badge">Ao vivo</span>
        {fullscreen.supported && (
          <div className="mesa-controls mesa-controls--corner">
            <button type="button" className="mesa-ctrl" onClick={fullscreen.toggle} aria-label={fullscreen.active ? 'Sair da tela cheia' : 'Tela cheia'}>
              <IconFullscreen exit={fullscreen.active} />
            </button>
          </div>
        )}
      </div>

      <div className="mesa-bar">
        <div className="mesa-bar__info">
          <span className={`mesa-audio-tag${hasAudio ? '' : ' mesa-audio-tag--off'}`}>
            <IconSpeaker muted={!hasAudio} />
            {hasAudio ? 'Com som' : 'Sem som'}
          </span>
          <span className="mesa-bar__count">
            {watching === 0 ? 'Ninguém assistindo ainda' : `${watching} ${watching === 1 ? 'jogador assistindo' : 'jogadores assistindo'}`}
          </span>
        </div>
        <button type="button" className="btn btn-danger" onClick={mesa.stopShare}>Parar transmissão</button>
      </div>

      {!hasAudio && (
        <p className="mesa-hint">
          A transmissão está sem som. Para incluir, pare e transmita de novo marcando <strong>Compartilhar áudio</strong>.
        </p>
      )}

      {mesa.viewers.length > 0 && (
        <ul className="mesa-viewers" aria-label="Quem está na transmissão">
          {mesa.viewers.map((v) => <ViewerChip key={v.id} viewer={v} />)}
        </ul>
      )}
    </>
  )
}

// ── Jogador ──────────────────────────────────────────────

function PlayerView() {
  const mesa = useMesaStream()
  const stageRef = useRef<HTMLDivElement>(null)
  const fullscreen = useFullscreen(stageRef)
  const stream = mesa.remoteStream
  const hasAudio = (stream?.getAudioTracks().length ?? 0) > 0

  if (!stream) {
    return (
      <div className="mesa-stage mesa-stage--empty">
        {mesa.status === 'connecting' ? (
          <>
            <div className="spinner" />
            <p className="mesa-stage__title">Conectando à transmissão…</p>
          </>
        ) : mesa.status === 'lost' ? (
          <>
            <IconScreen />
            <p className="mesa-stage__title">A conexão com a transmissão caiu</p>
            <p className="mesa-stage__text">Pode ter sido a internet de alguém. Tente conectar de novo.</p>
            <button type="button" className="btn btn-primary mesa-stage__cta" onClick={mesa.retry}>Tentar de novo</button>
          </>
        ) : (
          <>
            <IconScreen />
            <p className="mesa-stage__title">Nenhuma transmissão no momento</p>
            <p className="mesa-stage__text">Quando o mestre transmitir a tela, ela aparece aqui, com som.</p>
          </>
        )}
      </div>
    )
  }

  return (
    <div ref={stageRef} className="mesa-stage mesa-stage--live">
      <StreamVideo stream={stream} className="mesa-stage__video" />
      {mesa.status === 'live' && <span className="mesa-live-badge">Ao vivo</span>}

      {hasAudio && mesa.audioBlocked && (
        <button type="button" className="mesa-unlock" onClick={mesa.unlockAudio}>
          <IconSpeaker muted={false} />
          Ativar som
        </button>
      )}

      <div className="mesa-controls">
        {hasAudio ? (
          <>
            <button
              type="button"
              className="mesa-ctrl"
              onClick={() => mesa.setMuted(!mesa.muted)}
              aria-label={mesa.muted ? 'Ativar som' : 'Silenciar'}
              aria-pressed={mesa.muted}
            >
              <IconSpeaker muted={mesa.muted || mesa.volume === 0} />
            </button>
            <input
              type="range"
              className="mesa-volume"
              min={0}
              max={1}
              step={0.05}
              value={mesa.muted ? 0 : mesa.volume}
              onChange={(e) => { mesa.setVolume(Number(e.target.value)); if (mesa.muted) mesa.setMuted(false) }}
              aria-label="Volume"
            />
          </>
        ) : (
          <span className="mesa-controls__note">Sem som</span>
        )}
        <span className="mesa-controls__spacer" />
        {fullscreen.supported && (
          <button type="button" className="mesa-ctrl" onClick={fullscreen.toggle} aria-label={fullscreen.active ? 'Sair da tela cheia' : 'Tela cheia'}>
            <IconFullscreen exit={fullscreen.active} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Painel ───────────────────────────────────────────────

export function MesaPanel() {
  const mesa = useMesaStream()
  return (
    <section className="mesa">
      {mesa.channelError && <p className="mesa-msg mesa-msg--error" role="alert">{mesa.channelError}</p>}
      {mesa.isMaster ? <MasterView /> : <PlayerView />}
      {!mesa.isMaster && mesa.remoteStream && (
        <p className="mesa-hint">O som continua tocando enquanto você olha as outras abas.</p>
      )}
    </section>
  )
}
