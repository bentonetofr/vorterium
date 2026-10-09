import { useCallback, useEffect, useState } from 'react'
import type { CampaignMemberWithProfile, CampaignWithRole } from '../../../shared/types'
import { getCampaignMembers } from '../../members/services/memberService'
import {
  createWorldStorage, deleteCharacter, listCampaignCharacters, loadEngine, watchCharacters,
  type CampaignCharacter,
} from '../services/vortableService'
import { useMesaStream } from '../../mesa/MesaStreamProvider'
import { useVortableNet } from '../net/VortableNetProvider'
import { useVortableWorlds } from '../worlds/VortableWorldProvider'
import { CharacterFace } from './CharacterFace'
import { Loader } from '../../../shared/components/Loader'

/** Mestre: os jogadores, o personagem que cada um criou na ficha (o mestre não troca nem entrega), espectadores e teleporte. */
export function PlayersManager({ campaign }: { campaign: CampaignWithRole; userId: string }) {
  const [players, setPlayers] = useState<CampaignMemberWithProfile[] | null>(null)
  const [characters, setCharacters] = useState<CampaignCharacter[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const vnet = useVortableNet()
  const { stage, setSpectate } = useMesaStream()
  const rules = stage.spectate
  const { active } = useVortableWorlds()
  const [zones, setZones] = useState<{ id: string; name: string }[]>([])

  // zonas do mundo (pra levar um jogador até uma delas)
  useEffect(() => {
    if (!active) return
    let dead = false
    createWorldStorage(campaign.id, active.id, active.name)
      .then((worlds) => worlds.list())
      .then((list) => { if (!dead) setZones(list.map((z) => ({ id: z.id, name: z.name }))) })
      .catch(() => {})
    return () => { dead = true }
  }, [campaign.id, active?.id, active?.name])

  /** Leva o jogador (conectado) ao início de uma zona. */
  async function teleport(playerId: string, zoneId: string) {
    if (!zoneId) return
    setError(null)
    try {
      if (!active) throw new Error('Nenhum mundo aberto.')
      const worlds = await createWorldStorage(campaign.id, active.id, active.name)
      const zone = await worlds.load(zoneId)
      if (!zone) throw new Error('Essa zona não existe mais.')
      vnet.net?.sendTo(playerId, { t: 'teleport', zone: zone.id, x: zone.spawn.x, y: zone.spawn.y })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não deu pra levar o jogador.')
    }
  }

  const load = useCallback(async () => {
    try {
      const [members, chars] = await Promise.all([getCampaignMembers(campaign.id), listCampaignCharacters(campaign.id)])
      setPlayers(members.filter((m) => m.role === 'player'))
      setCharacters(chars)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os jogadores.')
    }
  }, [campaign.id])

  useEffect(() => {
    void load()
    return watchCharacters(campaign.id, () => { void load() })
  }, [campaign.id, load])

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key)
    setError(null)
    try {
      await action()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não deu certo.')
    } finally {
      setBusy(null)
    }
  }

  /** Baixa um ou todos os bonecos como arquivo (vale em outra campanha ou no Vortable solto). */
  async function exportCharacters(list: CampaignCharacter[], fileName?: string) {
    setError(null)
    try {
      const engine = await loadEngine()
      engine.downloadText(fileName ?? engine.characterFileName(list[0]?.name ?? 'personagens'), engine.exportCharacters(list))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não deu pra exportar.')
    }
  }

  if (!players) {
    return error
      ? <p className="vortable-msg vortable-msg--error" role="alert">{error}</p>
      : <div className="vortable-stage__cover vortable-players__loading"><Loader /></div>
  }

  const controlledBy = (id: string) => characters.find((c) => c.controllerId === id) ?? null
  const peerOf = (id: string) => vnet.peers.find((x) => x.id === id && x.connected)
  const spectators = vnet.peers.filter((x) => x.connected && x.role === 'spectator')
  const playing = vnet.peers.filter((x) => x.connected && x.role === 'player')
  const nameOf = (id: string) => players.find((p) => p.user_id === id)?.profile.display_name ?? 'o mestre'

  function remove(character: CampaignCharacter) {
    const who = character.controllerId ? ` ${nameOf(character.controllerId)} vai precisar criar outro na ficha.` : ''
    if (!confirm(`Apagar "${character.name}"?${who}`)) return
    void run(`del:${character.id}`, () => deleteCharacter(campaign.id, character.id))
  }

  return (
    <section className="vortable-players">
      {error && <p className="vortable-msg vortable-msg--error" role="alert">{error}</p>}

      <div className="vortable-spectate">
        <h3 className="vortable-players__title">Espectadores</h3>
        <label className="vortable-spectate__opt">
          <input type="checkbox" checked={rules.allow} onChange={(e) => setSpectate({ allow: e.target.checked })} />
          Permitir espectadores
        </label>
        <label className="vortable-spectate__opt">
          <input type="checkbox" checked={rules.free} disabled={!rules.allow} onChange={(e) => setSpectate({ free: e.target.checked })} />
          Câmera livre
        </label>
        <label className="vortable-spectate__opt">
          Foco da câmera do mestre
          <select
            className="vortable-player__select"
            value={rules.focus && playing.some((x) => x.id === rules.focus) ? rules.focus : ''}
            disabled={!rules.allow}
            onChange={(e) => setSpectate({ focus: e.target.value || null })}
          >
            <option value="">Ninguém</option>
            {playing.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        {spectators.length > 0 && (
          <ul className="vortable-spectate__list">
            {spectators.map((x) => (
              <li key={x.id}>
                <span>👁 {x.name}</span>
                <button type="button" className="btn btn-ghost" onClick={() => vnet.net?.command(x.id, 'play')}>Colocar em jogo</button>
                <button type="button" className="btn btn-ghost" onClick={() => { if (confirm(`Tirar ${x.name} da sessão?`)) vnet.net?.kick(x.id) }}>Tirar</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="vortable-players__head">
        <h3 className="vortable-players__title">Jogadores</h3>
        <span className="vortable-players__actions">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={characters.length === 0}
            onClick={() => void exportCharacters(characters, 'bonecos.vortable-personagem.json')}
          >
            Exportar todos
          </button>
        </span>
      </div>
      {players.length === 0 && <p className="vortable-msg">Nenhum jogador na campanha ainda.</p>}
      <ul className="vortable-players__list">
        {players.map((p) => {
          const mine = controlledBy(p.user_id)
          const online = Boolean(peerOf(p.user_id))
          const watching = peerOf(p.user_id)?.role === 'spectator'
          return (
            <li key={p.user_id} className="vortable-player">
              {mine ? <CharacterFace appearance={mine.appearance} /> : <span className="vortable-face vortable-face--empty" />}
              <div className="vortable-player__info">
                <strong>
                  <span className={`vortable-dot${online ? ' vortable-dot--on' : ''}`} title={online ? 'Online no Vortable' : 'Fora do Vortable'} />
                  {p.profile.display_name}
                </strong>
                <span>{watching ? 'Assistindo' : mine ? mine.name : 'Ainda não criou o personagem'}</span>
              </div>
              {online && watching && (
                <button type="button" className="btn btn-ghost" onClick={() => vnet.net?.command(p.user_id, 'play')}>Colocar em jogo</button>
              )}
              {online && !watching && (
                <>
                  <select
                    className="vortable-player__select"
                    aria-label={`Levar ${p.profile.display_name} a uma zona`}
                    value=""
                    onChange={(e) => void teleport(p.user_id, e.target.value)}
                  >
                    <option value="">Levar a…</option>
                    {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                  </select>
                  {rules.allow && (
                    <button type="button" className="btn btn-ghost" onClick={() => vnet.net?.command(p.user_id, 'spectate')}>Mandar assistir</button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => { if (confirm(`Tirar ${p.profile.display_name} da sessão?`)) vnet.net?.kick(p.user_id) }}
                  >
                    Expulsar
                  </button>
                </>
              )}
              <button type="button" className="btn btn-ghost" disabled={!mine} onClick={() => mine && void exportCharacters([mine])}>
                Exportar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={!mine || busy !== null}
                onClick={() => mine && remove(mine)}
              >
                Apagar personagem
              </button>
            </li>
          )
        })}
      </ul>

    </section>
  )
}
