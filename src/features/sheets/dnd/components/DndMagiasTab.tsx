import { useState } from 'react'
import { Select } from '../../../../shared/components/Select'
import type { DndCharacterSpell } from '../../../../shared/types'
import { getClass } from '../catalog'
import type { SpellEntry } from '../catalog/types'
import { SPELL_SCHOOL_LABEL, spellLevelLabel } from '../catalog/spellUtils'
import { useSpellCatalog } from '../hooks/useSpellCatalog'
import { ABILITIES } from '../rules/abilities'
import { PACT_SLOT_KEY, spellSlotKey, spellSlotLabel } from '../model/slots'
import { formatSigned } from '../model/format'
import { createDndSpell, deleteDndSpell, updateDndSpell } from '../services/dndSheetService'
import { saveDndResource, setDndResourceCurrent } from '../services/dndResourceService'
import { DerivedField, NumberField, Pips, Toggle } from './DndControls'
import { ChipRow, Equation, StatChip, StatusPill } from './DndVisuals'
import { DndSpellBrowser } from './DndSpellBrowser'
import { DndSpellDetails } from './DndSpellDetails'
import type { DndForm } from '../model/sheetForm'
import type { SheetCtx } from './sheetContext'

// ────────────────────────────────────────────────────────
// Aba Magias: conjuração de cada classe (atributo, CD, ataque, truques,
// magias conhecidas ou preparadas), espaços de magia clicáveis e a lista de
// magias do personagem. As magias vêm do livro (catálogo das 319 magias do SRD,
// com busca e filtros) ou são escritas à mão; uma magia do livro pode virar
// cópia própria para editar o texto.
// ────────────────────────────────────────────────────────

const LEVEL_OPTIONS = Array.from({ length: 10 }, (_, level) => ({ value: String(level), label: level === 0 ? 'Truque' : `${level}º nível` }))
const ABILITY_OPTIONS = [{ value: '', label: 'Automático (pela classe)' }, ...ABILITIES.map((a) => ({ value: a.key, label: a.label }))]
const LEARNING_LABEL = { known: 'conhece', prepared: 'prepara', 'prepared-half': 'prepara', spellbook: 'prepara (do grimório)' } as const

export function DndMagiasTab({ ctx }: { ctx: SheetCtx }) {
  const { derived, data, sheet, form, set, readOnly, report } = ctx
  const casting = derived.spellcasting
  const [name, setName] = useState('')
  const [level, setLevel] = useState('1')
  const [busy, setBusy] = useState<string | null>(null)
  const [bookOpen, setBookOpen] = useState(false)
  const catalogMod = useSpellCatalog()

  const slotRows = data.resources.filter((r) => r.source === 'spell_slots')
  const spells = [...data.details.spells].sort((a, b) => a.spell_level - b.spell_level || a.name.localeCompare(b.name, 'pt-BR'))
  const cantripCount = data.details.spells.filter((s) => s.spell_level === 0).length
  const cantripLimit = casting?.classes.reduce((n, c) => n + c.cantripsKnown, 0) ?? 0
  const haveKeys = new Set(data.details.spells.flatMap((s) => (s.catalog_key ? [s.catalog_key] : [])))
  const levels = Array.from({ length: 10 }, (_, n) => n).filter((n) => spells.some((s) => s.spell_level === n))
  const preparedCount = data.details.spells.filter((s) => s.prepared && s.spell_level > 0).length
  const preparedLimit = casting?.classes.filter((c) => getClass(c.classKey)?.spellcasting?.learning !== 'known').reduce((n, c) => n + c.spellsKnownOrPrepared, 0) ?? 0

  async function run(key: string, job: () => Promise<void>) {
    setBusy(key)
    report(null)
    try { await job() } catch (err) { report(err instanceof Error ? err.message : 'Algo deu errado. Tente de novo.') } finally { setBusy(null) }
  }

  const manualSlots = form.manual_modes.includes('spell_slots')
  const slotList = manualSlots
    ? Array.from({ length: 9 }, (_, i) => ({ level: i + 1, max: slotRows.find((r) => r.key === spellSlotKey(i + 1))?.max_value ?? 0 }))
    : (casting?.slots ?? []).map((max, i) => ({ level: i + 1, max }))
  /** Modo manual: o total de espaços de cada nível é digitado; o gasto continua nas bolinhas. */
  const setSlotTotal = (level: number, total: number) => run(spellSlotKey(level), async () => {
    const key = spellSlotKey(level)
    const row = slotRows.find((r) => r.key === key)
    const saved = await saveDndResource(sheet.id, {
      key, label: spellSlotLabel(level), max_value: total, current_value: Math.min(row?.current_value ?? total, total),
      recharge: 'long', source: 'spell_slots', sort_order: level,
    })
    data.setResources((rs) => [...rs.filter((r) => r.key !== key), saved])
  })

  const setSlots = (key: string, filled: number) => {
    const row = slotRows.find((r) => r.key === key)
    if (!row || readOnly) return
    void run(key, async () => {
      const saved = await setDndResourceCurrent(row, filled)
      data.setResources((rs) => rs.map((r) => (r.id === saved.id ? saved : r)))
    })
  }

  const addSpell = () => run('new', async () => {
    const clean = name.trim()
    if (!clean) { report('Escreva o nome da magia.'); return }
    const saved = await createDndSpell(sheet.id, {
      name: clean, spell_level: Number(level), school: '', casting_time: '', spell_range: '', duration: '',
      concentration: false, ritual: false, prepared: false, description: '', catalog_key: null, sort_order: data.details.spells.length,
    })
    data.setDetails((d) => ({ ...d, spells: [...d.spells, saved] }))
    setName('')
  })

  const addFromBook = (sp: SpellEntry) => run(sp.key, async () => {
    const saved = await createDndSpell(sheet.id, {
      name: sp.name, spell_level: sp.level, school: SPELL_SCHOOL_LABEL[sp.school], casting_time: sp.castingTime, spell_range: sp.range,
      duration: sp.duration, concentration: !!sp.concentration, ritual: !!sp.ritual, prepared: false, description: '',
      catalog_key: sp.key, sort_order: data.details.spells.length,
    })
    data.setDetails((d) => ({ ...d, spells: [...d.spells, saved] }))
  })

  const patchSpell = (s: DndCharacterSpell, patch: Partial<Pick<DndCharacterSpell, 'prepared' | 'concentration' | 'ritual' | 'description' | 'catalog_key'>>) =>
    run(s.id, async () => {
      const saved = await updateDndSpell(s.id, patch)
      data.setDetails((d) => ({ ...d, spells: d.spells.map((x) => (x.id === saved.id ? saved : x)) }))
    })

  /** Vira cópia própria: o texto do livro vai para as notas, onde pode ser editado. */
  const makeOwnCopy = (s: DndCharacterSpell, cat: SpellEntry) => {
    const text = [...cat.text, ...(cat.higher ? [`Em níveis superiores. ${cat.higher}`] : [])].join('\n\n')
    return patchSpell(s, { catalog_key: null, description: [text, s.description].filter((x) => x.trim()).join('\n\n---\n\n') })
  }

  const removeSpell = (s: DndCharacterSpell) => run(s.id, async () => {
    await deleteDndSpell(s.id)
    data.setDetails((d) => ({ ...d, spells: d.spells.filter((x) => x.id !== s.id) }))
  })

  if (!casting && spells.length === 0 && readOnly) return <div className="dsh-tab"><p className="dsh-faint">Este personagem não conjura magias.</p></div>

  const stats = derived.spellStats
  const pact = data.resources.find((r) => r.key === PACT_SLOT_KEY && r.max_value > 0)

  return (
    <div className="dsh-tab dsh-cols anim-tab-panel">
      <div className={`dsh-col${casting ? '' : ' dsh-wide'}`}>
      <section className="dsh-card">
        <div className="dsh-card__header"><h4 className="dsh-card__title">Conjuração</h4></div>
        <label className="dsh-field">
          <span className="dsh-label">Atributo de conjuração</span>
          <Select options={ABILITY_OPTIONS} value={form.spell_ability} onChange={(v) => set('spell_ability', v as DndForm['spell_ability'])} disabled={readOnly} aria-label="Atributo de conjuração" />
        </label>
        {stats ? (
          <>
            <ChipRow>
              <StatChip label="Atributo">{ABILITIES.find((a) => a.key === stats.ability)?.label}{stats.chosen ? ' (escolhido)' : ''}</StatChip>
            </ChipRow>
            <Equation
              resultLabel="CD das magias"
              parts={[{ label: 'Base', value: 8 }, { label: 'Proficiência', value: formatSigned(derived.proficiencyBonus) }, { label: 'Modificador', value: formatSigned(derived.abilityMods[stats.ability]) }]}
              result={<DerivedField ctx={ctx} field="spell_save_dc" value={stats.saveDc} label="CD das magias" min={0} max={40} />}
            />
            <Equation
              resultLabel="Ataque de magia"
              parts={[{ label: 'Proficiência', value: formatSigned(derived.proficiencyBonus) }, { label: 'Modificador', value: formatSigned(derived.abilityMods[stats.ability]) }]}
              result={<DerivedField ctx={ctx} field="spell_attack_bonus" value={stats.attackBonus} label="Bônus de ataque de magia" signed min={-10} max={30} />}
            />
          </>
        ) : (
          <StatusPill tone="warn" title="Escolha um atributo acima para calcular a CD e o ataque de magia à mão, ou use uma classe conjuradora">Nenhuma classe conjuradora</StatusPill>
        )}
        {casting && (
          <>
            <ul className="dsh-list">
              {casting.classes.map((c) => {
                const def = getClass(c.classKey)
                const ab = ABILITIES.find((a) => a.key === c.ability)
                const learning = def?.spellcasting?.learning ?? 'known'
                return (
                  <li key={c.classKey} className="dsh-class">
                    <strong className="dsh-class__name">{def?.name ?? c.classKey}</strong>
                    <ChipRow>
                      <StatChip label="Atributo">{ab?.short ?? ab?.label}</StatChip>
                      <StatChip label="Truques">{c.cantripsKnown}</StatChip>
                      <StatChip label={`Magias que ${LEARNING_LABEL[learning]}`}>{c.spellsKnownOrPrepared}</StatChip>
                      {c.spellbookSize != null && <StatChip label="Grimório">{c.spellbookSize}</StatChip>}
                    </ChipRow>
                  </li>
                )
              })}
            </ul>
            {casting.classes.length > 1 && <StatusPill title="Os espaços de magia somam os níveis de conjurador; truques e magias contam por classe">Conjurador multiclasse</StatusPill>}
          </>
        )}
      </section>
      </div>

      {(casting || manualSlots) && (
        <div className="dsh-col">
        <section className="dsh-card">
          <div className="dsh-card__header"><h4 className="dsh-card__title" title="Bolinha cheia é um espaço disponível; clique para gastar. O descanso longo recarrega todos.">Espaços de magia</h4></div>
          {!manualSlots && slotRows.filter((r) => r.max_value > 0).length === 0 && <p className="dsh-faint">Sem espaços de magia neste nível.</p>}
          <ul className="dsh-slots">
            {slotList.map(({ level: lv, max }) => {
              const key = spellSlotKey(lv)
              const row = slotRows.find((r) => r.key === key)
              if (max === 0 && !manualSlots) return null
              const available = row ? Math.min(row.current_value, max) : max
              return (
                <li key={key} className="dsh-slot">
                  <span className="dsh-slot__label">{lv}º nível</span>
                  {manualSlots && (
                    <NumberField value={max} min={0} max={20} label={`Total de espaços de ${lv}º nível`} disabled={readOnly || busy === key}
                      onChange={(n) => void setSlotTotal(lv, n)} className="dsh-num--sm" />
                  )}
                  {max > 0 && (
                    <Pips total={max} filled={available} label={`Espaços de ${lv}º nível disponíveis`}
                      onChange={readOnly || !row || busy === key ? undefined : (n) => setSlots(key, n)} />
                  )}
                  <span className="dsh-faint">{max > 0 ? `${available}/${max}` : ''}</span>
                </li>
              )
            })}
            {casting?.pact && pact && (
              <li className="dsh-slot">
                <span className="dsh-slot__label">Pacto ({casting.pact.level}º nível)</span>
                <Pips total={pact.max_value} filled={Math.min(pact.current_value, pact.max_value)} tone="good" label="Espaços de Pacto disponíveis"
                  onChange={readOnly || busy === PACT_SLOT_KEY ? undefined : (n) => setSlots(PACT_SLOT_KEY, n)} />
                <span className="dsh-faint">{Math.min(pact.current_value, pact.max_value)}/{pact.max_value} · voltam no descanso curto</span>
              </li>
            )}
          </ul>
        </section>
        </div>
      )}

      <section className="dsh-card dsh-wide">
        <div className="dsh-card__header">
          <h4 className="dsh-card__title">Magias do personagem</h4>
          <span className="dsh-card__badges">
            {cantripLimit > 0 && <span className={`dsh-badge${cantripCount > cantripLimit ? ' dsh-badge--bad' : ''}`}>Truques {cantripCount} / {cantripLimit}</span>}
            {preparedLimit > 0 && <span className={`dsh-badge${preparedCount > preparedLimit ? ' dsh-badge--bad' : ''}`}>Preparadas {preparedCount} / {preparedLimit}</span>}
          </span>
        </div>
        {spells.length === 0 && <p className="dsh-faint">Nenhuma magia ainda. Busque no livro de magias abaixo ou escreva uma à mão.</p>}
        {levels.map((lv) => (
          <div key={lv} className="dsh-spell-group">
            <h5 className="dsh-spell-group__title">{lv === 0 ? 'Truques' : spellLevelLabel(lv)} <span className="dsh-faint">{spells.filter((s) => s.spell_level === lv).length}</span></h5>
            <ul className="dsh-list">
              {spells.filter((s) => s.spell_level === lv).map((s) => {
                const cat = s.catalog_key ? catalogMod?.getSpell(s.catalog_key) : undefined
                const meta = [s.school, s.casting_time, s.spell_range, s.duration].filter(Boolean).join(' · ')
                return (
                  <li key={s.id} className="dsh-spell">
                    <div className="dsh-spell__main">
                      <span className="dsh-tag">{s.spell_level === 0 ? 'Truque' : `${s.spell_level}º`}</span>
                      <strong className="dsh-spell__name">{s.name}</strong>
                      {s.spell_level > 0 && <Toggle checked={s.prepared} onChange={readOnly ? undefined : (v) => void patchSpell(s, { prepared: v })} label="Preparada" />}
                      {s.catalog_key ? (
                        <>
                          {s.concentration && <span className="dsh-badge" title="Exige concentração">C</span>}
                          {s.ritual && <span className="dsh-badge" title="Pode ser conjurada como ritual">R</span>}
                        </>
                      ) : (
                        <>
                          <Toggle checked={s.concentration} onChange={readOnly ? undefined : (v) => void patchSpell(s, { concentration: v })} label="Concentração" />
                          <Toggle checked={s.ritual} onChange={readOnly ? undefined : (v) => void patchSpell(s, { ritual: v })} label="Ritual" />
                        </>
                      )}
                      {!readOnly && <button type="button" className="dsh-x" onClick={() => void removeSpell(s)} disabled={busy === s.id} aria-label={`Remover ${s.name}`}>×</button>}
                    </div>
                    {meta && <p className="dsh-spell__meta">{meta}</p>}
                    {(cat || !readOnly || s.description) && (
                      <details className="dsh-spell__more">
                        <summary>{cat ? 'Ver a magia' : 'Notas'}</summary>
                        {cat && <DndSpellDetails spell={cat} />}
                        {cat && !readOnly && (
                          <button type="button" className="dsh-link" disabled={busy === s.id} onClick={() => void makeOwnCopy(s, cat)}
                            title="Troca a magia do livro por uma cópia sua, com o texto nas notas para você editar">
                            Personalizar (virar cópia própria)
                          </button>
                        )}
                        <textarea className="dsh-input dsh-textarea dsh-textarea--sm" rows={cat ? 2 : 4} defaultValue={s.description} readOnly={readOnly} maxLength={8000}
                          placeholder={cat ? 'Suas anotações sobre esta magia' : 'Texto e notas da magia (alcance, duração, efeito...)'} aria-label={`Notas de ${s.name}`}
                          onBlur={(e) => { if (e.target.value !== s.description) void patchSpell(s, { description: e.target.value }) }} />
                      </details>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        {!readOnly && (
          <div className="dsh-add-row">
            <input type="text" className="dsh-input" value={name} maxLength={160} placeholder="Magia própria (nome)"
              onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addSpell() } }} />
            <Select options={LEVEL_OPTIONS} value={level} onChange={setLevel} aria-label="Nível da magia" />
            <button type="button" className="dsh-chip" onClick={() => void addSpell()} disabled={busy === 'new'}>Adicionar</button>
          </div>
        )}
      </section>

      {!readOnly && (
        <section className="dsh-card dsh-wide">
          <div className="dsh-card__header">
            <h4 className="dsh-card__title">Livro de magias</h4>
            <button type="button" className="dsh-chip" aria-expanded={bookOpen} onClick={() => setBookOpen((o) => !o)}>{bookOpen ? 'Fechar o livro' : 'Abrir o livro'}</button>
          </div>
          {!bookOpen && <ChipRow><StatChip label="No livro">319 magias</StatChip><StatChip label="Fonte">SRD 5.1</StatChip><StatChip label="Filtros">nível · escola · classe</StatChip></ChipRow>}
          {bookOpen && (
            <DndSpellBrowser catalog={catalogMod?.SPELLS ?? null} have={haveKeys} myClasses={casting?.classes.map((c) => c.classKey) ?? []}
              readOnly={readOnly} busy={busy} onAdd={(sp) => void addFromBook(sp)} />
          )}
        </section>
      )}
    </div>
  )
}
