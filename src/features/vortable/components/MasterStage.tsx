import { useEffect, useState } from 'react'
import type { CampaignWithRole } from '../../../shared/types'
import { createCharacterStorage, createWorldStorage, listNpcCharacters, resolveAppearance, VORTABLE_ASSETS } from '../services/vortableService'
import { EngineStage } from './EngineStage'
import { PlayersManager } from './PlayersManager'
import { LiveControl } from './LiveControl'
import { SceneBar } from './SceneBar'
import { ModeButton } from './ModeButton'
import { EditorBar, type EditorBarHandle } from './EditorBar'
import { useVortableNet } from '../net/VortableNetProvider'
import { useVortableWorlds } from '../worlds/VortableWorldProvider'
import { getResume, patchResume } from '../resume/resumeStore'
import { Loader } from '../../../shared/components/Loader'

/** Duas telas: as ferramentas (editar o mundo) e o controle ao vivo (ver a cena como os jogadores e mudar tudo na hora). */
type Mode = 'editar' | 'controle'
/** Telas secundárias, abertas de dentro de uma das duas (têm um "Voltar"). */
type Extra = 'personagens' | 'jogadores'

const EXTRA_TITLE: Record<Extra, string> = { personagens: 'Personagens', jogadores: 'Jogadores' }

/** Mestre: editor do mundo, controle ao vivo, criador de personagens e gerência dos jogadores. */
export function MasterStage({ campaign, userId, editSignal = 0 }: { campaign: CampaignWithRole; userId: string; editSignal?: number }) {
  // voltando ao Vortable: a mesma tela em que o mestre estava
  const [mode, setMode] = useState<Mode>(() => (getResume(campaign.id)?.masterTab === 'controle' ? 'controle' : 'editar'))
  const [extra, setExtra] = useState<Extra | null>(null)
  // ações do editor (nome, Nova, Salvar, Testar…), mostradas na faixa de cima enquanto o editor está aberto
  const [editor, setEditor] = useState<EditorBarHandle | null>(null)
  useEffect(() => { patchResume(campaign.id, { masterTab: mode }) }, [campaign.id, mode])
  const vnet = useVortableNet()
  const { editing, ready } = useVortableWorlds()

  // "Editar" num mundo (painel Mundos): vai pro editor
  useEffect(() => { if (editSignal > 0) { setExtra(null); setMode('editar') } }, [editSignal])

  const floating = mode === 'controle' && !extra

  function toggle() {
    setExtra(null)
    setMode((m) => (m === 'editar' ? 'controle' : 'editar'))
  }

  return (
    <div className={`vortable-master${floating ? ' vortable-master--float' : ''}`}>
      {/* no controle ao vivo a faixa some: os botões flutuam por cima da cena */}
      <div className={`vortable-master__top${floating ? ' vortable-master__top--float' : ''}`}>
        <ModeButton mode={mode} onClick={toggle} />
        {mode === 'editar' && !extra && editor && <EditorBar editor={editor} />}
        <SceneBar campaignId={campaign.id} />
      </div>

      {extra && (
        <div className="vortable-extra">
          <div className="vortable-extra__bar">
            <button type="button" className="btn btn-ghost" onClick={() => setExtra(null)}>← Voltar</button>
            <h3 className="vortable-extra__title">{EXTRA_TITLE[extra]}</h3>
          </div>
          {extra === 'personagens' && (
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
          {extra === 'jogadores' && <PlayersManager campaign={campaign} userId={userId} />}
        </div>
      )}

      {!extra && mode === 'editar' && !ready && <div className="vortable-stage"><div className="vortable-stage__cover"><Loader /></div></div>}
      {!extra && mode === 'editar' && ready && editing && (
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
            // voltando: a zona como estava (com o que não foi salvo; sem alterações, a versão fresca do banco) e a câmera no mesmo lugar
            const back = getResume(campaign.id)?.editor
            const resumeSnap = back && back.worldId === editing.id ? back.snap : undefined
            // abre a zona em que estava ao sair; senão a mais recente; sem nenhuma, uma zona nova
            const [last] = await worlds.list()
            const wantId = resumeSnap?.kind === 'edit' ? resumeSnap.zone.id : last?.id
            const zone = wantId ? (await worlds.load(wantId)) ?? undefined : undefined
            if (isDead()) return () => {}
            const net = vnet.net
            const game = engine.mountVortable(host, {
              mode: 'edit',
              resume: resumeSnap,
              zone,
              appearance,
              assetBase: VORTABLE_ASSETS,
              storage: worlds,
              onEditCharacter: () => setExtra('personagens'),
              // NPCs especiais: os que o mestre criou nas fichas de NPC (o editor os põe nas zonas)
              npcLibrary: () => listNpcCharacters(campaign.id),
              externalToolbar: true,
              // o botão Testar do editor põe o mestre no mundo, junto com os jogadores
              net: net ? { selfId: userId, get name() { return net.name }, send: (m) => net.send(m) } : undefined,
            })
            if (net) {
              net.sink = (m) => game.receive(m)
              net.onOpen = () => game.resync()
            }
            if (game.editor) setEditor({ controls: game.editor, icons: engine.EDITOR_ICONS as Record<string, string> })
            return () => {
              setEditor(null)
              if (net) { net.sink = null; net.onOpen = null }
              const snap = game.snapshot()
              if (snap) patchResume(campaign.id, { editor: { worldId: editing.id, snap } })
              game.destroy()
            }
          }}
        />
      )}

      {!extra && mode === 'controle' && (
        <LiveControl key="controle" campaign={campaign} userId={userId} onOpen={setExtra} />
      )}
    </div>
  )
}
