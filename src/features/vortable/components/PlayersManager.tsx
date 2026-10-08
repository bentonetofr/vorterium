import { useCallback, useEffect, useState } from 'react'
import type { CampaignMemberWithProfile, CampaignWithRole } from '../../../shared/types'
import { getCampaignMembers } from '../../members/services/memberService'
import {
  assignCharacter, deleteCharacter, listCampaignCharacters, watchCharacters, type CampaignCharacter,
} from '../services/vortableService'
import { CharacterFace } from './CharacterFace'

/** Mestre: quem joga com qual boneco, troca, apaga e bonecos sem dono. */
export function PlayersManager({ campaign }: { campaign: CampaignWithRole }) {
  const [players, setPlayers] = useState<CampaignMemberWithProfile[] | null>(null)
  const [characters, setCharacters] = useState<CampaignCharacter[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

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

  if (!players) {
    return error
      ? <p className="vortable-msg vortable-msg--error" role="alert">{error}</p>
      : <div className="vortable-stage__cover vortable-players__loading"><div className="spinner" /></div>
  }

  const controlledBy = (id: string) => characters.find((c) => c.controllerId === id) ?? null
  const free = characters.filter((c) => !c.controllerId)
  const nameOf = (id: string) => players.find((p) => p.user_id === id)?.profile.display_name ?? 'o mestre'

  function remove(character: CampaignCharacter) {
    const who = character.controllerId ? ` ${nameOf(character.controllerId)} volta a criar o dele.` : ''
    if (!confirm(`Apagar "${character.name}"?${who}`)) return
    void run(`del:${character.id}`, () => deleteCharacter(campaign.id, character.id))
  }

  return (
    <section className="vortable-players">
      {error && <p className="vortable-msg vortable-msg--error" role="alert">{error}</p>}

      <h3 className="vortable-players__title">Jogadores</h3>
      {players.length === 0 && <p className="vortable-msg">Nenhum jogador na campanha ainda.</p>}
      <ul className="vortable-players__list">
        {players.map((p) => {
          const mine = controlledBy(p.user_id)
          return (
            <li key={p.user_id} className="vortable-player">
              {mine ? <CharacterFace appearance={mine.appearance} /> : <span className="vortable-face vortable-face--empty" />}
              <div className="vortable-player__info">
                <strong>{p.profile.display_name}</strong>
                <span>{mine ? mine.name : 'Ainda sem boneco'}</span>
              </div>
              <select
                className="vortable-player__select"
                aria-label={`Boneco de ${p.profile.display_name}`}
                value={mine?.id ?? ''}
                disabled={busy !== null}
                onChange={(e) => {
                  const id = e.target.value || null
                  void run(`give:${p.user_id}`, () => assignCharacter(campaign.id, p.user_id, id))
                }}
              >
                <option value="">Sem boneco</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.controllerId && c.controllerId !== p.user_id ? ` (de ${nameOf(c.controllerId)})` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-danger"
                disabled={!mine || busy !== null}
                onClick={() => mine && remove(mine)}
              >
                Apagar boneco
              </button>
            </li>
          )
        })}
      </ul>

      {free.length > 0 && (
        <>
          <h3 className="vortable-players__title">Bonecos sem jogador</h3>
          <ul className="vortable-players__list">
            {free.map((c) => (
              <li key={c.id} className="vortable-player">
                <CharacterFace appearance={c.appearance} />
                <div className="vortable-player__info">
                  <strong>{c.name}</strong>
                  <span>Escolha-o no jogador acima</span>
                </div>
                <span className="vortable-player__spacer" />
                <button type="button" className="btn btn-danger" disabled={busy !== null} onClick={() => remove(c)}>Apagar</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
