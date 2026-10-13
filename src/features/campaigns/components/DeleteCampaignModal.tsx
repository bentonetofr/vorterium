import { useState, type FormEvent } from 'react'
import { ModalOverlay } from '../../../shared/components/ModalOverlay'
import { deleteCampaign } from '../services/campaignService'

interface DeleteCampaignModalProps {
  campaignId:   string
  campaignName: string
  onClose:      () => void
  /** A campanha foi excluída (tire ela da lista). */
  onDeleted:    () => void
}

/**
 * Exclusão de uma campanha: só libera o botão depois de escrever, igualzinho, a frase
 * `DELETAR (nome da campanha)`. Apaga a campanha e tudo o que está nela, sem volta.
 */
export function DeleteCampaignModal({ campaignId, campaignName, onClose, onDeleted }: DeleteCampaignModalProps) {
  const phrase = `DELETAR (${campaignName})`
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const matches = typed.trim() === phrase

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!matches || busy) return
    setBusy(true)
    setError(null)
    try {
      await deleteCampaign(campaignId)
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir a campanha.')
      setBusy(false)
    }
  }

  return (
    <ModalOverlay onClose={busy ? () => {} : onClose}>
      <form className="delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-modal-title" onSubmit={(e) => void submit(e)}>
        <header className="delete-modal__header">
          <h4 id="delete-modal-title" className="delete-modal__title">Excluir campanha</h4>
          <button type="button" className="modal-close" onClick={onClose} disabled={busy} aria-label="Fechar">×</button>
        </header>
        <p className="delete-modal__warn">
          Isso apaga <strong>{campaignName}</strong> e tudo o que está nela: fichas, mundos do Vortable, notas, quadro, chat, episódios e jogadores.
          <strong> Não tem como desfazer.</strong> Se só quer tirar da lista, arquive no botão de envelope.
        </p>
        <label className="delete-modal__label" htmlFor="delete-campaign-phrase">
          Para confirmar, escreva exatamente:
        </label>
        <code className="delete-modal__phrase">{phrase}</code>
        <input
          id="delete-campaign-phrase"
          className="input delete-modal__input"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus
          placeholder={phrase}
          disabled={busy}
        />
        {error && <p className="delete-modal__error" role="alert">{error}</p>}
        <div className="delete-modal__actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="btn btn-danger" disabled={!matches || busy}>
            {busy ? 'Excluindo…' : 'Excluir para sempre'}
          </button>
        </div>
      </form>
    </ModalOverlay>
  )
}
