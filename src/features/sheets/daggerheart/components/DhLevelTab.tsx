import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import { confirmDialog } from '../../../../shared/components/dialogs'
import { currentSubclass, proficiency, subclassStage, thresholds, tierOf } from '../model/derive'
import { MAX_LEVEL } from '../model/defaults'
import { applyAdvancement, canLevelUp, undoLastAdvancement } from '../model/levelUp'
import type { DhSheetData } from '../model/types'
import { DhLevelWizard, describePick } from './DhLevelWizard'

// ────────────────────────────────────────────────────────
// Subir de nível: uma janela suspensa (aberta pelo botão no fim da barra de abas) com uma pergunta por vez: conquistas do nível
// (Experiência nova, +1 de Proficiência, marcas de atributo limpas nos níveis 5 e 8), as duas opções do quadro do patamar, os
// detalhes de cada uma, a carta de domínio do nível e a confirmação. Os limiares sobem junto com o nível. Embaixo ficam o histórico
// das subidas e o botão de desfazer a última.
// ────────────────────────────────────────────────────────

interface Props {
  data: DhSheetData
  update: (fn: (d: DhSheetData) => DhSheetData) => void
  canEdit: boolean
  onClose: () => void
}

export function DhLevelDialog({ data, update, canEdit, onClose }: Props) {
  const next = data.level + 1
  const ready = canLevelUp(data)

  async function undo() {
    if (!(await confirmDialog({ title: 'Desfazer a última subida de nível?', message: 'O nível, as escolhas e as cartas desse nível voltam ao que eram.', confirmLabel: 'Desfazer', tone: 'danger' }))) return
    update(undoLastAdvancement)
  }

  const th = thresholds(data)
  const sub = currentSubclass(data)

  return (
    <ModalOverlay onClose={onClose}>
      <div className="dh-dialog dh-lvl" role="dialog" aria-modal="true" aria-label="Subir de nível">
        <header className="dh-dialog__head">
          <div>
            <small className="dh-lvl__kicker">Nível {data.level} · Patamar {tierOf(data.level)}</small>
            <h3>{ready && data.level < MAX_LEVEL ? `Subir para o nível ${next}` : 'Subir de nível'}</h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </header>
        <p className="dh-lvl__stats">Proficiência <b>{proficiency(data)}</b> · limiares <b>{th.major}/{th.severe}</b>{sub && <> · subclasse {sub.name} (carta {subclassStage(data)} de 3)</>}</p>

        {!ready && <p className="dh-hint">Escolha a classe e a subclasse (na ficha ou na aba Personagem) para poder subir de nível.</p>}
        {ready && data.level >= MAX_LEVEL && <p className="dh-hint">O personagem já está no nível máximo.</p>}
        {ready && data.level < MAX_LEVEL && !canEdit && <p className="dh-hint">Só quem edita a ficha pode subir de nível.</p>}
        {ready && data.level < MAX_LEVEL && canEdit && (
          <DhLevelWizard
            stepped bare data={data} onCancel={onClose}
            onApply={(adv, expName) => { update((d) => applyAdvancement(d, adv, expName)); onClose() }}
          />
        )}

        {data.advancements.length > 0 && (
          <details className="dh-lvl__history">
            <summary>Histórico das subidas ({data.advancements.length})</summary>
            <ol className="dh-history">
              {data.advancements.map((a) => (
                <li key={a.level}>
                  <b>Nível {a.level}</b>: {a.picks.map((p) => describePick(p, data)).join(' · ')}
                </li>
              ))}
            </ol>
            {canEdit && <button type="button" className="dh-link" onClick={() => void undo()}>Desfazer a última subida</button>}
          </details>
        )}
      </div>
    </ModalOverlay>
  )
}
