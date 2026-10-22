import { useMemo, useState } from 'react'
import { Select } from '../../../../shared/components/Select'
import type { SpellEntry } from '../catalog/types'
import { SPELL_SCHOOLS, SPELL_SCHOOL_LABEL, searchSpells, spellLevelLabel } from '../catalog/spellUtils'
import { Toggle } from './DndControls'
import { DndSpellDetails } from './DndSpellDetails'

// ────────────────────────────────────────────────────────
// Livro de magias: busca no catálogo do SRD com filtros de nível, escola e
// classe, e botão para levar a magia à ficha.
// ────────────────────────────────────────────────────────

const PAGE = 30
const CLASS_OPTIONS = [
  { value: 'bard', label: 'Bardo' }, { value: 'cleric', label: 'Clérigo' }, { value: 'druid', label: 'Druida' },
  { value: 'paladin', label: 'Paladino' }, { value: 'ranger', label: 'Patrulheiro' }, { value: 'sorcerer', label: 'Feiticeiro' },
  { value: 'warlock', label: 'Bruxo' }, { value: 'wizard', label: 'Mago' },
]
const LEVEL_OPTIONS = [{ value: '', label: 'Todos os níveis' }, ...Array.from({ length: 10 }, (_, n) => ({ value: String(n), label: spellLevelLabel(n) }))]
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
}

export function DndSpellBrowser({ catalog, have, myClasses, readOnly, busy, onAdd }: Props) {
  const [text, setText] = useState('')
  const [level, setLevel] = useState('')
  const [school, setSchool] = useState('')
  const [cls, setCls] = useState(myClasses.length > 0 ? 'mine' : '')
  const [ritual, setRitual] = useState(false)
  const [conc, setConc] = useState(false)
  const [shown, setShown] = useState(PAGE)

  const classOptions = useMemo(() => [
    { value: '', label: 'Todas as classes' },
    ...(myClasses.length > 0 ? [{ value: 'mine', label: 'Da minha ficha' }] : []),
    ...CLASS_OPTIONS,
  ], [myClasses.length])

  const results = useMemo(() => {
    if (!catalog) return []
    const base = searchSpells({
      text, level: level === '' ? undefined : Number(level), school: school ? school as SpellEntry['school'] : undefined,
      classKey: cls && cls !== 'mine' ? cls : undefined, ritual: ritual || undefined, concentration: conc || undefined,
    }, catalog)
    return cls === 'mine' ? base.filter((s) => s.classes.some((c) => myClasses.includes(c))) : base
  }, [catalog, text, level, school, cls, ritual, conc, myClasses])

  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setShown(PAGE) }

  if (!catalog) return <p className="dsh-faint">Abrindo o livro de magias...</p>

  return (
    <div className="dsh-browser">
      <div className="dsh-filters">
        <input type="search" className="dsh-input dsh-filters__text" value={text} placeholder="Buscar por nome (ex.: bola de fogo)" aria-label="Buscar magia"
          onChange={(e) => reset(setText)(e.target.value)} />
        <Select options={LEVEL_OPTIONS} value={level} onChange={reset(setLevel)} aria-label="Filtrar por nível" />
        <Select options={SCHOOL_OPTIONS} value={school} onChange={reset(setSchool)} aria-label="Filtrar por escola" />
        <Select options={classOptions} value={cls} onChange={reset(setCls)} aria-label="Filtrar por classe" />
        <Toggle checked={ritual} onChange={reset(setRitual)} label="Ritual" />
        <Toggle checked={conc} onChange={reset(setConc)} label="Concentração" />
      </div>
      <p className="dsh-note">{results.length} magia{results.length === 1 ? '' : 's'} do livro{results.length > shown ? `, mostrando ${shown}` : ''}.</p>
      {results.length === 0 && <p className="dsh-faint">Nenhuma magia com esses filtros.</p>}
      <ul className="dsh-list">
        {results.slice(0, shown).map((s) => {
          const owned = have.has(s.key)
          return (
            <li key={s.key} className="dsh-spell">
              <div className="dsh-spell__main">
                <span className="dsh-tag">{s.level === 0 ? 'Truque' : `${s.level}º`}</span>
                <strong className="dsh-spell__name">{s.name} <span className="dsh-faint">{s.original}</span></strong>
                {s.concentration && <span className="dsh-badge" title="Exige concentração">C</span>}
                {s.ritual && <span className="dsh-badge" title="Pode ser conjurada como ritual">R</span>}
                {!readOnly && (
                  <button type="button" className={`dsh-chip${owned ? '' : ' dsh-chip--primary'}`} disabled={owned || busy === s.key} onClick={() => onAdd(s)}>
                    {owned ? 'Na ficha' : 'Adicionar'}
                  </button>
                )}
              </div>
              <details className="dsh-spell__more">
                <summary>{SPELL_SCHOOL_LABEL[s.school]} · {s.castingTime} · {s.range} · {s.duration}</summary>
                <DndSpellDetails spell={s} />
              </details>
            </li>
          )
        })}
      </ul>
      {results.length > shown && (
        <button type="button" className="dsh-chip" onClick={() => setShown((n) => n + PAGE)}>Mostrar mais {Math.min(PAGE, results.length - shown)}</button>
      )}
    </div>
  )
}
