import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { getMyCharacter, isCampaignMaster } from '../services/vortableService'
import { CharacterStudio } from './CharacterStudio'
import './CharacterStudio.css'

/**
 * Botão pequeno embaixo do retrato da ficha: abre o criador de personagem do Vortable em tela cheia.
 * Na ficha do próprio jogador, é ele quem cria o boneco dele. Na ficha de OUTRO jogador, só o mestre da campanha vê o botão:
 * ele cria (ou refaz) o personagem do jogador, pra quem não consegue montar o boneco sozinho, e pode importar um arquivo de
 * personagem ali dentro. Fica solto (absolute) embaixo do retrato, então o card em volta não muda de tamanho
 * — o pai do botão precisa ter `position: relative`.
 */
export function CreateCharacterButton({ campaignId, ownerId, onCharacterSaved }: {
  campaignId: string
  ownerId: string
  /** Chamado depois que o criador salva o personagem (a ficha usa pra pôr as armas no boneco novo). */
  onCharacterSaved?: () => void
}) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  // undefined = descobrindo · false = ainda não criou
  const [has, setHas] = useState<boolean | undefined>(undefined)
  // mestre vendo a ficha de um jogador (undefined = descobrindo)
  const [master, setMaster] = useState<boolean | undefined>(undefined)
  const mineSheet = !!user && user.id === ownerId

  const refresh = useCallback(() => {
    getMyCharacter(campaignId, ownerId).then((c) => setHas(c !== null)).catch(() => setHas(undefined))
  }, [campaignId, ownerId])

  useEffect(() => {
    if (!user) return
    if (mineSheet) { refresh(); return }
    let dead = false
    isCampaignMaster(campaignId, user.id)
      .then((m) => { if (dead) return; setMaster(m); if (m) refresh() })
      .catch(() => { if (!dead) setMaster(false) })
    return () => { dead = true }
  }, [user, mineSheet, campaignId, refresh])

  if (!user || (!mineSheet && !master)) return null
  const forPlayer = !mineSheet
  return (
    <>
      <button
        type="button"
        className="char-btn"
        onClick={() => setOpen(true)}
        title={forPlayer
          ? 'Mestre: crie (ou refaça) a aparência do personagem deste jogador. Você também pode importar um arquivo de personagem. É com esse boneco que ele joga no Vortable nesta campanha.'
          : 'Crie a aparência do seu personagem: é com ele que você joga no Vortable nesta campanha'}
      >
        {forPlayer
          ? (has ? 'Editar personagem do jogador' : 'Criar personagem do jogador')
          : (has ? 'Editar personagem no Vortable' : 'Criar personagem no Vortable')}
      </button>
      {open && (
        <CharacterStudio
          campaignId={campaignId}
          userId={user.id}
          {...(forPlayer ? { forPlayer: { id: ownerId } } : {})}
          onClose={() => { setOpen(false); refresh() }}
          onSaved={() => { refresh(); onCharacterSaved?.() }}
        />
      )}
    </>
  )
}
