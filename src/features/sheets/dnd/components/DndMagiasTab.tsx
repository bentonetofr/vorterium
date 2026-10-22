import { useState } from 'react'
import { Presence } from '../../../../shared/components/Presence'
import { Select } from '../../../../shared/components/Select'
import type { DndCharacterSpell } from '../../../../shared/types'
import { getClass, spellListClass } from '../catalog'
import type { SpellEntry } from '../catalog/types'
import { SPELL_SCHOOL_LABEL, spellLevelLabel } from '../catalog/spellUtils'
import { useSpellCatalog } from '../hooks/useSpellCatalog'
import { ABILITIES } from '../rules/abilities'
import { PACT_SLOT_KEY, spellSlotKey, spellSlotLabel } from '../model/slots'
import { formatSigned } from '../model/format'
import { createDndSpell, deleteDndSpell, updateDndSpell } from '../services/dndSheetService'
import { saveDndResource, setDndResourceCurrent } from '../services/dndResourceService'
import { DerivedField, NumberField, Pips } from './DndControls'
import { ChipRow, StatChip, StatusPill } from './DndVisuals'
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
    <div className="dsh-tab dsh-cols dsh-cols--even anim-tab-panel">
      <div className={`dsh-col${casting ? '' : ' dsh-wide'}`}>
      <section className="dsh-card">
        <div className="dsh-card__header"><h4 className="dsh-card__title">Conjuração</h4></div>
        <label className="dsh-field dsh-field--tile">
          <span className="dsh-label">Atributo de conjuração</span>
          <Select options={ABILITY_OPTIONS} value={form.spell_ability} onChange={(v) => set('spell_ability', v as DndForm['spell_ability'])} disabled={readOnly} aria-label="Atributo de conjuração" />
        </label>
        {stats ? (
          <div className="dsh-spellstats">
            <div className="dsh-spellstat" role="group" aria-label="Cálculo da CD das magias">
              <span className="dsh-spellstat__label">CD das magias</span>
              <strong className="dsh-spellstat__value"><DerivedField ctx={ctx} field="spell_save_dc" value={stats.saveDc} label="CD das magias" min={0} max={40} /></strong>
              <span className="dsh-spellstat__terms">
                <span><small>Base</small>8</span>
                <span><small>Prof.</small>{formatSigned(derived.proficiencyBonus)}</span>
                <span><small>{ABILITIES.find((a) => a.key === stats.ability)?.short}</small>{formatSigned(derived.abilityMods[stats.ability])}</span>
              </span>
            </div>
            <div className="dsh-spellstat" role="group" aria-label="Cálculo do ataque de magia">
              <span className="dsh-spellstat__label">Ataque de magia</span>
              <strong className="dsh-spellstat__value"><DerivedField ctx={ctx} field="spell_attack_bonus" value={stats.attackBonus} label="Bônus de ataque de magia" signed min={-10} max={30} /></strong>
              <span className="dsh-spellstat__terms">
                <span><small>Prof.</small>{formatSigned(derived.proficiencyBonus)}</span>
                <span><small>{ABILITIES.find((a) => a.key === stats.ability)?.short}</small>{formatSigned(derived.abilityMods[stats.ability])}</span>
              </span>
            </div>
          </div>
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
                  <li key={c.classKey} className="dsh-class dsh-castclass">
                    <strong className="dsh-class__name">{def?.name ?? c.classKey}</strong>
                    <div className="dsh-castnums">
                      <span className="dsh-castnum"><small>Atributo</small><strong>{ab?.short ?? ab?.label}</strong></span>
                      <span className="dsh-castnum"><small>Truques</small><strong>{c.cantripsKnown}</strong></span>
                      <span className="dsh-castnum"><small>{`Magias que ${LEARNING_LABEL[learning]}`}</small><strong>{c.spellsKnownOrPrepared}</strong></span>
                      {c.spellbookSize != null && <span className="dsh-castnum"><small>Grimório</small><strong>{c.spellbookSize}</strong></span>}
                    </div>
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
        {spells.length === 0 && (
          <div className="dsh-noattack">
            <strong>Nenhuma magia ainda</strong>
            <span>Abra o livro de magias abaixo e clique em uma magia para trazê-la, ou escreva uma à mão.</span>
          </div>
        )}
        {levels.map((lv) => (
          <div key={lv} className="dsh-spell-group">
            <h5 className="dsh-spell-group__title">{lv === 0 ? 'Truques' : spellLevelLabel(lv)} <span className="dsh-faint">{spells.filter((s) => s.spell_level === lv).length}</span></h5>
            <ul className="dsh-list">
              {spells.filter((s) => s.spell_level === lv).map((s) => {
                const cat = s.catalog_key ? catalogMod?.getSpell(s.catalog_key) : undefined
                const meta = [s.school, s.casting_time, s.spell_range, s.duration].filter(Boolean)
                const isPrepared = s.prepared && s.spell_level > 0
                return (
                  <li key={s.id} className={`dsh-spell${isPrepared ? ' is-prepared' : ''}`}>
                    <div className="dsh-spell__main">
                      <span className="dsh-tag">{s.spell_level === 0 ? 'Truque' : `${s.spell_level}º`}</span>
                      <strong className="dsh-spell__name">{s.name}</strong>
                      {s.catalog_key ? (
                        <>
                          {s.concentration && <span className="dsh-badge" title="Exige concentração">C</span>}
                          {s.ritual && <span className="dsh-badge" title="Pode ser conjurada como ritual">R</span>}
                        </>
                      ) : (
                        <>
                          <button type="button" className={`dsh-flag dsh-flag--sm${s.concentration ? ' is-on' : ''}`} aria-pressed={s.concentration} disabled={readOnly}
                            onClick={() => void patchSpell(s, { concentration: !s.concentration })}>Concentração</button>
                          <button type="button" className={`dsh-flag dsh-flag--sm${s.ritual ? ' is-on' : ''}`} aria-pressed={s.ritual} disabled={readOnly}
                            onClick={() => void patchSpell(s, { ritual: !s.ritual })}>Ritual</button>
                        </>
                      )}
                      {s.spell_level > 0 && (
                        <button type="button" className={`dsh-flag${s.prepared ? ' is-on' : ''}`} aria-pressed={s.prepared} disabled={readOnly || busy === s.id}
                          title="Magia preparada" onClick={() => void patchSpell(s, { prepared: !s.prepared })}>{s.prepared ? '✓ Preparada' : 'Preparada'}</button>
                      )}
                      {!readOnly && <button type="button" className="dsh-x" onClick={() => void removeSpell(s)} disabled={busy === s.id} aria-label={`Remover ${s.name}`}>×</button>}
                    </div>
                    {meta.length > 0 && <div className="dsh-spellchips">{meta.map((m) => <span key={m} className="dsh-cardchip">{m}</span>)}</div>}
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
          <div className="dsh-newattack">
            <label className="dsh-field dsh-field--tile"><span className="dsh-label">Magia própria</span>
              <input type="text" className="dsh-focus__input" value={name} maxLength={160} placeholder="Nome da magia"
                onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addSpell() } }} /></label>
            <div className="dsh-field dsh-field--tile"><span className="dsh-label">Nível</span>
              <Select options={LEVEL_OPTIONS} value={level} onChange={setLevel} aria-label="Nível da magia" /></div>
            <button type="button" className="dsh-newattack__add" onClick={() => void addSpell()} disabled={busy === 'new'}>+ Adicionar magia</button>
          </div>
        )}
      </section>

      {!readOnly && (
        <section className="dsh-card dsh-wide dsh-bookcta">
          <div className="dsh-bookcta__text">
            <h4 className="dsh-card__title">Livro de magias</h4>
            <p className="dsh-note">Todas as magias do SRD em cards. Clique em uma para levá-la à ficha na hora, ou em "Ver mais" para ler o texto completo.</p>
            <ChipRow><StatChip label="No livro">{catalogMod ? `${catalogMod.SPELLS.length} magias` : '319 magias'}</StatChip><StatChip label="Fonte">SRD 5.1</StatChip><StatChip label="Filtros">nível · classe · escola</StatChip></ChipRow>
          </div>
          <button type="button" className="dsh-bookcta__open" aria-haspopup="dialog" onClick={() => setBookOpen(true)}>Abrir o livro</button>
        </section>
      )}
      {!readOnly && (
        <Presence show={bookOpen}>{() => (
          <DndSpellBrowser catalog={catalogMod?.SPELLS ?? null} have={haveKeys} myClasses={casting?.classes.map((c) => spellListClass(c.classKey, data.classes.find((r) => r.class_key === c.classKey)?.subclass_key)) ?? []}
            readOnly={readOnly} busy={busy} onAdd={(sp) => void addFromBook(sp)} onClose={() => setBookOpen(false)} />
        )}</Presence>
      )}
    </div>
  )
}
