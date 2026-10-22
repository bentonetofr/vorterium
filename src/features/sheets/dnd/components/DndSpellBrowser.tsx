import { useMemo, useState, type ReactNode } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import { Select } from '../../../../shared/components/Select'
import type { SpellEntry } from '../catalog/types'
import { SPELL_SCHOOLS, SPELL_SCHOOL_LABEL, searchSpells } from '../catalog/spellUtils'
import { DndSpellDetails, spellSubtitle } from './DndSpellDetails'

// ────────────────────────────────────────────────────────
// Livro de magias: uma janela no centro do site com todas as magias do
// catálogo em cards, barra de busca e filtros de nível, classe, escola, ritual
// e concentração. Clicar no card leva a magia para a ficha na hora; o botão
// "Ver mais" do card abre o texto completo dentro da janela.
// ────────────────────────────────────────────────────────

const PAGE = 48
const CLASS_OPTIONS = [
  { value: 'bard', label: 'Bardo' }, { value: 'cleric', label: 'Clérigo' }, { value: 'druid', label: 'Druida' },
  { value: 'paladin', label: 'Paladino' }, { value: 'ranger', label: 'Patrulheiro' }, { value: 'sorcerer', label: 'Feiticeiro' },
  { value: 'warlock', label: 'Bruxo' }, { value: 'wizard', label: 'Mago' },
]
const LEVEL_CHIPS = [{ value: '', label: 'Todos' }, ...Array.from({ length: 10 }, (_, n) => ({ value: String(n), label: n === 0 ? 'Truques' : `${n}º` }))]
const SCHOOL_OPTIONS = [{ value: '', label: 'Todas as escolas' }, ...SPELL_SCHOOLS.map((s) => ({ value: s, label: SPELL_SCHOOL_LABEL[s] }))]

interface Props {
  catalog:    readonly SpellEntry[] | null
  /** Chaves das magias que a ficha já tem. */
  have:       ReadonlySet<string>
  /** Classes conjuradoras da ficha (chaves), para o filtro "Da minha ficha". */
  myClasses:  readonly string[]
  readOnly:   boolean
  busy:       string | null
  onAdd:      (spell: SpellEntry) => void
  onClose?:   () => void
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" className={`dsh-bookchip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={onClick}>{children}</button>
}

export function DndSpellBrowser({ catalog, have, myClasses, readOnly, busy, onAdd, onClose }: Props) {
  const [text, setText] = useState('')
  const [level, setLevel] = useState('')
  const [school, setSchool] = useState('')
  const [cls, setCls] = useState(myClasses.length > 0 ? 'mine' : '')
  const [ritual, setRitual] = useState(false)
  const [conc, setConc] = useState(false)
  const [shown, setShown] = useState(PAGE)
  const [detail, setDetail] = useState<SpellEntry | null>(null)

  const results = useMemo(() => {
    if (!catalog) return []
    const base = searchSpells({
      text, level: level === '' ? undefined : Number(level), school: school ? school as SpellEntry['school'] : undefined,
      classKey: cls && cls !== 'mine' ? cls : undefined, ritual: ritual || undefined, concentration: conc || undefined,
    }, catalog)
    return cls === 'mine' ? base.filter((s) => s.classes.some((c) => myClasses.includes(c))) : base
  }, [catalog, text, level, school, cls, ritual, conc, myClasses])

  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setShown(PAGE) }
  const close = onClose ?? (() => {})

  return (
    <ModalOverlay onClose={close}>
      <div className="dsh-sheet dsh-book" role="dialog" aria-modal="true" aria-labelledby="dsh-book-title">
        <header className="dsh-book__head">
          <div className="dsh-book__titles">
            <h3 id="dsh-book-title" className="dsh-book__title">Livro de magias</h3>
            <span className="dsh-book__count">{catalog ? `${results.length} magia${results.length === 1 ? '' : 's'}` : 'abrindo...'}</span>
          </div>
          <button type="button" className="modal-close" onClick={close} aria-label="Fechar">×</button>
        </header>

        {!catalog ? <p className="dsh-faint dsh-book__loading">Abrindo o livro de magias...</p> : (
          <>
            <div className="dsh-book__filters">
              <input type="search" className="dsh-book__search" value={text} placeholder="Buscar magia pelo nome (ex.: bola de fogo)" aria-label="Buscar magia" autoFocus
                onChange={(e) => reset(setText)(e.target.value)} />
              <div className="dsh-book__row" role="group" aria-label="Filtrar por nível">
                {LEVEL_CHIPS.map((l) => <Chip key={l.value} on={level === l.value} onClick={() => reset(setLevel)(l.value)}>{l.label}</Chip>)}
              </div>
              <div className="dsh-book__row" role="group" aria-label="Filtrar por classe">
                <Chip on={cls === ''} onClick={() => reset(setCls)('')}>Todas as classes</Chip>
                {myClasses.length > 0 && <Chip on={cls === 'mine'} onClick={() => reset(setCls)('mine')}>Da minha ficha</Chip>}
                {CLASS_OPTIONS.map((c) => <Chip key={c.value} on={cls === c.value} onClick={() => reset(setCls)(c.value)}>{c.label}</Chip>)}
              </div>
              <div className="dsh-book__row">
                <div className="dsh-book__school"><Select options={SCHOOL_OPTIONS} value={school} onChange={reset(setSchool)} aria-label="Filtrar por escola" /></div>
                <Chip on={ritual} onClick={() => reset(setRitual)(!ritual)}>Ritual</Chip>
                <Chip on={conc} onClick={() => reset(setConc)(!conc)}>Concentração</Chip>
              </div>
            </div>

            <div className="dsh-book__body">
              {results.length === 0 && <p className="dsh-faint dsh-book__empty">Nenhuma magia com esses filtros.</p>}
              <ul className="dsh-bookgrid">
                {results.slice(0, shown).map((s) => {
                  const owned = have.has(s.key)
                  const adding = busy === s.key
                  return (
                    <li key={s.key} className={`dsh-bookcard${owned ? ' is-owned' : ''}`}>
                      <button type="button" className="dsh-bookcard__body" disabled={readOnly || owned || adding} onClick={() => onAdd(s)}
                        title={owned ? 'Já está na ficha' : 'Clique para adicionar à ficha'}>
                        <span className="dsh-bookcard__top">
                          <span className="dsh-tag">{s.level === 0 ? 'Truque' : `${s.level}º`}</span>
                          {s.concentration && <span className="dsh-badge" title="Exige concentração">C</span>}
                          {s.ritual && <span className="dsh-badge" title="Pode ser conjurada como ritual">R</span>}
                        </span>
                        <strong className="dsh-bookcard__name">{s.name}</strong>
                        <span className="dsh-bookcard__orig">{s.original}</span>
                        <span className="dsh-bookcard__meta">{SPELL_SCHOOL_LABEL[s.school]} · {s.castingTime} · {s.range}</span>
                        <span className="dsh-bookcard__state">{owned ? '✓ Na ficha' : adding ? 'Adicionando...' : '+ Adicionar'}</span>
                      </button>
                      <button type="button" className="dsh-bookcard__more" onClick={() => setDetail(s)}>Ver mais</button>
                    </li>
                  )
                })}
              </ul>
              {results.length > shown && (
                <button type="button" className="dsh-chip dsh-book__more" onClick={() => setShown((n) => n + PAGE)}>Mostrar mais {Math.min(PAGE, results.length - shown)}</button>
              )}
            </div>
          </>
        )}

        {detail && (
          <div className="dsh-book__detail" role="region" aria-label={`Texto de ${detail.name}`}>
            <div className="dsh-book__detail-head">
              <button type="button" className="dsh-chip" onClick={() => setDetail(null)}>← Voltar</button>
              {!readOnly && (
                <button type="button" className={`dsh-chip${have.has(detail.key) ? '' : ' dsh-chip--primary'}`} disabled={have.has(detail.key) || busy === detail.key} onClick={() => onAdd(detail)}>
                  {have.has(detail.key) ? '✓ Na ficha' : 'Adicionar à ficha'}
                </button>
              )}
            </div>
            <h4 className="dsh-book__detail-title">{detail.name} <span className="dsh-faint">{detail.original}</span></h4>
            <p className="dsh-faint">{spellSubtitle(detail)} · {detail.classes.map((c) => CLASS_OPTIONS.find((o) => o.value === c)?.label ?? c).join(', ')}</p>
            <DndSpellDetails spell={detail} />
          </div>
        )}
      </div>
    </ModalOverlay>
  )
}
