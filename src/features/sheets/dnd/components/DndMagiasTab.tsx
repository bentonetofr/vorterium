import { useState } from 'react'
import { Select } from '../../../../shared/components/Select'
import type { DndCharacterSpell } from '../../../../shared/types'
import { getClass } from '../catalog'
import { ABILITIES } from '../rules/abilities'
import { PACT_SLOT_KEY, spellSlotKey } from '../model/slots'
import { formatSigned } from '../model/format'
import { createDndSpell, deleteDndSpell, updateDndSpell } from '../services/dndSheetService'
import { setDndResourceCurrent } from '../services/dndResourceService'
import { DerivedField, Pips, Toggle } from './DndControls'
import type { SheetCtx } from './sheetContext'

// ────────────────────────────────────────────────────────
// Aba Magias: conjuração de cada classe (atributo, CD, ataque, truques,
// magias conhecidas ou preparadas), espaços de magia clicáveis e a lista de
// magias do personagem. A lista é manual por enquanto: o catálogo das 310
// magias do SRD, com busca, chega no Marco 5.
// ────────────────────────────────────────────────────────

const LEVEL_OPTIONS = Array.from({ length: 10 }, (_, level) => ({ value: String(level), label: level === 0 ? 'Truque' : `${level}º nível` }))
const LEARNING_LABEL = { known: 'conhece', prepared: 'prepara', 'prepared-half': 'prepara', spellbook: 'prepara (do grimório)' } as const

export function DndMagiasTab({ ctx }: { ctx: SheetCtx }) {
  const { derived, data, sheet, readOnly, report } = ctx
  const casting = derived.spellcasting
  const [name, setName] = useState('')
  const [level, setLevel] = useState('1')
  const [busy, setBusy] = useState<string | null>(null)

  const slotRows = data.resources.filter((r) => r.source === 'spell_slots')
  const spells = [...data.details.spells].sort((a, b) => a.spell_level - b.spell_level || a.name.localeCompare(b.name, 'pt-BR'))
  const preparedCount = data.details.spells.filter((s) => s.prepared && s.spell_level > 0).length
  const preparedLimit = casting?.classes.filter((c) => getClass(c.classKey)?.spellcasting?.learning !== 'known').reduce((n, c) => n + c.spellsKnownOrPrepared, 0) ?? 0

  async function run(key: string, job: () => Promise<void>) {
    setBusy(key)
    report(null)
    try { await job() } catch (err) { report(err instanceof Error ? err.message : 'Algo deu errado. Tente de novo.') } finally { setBusy(null) }
  }

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
      concentration: false, ritual: false, prepared: false, description: '', sort_order: data.details.spells.length,
    })
    data.setDetails((d) => ({ ...d, spells: [...d.spells, saved] }))
    setName('')
  })

  const patchSpell = (s: DndCharacterSpell, patch: Partial<Pick<DndCharacterSpell, 'prepared' | 'concentration' | 'ritual' | 'description'>>) =>
    run(s.id, async () => {
      const saved = await updateDndSpell(s.id, patch)
      data.setDetails((d) => ({ ...d, spells: d.spells.map((x) => (x.id === saved.id ? saved : x)) }))
    })

  const removeSpell = (s: DndCharacterSpell) => run(s.id, async () => {
    await deleteDndSpell(s.id)
    data.setDetails((d) => ({ ...d, spells: d.spells.filter((x) => x.id !== s.id) }))
  })

  if (!casting && spells.length === 0 && readOnly) return <div className="dsh-tab"><p className="dsh-faint">Este personagem não conjura magias.</p></div>

  const first = casting?.classes[0]
  const pact = data.resources.find((r) => r.key === PACT_SLOT_KEY && r.max_value > 0)

  return (
    <div className="dsh-tab dsh-columns anim-tab-panel">
      <section className="dsh-card">
        <div className="dsh-card__header"><h4 className="dsh-card__title">Conjuração</h4></div>
        {!casting ? (
          <p className="dsh-faint">Nenhuma das classes do personagem conjura magias. Classes conjuradoras: Bardo, Clérigo, Druida, Feiticeiro, Bruxo, Mago, e Paladino e Patrulheiro a partir do 2º nível.</p>
        ) : (
          <>
            <dl className="dsh-facts">
              <dt>CD das magias</dt><dd><DerivedField ctx={ctx} field="spell_save_dc" value={first!.saveDc} label="CD das magias" min={0} max={40} /></dd>
              <dt>Ataque de magia</dt><dd><DerivedField ctx={ctx} field="spell_attack_bonus" value={first!.attackBonus} label="Bônus de ataque de magia" signed min={-10} max={30} /></dd>
            </dl>
            <ul className="dsh-list">
              {casting.classes.map((c) => {
                const def = getClass(c.classKey)
                const ab = ABILITIES.find((a) => a.key === c.ability)
                const learning = def?.spellcasting?.learning ?? 'known'
                return (
                  <li key={c.classKey} className="dsh-class">
                    <strong className="dsh-class__name">{def?.name ?? c.classKey}</strong>
                    <p className="dsh-note">
                      Atributo: {ab?.label}. Truques: {c.cantripsKnown}. Magias que {LEARNING_LABEL[learning]}: {c.spellsKnownOrPrepared}
                      {c.spellbookSize != null && <>, grimório com {c.spellbookSize}</>}.
                    </p>
                  </li>
                )
              })}
            </ul>
            {casting.classes.length > 1 && <p className="dsh-note">Na multiclasse, os espaços de magia somam os níveis de conjurador; truques e magias contam por classe.</p>}
          </>
        )}
      </section>

      {casting && (
        <section className="dsh-card">
          <div className="dsh-card__header"><h4 className="dsh-card__title">Espaços de magia</h4></div>
          {slotRows.filter((r) => r.max_value > 0).length === 0 && <p className="dsh-faint">Sem espaços de magia neste nível.</p>}
          <ul className="dsh-slots">
            {casting.slots.map((max, i) => {
              const key = spellSlotKey(i + 1)
              const row = slotRows.find((r) => r.key === key)
              if (max === 0) return null
              const available = row ? Math.min(row.current_value, max) : max
              return (
                <li key={key} className="dsh-slot">
                  <span className="dsh-slot__label">{i + 1}º nível</span>
                  <Pips total={max} filled={available} label={`Espaços de ${i + 1}º nível disponíveis`}
                    onChange={readOnly || !row || busy === key ? undefined : (n) => setSlots(key, n)} />
                  <span className="dsh-faint">{available}/{max}</span>
                </li>
              )
            })}
            {casting.pact && pact && (
              <li className="dsh-slot">
                <span className="dsh-slot__label">Pacto ({casting.pact.level}º nível)</span>
                <Pips total={pact.max_value} filled={Math.min(pact.current_value, pact.max_value)} tone="good" label="Espaços de Pacto disponíveis"
                  onChange={readOnly || busy === PACT_SLOT_KEY ? undefined : (n) => setSlots(PACT_SLOT_KEY, n)} />
                <span className="dsh-faint">{Math.min(pact.current_value, pact.max_value)}/{pact.max_value} · voltam no descanso curto</span>
              </li>
            )}
          </ul>
          <p className="dsh-note">Bolinha cheia é um espaço disponível; clique para gastar. O descanso longo recarrega todos.</p>
        </section>
      )}

      <section className="dsh-card dsh-card--wide">
        <div className="dsh-card__header">
          <h4 className="dsh-card__title">Magias do personagem</h4>
          {preparedLimit > 0 && <span className={`dsh-badge${preparedCount > preparedLimit ? ' dsh-badge--bad' : ''}`}>Preparadas {preparedCount} / {preparedLimit}</span>}
        </div>
        {spells.length === 0 && <p className="dsh-faint">Nenhuma magia ainda.</p>}
        <ul className="dsh-list">
          {spells.map((s) => (
            <li key={s.id} className="dsh-spell">
              <div className="dsh-spell__main">
                <span className="dsh-tag">{s.spell_level === 0 ? 'Truque' : `${s.spell_level}º`}</span>
                <strong className="dsh-spell__name">{s.name}</strong>
                {s.spell_level > 0 && <Toggle checked={s.prepared} onChange={readOnly ? undefined : (v) => void patchSpell(s, { prepared: v })} label="Preparada" />}
                <Toggle checked={s.concentration} onChange={readOnly ? undefined : (v) => void patchSpell(s, { concentration: v })} label="Concentração" />
                <Toggle checked={s.ritual} onChange={readOnly ? undefined : (v) => void patchSpell(s, { ritual: v })} label="Ritual" />
                {!readOnly && <button type="button" className="dsh-x" onClick={() => void removeSpell(s)} disabled={busy === s.id} aria-label={`Remover ${s.name}`}>×</button>}
              </div>
              {(!readOnly || s.description) && (
                <textarea className="dsh-input dsh-textarea dsh-textarea--sm" rows={2} defaultValue={s.description} readOnly={readOnly} maxLength={2000}
                  placeholder="Notas da magia (alcance, duração, efeito...)" aria-label={`Notas de ${s.name}`}
                  onBlur={(e) => { if (e.target.value !== s.description) void patchSpell(s, { description: e.target.value }) }} />
              )}
            </li>
          ))}
        </ul>
        {!readOnly && (
          <div className="dsh-add-row">
            <input type="text" className="dsh-input" value={name} maxLength={160} placeholder="Nome da magia"
              onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addSpell() } }} />
            <Select options={LEVEL_OPTIONS} value={level} onChange={setLevel} aria-label="Nível da magia" />
            <button type="button" className="dsh-chip dsh-chip--primary" onClick={() => void addSpell()} disabled={busy === 'new'}>Adicionar</button>
          </div>
        )}
        <p className="dsh-note">
          {first ? <>Ataque de magia {formatSigned(first.attackBonus)}, CD {first.saveDc}. </> : null}
          A busca no catálogo de magias do livro chega numa próxima atualização.
        </p>
      </section>
    </div>
  )
}
