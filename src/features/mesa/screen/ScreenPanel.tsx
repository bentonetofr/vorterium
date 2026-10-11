import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from 'react'
import { useScreenShare } from './ScreenShareProvider'
import { canShareScreen } from '../mesaRtc'
import type { ScreenDiag, ScreenPing, ScreenViewer, ViewerStatus } from './ScreenSession'
import '../components/MesaPanel.css'

// ────────────────────────────────────────────────────────
// Aba "Transmissão" da Sessão: o mestre transmite a tela (com som); aponta
// com um clique e todos veem o brilho no mesmo lugar. A conexão mora no
// ScreenShareProvider — esta aba só desenha.
// ────────────────────────────────────────────────────────

// ── Palco: mídia + ponteiro ──────────────────────────────

interface Box { left: number; top: number; width: number; height: number }

/**
 * Área que a imagem/vídeo ocupa de fato dentro do palco (object-fit:
 * contain deixa faixas pretas) — é nela que o ponteiro vira 0–1, igual
 * pra todo mundo, qualquer que seja o tamanho da tela de cada um.
 */
function useContentBox(wrapRef: RefObject<HTMLElement | null>, size: { w: number; h: number } | null): Box | null {
  const [box, setBox] = useState<Box | null>(null)
  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || !size || !size.w || !size.h) { setBox(null); return }
    const measure = () => {
      const W = wrap.clientWidth, H = wrap.clientHeight
      const scale = Math.min(W / size.w, H / size.h)
      const width = size.w * scale, height = size.h * scale
      setBox({ left: (W - width) / 2, top: (H - height) / 2, width, height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [wrapRef, size])
  return box
}

function PingLayer({ pings, box }: { pings: ScreenPing[]; box: Box | null }) {
  if (!box) return null
  return (
    <div className="mesa-pings" style={box} aria-hidden="true">
      {pings.map((p) => (
        <span key={p.id} className="mesa-ping" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}>
          <span className="mesa-ping__ring" />
          <span className="mesa-ping__ring mesa-ping__ring--late" />
          <span className="mesa-ping__core" />
        </span>
      ))}
    </div>
  )
}

interface StageProps {
  stream?:   MediaStream | null
  pings:     ScreenPing[]
  onPoint?:  (x: number, y: number) => void
  frameRef:  RefObject<HTMLDivElement | null>
  children?: ReactNode
}

function StageMedia({ stream, pings, onPoint, frameRef, children }: StageProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const box = useContentBox(frameRef, size)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !stream) return
    video.srcObject = stream
    video.play().catch(() => { /* mudo: autoplay liberado */ })
    const onSize = () => { if (video.videoWidth) setSize({ w: video.videoWidth, h: video.videoHeight }) }
    video.addEventListener('loadedmetadata', onSize)
    video.addEventListener('resize', onSize)
    onSize()
    return () => {
      video.removeEventListener('loadedmetadata', onSize)
      video.removeEventListener('resize', onSize)
    }
  }, [stream])

  function handleClick(e: MouseEvent<HTMLDivElement>) {
    if (!onPoint || !box || !frameRef.current) return
    const rect = frameRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left - box.left) / box.width
    const y = (e.clientY - rect.top - box.top) / box.height
    if (x < 0 || x > 1 || y < 0 || y > 1) return
    onPoint(x, y)
  }

  return (
    <div className={`mesa-stage__media${onPoint ? ' mesa-stage__media--pointer' : ''}`} onClick={handleClick}>
      {stream ? (
        // Sempre mudo: o som vem do <audio> do provider (continua fora da aba).
        <video ref={videoRef} className="mesa-stage__video" autoPlay playsInline muted />
      ) : null}
      <PingLayer pings={pings} box={box} />
      {children}
    </div>
  )
}

function useFullscreen(target: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false)
  useEffect(() => {
    const onChange = () => setActive(document.fullscreenElement != null && document.fullscreenElement === target.current)
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

// ── Cena de espera (arte do site) ────────────────────────

const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ'

function MesaScene({ title, text, action, busy }: { title: string; text?: string; action?: ReactNode; busy?: boolean }) {
  return (
    <div className={`mesa-scene${busy ? ' mesa-scene--busy' : ''}`}>
      <div className="mesa-scene__sigil" aria-hidden="true">
        <svg viewBox="0 0 200 200" className="mesa-scene__ring">
          <circle cx="100" cy="100" r="92" className="mesa-scene__circle" />
          <circle cx="100" cy="100" r="70" className="mesa-scene__circle mesa-scene__circle--thin" />
          {RUNES.split('').map((rune, i, all) => {
            const a = (i / all.length) * Math.PI * 2
            return (
              <text key={i} x={100 + Math.cos(a) * 81} y={100 + Math.sin(a) * 81} className="mesa-scene__rune"
                transform={`rotate(${(a * 180) / Math.PI + 90} ${100 + Math.cos(a) * 81} ${100 + Math.sin(a) * 81})`}>
                {rune}
              </text>
            )
          })}
        </svg>
        <img src="/assets/logo-campaign-lab-mark.png" alt="" className="mesa-scene__knight" draggable={false} />
      </div>
      <p className="mesa-scene__title">{title}</p>
      {text && <p className="mesa-scene__text">{text}</p>}
      {action}
    </div>
  )
}

const SCENE_BY_STATUS: Record<ViewerStatus, { title: string; text?: string; busy?: boolean }> = {
  offline:      { title: 'O mestre prepara a cena…', text: 'A transmissão aparece aqui assim que começar.' },
  waiting:      { title: 'O mestre prepara a cena…', text: 'A transmissão aparece aqui assim que começar.' },
  connecting:   { title: 'Abrindo a cena…', busy: true },
  live:         { title: 'Abrindo a cena…', busy: true },
  reconnecting: { title: 'Reconectando à mesa…', text: 'A conexão oscilou. Voltando sozinho.', busy: true },
  lost:         { title: 'A conexão com a mesa caiu', text: 'Pode ter sido a internet de alguém.' },
}

// ── Mestre ───────────────────────────────────────────────

const QUALITY_LABEL = { good: 'boa', fair: 'instável', poor: 'ruim' } as const

function ViewerChip({ viewer }: { viewer: ScreenViewer }) {
  const connecting = viewer.state === 'new' || viewer.state === 'connecting'
  const quality = viewer.state === 'disconnected' ? 'poor' : viewer.stats?.quality
  const s = viewer.stats
  const parts: string[] = []
  if (s?.fps != null) parts.push(`${s.fps} fps`)
  if (s?.height) parts.push(`${s.height}p`)
  if (s?.rttMs != null) parts.push(`${s.rttMs} ms`)
  if (s?.loss != null && s.loss > 0.005) parts.push(`${Math.round(s.loss * 100)}% perda`)
  return (
    <li
      className={`mesa-viewer${quality ? ` mesa-viewer--${quality}` : ''}${connecting ? ' mesa-viewer--connecting' : ''}`}
      title={quality ? `Conexão ${QUALITY_LABEL[quality]}` : undefined}
    >
      <span className="mesa-viewer__dot" aria-hidden="true" />
      <span className="mesa-viewer__name">{viewer.name}</span>
      <span className="mesa-viewer__state">
        {connecting ? 'conectando' : viewer.state === 'disconnected' ? 'instável' : parts.join(' · ') || 'assistindo'}
      </span>
    </li>
  )
}

function MasterView() {
  const mesa = useScreenShare()
  const frameRef = useRef<HTMLDivElement>(null)
  const fullscreen = useFullscreen(frameRef)
  const stream = mesa.localStream
  const { stage } = mesa
  const sharing = Boolean(stream)
  const showing = sharing
  const canShare = canShareScreen()
  const watching = new Set(mesa.viewers.filter((v) => v.state === 'connected').map((v) => v.id.split(':')[0])).size

  const shareButton = canShare ? (
    <button type="button" className="btn btn-primary mesa-scene__cta" onClick={() => void mesa.startShare()} disabled={mesa.starting}>
      {mesa.starting ? 'Escolhendo a tela…' : 'Transmitir tela'}
    </button>
  ) : null

  return (
    <>
      <div ref={frameRef} className={`mesa-stage${showing ? ' mesa-stage--live' : ''}`}>
        {showing ? (
          <StageMedia stream={stream} pings={mesa.pings} onPoint={mesa.ping} frameRef={frameRef}>
            <span className="mesa-live-badge">Ao vivo</span>
            {stage.paused && <span className="mesa-paused-badge">Pausada para os jogadores</span>}
            {fullscreen.supported && (
              <div className="mesa-controls mesa-controls--corner">
                <button type="button" className="mesa-ctrl" onClick={(e) => { e.stopPropagation(); fullscreen.toggle() }} aria-label={fullscreen.active ? 'Sair da tela cheia' : 'Tela cheia'}>
                  <IconFullscreen exit={fullscreen.active} />
                </button>
              </div>
            )}
          </StageMedia>
        ) : (
          <MesaScene
            title="Transmita sua tela para os jogadores"
            text={canShare
              ? 'Mapas, vídeos e música: o que estiver na tela escolhida aparece aqui para todos, com som.'
              : 'Neste aparelho não dá para transmitir a tela (use o Chrome ou o Edge no computador).'}
            action={shareButton}
          />
        )}
      </div>

      {showing && <p className="mesa-hint mesa-hint--center">Clique na imagem para apontar um lugar para todos.</p>}

      {mesa.shareError && <p className="mesa-msg mesa-msg--error" role="alert">{mesa.shareError}</p>}

      {sharing && (
        <div className="mesa-bar">
          <div className="mesa-bar__info">
            <span className={`mesa-audio-tag${stage.audio ? '' : ' mesa-audio-tag--off'}`}>
              <IconSpeaker muted={!stage.audio} />
              {stage.audio ? 'Com som' : 'Sem som'}
            </span>
            <span className="mesa-bar__count">
              {watching === 0 ? 'Ninguém assistindo ainda' : `${watching} ${watching === 1 ? 'jogador assistindo' : 'jogadores assistindo'}`}
            </span>
          </div>
          <div className="mesa-bar__actions">
            <button type="button" className={`btn btn-ghost${stage.paused ? ' mesa-btn--resume' : ''}`} onClick={() => mesa.setPaused(!stage.paused)}>
              {stage.paused ? 'Retomar' : 'Pausar'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void mesa.switchScreen()} disabled={mesa.starting}>
              {mesa.starting ? 'Escolhendo…' : 'Trocar tela'}
            </button>
            <button type="button" className="btn btn-danger" onClick={mesa.stopShare}>Parar transmissão</button>
          </div>
        </div>
      )}

      {sharing && !stage.audio && (
        <p className="mesa-hint">
          Sem som. Use <strong>Trocar tela</strong> e marque <strong>Compartilhar áudio</strong> na janela do navegador.
        </p>
      )}
      {!sharing && canShare && (
        <p className="mesa-hint">
          Para o som ir junto, marque <strong>Compartilhar áudio</strong> na janela do navegador. Uma
          <strong> aba</strong> transmite o som dela; a <strong>tela inteira</strong> transmite o som do
          computador (Windows). Chrome e Edge mandam som; Firefox e Safari, só a imagem.
        </p>
      )}

      {sharing && mesa.viewers.length > 0 && (
        <ul className="mesa-viewers" aria-label="Conexão de cada jogador">
          {mesa.viewers.map((v) => <ViewerChip key={v.id} viewer={v} />)}
        </ul>
      )}

    </>
  )
}

// ── Jogador ──────────────────────────────────────────────

function PlayerView() {
  const mesa = useScreenShare()
  const frameRef = useRef<HTMLDivElement>(null)
  const fullscreen = useFullscreen(frameRef)
  const { stage } = mesa
  const stream = mesa.remoteStream
  const showVideo = Boolean(stream) && Boolean(stage.screenId)
  const hasAudio = Boolean(stage.screenId) && stage.audio && Boolean(stream)
  const scene = SCENE_BY_STATUS[mesa.status]

  return (
    <>
      <div ref={frameRef} className={`mesa-stage${showVideo ? ' mesa-stage--live' : ''}`}>
        {showVideo ? (
          <StageMedia stream={stream} pings={mesa.pings} frameRef={frameRef}>
            {showVideo && mesa.status === 'live' && !stage.paused && <span className="mesa-live-badge">Ao vivo</span>}

            {showVideo && stage.paused && (
              <div className="mesa-paused">
                <span className="mesa-paused__sigil" aria-hidden="true">ᛉ</span>
                <p className="mesa-paused__title">Mestre ajustando a cena…</p>
              </div>
            )}
            {showVideo && mesa.status === 'reconnecting' && (
              <div className="mesa-paused"><p className="mesa-paused__title">Reconectando…</p></div>
            )}

            {hasAudio && mesa.audioBlocked && (
              <button type="button" className="mesa-unlock" onClick={mesa.unlockAudio}>
                <IconSpeaker muted={false} />
                Ativar som
              </button>
            )}

            <div className="mesa-controls" onClick={(e) => e.stopPropagation()}>
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
              ) : showVideo ? (
                <span className="mesa-controls__note">Sem som</span>
              ) : null}
              <span className="mesa-controls__spacer" />
              {fullscreen.supported && (
                <button type="button" className="mesa-ctrl" onClick={fullscreen.toggle} aria-label={fullscreen.active ? 'Sair da tela cheia' : 'Tela cheia'}>
                  <IconFullscreen exit={fullscreen.active} />
                </button>
              )}
            </div>
          </StageMedia>
        ) : (
          <MesaScene
            title={scene.title}
            text={scene.text}
            busy={scene.busy}
            action={mesa.status === 'lost'
              ? <button type="button" className="btn btn-primary mesa-scene__cta" onClick={mesa.retry}>Tentar de novo</button>
              : undefined}
          />
        )}
      </div>
    </>
  )
}

// ── Detalhes da conexão (jogador) ────────────────────────
// Aparece enquanto a transmissão não abre: mostra em que etapa parou,
// pra dar pra saber se é a mensagem que não chega ou a rede que não liga.

const ICE_LABEL: Record<string, string> = {
  new: 'começando', checking: 'testando rotas', connected: 'ligada', completed: 'ligada',
  failed: 'falhou', disconnected: 'caiu', closed: 'fechada',
}

function browserName(): string {
  const ua = navigator.userAgent
  const m = /(Firefox|Edg|OPR|Chrome|Safari)\/(\d+)/.exec(ua)
  if (!m) return 'navegador desconhecido'
  const name = { Edg: 'Edge', OPR: 'Opera' }[m[1]] ?? m[1]
  return `${name} ${m[2]}`
}

function counts(c: ScreenDiag['local']): string {
  return `direta ${c.host} · STUN ${c.srflx + c.prflx} · TURN ${c.relay}`
}

function ConnectionDetails({ diag, status }: { diag: ScreenDiag; status: ViewerStatus }) {
  const iceFailed = diag.iceState === 'failed' || diag.connState === 'failed'
  const noRelay = diag.local.relay === 0 && diag.remote.relay === 0
  let hint: string | null = null
  if (diag.offers === 0 && status !== 'connecting') hint = 'A oferta do mestre não está chegando: confira se o mestre está com a aba do Vorterium aberta.'
  else if (iceFailed && noRelay) {
    hint = diag.turn
      ? 'As redes não se ligaram nem pelo servidor TURN configurado. Confira as credenciais do TURN.'
      : 'As duas redes não conseguiram se ligar direto (firewall ou operadora). Isso se resolve com um servidor TURN.'
  }
  return (
    <details className="mesa-diag">
      <summary>Detalhes da conexão</summary>
      <dl className="mesa-diag__list">
        <div><dt>Navegador</dt><dd>{browserName()}</dd></div>
        <div><dt>Oferta do mestre</dt><dd>{diag.offers > 0 ? `recebida (${diag.offers}×)` : 'não chegou'}</dd></div>
        <div><dt>Ligação de rede</dt><dd>{diag.iceState ? ICE_LABEL[diag.iceState] ?? diag.iceState : '-'}</dd></div>
        <div><dt>Suas rotas</dt><dd>{counts(diag.local)}</dd></div>
        <div><dt>Rotas do mestre</dt><dd>{counts(diag.remote)}</dd></div>
        <div><dt>Servidor TURN</dt><dd>{diag.turn ? 'configurado' : 'não configurado'}</dd></div>
        {diag.route && <div><dt>Rota em uso</dt><dd>{diag.route}</dd></div>}
        {diag.lastError && <div><dt>Último erro</dt><dd>{diag.lastError}</dd></div>}
      </dl>
      {hint && <p className="mesa-diag__hint">{hint}</p>}
    </details>
  )
}

// ── Painel ───────────────────────────────────────────────

export function ScreenPanel() {
  const mesa = useScreenShare()
  const { setViewing } = mesa

  // Avisa o provider que a aba está aberta (esconde o aviso "ao vivo").
  useEffect(() => {
    setViewing(true)
    return () => setViewing(false)
  }, [setViewing])

  return (
    <section className="mesa">
      {mesa.channelError && <p className="mesa-msg mesa-msg--error" role="alert">{mesa.channelError}</p>}
      {mesa.isMaster ? <MasterView /> : <PlayerView />}
      {!mesa.isMaster && mesa.stage.screenId && mesa.stage.audio && mesa.remoteStream && (
        <p className="mesa-hint">O som continua tocando enquanto você olha as outras abas.</p>
      )}
      {!mesa.isMaster && mesa.stage.screenId && mesa.status !== 'live' && (
        <ConnectionDetails diag={mesa.diag} status={mesa.status} />
      )}
    </section>
  )
}
