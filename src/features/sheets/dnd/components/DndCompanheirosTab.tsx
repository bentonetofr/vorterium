import { useCallback, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { AvatarCropEditor } from '../../../users/components/AvatarCropEditor'
import { Presence } from '../../../../shared/components/Presence'
import { DND_PORTRAIT_PICK_MAX_BYTES, DND_PORTRAIT_TYPES } from '../constants/dnd'
import { removeDndCompanionPhoto, uploadDndCompanionPhoto } from '../services/dndPortraitService'
import { CONDITIONS } from '../catalog'
import { COMPANION_GUIDE } from '../model/companionGuide'
import { BLANKS, PRESETS, blankOfKind, companionFromPreset, presetAttacks } from '../model/companionCatalog'
import {
  ABILITY_KEYS, ABILITY_NAME, ABILITY_SHORT, COMPANION_LIMIT, COMPANION_SKILLS, KINDS, KIND_LABEL, SIZES, SPEED_LABEL, STATE_LABEL, TRAIT_KINDS, TRAIT_LABEL,
  blankAttack, blankTrait, freeze, heal, mod, ownerCtx, readCompanion, signed, takeDamage, unfreeze, usesLevel, usesSlot, viewOf,
  type AttackView, type Companion, type CompanionKind, type CompanionState, type OwnerCtx, type SpeedKey,
} from '../model/companions'
import { formatMeters } from '../model/format'
import type { AbilityKey } from '../rules/types'
import { critDamage, type BonusTile, type CheckKind, type CheckSpec } from '../rolls/checkModel'
import { useDndRoll } from '../rolls/DndRollProvider'
import { RollButton } from '../rolls/RollButton'
import { NumberField, Pips } from './DndControls'
import type { SheetCtx } from './sheetContext'

// ────────────────────────────────────────────────────────
// Aba Companheiros: familiares, constructos (Defensor de Aço, Homúnculo, Canhão Místico), companheiros animais, montarias,
// criaturas invocadas e pets. Cada um é uma mini-ficha (PV, CA, atributos, ataques, habilidades) guardada na própria ficha.
// As contas e os modelos estão em model/companions.ts e model/companionCatalog.ts.
// ────────────────────────────────────────────────────────

const KIND_TAG: Record<CompanionKind, string> = { constructo: 'CON', familiar: 'FAM', besta: 'BES', montaria: 'MON', invocado: 'INV', pet: 'PET', outro: 'OUT' }

export function DndCompanheirosTab({ ctx }: { ctx: SheetCtx }) {
  const { form, update, derived, data, readOnly } = ctx
  const owner = useMemo(() => ownerCtx(derived, data.classes, form.class_names), [derived, data.classes, form.class_names])
  const list = form.companions
  const [picking, setPicking] = useState(false)
  const [guide, setGuide] = useState(false)
  const [open, setOpen] = useState<Record<string, boolean>>({})

  // toda mudança passa por readCompanion: o que está na ficha é sempre o que o banco devolveria (o eco do salvamento bate)
  const change = useCallback((id: string, fn: (c: Companion) => Companion) => {
    update((f) => ({ ...f, companions: f.companions.map((c) => (c.id === id ? readCompanion(fn(c)) : c)) }))
  }, [update])

  const add = (c: Companion | null) => {
    if (!c || readOnly || list.length >= COMPANION_LIMIT) return
    const start = readCompanion({ ...c, hp: viewOf(c, owner).hpMax })
    update((f) => ({ ...f, companions: [...f.companions, start].slice(0, COMPANION_LIMIT) }))
    setOpen((o) => ({ ...o, [start.id]: true }))
    setPicking(false)
  }

  const remove = async (c: Companion) => {
    // carregado só na hora (o diálogo mexe em `window`, que não existe nos testes de desenho)
    const { confirmDialog } = await import('../../../../shared/components/dialogs')
    const ok = await confirmDialog({ title: 'Remover companheiro', message: `Tirar ${c.name || c.species || 'este companheiro'} da ficha? Não dá para desfazer.`, confirmLabel: 'Remover' })
    if (!ok) return
    update((f) => ({ ...f, companions: f.companions.filter((x) => x.id !== c.id) }))
    // a foto só ficaria órfã no armazenamento: tira junto (se não der, não atrapalha)
    if (c.photo_url) void removeDndCompanionPhoto(ctx.sheet.id, c.id).catch(() => undefined)
  }

  return (
    <div className="dsh-tab anim-tab-panel dcm">
      <section className="dsh-card dcm-head">
        <div className="dsh-card__header">
          <h4 className="dsh-card__title">Companheiros</h4>
          <span className="dsh-faint">{list.length}/{COMPANION_LIMIT}</span>
        </div>
        <p className="dcm-lead">Familiar, constructo, animal fiel, montaria, criatura invocada ou pet: cada um tem a sua mini-ficha, com PV, CA, ataques e habilidades.</p>
        <div className="dcm-toolbar">
          {!readOnly && <button type="button" className="dsh-chip dsh-chip--primary" onClick={() => setPicking((p) => !p)} disabled={list.length >= COMPANION_LIMIT} aria-expanded={picking}>{picking ? 'Fechar a lista' : 'Adicionar companheiro'}</button>}
          <button type="button" className="dsh-chip" onClick={() => setGuide((g) => !g)} aria-expanded={guide}>{guide ? 'Fechar o guia' : 'Guia de regras'}</button>
        </div>
        {picking && !readOnly && <Picker onPick={add} />}
        {guide && <Guide />}
      </section>

      {list.length === 0 && !picking && (
        <p className="dcm-empty">Nenhum companheiro ainda. Escolha um modelo do livro (Defensor de Aço, familiar, Fera da Terra, cavalo de guerra...) ou monte um do zero.</p>
      )}

      {list.map((c) => (
        <CompanionCard
          key={c.id} c={c} owner={owner} ctx={ctx} open={open[c.id] ?? list.length === 1}
          onToggle={() => setOpen((o) => ({ ...o, [c.id]: !(o[c.id] ?? list.length === 1) }))}
          onChange={(fn) => change(c.id, fn)} onRemove={() => void remove(c)}
        />
      ))}
    </div>
  )
}

// ── Escolher o que adicionar ─────────────────────────────

function Picker({ onPick }: { onPick: (c: Companion | null) => void }) {
  const [kind, setKind] = useState<CompanionKind | 'all'>('all')
  const [q, setQ] = useState('')
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const needle = norm(q.trim())
  const shown = PRESETS.filter((p) => (kind === 'all' || p.group === kind) && (!needle || norm(`${p.label} ${p.source} ${p.blurb}`).includes(needle)))
  const blanks = BLANKS.filter((b) => (kind === 'all' || b.kind === kind) && (!needle || norm(`${b.label} ${b.blurb}`).includes(needle)))
  return (
    <div className="dcm-picker">
      <div className="dcm-chips" role="tablist" aria-label="Tipo de companheiro">
        {(['all', ...KINDS] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} className={`dcm-chip${kind === k ? ' is-on' : ''}`} onClick={() => setKind(k)}>{k === 'all' ? 'Todos' : KIND_LABEL[k]}</button>
        ))}
      </div>
      <input type="search" className="dsh-input" placeholder="Buscar (lobo, defensor, corvo, canhão...)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar modelo" />
      <ul className="dcm-presets">
        {shown.map((p) => (
          <li key={p.key}>
            <button type="button" className="dcm-preset" onClick={() => onPick(companionFromPreset(p.key))}>
              <span className="dcm-preset__tag">{KIND_TAG[p.key.startsWith('invoked:') ? 'invocado' : p.group]}</span>
              <span className="dcm-preset__body"><b>{p.label}</b><em>{p.source}</em><span>{p.blurb}</span></span>
            </button>
          </li>
        ))}
        {blanks.map((b) => (
          <li key={b.kind}>
            <button type="button" className="dcm-preset dcm-preset--blank" onClick={() => onPick(blankOfKind(b.kind))}>
              <span className="dcm-preset__tag">+</span>
              <span className="dcm-preset__body"><b>{b.label}</b><span>{b.blurb}</span></span>
            </button>
          </li>
        ))}
        {shown.length === 0 && blanks.length === 0 && <li className="dcm-empty">Nada com esse nome. Tente "Em branco" e digite o bloco da criatura.</li>}
      </ul>
    </div>
  )
}

function Guide() {
  const [openId, setOpenId] = useState<string | null>('turno')
  return (
    <div className="dcm-guide">
      {COMPANION_GUIDE.map((s) => (
        <div key={s.id} className={`dcm-guide__item${openId === s.id ? ' is-open' : ''}`}>
          <button type="button" className="dcm-guide__head" aria-expanded={openId === s.id} onClick={() => setOpenId(openId === s.id ? null : s.id)}>
            <span>{s.title}</span><span aria-hidden="true">{openId === s.id ? '▴' : '▾'}</span>
          </button>
          {openId === s.id && (
            <div className="dcm-guide__body">
              <p className="dcm-guide__lead">{s.lead}</p>
              <ul>{s.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Pequenos campos de edição ────────────────────────────

function TextIn({ label, value, onChange, max = 120, wide, placeholder }: { label: string; value: string; onChange: (v: string) => void; max?: number; wide?: boolean; placeholder?: string }) {
  return (
    <label className={`dcm-f${wide ? ' dcm-f--wide' : ''}`}>
      <span>{label}</span>
      <input type="text" className="dsh-input" value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function NumIn({ label, value, onChange, min = 0, max = 999, disabled, hint }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; disabled?: boolean; hint?: string }) {
  return (
    <label className="dcm-f" title={hint}>
      <span>{label}</span>
      <NumberField value={value} onChange={onChange} min={min} max={max} label={label} disabled={disabled} />
    </label>
  )
}

function Pencil({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" className={`dcm-pencil${on ? ' is-on' : ''}`} onClick={onClick} aria-pressed={on} aria-label={on ? `Concluir: ${label}` : `Editar: ${label}`} title={on ? 'Concluir' : 'Editar'}>
      {on ? 'Concluir' : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
      )}
    </button>
  )
}

function Section({ title, edit, children, aside }: { title: string; edit?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="dcm-sec">
      <header className="dcm-sec__head"><h5>{title}</h5>{aside}{edit}</header>
      {children}
    </section>
  )
}

// ── Um companheiro ───────────────────────────────────────

const speedText = (c: Companion, ft: boolean): string => {
  const d = (n: number) => (ft ? `${n} pés` : formatMeters(n))
  const parts = (['walk', 'fly', 'swim', 'climb', 'burrow'] as SpeedKey[]).filter((k) => c.speeds[k] > 0).map((k) => (k === 'walk' ? d(c.speeds.walk) : `${SPEED_LABEL[k].toLowerCase()} ${d(c.speeds[k])}`))
  return parts.join(', ') || '—'
}

const check = (kind: CheckKind, key: string, label: string, tiles: BonusTile[]): CheckSpec => ({ kind, key, label, tiles, dc: null, dcHidden: false, advantage: 'normal' })

interface CardProps {
  c: Companion
  owner: OwnerCtx
  ctx: SheetCtx
  open: boolean
  onToggle: () => void
  onChange: (fn: (c: Companion) => Companion) => void
  onRemove: () => void
}

function CompanionCard({ c, owner, ctx, open, onToggle, onChange, onRemove }: CardProps) {
  const ro = ctx.readOnly
  const unitFt = ctx.form.speed_unit === 'ft'
  const roller = useDndRoll()
  const v = viewOf(c, owner)
  const [edit, setEdit] = useState<string | null>(null)
  const [amount, setAmount] = useState(1)
  const [crit, setCrit] = useState<Record<string, boolean>>({})
  const hp = Math.min(c.hp, v.hpMax)
  const pct = v.hpMax > 0 ? Math.max(0, Math.min(100, Math.round((100 * hp) / v.hpMax))) : 0
  const name = c.name.trim() || c.species || 'Companheiro'
  const toggleEdit = (k: string) => setEdit((e) => (e === k ? null : k))
  const set = <K extends keyof Companion>(key: K, value: Companion[K]) => onChange((x) => ({ ...x, [key]: value }))
  const dist = (ft: number) => (unitFt ? `${ft} pés` : formatMeters(ft))

  // ── Rolagens ──
  const profTiles = (k: AbilityKey, extra: BonusTile[]): BonusTile[] => [{ id: `mod_${k}`, label: ABILITY_NAME[k], value: mod(c.abilities[k]), badge: ABILITY_SHORT[k] }, ...extra, ...(c.pb_checks ? [{ id: 'bond', label: 'Vínculo Primal', value: v.pb, badge: 'PROF' }] : [])]
  const rollAbility = (k: AbilityKey) => roller.check(check('ability', `${c.id}:${k}`, `${name}: teste de ${ABILITY_NAME[k]}`, profTiles(k, [])))
  const rollSave = (k: AbilityKey) => roller.check(check('save', `${c.id}:${k}`, `${name}: salvaguarda de ${ABILITY_NAME[k]}`, profTiles(k, c.save_prof.includes(k) ? [{ id: 'prof', label: 'Proficiência', value: v.pb, badge: 'PROF' }] : [])))
  const rollSkill = (key: string) => {
    const def = COMPANION_SKILLS.find((s) => s.key === key)!
    const sk = c.skills.find((s) => s.key === key)!
    const extra: BonusTile[] = [{ id: 'prof', label: 'Proficiência', value: v.pb, badge: 'PROF' }, ...(sk.level === 'expertise' ? [{ id: 'exp', label: 'Especialista', value: v.pb, badge: 'ESP' }] : [])]
    roller.check(check('skill', `${c.id}:${key}`, `${name}: ${def.label}`, profTiles(def.ability, extra)))
  }
  const rollHit = (a: AttackView) => {
    const tiles: BonusTile[] = [{ id: 'bonus', label: 'Bônus de ataque', value: a.hitBonus, badge: '+' }]
    roller.check(check('attack', `${c.id}:${a.attack.id}`, `Ataque: ${name} · ${a.attack.name}`, tiles), { onResult: ({ crit: r }) => setCrit((m) => ({ ...m, [a.attack.id]: r === 'crit' })) })
  }
  const rollDamage = (a: AttackView) => {
    const isCrit = !!crit[a.attack.id]
    const type = a.attack.type ? ` (${a.attack.type})` : ''
    void roller.roll(`${isCrit ? 'Dano crítico' : 'Dano'}: ${name} · ${a.attack.name}${type}`, isCrit ? critDamage(a.formula) : a.formula, { kind: 'damage', key: `${c.id}:${a.attack.id}` })
    if (isCrit) setCrit((m) => ({ ...m, [a.attack.id]: false }))
  }

  const hurt = () => onChange((x) => takeDamage(x, amount, v.hpMax))
  const cure = () => onChange((x) => heal(x, amount, v.hpMax))
  const mend = () => onChange((x) => ({ ...x, hp: v.hpMax, hp_temp: 0, state: x.state === 'caido' || x.state === 'morto' ? 'ativo' : x.state }))
  const setState = (s: CompanionState) => onChange((x) => ({ ...x, state: s, hp: s === 'caido' || s === 'morto' ? 0 : x.state === 'caido' || x.state === 'morto' ? Math.max(1, x.hp) : x.hp }))

  const patchAttack = (id: string, p: Partial<Companion['attacks'][number]>) => onChange((x) => ({ ...x, attacks: x.attacks.map((a) => (a.id === id ? { ...a, ...p } : a)) }))
  const patchTrait = (id: string, p: Partial<Companion['traits'][number]>) => onChange((x) => ({ ...x, traits: x.traits.map((t) => (t.id === id ? { ...t, ...p } : t)) }))

  const ruleOn = c.rule !== 'manual'
  const lock = c.auto
  const tpl = c.template ? presetAttacks(c.template) : null

  return (
    <article className={`dsh-card dcm-card dcm-card--${c.kind} dcm-state--${c.state}${open ? ' is-open' : ''}`}>
      <header className="dcm-card__head">
        <button type="button" className="dcm-card__toggle" onClick={onToggle} aria-expanded={open} aria-label={`${open ? 'Recolher' : 'Abrir'} ${name}`}>
          <span className={`dcm-av dcm-av--${c.kind}${c.photo_url ? ' dcm-av--photo' : ''}`} aria-hidden="true">{c.photo_url ? <img src={c.photo_url} alt="" /> : KIND_TAG[c.kind]}</span>
          <span className="dcm-card__who">
            <span className="dcm-card__name">{name}</span>
            <span className="dcm-card__sub">{KIND_LABEL[c.kind]}{c.species && c.name.trim() ? ` · ${c.species}` : ''} · {c.size} · {c.type}</span>
          </span>
          <span className="dcm-card__mini" aria-hidden="true"><b>{hp}</b>/{v.hpMax} PV · CA {v.ac}</span>
          <span className="dcm-chev" aria-hidden="true">{open ? '▴' : '▾'}</span>
        </button>
      </header>
      <div className={`dcm-bar${hp === 0 ? ' is-zero' : ''}`} role="progressbar" aria-label={`PV de ${name}`} aria-valuemin={0} aria-valuemax={v.hpMax} aria-valuenow={hp}><i style={{ width: `${pct}%` }} /></div>

      {open && (
        <div className="dcm-card__body">
          <div className="dcm-top">
          <CompanionPhoto c={c} ro={ro} sheetId={ctx.sheet.id} report={ctx.report} onPhoto={(url) => set('photo_url', url)} />
          {/* Vida */}
          <div className="dcm-vitals">
            <div className="dcm-hp">
              <span className="dcm-hp__num"><b>{hp}</b><small>/ {v.hpMax}</small>{c.hp_temp > 0 && <em title="PV temporários">+{c.hp_temp}</em>}</span>
              <span className="dsh-label">Pontos de vida</span>
            </div>
            {!ro && (
              <div className="dcm-hp__ctl">
                <NumberField value={amount} onChange={setAmount} min={1} max={9999} label="Quantidade" />
                <button type="button" className="dsh-chip dsh-chip--bad" onClick={hurt}>Dano</button>
                <button type="button" className="dsh-chip" onClick={cure}>Cura</button>
                <button type="button" className="dsh-chip" onClick={mend} title="PV no máximo e sem PV temporários">Curar tudo</button>
                <label className="dcm-temp"><span>PV temp.</span><NumberField value={c.hp_temp} onChange={(n) => set('hp_temp', n)} min={0} max={9999} label="PV temporários" /></label>
              </div>
            )}
            <label className="dcm-state"><span className="dsh-label">Situação</span>
              <select className="dsh-input" value={c.state} disabled={ro} onChange={(e) => setState(e.target.value as CompanionState)}>
                {(Object.keys(STATE_LABEL) as CompanionState[]).map((s) => <option key={s} value={s}>{STATE_LABEL[s]}</option>)}
              </select>
            </label>
          </div>
          </div>

          {/* Números */}
          <Section title="Números" edit={!ro && <Pencil on={edit === 'nums'} onClick={() => toggleEdit('nums')} label="números" />}
            aside={ruleOn && !ro ? (
              <span className="dcm-seg" role="radiogroup" aria-label="Modo dos números">
                <button type="button" role="radio" aria-checked={c.auto} className={c.auto ? 'is-on' : ''} onClick={() => !c.auto && onChange((x) => (tpl ? unfreeze(x, { attacks: tpl.map((a, i) => ({ ...a, id: x.attacks[i]?.id ?? a.id })) }) : unfreeze(x, null)))} title="PV, CA e bônus saem do seu nível e da sua proficiência">Automático</button>
                <button type="button" role="radio" aria-checked={!c.auto} className={!c.auto ? 'is-on' : ''} onClick={() => c.auto && onChange((x) => freeze(x, owner))} title="Os números ficam como estão e você digita o que quiser">Manual</button>
              </span>
            ) : undefined}>
            <div className="dcm-tiles">
              <Tile label="CA" value={String(v.ac)} />
              <Tile label="Prof." value={signed(v.pb)} />
              <Tile label="Iniciativa" value={signed(v.initiative)} />
              {v.saveDc != null && <Tile label="CD" value={String(v.saveDc)} hint="CD das salvaguardas dele (a de magia do seu personagem)" />}
              <Tile label="Perc. passiva" value={String(v.passivePerception)} />
              <Tile label="Deslocamento" value={speedText(c, unitFt)} wide />
            </div>
            {ruleOn && c.auto && v.note && <p className="dcm-note">{v.note}.</p>}
            {ruleOn && c.auto && (usesLevel(c.rule) || usesSlot(c.rule)) && !ro && (
              <div className="dcm-rule">
                {usesLevel(c.rule) && (
                  <label className="dcm-f dcm-f--inline"><span>Nível de referência</span>
                    <NumberField value={c.level_ref ?? v.level ?? 1} onChange={(n) => set('level_ref', n)} min={1} max={20} label="Nível de referência" />
                    {c.level_ref != null && <button type="button" className="dcm-link" onClick={() => set('level_ref', null)}>usar o da ficha</button>}
                  </label>
                )}
                {usesSlot(c.rule) && <NumIn label="Nível do espaço de magia" value={c.slot_level} onChange={(n) => set('slot_level', n)} min={4} max={9} />}
              </div>
            )}
            {edit === 'nums' && (
              <div className="dcm-edit">
                <NumIn label="PV máximo" value={c.hp_max} onChange={(n) => set('hp_max', n)} max={9999} disabled={lock && ruleOn} hint={lock && ruleOn ? 'No automático vem da regra. Mude para Manual para digitar.' : undefined} />
                <NumIn label="CA" value={c.ac} onChange={(n) => set('ac', n)} max={40} disabled={lock && ruleOn && c.rule !== 'ranger'} hint={c.rule === 'ranger' ? 'CA da criatura; a sua proficiência é somada por cima' : undefined} />
                {c.rule === 'ranger' && <NumIn label="PV da criatura (livro)" value={c.base_hp} onChange={(n) => set('base_hp', n)} max={9999} />}
                {!ruleOn && <NumIn label="Proficiência" value={c.pb} onChange={(n) => set('pb', n)} max={12} />}
                {(Object.keys(SPEED_LABEL) as SpeedKey[]).map((k) => (
                  <NumIn key={k} label={`${SPEED_LABEL[k]} (pés)`} value={c.speeds[k]} onChange={(n) => onChange((x) => ({ ...x, speeds: { ...x.speeds, [k]: n } }))} max={500} />
                ))}
                <label className="dcm-f dcm-f--inline"><input type="checkbox" checked={c.pb_checks} onChange={(e) => set('pb_checks', e.target.checked)} /><span>Soma a proficiência a todo teste e salvaguarda (Vínculo Primal)</span></label>
              </div>
            )}
          </Section>

          {/* Identidade */}
          <Section title="Identidade" edit={!ro && <Pencil on={edit === 'id'} onClick={() => toggleEdit('id')} label="identidade" />}>
            {edit === 'id' ? (
              <div className="dcm-edit">
                <TextIn label="Nome" value={c.name} onChange={(x) => set('name', x)} max={80} placeholder={c.species} />
                <TextIn label="Criatura ou modelo" value={c.species} onChange={(x) => set('species', x)} max={80} />
                <label className="dcm-f"><span>Tipo de companheiro</span>
                  <select className="dsh-input" value={c.kind} onChange={(e) => set('kind', e.target.value as CompanionKind)}>{KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
                </label>
                <label className="dcm-f"><span>Tamanho</span>
                  <select className="dsh-input" value={c.size} onChange={(e) => set('size', e.target.value)}>{SIZES.map((s) => <option key={s} value={s}>{s}</option>)}{!(SIZES as readonly string[]).includes(c.size) && <option value={c.size}>{c.size}</option>}</select>
                </label>
                <TextIn label="Tipo da criatura" value={c.type} onChange={(x) => set('type', x)} max={40} />
                <TextIn label="ND" value={c.cr} onChange={(x) => set('cr', x)} max={12} />
              </div>
            ) : (
              <p className="dcm-text">{c.species || 'Sem modelo'} · {c.size} · {c.type}{c.cr ? ` · ND ${c.cr}` : ''}{c.template ? '' : ' · feito à mão'}</p>
            )}
          </Section>

          {/* Atributos */}
          <Section title="Atributos e testes" edit={!ro && <Pencil on={edit === 'abs'} onClick={() => toggleEdit('abs')} label="atributos" />}>
            <div className="dcm-abs">
              {ABILITY_KEYS.map((k) => (
                <div key={k} className="dcm-ab">
                  <span className="dcm-ab__k">{ABILITY_SHORT[k]}</span>
                  {edit === 'abs'
                    ? <NumberField value={c.abilities[k]} onChange={(n) => onChange((x) => ({ ...x, abilities: { ...x.abilities, [k]: n } }))} min={1} max={30} label={ABILITY_NAME[k]} />
                    : <span className="dcm-ab__v">{c.abilities[k]}</span>}
                  <span className="dcm-ab__mod">{signed(mod(c.abilities[k]))}<RollButton label={`Teste de ${ABILITY_NAME[k]} de ${name}`} onClick={() => rollAbility(k)} /></span>
                  <span className={`dcm-ab__save${v.saves[k].proficient ? ' is-prof' : ''}`}>
                    Salv. {signed(v.saves[k].bonus)}<RollButton label={`Salvaguarda de ${ABILITY_NAME[k]} de ${name}`} onClick={() => rollSave(k)} />
                  </span>
                  {edit === 'abs' && (
                    <label className="dcm-ab__prof"><input type="checkbox" checked={c.save_prof.includes(k)} onChange={(e) => onChange((x) => ({ ...x, save_prof: e.target.checked ? [...x.save_prof, k] : x.save_prof.filter((s) => s !== k) }))} /> prof. na salv.</label>
                  )}
                </div>
              ))}
            </div>
            {edit === 'abs' ? (
              <div className="dcm-skillsedit">
                {COMPANION_SKILLS.map((s) => {
                  const cur = c.skills.find((x) => x.key === s.key)?.level ?? 'none'
                  return (
                    <label key={s.key} className="dcm-f dcm-f--inline"><span>{s.label}</span>
                      <select className="dsh-input" value={cur} onChange={(e) => onChange((x) => ({ ...x, skills: [...x.skills.filter((k) => k.key !== s.key), ...(e.target.value === 'none' ? [] : [{ key: s.key, level: e.target.value as 'proficient' | 'expertise' }])] }))}>
                        <option value="none">—</option><option value="proficient">Proficiente</option><option value="expertise">Especialista</option>
                      </select>
                    </label>
                  )
                })}
              </div>
            ) : v.skills.length > 0 && (
              <ul className="dcm-skills">
                {v.skills.map((s) => (
                  <li key={s.key}><span>{s.label}{s.level === 'expertise' ? ' ★' : ''}</span><b>{signed(s.bonus)}</b><RollButton label={`${s.label} de ${name}`} onClick={() => rollSkill(s.key)} /></li>
                ))}
              </ul>
            )}
          </Section>

          {/* Ataques */}
          <Section title="Ataques" aside={!ro ? <button type="button" className="dcm-link" onClick={() => { const a = blankAttack(); onChange((x) => ({ ...x, attacks: [...x.attacks, a].slice(0, 8) })); setEdit(`atk:${a.id}`) }} disabled={c.attacks.length >= 8}>+ Adicionar</button> : undefined}>
            {v.attacks.length === 0 && <p className="dcm-text dcm-text--muted">Sem ataques{c.template.startsWith('familiar:') ? ': o familiar de Convocar Familiar não pode atacar' : ''}.</p>}
            <ul className="dcm-atks">
              {v.attacks.map((a) => {
                const at = a.attack
                const editing = edit === `atk:${at.id}`
                const range = at.kind === 'ranged' ? `alcance ${dist(at.range_ft)}${at.range_long_ft ? `/${dist(at.range_long_ft)}` : ''}` : `alcance ${dist(at.reach_ft)}`
                return (
                  <li key={at.id} className="dcm-atk">
                    <div className="dcm-atk__row">
                      <span className="dcm-atk__name">{at.name}</span>
                      <span className="dcm-atk__hit">{a.saveDc != null ? `CD ${a.saveDc} ${ABILITY_SHORT[at.save as AbilityKey]}` : `${signed(a.hitBonus)} p/ acertar`}</span>
                      <span className="dcm-atk__dmg">{a.damageText}{at.type ? ` ${at.type}` : ''}</span>
                      <span className="dcm-atk__rng">{range}</span>
                      <span className="dcm-atk__btns">
                        {a.saveDc == null && <RollButton label={`Atacar com ${at.name}`} onClick={() => rollHit(a)}>Atacar</RollButton>}
                        <RollButton label={`Dano de ${at.name}`} onClick={() => rollDamage(a)} className={crit[at.id] ? 'is-crit' : ''}>{crit[at.id] ? 'Dano crítico' : 'Dano'}</RollButton>
                        {!ro && <Pencil on={editing} onClick={() => toggleEdit(`atk:${at.id}`)} label={`ataque ${at.name}`} />}
                      </span>
                    </div>
                    {at.text && !editing && <p className="dcm-atk__text">{at.text}</p>}
                    {editing && (
                      <div className="dcm-edit">
                        <TextIn label="Nome" value={at.name} onChange={(x) => patchAttack(at.id, { name: x })} max={80} />
                        <label className="dcm-f"><span>Tipo</span>
                          <select className="dsh-input" value={at.kind} onChange={(e) => patchAttack(at.id, { kind: e.target.value as 'melee' | 'ranged' })}><option value="melee">Corpo a corpo</option><option value="ranged">À distância</option></select>
                        </label>
                        {at.kind === 'melee' ? <NumIn label="Alcance (pés)" value={at.reach_ft} onChange={(n) => patchAttack(at.id, { reach_ft: n })} max={300} /> : (<>
                          <NumIn label="Alcance normal (pés)" value={at.range_ft} onChange={(n) => patchAttack(at.id, { range_ft: n })} max={2000} />
                          <NumIn label="Alcance longo (pés)" value={at.range_long_ft} onChange={(n) => patchAttack(at.id, { range_long_ft: n })} max={4000} />
                        </>)}
                        <label className="dcm-f"><span>Efeito</span>
                          <select className="dsh-input" value={at.save || 'attack'} onChange={(e) => patchAttack(at.id, { save: e.target.value === 'attack' ? '' : (e.target.value as AbilityKey) })}>
                            <option value="attack">Jogada de ataque</option>
                            {ABILITY_KEYS.map((k) => <option key={k} value={k}>Salvaguarda de {ABILITY_NAME[k]}</option>)}
                          </select>
                        </label>
                        {at.save ? <NumIn label="CD (0 = a de magia)" value={at.dc} onChange={(n) => patchAttack(at.id, { dc: n })} max={40} /> : (<>
                          <label className="dcm-f"><span>Bônus de acerto</span>
                            <select className="dsh-input" value={at.hit_mode} onChange={(e) => patchAttack(at.id, { hit_mode: e.target.value as 'spell' | 'fixed' })}><option value="fixed">Número fixo</option><option value="spell">Ataque de magia do dono</option></select>
                          </label>
                          {at.hit_mode === 'fixed' && <NumIn label="Acerto" value={at.hit} onChange={(n) => patchAttack(at.id, { hit: n })} min={-20} max={40} />}
                          <label className="dcm-f dcm-f--inline"><input type="checkbox" checked={at.hit_pb} onChange={(e) => patchAttack(at.id, { hit_pb: e.target.checked })} /><span>Soma a proficiência ao acerto</span></label>
                        </>)}
                        <TextIn label="Dados do dano (ex.: 1d8)" value={at.dice} onChange={(x) => patchAttack(at.id, { dice: x.replace(/[^0-9d+]/gi, '') })} max={30} />
                        <NumIn label="Dano fixo" value={at.dmg} onChange={(n) => patchAttack(at.id, { dmg: n })} min={-50} max={200} />
                        <label className="dcm-f dcm-f--inline"><input type="checkbox" checked={at.dmg_pb} onChange={(e) => patchAttack(at.id, { dmg_pb: e.target.checked })} /><span>Soma a proficiência ao dano</span></label>
                        <TextIn label="Tipo de dano" value={at.type} onChange={(x) => patchAttack(at.id, { type: x })} max={40} />
                        <TextIn label="Efeito extra" value={at.text} onChange={(x) => patchAttack(at.id, { text: x })} max={600} wide />
                        <button type="button" className="dsh-chip dsh-chip--bad dcm-del" onClick={() => { onChange((x) => ({ ...x, attacks: x.attacks.filter((k) => k.id !== at.id) })); setEdit(null) }}>Remover ataque</button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </Section>

          {/* Habilidades */}
          <Section title="Habilidades" aside={!ro ? <button type="button" className="dcm-link" onClick={() => { const t = blankTrait(); onChange((x) => ({ ...x, traits: [...x.traits, t].slice(0, 24) })); setEdit(`trait:${t.id}`) }} disabled={c.traits.length >= 24}>+ Adicionar</button> : undefined}>
            {c.traits.length === 0 && <p className="dcm-text dcm-text--muted">Nenhuma habilidade.</p>}
            {TRAIT_KINDS.map((kind) => {
              const rows = c.traits.filter((t) => t.kind === kind)
              if (!rows.length) return null
              return (
                <div key={kind} className="dcm-tgroup">
                  <h6>{TRAIT_LABEL[kind]}{rows.length > 1 && kind !== 'trait' ? 's' : kind === 'trait' && rows.length > 1 ? 's' : ''}</h6>
                  <ul>
                    {rows.map((t) => {
                      const editing = edit === `trait:${t.id}`
                      return (
                        <li key={t.id} className="dcm-trait">
                          <div className="dcm-trait__head">
                            <b>{t.name}</b>
                            {t.uses_max > 0 && <span className="dcm-trait__uses"><Pips total={t.uses_max} filled={t.uses_max - t.uses_used} onChange={ro ? undefined : (n) => patchTrait(t.id, { uses_used: t.uses_max - n })} label={`Usos de ${t.name}`} size="sm" /><small>{t.recharge === 'short' ? 'desc. curto' : 'desc. longo'}</small></span>}
                            {!ro && <Pencil on={editing} onClick={() => toggleEdit(`trait:${t.id}`)} label={`habilidade ${t.name}`} />}
                          </div>
                          {!editing && t.text && <p className="dcm-trait__text">{t.text}</p>}
                          {editing && (
                            <div className="dcm-edit">
                              <TextIn label="Nome" value={t.name} onChange={(x) => patchTrait(t.id, { name: x })} max={80} />
                              <label className="dcm-f"><span>Quando serve</span>
                                <select className="dsh-input" value={t.kind} onChange={(e) => patchTrait(t.id, { kind: e.target.value as Companion['traits'][number]['kind'] })}>{TRAIT_KINDS.map((k) => <option key={k} value={k}>{TRAIT_LABEL[k]}</option>)}</select>
                              </label>
                              <NumIn label="Usos (0 = sem limite)" value={t.uses_max} onChange={(n) => patchTrait(t.id, { uses_max: n, uses_used: Math.min(t.uses_used, n) })} max={99} />
                              <label className="dcm-f"><span>Recarrega em</span>
                                <select className="dsh-input" value={t.recharge} onChange={(e) => patchTrait(t.id, { recharge: e.target.value as 'short' | 'long' })}><option value="long">Descanso longo</option><option value="short">Descanso curto</option></select>
                              </label>
                              <label className="dcm-f dcm-f--wide"><span>Descrição</span>
                                <textarea className="dsh-input dsh-textarea dsh-textarea--sm" rows={4} maxLength={2000} value={t.text} onChange={(e) => patchTrait(t.id, { text: e.target.value })} />
                              </label>
                              <button type="button" className="dsh-chip dsh-chip--bad dcm-del" onClick={() => { onChange((x) => ({ ...x, traits: x.traits.filter((k) => k.id !== t.id) })); setEdit(null) }}>Remover habilidade</button>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </Section>

          {/* Defesas e sentidos */}
          <Section title="Defesas e sentidos" edit={!ro && <Pencil on={edit === 'def'} onClick={() => toggleEdit('def')} label="defesas e sentidos" />}>
            {edit === 'def' ? (
              <div className="dcm-edit">
                <TextIn label="Sentidos" value={c.senses} onChange={(x) => set('senses', x)} max={200} wide />
                <TextIn label="Idiomas" value={c.languages} onChange={(x) => set('languages', x)} max={200} wide />
                <TextIn label="Resistências a dano" value={c.resistances} onChange={(x) => set('resistances', x)} max={200} wide />
                <TextIn label="Imunidades a dano" value={c.immunities} onChange={(x) => set('immunities', x)} max={200} wide />
                <TextIn label="Imunidades a condições" value={c.condition_immunities} onChange={(x) => set('condition_immunities', x)} max={200} wide />
              </div>
            ) : (
              <dl className="dcm-facts">
                {([['Sentidos', c.senses], ['Idiomas', c.languages], ['Resistências', c.resistances], ['Imunidades a dano', c.immunities], ['Imunidades a condições', c.condition_immunities]] as const).filter(([, t]) => t).map(([k, t]) => (<div key={k}><dt>{k}</dt><dd>{t}</dd></div>))}
                {!c.senses && !c.languages && !c.resistances && !c.immunities && !c.condition_immunities && <p className="dcm-text dcm-text--muted">Nada anotado.</p>}
              </dl>
            )}
          </Section>

          {/* Condições */}
          <Section title="Condições">
            <div className="dcm-conds" role="group" aria-label="Condições do companheiro">
              {CONDITIONS.map((cd) => {
                const on = c.conditions.includes(cd.key)
                return <button key={cd.key} type="button" className={`dcm-cond${on ? ' is-on' : ''}`} aria-pressed={on} disabled={ro} title={cd.summary} onClick={() => onChange((x) => ({ ...x, conditions: on ? x.conditions.filter((k) => k !== cd.key) : [...x.conditions, cd.key] }))}>{cd.name}</button>
              })}
            </div>
          </Section>

          <Section title="Anotações">
            <textarea className="dsh-input dsh-textarea" rows={4} maxLength={4000} readOnly={ro} value={c.notes} placeholder="Temperamento, história, truques, o que o Mestre combinou..." aria-label={`Anotações de ${name}`} onChange={(e) => set('notes', e.target.value)} />
          </Section>

          {!ro && <div className="dcm-foot"><button type="button" className="dsh-chip dsh-chip--bad" onClick={onRemove}>Remover companheiro</button></div>}
        </div>
      )}
    </article>
  )
}

/**
 * A foto do companheiro: um círculo no alto do cartão, à esquerda, no mesmo lugar e do mesmo jeito da foto do companheiro de
 * Altherium (clicar troca, o × tira, e antes de enviar abre o ajuste de enquadramento).
 */
function CompanionPhoto({ c, ro, sheetId, report, onPhoto }: { c: Companion; ro: boolean; sheetId: string; report: (m: string | null) => void; onPhoto: (url: string | null) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!DND_PORTRAIT_TYPES.includes(f.type as (typeof DND_PORTRAIT_TYPES)[number])) { report('Escolha uma imagem JPG, PNG ou WebP.'); return }
    if (f.size > DND_PORTRAIT_PICK_MAX_BYTES) { report('A imagem deve ter no máximo 10 MB.'); return }
    report(null)
    setDraft(f)
  }
  const save = async (file: File) => {
    setBusy(true)
    try { onPhoto(await uploadDndCompanionPhoto(sheetId, c.id, file)); setDraft(null) }
    catch (err) { setDraft(null); report(err instanceof Error ? err.message : 'Não deu pra enviar a foto.') }
    finally { setBusy(false) }
  }
  const drop = async () => {
    setBusy(true)
    try { await removeDndCompanionPhoto(sheetId, c.id); onPhoto(null) }
    catch (err) { report(err instanceof Error ? err.message : 'Não deu pra remover a foto.') }
    finally { setBusy(false) }
  }
  const name = c.name.trim() || c.species || 'companheiro'
  return (
    <div className="dcm-photo-wrap">
      <label className={`dcm-photo${ro ? ' is-ro' : ''}`}>
        {c.photo_url ? <img src={c.photo_url} alt={`Foto de ${name}`} /> : <span className="dcm-photo__tag" aria-hidden="true">{KIND_TAG[c.kind]}</span>}
        {!ro && <span className="dcm-photo__over">{c.photo_url ? 'Trocar foto' : 'Adicionar foto'}</span>}
        {!ro && <input ref={fileRef} type="file" hidden accept={DND_PORTRAIT_TYPES.join(',')} disabled={busy} onChange={pick} aria-label={`Foto de ${name}`} />}
      </label>
      {c.photo_url && !ro && <button type="button" className="dcm-photo__x" onClick={() => void drop()} disabled={busy} aria-label={`Remover a foto de ${name}`}>×</button>}
      <Presence show={!!draft} exitMs={220}>
        {() => draft && (
          <AvatarCropEditor
            file={draft} saving={busy} onCancel={() => setDraft(null)} onSave={save}
            title="Ajustar foto do companheiro" description="Escolha o enquadramento que aparece no cartão do companheiro." confirmLabel="Usar esta foto"
          />
        )}
      </Presence>
    </div>
  )
}

function Tile({ label, value, wide, hint }: { label: string; value: string; wide?: boolean; hint?: string }) {
  return <div className={`dcm-tile${wide ? ' dcm-tile--wide' : ''}`} title={hint}><span className="dcm-tile__k">{label}</span><span className="dcm-tile__v">{value}</span></div>
}
