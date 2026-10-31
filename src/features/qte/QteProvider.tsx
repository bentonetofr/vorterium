import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useCurrentCampaign } from '../campaigns/CurrentCampaignContext'
import { useObserver } from '../../shared/lib/observer'
import { EMPTY_QTE, QteSession, isActive, type QteSnapshot } from './QteSession'

// ────────────────────────────────────────────────────────
// Cena a dois no nível do layout: a conexão vive enquanto a pessoa está
// dentro da campanha, para o convite (e o "assistir") chegar em qualquer
// página, não só na ficha. A tela da cena (QteOverlay) e os avisos
// (QteNotice) desenham em cima disto.
// ────────────────────────────────────────────────────────

interface QteValue extends QteSnapshot {
  enabled:    boolean
  isMaster:   boolean
  userId:     string | null
  campaignId: string | null
  /** A tela da cena está aberta para mim. */
  open:       boolean
  setOpen:    (v: boolean) => void
  openLobby:  () => string | null
  closeLobby: () => void
  begin:      (partners: { uid: string; name: string }[], asPlayer: boolean) => Promise<string | null>
  cancel:     (note?: string) => void
  accept:     () => Promise<void>
  decline:    () => void
  press:      (key: string) => void
  forfeit:    () => void
  /** Fecha a tela e, se a cena já acabou, limpa para uma nova. */
  leave:      () => void
}

const QteContext = createContext<QteValue | null>(null)

export function QteProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { campaign } = useCurrentCampaign()
  const observer = useObserver()
  const campaignId = campaign?.id ?? null
  const isMaster   = campaign?.role === 'master'
  const userId     = user?.id ?? null
  const name =
    (user?.user_metadata?.display_name as string | undefined) ??
    user?.email?.split('@')[0] ??
    'Jogador'

  const sessionRef = useRef<QteSession | null>(null)
  const [snap, setSnap] = useState<QteSnapshot>(EMPTY_QTE)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // a conta dev observadora só lê: não entra na cena
    if (!campaignId || !userId || observer) return
    const session = new QteSession({ campaignId, userId, name, isMaster, onChange: setSnap })
    sessionRef.current = session
    void session.connect()
    return () => {
      session.dispose()
      if (sessionRef.current === session) sessionRef.current = null
      setSnap(EMPTY_QTE)
      setOpen(false)
    }
    // O nome só vai nos convites — não reconecta se mudar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, userId, isMaster, observer])

  useEffect(() => {
    const onUnload = () => sessionRef.current?.dispose()
    window.addEventListener('pagehide', onUnload)
    return () => window.removeEventListener('pagehide', onUnload)
  }, [])

  // Aceitou e a contagem começou: a tela abre sozinha (mesmo se fechou no meio).
  const game = snap.game
  const iPlay = !!game && game.players.some((p) => p.uid === userId && p.accepted === true)
  useEffect(() => {
    if (game && iPlay && (game.phase === 'countdown' || game.phase === 'playing')) setOpen(true)
  }, [game?.id, game?.phase, iPlay]) // eslint-disable-line react-hooks/exhaustive-deps

  const openLobby  = useCallback(() => sessionRef.current?.openLobby() ?? 'Sem conexão com a campanha.', [])
  const closeLobby = useCallback(() => sessionRef.current?.closeLobby(), [])
  const begin      = useCallback(async (partners: { uid: string; name: string }[], asPlayer: boolean) => {
    const err = (await sessionRef.current?.begin(partners, asPlayer)) ?? null
    if (!err) setOpen(true)
    return err
  }, [])
  const cancel   = useCallback((note?: string) => sessionRef.current?.cancel(note), [])
  const accept   = useCallback(async () => { await sessionRef.current?.accept(); setOpen(true) }, [])
  const decline  = useCallback(() => { sessionRef.current?.decline(); setOpen(false) }, [])
  const press    = useCallback((key: string) => sessionRef.current?.press(key), [])
  const forfeit  = useCallback(() => sessionRef.current?.forfeit(), [])
  const leave    = useCallback(() => {
    sessionRef.current?.clear()
    setOpen(false)
  }, [])

  const value: QteValue = {
    ...snap,
    enabled: Boolean(campaignId && userId && !observer),
    isMaster, userId, campaignId,
    open, setOpen,
    openLobby, closeLobby, begin, cancel, accept, decline, press, forfeit, leave,
  }

  return <QteContext.Provider value={value}>{children}</QteContext.Provider>
}

export function useQte(): QteValue {
  const ctx = useContext(QteContext)
  if (!ctx) throw new Error('useQte deve ser usado dentro de um <QteProvider>')
  return ctx
}

export { isActive }
