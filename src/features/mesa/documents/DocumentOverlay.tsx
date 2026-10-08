import { createPortal } from 'react-dom'
import { useCurrentCampaign } from '../../campaigns/CurrentCampaignContext'
import { usePip } from '../../vortable/pip/pipStore'
import { useMesaStream } from '../MesaStreamProvider'
import { DocumentStage } from './MesaDocuments'
import './Documents.css'

/**
 * O documento que o mestre pôs na mesa, grande no centro da tela de todo mundo (jogo, site,
 * qualquer página da campanha). O fundo desfoca e escurece com uma vinheta. O mestre vira as
 * páginas e tira o documento: some pra todos. Fica abaixo dos botões do canto (dados, chat).
 */
export function DocumentOverlay() {
  const { campaign } = useCurrentCampaign()
  const pip = usePip()
  const mesa = useMesaStream()
  const doc = mesa.stage.document
  const campaignId = campaign?.id ?? pip?.id ?? null
  if (!doc || !campaignId) return null

  return createPortal(
    <div className="doc-overlay" role="dialog" aria-modal="false" aria-label={doc.title}>
      <div className="doc-overlay__stage">
        <DocumentStage key={doc.id} campaignId={campaignId} docId={doc.id} page={doc.page} />
      </div>
      <p className="doc-overlay__title">{doc.title}</p>
      {mesa.isMaster && (
        <button type="button" className="doc-overlay__close" onClick={mesa.hideDocument} title="Tirar da mesa (some pra todos)">
          <span aria-hidden="true">×</span> Tirar da mesa
        </button>
      )}
    </div>,
    document.body,
  )
}
