import { DND_TEXT_LIMITS } from '../model/sheetForm'
import type { SheetCtx } from './sheetContext'

// ────────────────────────────────────────────────────────
// Aba Anotações: uma página em branco do jogador pra lembretes da campanha, contatos, pistas e o que mais quiser.
// É o campo `notes` da ficha (o mesmo que ficava na aba História), salvo junto com o resto.
// ────────────────────────────────────────────────────────

export function DndAnotacoesTab({ ctx }: { ctx: SheetCtx }) {
  const { form, set, readOnly } = ctx
  const used = form.notes.length
  const limit = DND_TEXT_LIMITS.notes

  return (
    <div className="dsh-tab anim-tab-panel">
      <section className="dsh-card dsh-notecard dsh-notepage">
        <div className="dsh-card__header"><h4 className="dsh-card__title">Anotações</h4></div>
        <p className="dsh-notecard__hint">Lembretes da campanha, nomes e contatos, pistas, planos, o que o grupo combinou. Salva sozinho, junto com a ficha.</p>
        <textarea
          className="dsh-notearea dsh-notearea--page" maxLength={limit} value={form.notes} readOnly={readOnly}
          placeholder={readOnly ? '' : 'Escreva aqui...'} aria-label="Anotações" onChange={(e) => set('notes', e.target.value)}
        />
        <span className={`dsh-notecard__count${used >= limit * 0.9 ? ' is-near' : ''}`} title="Caracteres usados / limite">{used.toLocaleString('pt-BR')} / {limit.toLocaleString('pt-BR')}</span>
      </section>
    </div>
  )
}
