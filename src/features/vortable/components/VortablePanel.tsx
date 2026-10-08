import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { CampaignWithRole } from '../../../shared/types'
import { TabIndicator, useStableTabPanels, useTabDirection } from '../../../shared/components/TabIndicator'
import { createCharacterStorage, createWorldStorage, loadEngine, VORTABLE_ASSETS } from '../services/vortableService'
import './VortablePanel.css'

type Mode = 'jogar' | 'editar' | 'personagem'

interface VortablePanelProps {
  campaign:      CampaignWithRole
  currentUserId: string
}

const LABELS: Record<Mode, string> = { jogar: 'Jogar', editar: 'Editar mundo', personagem: 'Meu personagem' }

export function VortablePanel({ campaign, currentUserId }: VortablePanelProps) {
  const isMaster = campaign.role === 'master'
  const modes: Mode[] = isMaster ? ['editar', 'jogar', 'personagem'] : ['jogar', 'personagem']
  const [mode, setMode] = useState<Mode>(modes[0])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const stage = useRef<HTMLDivElement>(null)

  const tabDir = useTabDirection(modes, mode)
  const { tabsRef, selectTab } = useStableTabPanels<Mode>(setMode)

  // Cada modo monta o motor de novo no palco e desmonta ao sair.
  useEffect(() => {
    const host = stage.current
    if (!host) return
    let dead = false
    let destroy: (() => void) | null = null
    setStatus('loading')
    setError(null)

    ;(async () => {
      const engine = await loadEngine()
      const [worlds, characters] = await Promise.all([
        createWorldStorage(campaign.id, campaign.name),
        createCharacterStorage(campaign.id, currentUserId),
      ])
      if (dead) return

      if (mode === 'personagem') {
        const creator = engine.mountCharacterCreator(host, {
          assetBase: VORTABLE_ASSETS,
          storage: characters,
          back: { label: 'Voltar', onClick: () => selectTab(modes[0]) },
        })
        destroy = creator.destroy
      } else {
        // personagem em uso (o último salvo, se nenhum foi marcado)
        const data = await engine.loadCharacterData(VORTABLE_ASSETS)
        const [list, active] = await Promise.all([characters.list(), characters.getActive()])
        const chosen = list.find((c) => c.id === active) ?? list[0]
        const appearance = engine.normalizeAppearance(data, chosen?.appearance ?? engine.defaultAppearance())
        // editor abre a zona mais recente; sem nenhuma, uma zona nova
        const [last] = mode === 'editar' ? await worlds.list() : []
        const zone = last ? (await worlds.load(last.id)) ?? undefined : undefined
        if (dead) return

        const game = engine.mountVortable(host, {
          mode: mode === 'editar' ? 'edit' : 'play',
          zone,
          appearance,
          assetBase: VORTABLE_ASSETS,
          storage: worlds,
          onEditCharacter: () => selectTab('personagem'),
        })
        destroy = game.destroy
      }
      if (!dead) setStatus('ready')
    })().catch((err) => {
      if (dead) return
      console.error('[vortable]', err)
      setError(err instanceof Error ? err.message : 'Não foi possível abrir o Vortable.')
      setStatus('error')
    })

    return () => {
      dead = true
      destroy?.()
      host.replaceChildren()
    }
    // modes é derivado de isMaster; selectTab só troca o estado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, campaign.id, campaign.name, currentUserId])

  return (
    <div className="vortable-panel" style={{ '--tab-dir': tabDir } as CSSProperties}>
      <nav ref={tabsRef} className="campaign-tabs" role="tablist" aria-label="Vortable">
        {modes.map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            className={`campaign-tab ${mode === m ? 'campaign-tab--active' : ''}`}
            onClick={() => selectTab(m)}
          >
            <span className="campaign-tab__label">{LABELS[m]}</span>
          </button>
        ))}
        <TabIndicator activeKey={mode} />
      </nav>

      <div className={`vortable-panel__stage vortable-panel__stage--${mode}`}>
        <div ref={stage} className="vortable-panel__host" />
        {status === 'loading' && (
          <div className="vortable-panel__cover">
            <div className="spinner" />
            <span>Carregando o mundo...</span>
          </div>
        )}
        {status === 'error' && (
          <div className="vortable-panel__cover" role="alert">
            <span>{error}</span>
            <button className="btn btn-ghost" onClick={() => selectTab(mode)}>Tentar de novo</button>
          </div>
        )}
      </div>
    </div>
  )
}
