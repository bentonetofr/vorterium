import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { WatchControls } from '../../../vendor/vortable/vortable'
import { CurrentCampaignProvider, useCurrentCampaign } from '../../campaigns/CurrentCampaignContext'
import type { CampaignWithRole } from '../../../shared/types'
import { useMesaStream } from '../../mesa/MesaStreamProvider'
import { VortableNetProvider, useVortableNet } from '../net/VortableNetProvider'
import { VortableWorldProvider, useVortableWorlds } from '../worlds/VortableWorldProvider'
import { createWorldStorage, VORTABLE_ASSETS } from '../services/vortableService'
import { enterFullscreen } from '../fullscreen'
import { closePip, usePip } from '../pip/pipStore'
import { EngineStage } from './EngineStage'
import { SceneOverlay } from './SceneOverlay'
import './SceneBar.css'
import './VortablePip.css'

type Peer = ReturnType<WatchControls['peers']>[number]

/** Zoom da telinha: a janela é pequena, então o enquadramento é mais aberto que o do jogo. */
const PIP_ZOOM = 1.15
/** Sessão que nunca chegou ao ar (ou caiu logo): a telinha desiste depois disso. */
const GIVE_UP_MS = 12_000

/**
 * Telinha do Vortable: o jogador saiu pelo botão, mas a sessão continua rolando numa
 * janelinha enquanto ele anda pelo site. Ele fica como espectador (o mestre vê "Assistindo"),
 * com a câmera no foco do mestre ou no primeiro jogador. Fecha sozinha quando a sessão acaba.
 */
export function VortablePip() {
  const campaign = usePip()
  const { campaign: here } = useCurrentCampaign()
  const { live, stage } = useMesaStream()
  const seenLive = useRef(false)

  useEffect(() => { seenLive.current = false }, [campaign?.id])
  useEffect(() => {
    if (!campaign) return
    if (live) { seenLive.current = true; return }
    // a conexão ainda está chegando: dá um tempo antes de concluir que não há sessão
    if (seenLive.current) { closePip(); return }
    const timer = window.setTimeout(() => { if (!seenLive.current) closePip() }, GIVE_UP_MS)
    return () => window.clearTimeout(timer)
  }, [campaign, live])
  // mestre desligou os espectadores, ou a pessoa foi pra outra campanha
  useEffect(() => { if (campaign && !stage.spectate.allow) closePip() }, [campaign, stage.spectate.allow])
  useEffect(() => { if (campaign && here && here.id !== campaign.id) closePip() }, [campaign, here])

  if (!campaign) return null
  return (
    <CurrentCampaignProvider key={campaign.id} initial={campaign}>
      <VortableWorldProvider>
        <VortableNetProvider startWatching>
          <PipWindow campaign={campaign} />
        </VortableNetProvider>
      </VortableWorldProvider>
    </CurrentCampaignProvider>
  )
}

function PipWindow({ campaign }: { campaign: CampaignWithRole }) {
  const vnet = useVortableNet()
  const { active, ready } = useVortableWorlds()
  const { stage } = useMesaStream()
  const navigate = useNavigate()
  const watch = useRef<WatchControls | null>(null)
  const [peers, setPeers] = useState<Peer[]>([])
  const [picked, setPicked] = useState<string | null>(null)
  const [zoneName, setZoneName] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [epoch, setEpoch] = useState(0)

  const inGame = peers.filter((p) => p.zone)
  const rules = stage.spectate
  const followId =
    (rules.focus && inGame.some((p) => p.id === rules.focus) && !picked ? rules.focus : null)
    ?? (picked && inGame.some((p) => p.id === picked) ? picked : null)
    ?? inGame[0]?.id ?? null
  const followed = inGame.find((p) => p.id === followId)

  useEffect(() => {
    const timer = window.setInterval(() => { const w = watch.current; if (w) setPeers(w.peers()) }, 600)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const w = watch.current
    if (w && followId && w.following() !== followId) w.follow(followId, PIP_ZOOM)
  }, [followId, epoch])

  function step(delta: number) {
    if (inGame.length < 2) return
    const i = Math.max(0, inGame.findIndex((p) => p.id === followId))
    setPicked(inGame[(i + delta + inGame.length) % inGame.length].id)
  }

  function expand() {
    enterFullscreen() // vem do clique
    closePip()
    navigate(`/campanhas/${campaign.id}/vortable`)
  }

  return (
    <aside className={`vortable-pip${collapsed ? ' vortable-pip--collapsed' : ''}`} aria-label="Vortable ao vivo">
      <header className="vortable-pip__head">
        <span className="vortable-pip__live">Ao vivo</span>
        <span className="vortable-pip__title">{zoneName || 'Vortable'}</span>
        <button type="button" className="vortable-pip__btn" onClick={() => setCollapsed((v) => !v)} aria-label={collapsed ? 'Mostrar a telinha' : 'Recolher a telinha'} title={collapsed ? 'Mostrar' : 'Recolher'}>
          {collapsed ? '▴' : '▾'}
        </button>
        <button type="button" className="vortable-pip__btn" onClick={expand} aria-label="Voltar ao Vortable" title="Voltar ao Vortable">⤢</button>
        <button type="button" className="vortable-pip__btn" onClick={closePip} aria-label="Fechar a telinha" title="Fechar">✕</button>
      </header>

      {/* recolhida, a janela mantém o jogo montado (só some de vista): reabrir é instantâneo */}
      <div className="vortable-pip__body" hidden={collapsed}>
        <div className="vortable-pip__view">
          {!ready || !active ? (
            <div className="vortable-stage"><div className="vortable-stage__cover"><div className="spinner" /></div></div>
          ) : (
            <EngineStage
              key={active.id}
              deps={[campaign.id, vnet.net, active.id]}
              mount={async (engine, host, isDead) => {
                const worlds = await createWorldStorage(campaign.id, active.id, active.name)
                if (isDead()) return () => {}
                const net = vnet.net
                const game = engine.mountVortable(host, {
                  mode: 'watch',
                  // a telinha não toca som: quem anda pelo site não quer o ambiente da zona
                  appearance: engine.defaultAppearance(),
                  assetBase: VORTABLE_ASSETS,
                  storage: worlds,
                  onZone: (z) => setZoneName(z.name),
                  net: net ? { selfId: `pip:${campaign.id}:${Math.random().toString(36).slice(2, 8)}`, get name() { return net.name }, send: (m) => net.send(m) } : undefined,
                })
                watch.current = game.watch ?? null
                setEpoch((n) => n + 1)
                if (net) {
                  net.sink = (m) => game.receive(m)
                  net.onOpen = () => game.resync()
                  game.resync()
                }
                return () => {
                  watch.current = null
                  if (net) { net.sink = null; net.onOpen = null }
                  game.destroy()
                }
              }}
            />
          )}
          <SceneOverlay scene={stage.scene} />
        </div>
        <footer className="vortable-pip__foot">
          <button type="button" className="vortable-pip__btn" onClick={() => step(-1)} disabled={inGame.length < 2} aria-label="Jogador anterior">‹</button>
          <span className="vortable-pip__who">{followed ? followed.name : 'Ninguém em jogo'}</span>
          <button type="button" className="vortable-pip__btn" onClick={() => step(1)} disabled={inGame.length < 2} aria-label="Próximo jogador">›</button>
        </footer>
      </div>
    </aside>
  )
}
