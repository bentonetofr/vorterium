import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { getMyCharacter } from '../services/vortableService'
import { CharacterStudio } from './CharacterStudio'
import './CharacterStudio.css'

/**
 * Botão pequeno embaixo do retrato da ficha: abre o criador de personagem do Vortable em tela cheia.
 * Só aparece pro dono da ficha (cada jogador cria o seu). Fica solto (absolute) embaixo do retrato,
 * então o card em volta não muda de tamanho — o pai do botão precisa ter `position: relative`.
 */
export function CreateCharacterButton({ campaignId, ownerId, onCharacterSaved }: {
  campaignId: string
  ownerId: string
  /** Chamado depois que o criador salva o personagem (a ficha usa pra pôr as armas no boneco novo). */
  onCharacterSaved?: () => void
}) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  // undefined = descobrindo · null = ainda não criou
  const [mine, setMine] = useState<boolean | undefined>(undefined)
  const mineSheet = !!user && user.id === ownerId

  const refresh = useCallback(() => {
    if (!user) return
    getMyCharacter(campaignId, user.id).then((c) => setMine(c !== null)).catch(() => setMine(undefined))
  }, [campaignId, user])

  useEffect(() => { if (mineSheet) refresh() }, [mineSheet, refresh])

  if (!mineSheet || !user) return null
  return (
    <>
      <button
        type="button"
        className="char-btn"
        onClick={() => setOpen(true)}
        title="Crie a aparência do seu personagem: é com ele que você joga no Vortable nesta campanha"
      >
        {mine ? 'Editar personagem no Vortable' : 'Criar personagem no Vortable'}
      </button>
      {open && <CharacterStudio campaignId={campaignId} userId={user.id} onClose={() => { setOpen(false); refresh() }} onSaved={() => { refresh(); onCharacterSaved?.() }} />}
    </>
  )
}
