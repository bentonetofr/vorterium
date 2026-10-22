import { useState } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import { AUTOMATION_GROUPS, AUTOMATION_ITEMS, isItemManual, manualSeed, type AutomationItem } from '../model/automation'
import { removeDndOverrides, saveDndOverrides } from '../services/dndSheetService'
import type { SheetCtx } from './sheetContext'

// ────────────────────────────────────────────────────────
// Janela "Automatizar": no centro da tela, uma lista vertical do que a ficha
// pode calcular sozinha. Cada item tem o nome e uma descrição à esquerda e a
// escolha Automático / Manual à direita. É o único lugar que troca o modo: a
// ficha em si não tem selo nem botão de modo.
// ────────────────────────────────────────────────────────

interface Props {
  ctx:     SheetCtx
  onClose: () => void
}

export function DndAutomationPanel({ ctx, onClose }: Props) {
  const { form, set, derived, data, sheet, readOnly, report } = ctx
  const [busy, setBusy] = useState<string | null>(null)

  const overrideKeys = new Set<string>(data.details.overrides.map((o) => o.field_key))
  const manualNow = (item: AutomationItem) => isItemManual(item, overrideKeys, form.manual_modes)
  const manualCount = AUTOMATION_ITEMS.filter(manualNow).length

  async function apply(item: AutomationItem, manual: boolean) {
    if (manual === manualNow(item)) return
    if (item.mode) {
      const mode = item.mode
      set('manual_modes', (manual ? [...form.manual_modes, mode] : form.manual_modes.filter((m) => m !== mode)).sort())
      return
    }
    const fields = item.fields ?? []
    if (manual) {
      const saved = await saveDndOverrides(sheet.id, manualSeed(item, derived, form.hp_max))
      data.setDetails((d) => ({ ...d, overrides: [...d.overrides.filter((o) => !fields.includes(o.field_key)), ...saved] }))
    } else {
      await removeDndOverrides(sheet.id, fields)
      data.setDetails((d) => ({ ...d, overrides: d.overrides.filter((o) => !fields.includes(o.field_key)) }))
    }
  }

  async function choose(item: AutomationItem, manual: boolean) {
    if (readOnly || busy) return
    setBusy(item.id)
    report(null)
    try { await apply(item, manual) } catch (err) {
      report(err instanceof Error ? err.message : 'Não foi possível trocar o modo.')
    } finally { setBusy(null) }
  }

  async function allAutomatic() {
    if (readOnly || busy) return
    setBusy('all')
    report(null)
    try {
      for (const item of AUTOMATION_ITEMS) if (manualNow(item)) await apply(item, false)
    } catch (err) {
      report(err instanceof Error ? err.message : 'Não foi possível voltar tudo ao automático.')
    } finally { setBusy(null) }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="dsh-sheet dsh-auto" role="dialog" aria-modal="true" aria-labelledby="dsh-auto-title">
        <header className="dsh-auto__head">
          <div>
            <h3 id="dsh-auto-title" className="dsh-auto__title">Automatizar</h3>
            <p className="dsh-auto__lead">Escolha o que a ficha calcula sozinha pelas regras do livro e o que você prefere preencher à mão.</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </header>

        <div className="dsh-auto__body">
          {AUTOMATION_GROUPS.map((group) => (
            <section key={group} className="dsh-auto__group">
              <h4 className="dsh-auto__group-title">{group}</h4>
              <ul className="dsh-auto__list">
                {AUTOMATION_ITEMS.filter((i) => i.group === group).map((item) => {
                  const manual = manualNow(item)
                  const disabled = readOnly || busy !== null
                  return (
                    <li key={item.id} className="dsh-auto__item">
                      <div className="dsh-auto__text">
                        <strong>{item.title}</strong>
                        <span>{item.description}</span>
                      </div>
                      <div className="dsh-auto__choice" role="group" aria-label={`${item.title}: automático ou manual`}>
                        <button type="button" className={manual ? '' : 'is-on'} aria-pressed={!manual} disabled={disabled} onClick={() => void choose(item, false)}>Automático</button>
                        <button type="button" className={manual ? 'is-on is-manual' : ''} aria-pressed={manual} disabled={disabled} onClick={() => void choose(item, true)}>Manual</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>

        <footer className="dsh-auto__foot">
          <span className="dsh-faint">{manualCount === 0 ? 'Tudo automático.' : `${manualCount} ${manualCount === 1 ? 'item' : 'itens'} em modo manual.`}</span>
          <span className="dsh-auto__actions">
            <button type="button" className="dsh-chip" onClick={() => void allAutomatic()} disabled={readOnly || busy !== null || manualCount === 0}>Tudo automático</button>
            <button type="button" className="dsh-chip dsh-chip--primary" onClick={onClose}>Fechar</button>
          </span>
        </footer>
      </div>
    </ModalOverlay>
  )
}
