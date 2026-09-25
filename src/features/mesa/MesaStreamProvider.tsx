import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useCurrentCampaign } from '../campaigns/CurrentCampaignContext'
import { captureErrorMessage } from './mesaRtc'
import { EMPTY_SNAPSHOT, MesaSession, type MesaSnapshot } from './mesaSession'
import { getMesaImageShowUrl } from './services/mesaImagesService'

// ────────────────────────────────────────────────────────
// Transmissão da Mesa no nível do layout: a conexão vive enquanto a pessoa
// está dentro da campanha, não só com a aba "Mesa" aberta. Assim o mestre
// pode abrir fichas/bestiário sem derrubar a tela, e o jogador continua
// OUVINDO a transmissão em qualquer aba — o som sai de um <audio> daqui;
// a aba Mesa só desenha o vídeo (mudo) por cima do mesmo stream.
// ────────────────────────────────────────────────────────

interface MesaStreamValue extends MesaSnapshot {
  enabled:      boolean
  isMaster:     boolean
  /** A aba Mesa está aberta agora (o aviso de "ao vivo" não aparece por cima dela). */
  viewing:      boolean
  setViewing:   (v: boolean) => void
  // Mestre
  starting:     boolean
  shareError:   string | null
  startShare:   () => Promise<void>
  switchScreen: () => Promise<void>
  stopShare:    () => void
  setPaused:    (paused: boolean) => void
  /** Coloca uma imagem da galeria na mesa (gera o link pros jogadores). */
  showImage:    (image: { id: string; path: string; name: string }) => Promise<void>
  hideImage:    () => void
  /** Ponteiro: x/y de 0 a 1 dentro da imagem. */
  ping:         (x: number, y: number) => void
  // Jogador
  volume:       number
  setVolume:    (v: number) => void
  muted:        boolean
  setMuted:     (m: boolean) => void
  audioBlocked: boolean
  unlockAudio:  () => void
  retry:        () => void
}

const MesaStreamContext = createContext<MesaStreamValue | null>(null)

const VOLUME_KEY = 'vorterium:mesa-volume'

function readVolume(): number {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY))
    return Number.isFinite(v) && v > 0 && v <= 1 ? v : 1
  } catch {
    return 1
  }
}

export function MesaStreamProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { campaign } = useCurrentCampaign()
  const campaignId = campaign?.id ?? null
  const isMaster   = campaign?.role === 'master'
  const userId     = user?.id ?? null
  const name =
    (user?.user_metadata?.display_name as string | undefined) ??
    user?.email?.split('@')[0] ??
    'Jogador'

  const sessionRef = useRef<MesaSession | null>(null)
  const [snap, setSnap]             = useState<MesaSnapshot>(EMPTY_SNAPSHOT)
  const [starting, setStarting]     = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [viewing, setViewing]       = useState(false)

  useEffect(() => {
    if (!campaignId || !userId) return
    const session = new MesaSession({ campaignId, userId, name, isMaster, onChange: setSnap })
    sessionRef.current = session
    void session.connect()
    return () => {
      session.dispose()
      if (sessionRef.current === session) sessionRef.current = null
      setSnap(EMPTY_SNAPSHOT)
      setShareError(null)
      setStarting(false)
    }
    // O nome só vai no aviso de entrada — não reconecta se mudar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, userId, isMaster])

  // Fechou a aba/navegador: avisa os outros na hora (sem esperar o timeout do WebRTC).
  useEffect(() => {
    const onUnload = () => sessionRef.current?.dispose()
    window.addEventListener('pagehide', onUnload)
    return () => window.removeEventListener('pagehide', onUnload)
  }, [])

  const startShare = useCallback(async () => {
    const session = sessionRef.current
    if (!session) return
    setShareError(null)
    setStarting(true)
    try {
      await session.startShare()
    } catch (err) {
      setShareError(captureErrorMessage(err))
    } finally {
      setStarting(false)
    }
  }, [])

  const switchScreen = useCallback(async () => {
    const session = sessionRef.current
    if (!session) return
    setShareError(null)
    setStarting(true)
    try {
      await session.switchScreen()
    } catch (err) {
      setShareError(captureErrorMessage(err))
    } finally {
      setStarting(false)
    }
  }, [])

  const showImage = useCallback(async (image: { id: string; path: string; name: string }) => {
    const session = sessionRef.current
    if (!session) return
    const url = await getMesaImageShowUrl(image.path)
    session.showImage({ id: image.id, url, name: image.name })
  }, [])

  const stopShare = useCallback(() => sessionRef.current?.stopShare(), [])
  const setPaused = useCallback((paused: boolean) => { void sessionRef.current?.setPaused(paused) }, [])
  const hideImage = useCallback(() => sessionRef.current?.hideImage(), [])
  const ping      = useCallback((x: number, y: number) => sessionRef.current?.ping(x, y), [])
  const retry     = useCallback(() => sessionRef.current?.retry(), [])

  // ── Som do jogador ─────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement>(null)
  const [volume, setVolumeState] = useState(readVolume)
  const [muted, setMuted]        = useState(false)
  const [audioBlocked, setAudioBlocked] = useState(false)

  const setVolume = useCallback((v: number) => {
    setVolumeState(v)
    try { localStorage.setItem(VOLUME_KEY, String(v)) } catch { /* sem storage */ }
  }, [])

  const remoteStream = isMaster ? null : snap.remoteStream

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.srcObject = remoteStream
    if (!remoteStream) { setAudioBlocked(false); return }
    // Navegador pode barrar som sem clique recente — aí a aba mostra "Ativar som".
    audio.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true))
  }, [remoteStream])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
    audio.muted  = muted
  }, [volume, muted])

  const unlockAudio = useCallback(() => {
    audioRef.current?.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true))
  }, [])

  const value: MesaStreamValue = {
    ...snap,
    enabled: Boolean(campaignId && userId),
    isMaster,
    viewing,
    setViewing,
    starting,
    shareError,
    startShare,
    switchScreen,
    stopShare,
    setPaused,
    showImage,
    hideImage,
    ping,
    volume,
    setVolume,
    muted,
    setMuted,
    audioBlocked,
    unlockAudio,
    retry,
  }

  return (
    <MesaStreamContext.Provider value={value}>
      {children}
      <audio ref={audioRef} autoPlay hidden />
    </MesaStreamContext.Provider>
  )
}

export function useMesaStream(): MesaStreamValue {
  const context = useContext(MesaStreamContext)
  if (!context) throw new Error('useMesaStream deve ser usado dentro de um <MesaStreamProvider>')
  return context
}
