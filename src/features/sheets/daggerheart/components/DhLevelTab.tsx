import { useState } from 'react'
import { currentSubclass, proficiency, subclassStage, thresholds, tierOf } from '../model/derive'
import { MAX_LEVEL } from '../model/defaults'
import { applyAdvancement, canLevelUp, undoLastAdvancement } from '../model/levelUp'
import type { DhSheetData } from '../model/types'
import { confirmDialog } from '../../../../shared/components/dialogs'
import { DhLevelWizard, describePick } from './DhLevelWizard'
import { Banner } from './DhUi'

// ────────────────────────────────────────────────────────
// Subir de nível: conquistas do nível (Experiência nova, +1 de Proficiência, marcas de atributo limpas nos níveis 5 e 8),
// duas opções do quadro do patamar, a carta de domínio do nível e os limiares que sobem junto com o nível.
// ────────────────────────────────────────────────────────

interface Props {
  data: DhSheetData
  update: (fn: (d: DhSheetData) => DhSheetData) => void
  canEdit: boolean
}

export function DhLevelTab({ data, update, canEdit }: Props) {
  const next = data.level + 1
  const ready = canLevelUp(data)
  const [open, setOpen] = useState(false)

  async function undo() {
    if (!(await confirmDialog({ title: 'Desfazer a última subida de nível?', message: 'O nível, as escolhas e as cartas desse nível voltam ao que eram.', confirmLabel: 'Desfazer', tone: 'danger' }))) return
    update(undoLastAdvancement)
  }

  const th = thresholds(data)
  const sub = currentSubclass(data)

  return (
    <div className="dh-level">
      <section className="dh-box">
        <Banner>Nível {data.level} · Patamar {tierOf(data.level)}</Banner>
        <p>Proficiência <b>{proficiency(data)}</b> · limiares <b>{th.major}/{th.severe}</b>{sub && <> · subclasse {sub.name} (carta {subclassStage(data)} de 3)</>}</p>
        {!ready && <p className="dh-hint">Escolha a classe e a subclasse (na ficha ou na aba Personagem) para poder subir de nível.</p>}
        {ready && data.level >= MAX_LEVEL && <p className="dh-hint">Nível máximo.</p>}
        {ready && data.level < MAX_LEVEL && canEdit && !open && <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>Subir para o nível {next}</button>}
        {canEdit && data.advancements.length > 0 && <button type="button" className="dh-link" onClick={() => void undo()}>Desfazer a última subida</button>}
      </section>

      {open && ready && (
        <DhLevelWizard
          data={data}
          onCancel={() => setOpen(false)}
          onApply={async (adv, expName) => {
            if (!(await confirmDialog({ title: `Subir para o nível ${next}?`, message: 'Você pode desfazer a última subida depois, se errar.', confirmLabel: 'Subir de nível' }))) return
            update((d) => applyAdvancement(d, adv, expName))
            setOpen(false)
          }}
        />
      )}

      {data.advancements.length > 0 && (
        <section className="dh-box">
          <Banner>Histórico</Banner>
          <ol className="dh-history">
            {data.advancements.map((a) => (
              <li key={a.level}>
                <b>Nível {a.level}</b>: {a.picks.map((p) => describePick(p, data)).join(' · ')}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
