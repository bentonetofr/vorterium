import { useCallback, useEffect, useRef, useState } from 'react'
import type { CampaignWithRole } from '../../../shared/types'
import {
  createWorldStorage, getMyCharacter, VORTABLE_ASSETS, watchCharacters,
  type CampaignCharacter,
} from '../services/vortableService'
import { useMesaStream } from '../../mesa/MesaStreamProvider'
import { useVortableNet } from '../net/VortableNetProvider'
import { useVortableWorlds } from '../worlds/VortableWorldProvider'
import { EngineStage } from './EngineStage'
import { SceneOverlay } from './SceneOverlay'
import { SpectatorStage } from './SpectatorStage'
import { getResume, patchResume } from '../resume/resumeStore'
import { loadPlayPosition, savePlayPosition } from '../resume/playPosition'
import { setLocalZone } from '../enemies/localZone'
import { CreatureSfxToggle } from '../enemies/CreatureSfxToggle'
import './SceneBar.css'
import './SpectatorStage.css'
import './DoorPrompt.css'
import { Loader } from '../../../shared/components/Loader'
import { CharacterStudio } from './CharacterStudio'

/**
 * Jogador: só a tela do jogo, com o personagem que ele criou na ficha (fixo nesta campanha).
 * Sem personagem ainda, oferece o atalho pro criador; salvou, entra.
 */
export function PlayerStage({ campaign, userId }: { campaign: CampaignWithRole; userId: string }) {
  // undefined = carregando · null = ainda não tem boneco
  const [mine, setMine] = useState<CampaignCharacter | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  // o boneco está parado numa saída esperando o mestre dizer sim ou não (destino mostrado na tela)
  const [waitingDoor, setWaitingDoor] = useState<string | null>(null)
  // cena do mestre por cima do jogo (preto, pausa, imagem, título)
  const { stage } = useMesaStream()
  const vnet = useVortableNet()
  // o mundo que o mestre abriu: se ele abrir outro, o jogo recomeça nele
  const { active, ready } = useVortableWorlds()
  const allowSpectate = stage.spectate.allow
  const covered = stage.scene.kind !== 'game' || !!stage.document
  const coveredRef = useRef(covered)
  const gameRef = useRef<{ setInputLocked(locked: boolean): void; rename(): void } | null>(null)
  useEffect(() => {
    coveredRef.current = covered
    gameRef.current?.setInputLocked(covered)
  }, [covered])
  // o mestre desligou os espectadores: quem assistia volta pro jogo
  useEffect(() => { if (!allowSpectate && vnet.watching) vnet.setWatching(false) }, [allowSpectate, vnet.watching])
  // o personagem da ficha mudou de nome: os outros veem o nome novo
  useEffect(() => { gameRef.current?.rename() }, [vnet.name])

  const refresh = useCallback(async () => {
    try {
      setMine(await getMyCharacter(campaign.id, userId))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível abrir o seu boneco.')
    }
  }, [campaign.id, userId])

  // o mestre trocou ou apagou o boneco: a tela acompanha
  useEffect(() => {
    void refresh()
    const off = watchCharacters(campaign.id, () => { void refresh() })
    // rede de segurança (tempo real que caiu e voltou)
    const timer = window.setInterval(() => { void refresh() }, 20_000)
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { off(); window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [campaign.id, refresh])

  if (vnet.kicked) {
    return (
      <div className="vortable-stage"><div className="vortable-stage__cover" role="alert">
        <span>O mestre tirou você da sessão.</span>
        <button className="btn btn-ghost" onClick={vnet.retry}>Entrar de novo</button>
      </div></div>
    )
  }
  if (error) {
    return (
      <div className="vortable-stage"><div className="vortable-stage__cover" role="alert">
        <span>{error}</span>
        <button className="btn btn-ghost" onClick={() => void refresh()}>Tentar de novo</button>
      </div></div>
    )
  }
  if (mine === undefined) {
    return (
      <div className="vortable-stage"><div className="vortable-stage__cover">
        <Loader />
      </div></div>
    )
  }

  // só assistindo (escolha do jogador ou ordem do mestre)
  if (vnet.watching && allowSpectate) {
    return <SpectatorStage campaign={campaign} userId={userId} canPlay={mine !== null} onPlay={() => vnet.setWatching(false)} />
  }

  if (mine === null) {
    // cada jogador cria o personagem dele na ficha; aqui é o atalho pra quem ainda não criou
    return (
      <div className="vortable-player-wrap">
        <div className="vortable-stage"><div className="vortable-stage__cover">
          <span>Você ainda não criou o seu personagem.</span>
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>Criar personagem</button>
          <small>Também dá pra criar na sua ficha, no botão embaixo do retrato.</small>
        </div></div>
        {creating && <CharacterStudio campaignId={campaign.id} userId={userId} onClose={() => setCreating(false)} onSaved={() => { void refresh() }} />}
        {allowSpectate && <button type="button" className="spectator-skip" onClick={() => vnet.setWatching(true)}>Só assistir</button>}
      </div>
    )
  }

  if (!ready || !active) {
    return (
      <div className="vortable-stage"><div className="vortable-stage__cover">
        {ready ? <span>O mestre ainda não abriu nenhum mundo.</span> : <Loader />}
      </div></div>
    )
  }

  return (
    <div className="vortable-player-wrap">
      <EngineStage
        key={`${mine.id}:${active.id}`}
        deps={[campaign.id, userId, mine.id, JSON.stringify(mine.appearance), vnet.net, active.id]}
        mount={async (engine, host, isDead) => {
          const worlds = await createWorldStorage(campaign.id, active.id, active.name)
          const data = await engine.loadCharacterData(VORTABLE_ASSETS)
          if (isDead()) return () => {}
          const net = vnet.net
          // voltando ao Vortable (ou recarregando a página, ou depois de cair): o boneco reaparece onde parou (mesma zona e mesmo ponto)
          const back = getResume(campaign.id)?.play ?? loadPlayPosition(campaign.id, userId)
          const game = engine.mountVortable(host, {
            mode: 'play',
            resume: back && back.worldId === active.id ? back.snap : undefined,
            appearance: engine.normalizeAppearance(data, mine.appearance),
            assetBase: VORTABLE_ASSETS,
            storage: worlds,
            onZone: (z) => setLocalZone(z.id),
            // sair de uma zona precisa do sim do mestre
            gate: net ? async (info) => {
              setWaitingDoor(info.toName || info.to)
              try { return await net.askDoor(info) } finally { setWaitingDoor(null) }
            } : undefined,
            // o nome é lido a cada anúncio: acompanha a ficha
            net: vnet.net ? { selfId: userId, get name() { return net?.name ?? vnet.name }, send: (m) => net?.send(m) } : undefined,
          })
          game.setInputLocked(coveredRef.current)
          gameRef.current = game
          if (net) {
            net.sink = (m) => game.receive(m)
            net.onOpen = () => game.resync()
          }
          // a posição fica guardada no navegador a cada segundo e ao esconder/fechar a página, pra sobreviver a recarregar ou cair
          const savePos = () => {
            const snap = game.snapshot()
            if (snap) savePlayPosition(campaign.id, userId, { worldId: active.id, snap })
          }
          const posTimer = window.setInterval(savePos, 1000)
          const onHide = () => { if (document.visibilityState !== 'visible') savePos() }
          window.addEventListener('pagehide', savePos)
          document.addEventListener('visibilitychange', onHide)
          return () => {
            window.clearInterval(posTimer)
            window.removeEventListener('pagehide', savePos)
            document.removeEventListener('visibilitychange', onHide)
            savePos()
            if (gameRef.current === game) gameRef.current = null
            if (net && net.sink) { net.sink = null; net.onOpen = null }
            const snap = game.snapshot()
            if (snap) patchResume(campaign.id, { play: { worldId: active.id, snap } })
            game.destroy()
          }
        }}
      />
      {allowSpectate && <button type="button" className="spectator-skip" onClick={() => vnet.setWatching(true)}>Assistir</button>}
      {waitingDoor && (
        <div className="doorwait" role="status" aria-live="polite">
          <span className="doorwait__dot" aria-hidden="true" />
          Esperando o mestre permitir a ida para <strong>{waitingDoor}</strong>…
        </div>
      )}
      <CreatureSfxToggle />
      <SceneOverlay scene={stage.scene} />
    </div>
  )
}
