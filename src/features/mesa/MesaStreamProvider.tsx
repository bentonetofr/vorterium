import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useCurrentCampaign } from '../campaigns/CurrentCampaignContext'
import { EMPTY_SNAPSHOT, GAME_SCENE, MesaSession, type MesaScene, type MesaSnapshot } from './mesaSession'
import { getMesaImageShowUrl } from './services/mesaImagesService'
import { setDocumentVisible } from './documents/documentsService'

// ────────────────────────────────────────────────────────
// Estado da Mesa no nível do layout: a conexão vive enquanto a pessoa está
// dentro da campanha, não só com a aba "Mesa" aberta.
// ────────────────────────────────────────────────────────

interface MesaStreamValue extends MesaSnapshot {
  enabled:      boolean
  isMaster:     boolean
  /** A aba Mesa está aberta agora (o aviso de "ao vivo" não aparece por cima dela). */
  viewing:      boolean
  setViewing:   (v: boolean) => void
  /** Mestre: troca a cena que os jogadores veem (vale na hora pra todos). */
  setScene:     (scene: MesaScene) => void
  /** Mestre: põe uma imagem da galeria como cena (gera o link pros jogadores). */
  showImage:    (image: { id: string; path: string; name: string }) => Promise<void>
  hideImage:    () => void
  /** Põe um documento na mesa (e libera pros jogadores, se ainda estava escondido). */
  showDocument: (doc: { id: string; title: string; visible: boolean }) => Promise<void>
  hideDocument: () => void
  /** Livro na mesa: muda a página aberta pra todos. */
  setDocumentPage: (page: number) => void
}

const MesaStreamContext = createContext<MesaStreamValue | null>(null)

/**
 * `announce`: o mestre desta página avisa os jogadores que a Mesa está aberta
 * (só a página do Vortable liga isso; no resto do site o mestre só escuta).
 */
export function MesaStreamProvider({ children, announce = false }: { children: ReactNode; announce?: boolean }) {
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
  const [snap, setSnap]       = useState<MesaSnapshot>(EMPTY_SNAPSHOT)
  const [viewing, setViewing] = useState(false)

  useEffect(() => {
    if (!campaignId || !userId) return
    const session = new MesaSession({ campaignId, userId, name, isMaster, announce: announce && isMaster, onChange: setSnap })
    sessionRef.current = session
    void session.connect()
    return () => {
      session.dispose()
      if (sessionRef.current === session) sessionRef.current = null
      setSnap(EMPTY_SNAPSHOT)
    }
    // O nome só vai no aviso de entrada — não reconecta se mudar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, userId, isMaster, announce])

  // Fechou a aba/navegador: avisa os outros na hora.
  useEffect(() => {
    const onUnload = () => sessionRef.current?.dispose()
    window.addEventListener('pagehide', onUnload)
    return () => window.removeEventListener('pagehide', onUnload)
  }, [])

  const setScene = useCallback((scene: MesaScene) => sessionRef.current?.setScene(scene), [])

  const showImage = useCallback(async (image: { id: string; path: string; name: string }) => {
    const session = sessionRef.current
    if (!session) return
    const url = await getMesaImageShowUrl(image.path)
    session.setScene({ kind: 'image', id: image.id, url, name: image.name })
  }, [])

  const showDocument = useCallback(async (doc: { id: string; title: string; visible: boolean }) => {
    const session = sessionRef.current
    if (!session) return
    // Na mesa, todos veem: o documento é liberado antes.
    if (!doc.visible) await setDocumentVisible(doc.id, true)
    session.showDocument({ id: doc.id, title: doc.title, page: 0 })
  }, [])
  const hideDocument    = useCallback(() => sessionRef.current?.hideDocument(), [])
  const setDocumentPage = useCallback((page: number) => sessionRef.current?.setDocumentPage(page), [])
  const hideImage       = useCallback(() => sessionRef.current?.setScene(GAME_SCENE), [])

  const value: MesaStreamValue = {
    ...snap,
    enabled: Boolean(campaignId && userId),
    isMaster,
    viewing,
    setViewing,
    setScene,
    showImage,
    hideImage,
    showDocument,
    hideDocument,
    setDocumentPage,
  }

  return <MesaStreamContext.Provider value={value}>{children}</MesaStreamContext.Provider>
}

export function useMesaStream(): MesaStreamValue {
  const context = useContext(MesaStreamContext)
  if (!context) throw new Error('useMesaStream deve ser usado dentro de um <MesaStreamProvider>')
  return context
}
