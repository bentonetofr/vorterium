import { useCallback, useEffect, useRef, useState } from 'react'
import type { CampaignWithRole } from '../../../shared/types'
import {
  createCharacterStorage, createWorldStorage, getMyCharacter, VORTABLE_ASSETS, watchCharacters,
  type CampaignCharacter,
} from '../services/vortableService'
import { useMesaStream } from '../../mesa/MesaStreamProvider'
import { useVortableNet } from '../net/VortableNetProvider'
import { useVortableWorlds } from '../worlds/VortableWorldProvider'
import { EngineStage } from './EngineStage'
import { SceneOverlay } from './SceneOverlay'
import './SceneBar.css'

/**
 * Jogador: só a tela do jogo, com o boneco dele. Sem boneco ainda (a
 * primeira vez, ou o mestre apagou o dele), abre o criador; salvou, entra.
 */
export function PlayerStage({ campaign, userId }: { campaign: CampaignWithRole; userId: string }) {
  // undefined = carregando · null = ainda não tem boneco
  const [mine, setMine] = useState<CampaignCharacter | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  // cena do mestre por cima do jogo (preto, pausa, imagem, título)
  const { stage } = useMesaStream()
  const vnet = useVortableNet()
  // o mundo que o mestre abriu: se ele abrir outro, o jogo recomeça nele
  const { active, ready } = useVortableWorlds()
  const covered = stage.scene.kind !== 'game'
  const coveredRef = useRef(covered)
  const gameRef = useRef<{ setInputLocked(locked: boolean): void; rename(): void } | null>(null)
  useEffect(() => {
    coveredRef.current = covered
    gameRef.current?.setInputLocked(covered)
  }, [covered])
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
    return watchCharacters(campaign.id, () => { void refresh() })
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
        <div className="spinner" /><span>Carregando o mundo...</span>
      </div></div>
    )
  }

  if (mine === null) {
    return (
      <EngineStage
        key="criar"
        scroll
        deps={[campaign.id, userId]}
        mount={async (engine, host) => {
          const characters = await createCharacterStorage(campaign.id, userId)
          const creator = engine.mountCharacterCreator(host, {
            assetBase: VORTABLE_ASSETS,
            storage: characters,
            single: true,
            saveLabel: 'Entrar no jogo',
            onSaved: () => { void refresh() },
          })
          return creator.destroy
        }}
      />
    )
  }

  if (!ready || !active) {
    return (
      <div className="vortable-stage"><div className="vortable-stage__cover">
        {ready ? <span>O mestre ainda não abriu nenhum mundo.</span> : <><div className="spinner" /><span>Carregando o mundo...</span></>}
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
          const game = engine.mountVortable(host, {
            mode: 'play',
            appearance: engine.normalizeAppearance(data, mine.appearance),
            assetBase: VORTABLE_ASSETS,
            storage: worlds,
            // o nome é lido a cada anúncio: acompanha a ficha
            net: vnet.net ? { selfId: userId, get name() { return net?.name ?? vnet.name }, send: (m) => net?.send(m) } : undefined,
          })
          game.setInputLocked(coveredRef.current)
          gameRef.current = game
          if (net) {
            net.sink = (m) => game.receive(m)
            net.onOpen = () => game.resync()
          }
          return () => {
            if (gameRef.current === game) gameRef.current = null
            if (net && net.sink) { net.sink = null; net.onOpen = null }
            game.destroy()
          }
        }}
      />
      <SceneOverlay scene={stage.scene} />
    </div>
  )
}
