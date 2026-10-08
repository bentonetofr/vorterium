import { useEffect, useState, type CSSProperties } from 'react'
import type { CampaignWithRole } from '../../../shared/types'
import { TabIndicator, useStableTabPanels, useTabDirection } from '../../../shared/components/TabIndicator'
import { createCharacterStorage, createWorldStorage, resolveAppearance, VORTABLE_ASSETS } from '../services/vortableService'
import { EngineStage } from './EngineStage'
import { PlayersManager } from './PlayersManager'
import { LiveControl } from './LiveControl'
import { SceneBar } from './SceneBar'
import { useVortableNet } from '../net/VortableNetProvider'
import { useVortableWorlds } from '../worlds/VortableWorldProvider'

type Tab = 'editar' | 'controle' | 'personagens' | 'jogadores'

const TABS: Tab[] = ['editar', 'controle', 'personagens', 'jogadores']
const LABELS: Record<Tab, string> = {
  editar: 'Editar mundo', controle: 'Controle', personagens: 'Personagens', jogadores: 'Jogadores',
}

/** Mestre: editor do mundo, teste como boneco, criador de personagens e gerência dos jogadores. */
export function MasterStage({ campaign, userId, editSignal = 0 }: { campaign: CampaignWithRole; userId: string; editSignal?: number }) {
  const [tab, setTab] = useState<Tab>('editar')
  const vnet = useVortableNet()
  const { editing, ready } = useVortableWorlds()

  // "Editar" num mundo (painel Mundos): vai pra aba do editor
  useEffect(() => { if (editSignal > 0) setTab('editar') }, [editSignal])
  const tabDir = useTabDirection(TABS, tab)
  const { tabsRef, selectTab } = useStableTabPanels<Tab>(setTab)

  return (
    <div className="vortable-master" style={{ '--tab-dir': tabDir } as CSSProperties}>
      <div className="vortable-master__top">
      <nav ref={tabsRef} className="campaign-tabs" role="tablist" aria-label="Vortable">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`campaign-tab ${tab === t ? 'campaign-tab--active' : ''}`}
            onClick={() => selectTab(t)}
          >
            <span className="campaign-tab__label">{LABELS[t]}</span>
          </button>
        ))}
        <TabIndicator activeKey={tab} />
      </nav>
      <SceneBar campaignId={campaign.id} />
      </div>

      {tab === 'editar' && !ready && <div className="vortable-stage"><div className="vortable-stage__cover"><div className="spinner" /></div></div>}
      {tab === 'editar' && ready && editing && (
        <EngineStage
          key={`editar:${editing.id}`}
          deps={[campaign.id, userId, vnet.net, editing.id]}
          mount={async (engine, host, isDead) => {
            const [worlds, characters] = await Promise.all([
              // salvou uma zona: quem está jogando nela recarrega na hora
              createWorldStorage(campaign.id, editing.id, editing.name, (id) => vnet.net?.send({ t: 'zone', id })),
              createCharacterStorage(campaign.id, userId),
            ])
            const appearance = await resolveAppearance(characters)
            // abre a zona mais recente; sem nenhuma, uma zona nova
            const [last] = await worlds.list()
            const zone = last ? (await worlds.load(last.id)) ?? undefined : undefined
            if (isDead()) return () => {}
            const net = vnet.net
            const game = engine.mountVortable(host, {
              mode: 'edit',
              zone,
              appearance,
              assetBase: VORTABLE_ASSETS,
              storage: worlds,
              onEditCharacter: () => selectTab('personagens'),
              // o botão Testar do editor põe o mestre no mundo, junto com os jogadores
              net: net ? { selfId: userId, get name() { return net.name }, send: (m) => net.send(m) } : undefined,
            })
            if (net) {
              net.sink = (m) => game.receive(m)
              net.onOpen = () => game.resync()
            }
            return () => {
              if (net) { net.sink = null; net.onOpen = null }
              game.destroy()
            }
          }}
        />
      )}

      {tab === 'controle' && <LiveControl key="controle" campaign={campaign} userId={userId} />}

      {tab === 'personagens' && (
        <EngineStage
          key="personagens"
          scroll
          deps={[campaign.id, userId]}
          mount={async (engine, host) => {
            const characters = await createCharacterStorage(campaign.id, userId)
            const creator = engine.mountCharacterCreator(host, {
              assetBase: VORTABLE_ASSETS,
              storage: characters,
              // criar um NPC não tira o boneco de teste do mestre ("Usar" faz isso)
              activateOnSave: false,
            })
            return creator.destroy
          }}
        />
      )}

      {tab === 'jogadores' && <PlayersManager campaign={campaign} />}
    </div>
  )
}
