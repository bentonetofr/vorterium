import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Loader } from '../../../shared/components/Loader'
import { assignCharacter, createCharacterStorage, VORTABLE_ASSETS } from '../services/vortableService'
import { loadEngine } from '../services/vortableService'
import './CharacterStudio.css'

/**
 * O criador de personagem em tela cheia. Cada jogador cria o seu, na ficha: ao salvar, o personagem vira
 * o boneco fixo dele nesta campanha (é com ele que entra no Vortable).
 */
export function CharacterStudio({ campaignId, userId, onClose, onSaved }: {
  campaignId: string
  userId: string
  onClose: () => void
  onSaved?: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  // as funções mudam a cada render do pai: o criador é montado uma vez só
  const cb = useRef({ onClose, onSaved })
  cb.current = { onClose, onSaved }

  useEffect(() => {
    const el = host.current
    if (!el) return
    let dead = false
    let destroy: (() => void) | null = null
    let closeTimer = 0
    ;(async () => {
      const [engine, storage] = await Promise.all([loadEngine(), createCharacterStorage(campaignId, userId)])
      if (dead) return
      const creator = engine.mountCharacterCreator(el, {
        assetBase: VORTABLE_ASSETS,
        storage,
        single: true,
        title: 'Seu personagem',
        saveLabel: 'Salvar personagem',
        back: { label: 'Fechar', onClick: () => cb.current.onClose() },
        onSaved: (c) => {
          // o personagem salvo é o que a pessoa joga nesta campanha
          void assignCharacter(campaignId, userId, c.id)
            .catch(() => {})
            .finally(() => {
              cb.current.onSaved?.()
              closeTimer = window.setTimeout(() => cb.current.onClose(), 900)
            })
        },
      })
      if (dead) creator.destroy()
      else destroy = creator.destroy
    })().catch((err) => console.error('[vortable] o criador de personagem não abriu', err))
    return () => { dead = true; window.clearTimeout(closeTimer); destroy?.() }
  }, [campaignId, userId])

  // a página de trás não rola enquanto o criador está aberto
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return createPortal(
    <div className="char-studio" role="dialog" aria-modal="true" aria-label="Criar personagem">
      <div className="char-studio__loading"><Loader /></div>
      <div ref={host} className="char-studio__host" />
    </div>,
    document.body,
  )
}
