import { DND_TEXT_LIMITS } from '../model/sheetForm'
import type { DndForm } from '../model/sheetForm'
import type { SheetCtx } from './sheetContext'

// ────────────────────────────────────────────────────────
// Aba História: traços de personalidade, ideais, vínculos, defeitos, a
// história do personagem e as anotações da mesa.
// ────────────────────────────────────────────────────────

type TextField = 'personality_traits' | 'ideals' | 'bonds' | 'flaws' | 'backstory' | 'notes'

export function DndHistoriaTab({ ctx }: { ctx: SheetCtx }) {
  const { form, set, readOnly } = ctx

  const area = (key: TextField, title: string, rows: number, hint: string, opts: { tall?: boolean; wide?: boolean } = {}) => (
    <section className={`dsh-card${opts.wide ? ' dsh-wide' : ''}`} key={key}>
      <div className="dsh-card__header">
        <h4 className="dsh-card__title">{title}</h4>
        <span className="dsh-faint">{(form[key as keyof DndForm] as string).length}/{DND_TEXT_LIMITS[key]}</span>
      </div>
      <textarea
        className={`dsh-input dsh-textarea${opts.tall ? ' dsh-textarea--tall' : ''}`} rows={rows} maxLength={DND_TEXT_LIMITS[key]}
        value={form[key as keyof DndForm] as string} readOnly={readOnly} placeholder={hint} aria-label={title}
        onChange={(e) => set(key as keyof DndForm, e.target.value as never)}
      />
    </section>
  )

  return (
    <div className="dsh-tab dsh-cols anim-tab-panel">
      <div className="dsh-col">
        {area('personality_traits', 'Traços de personalidade', 3, 'Como o personagem age e fala.')}
        {area('bonds', 'Vínculos', 3, 'Pessoas, lugares e coisas que importam.')}
      </div>
      <div className="dsh-col">
        {area('ideals', 'Ideais', 3, 'No que ele acredita.')}
        {area('flaws', 'Defeitos', 3, 'O que o derruba.')}
      </div>
      {area('backstory', 'História do personagem', 9, 'De onde veio, o que viveu, o que quer.', { tall: true, wide: true })}
      {area('notes', 'Anotações', 6, 'Lembretes da campanha, contatos, pistas.', { wide: true })}
    </div>
  )
}
