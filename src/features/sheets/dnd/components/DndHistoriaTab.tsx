import { DND_TEXT_LIMITS } from '../model/sheetForm'
import type { DndForm } from '../model/sheetForm'
import type { SheetCtx } from './sheetContext'

// ────────────────────────────────────────────────────────
// Aba História: traços de personalidade, ideais, vínculos, defeitos, a
// história do personagem e as anotações da mesa.
// ────────────────────────────────────────────────────────

type TextField = 'personality_traits' | 'ideals' | 'bonds' | 'flaws' | 'backstory' | 'notes'

const SHORT: { key: TextField; title: string; hint: string }[] = [
  { key: 'personality_traits', title: 'Traços de personalidade', hint: 'Como o personagem age e fala.' },
  { key: 'ideals', title: 'Ideais', hint: 'No que ele acredita.' },
  { key: 'bonds', title: 'Vínculos', hint: 'Pessoas, lugares e coisas que importam.' },
  { key: 'flaws', title: 'Defeitos', hint: 'O que o derruba.' },
]

export function DndHistoriaTab({ ctx }: { ctx: SheetCtx }) {
  const { form, set, readOnly } = ctx

  const area = (key: TextField, title: string, rows: number, hint?: string, tall = false) => (
    <section className="dsh-card" key={key}>
      <div className="dsh-card__header">
        <h4 className="dsh-card__title">{title}</h4>
        <span className="dsh-faint">{(form[key as keyof DndForm] as string).length}/{DND_TEXT_LIMITS[key]}</span>
      </div>
      <textarea
        className={`dsh-input dsh-textarea${tall ? ' dsh-textarea--tall' : ''}`} rows={rows} maxLength={DND_TEXT_LIMITS[key]}
        value={form[key as keyof DndForm] as string} readOnly={readOnly} placeholder={hint} aria-label={title}
        onChange={(e) => set(key as keyof DndForm, e.target.value as never)}
      />
    </section>
  )

  return (
    <div className="dsh-tab dsh-columns anim-tab-panel">
      {SHORT.map((s) => area(s.key, s.title, 3, s.hint))}
      {area('backstory', 'História do personagem', 9, 'De onde veio, o que viveu, o que quer.', true)}
      {area('notes', 'Anotações', 6, 'Lembretes da campanha, contatos, pistas.')}
    </div>
  )
}
