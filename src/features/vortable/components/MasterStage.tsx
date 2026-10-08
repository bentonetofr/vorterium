import { useState, type CSSProperties } from 'react'
import type { CampaignWithRole } from '../../../shared/types'
import { TabIndicator, useStableTabPanels, useTabDirection } from '../../../shared/components/TabIndicator'
import { createCharacterStorage, createWorldStorage, resolveAppearance, VORTABLE_ASSETS } from '../services/vortableService'
import { EngineStage } from './EngineStage'
import { PlayersManager } from './PlayersManager'

type Tab = 'editar' | 'testar' | 'personagens' | 'jogadores'

const TABS: Tab[] = ['editar', 'testar', 'personagens', 'jogadores']
const LABELS: Record<Tab, string> = {
  editar: 'Editar mundo', testar: 'Testar', personagens: 'Personagens', jogadores: 'Jogadores',
}

/** Mestre: editor do mundo, teste como boneco, criador de personagens e gerência dos jogadores. */
export function MasterStage({ campaign, userId }: { campaign: CampaignWithRole; userId: string }) {
  const [tab, setTab] = useState<Tab>('editar')
  const tabDir = useTabDirection(TABS, tab)
  const { tabsRef, selectTab } = useStableTabPanels<Tab>(setTab)

  return (
    <div className="vortable-master" style={{ '--tab-dir': tabDir } as CSSProperties}>
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

      {tab === 'editar' && (
        <EngineStage
          key="editar"
          deps={[campaign.id, userId]}
          mount={async (engine, host, isDead) => {
            const [worlds, characters] = await Promise.all([
              createWorldStorage(campaign.id, campaign.name),
              createCharacterStorage(campaign.id, userId),
            ])
            const appearance = await resolveAppearance(characters)
            // abre a zona mais recente; sem nenhuma, uma zona nova
            const [last] = await worlds.list()
            const zone = last ? (await worlds.load(last.id)) ?? undefined : undefined
            if (isDead()) return () => {}
            const game = engine.mountVortable(host, {
              mode: 'edit',
              zone,
              appearance,
              assetBase: VORTABLE_ASSETS,
              storage: worlds,
              onEditCharacter: () => selectTab('personagens'),
            })
            return game.destroy
          }}
        />
      )}

      {tab === 'testar' && (
        <EngineStage
          key="testar"
          deps={[campaign.id, userId]}
          mount={async (engine, host, isDead) => {
            const [worlds, characters] = await Promise.all([
              createWorldStorage(campaign.id, campaign.name),
              createCharacterStorage(campaign.id, userId),
            ])
            const appearance = await resolveAppearance(characters)
            if (isDead()) return () => {}
            const game = engine.mountVortable(host, {
              mode: 'play',
              appearance,
              assetBase: VORTABLE_ASSETS,
              storage: worlds,
            })
            return game.destroy
          }}
        />
      )}

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
