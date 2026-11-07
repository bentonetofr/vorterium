import { useState } from 'react'
import { Select } from '../../../shared/components/Select'
import {
  ABILITY_KINDS, DAMAGE_KINDS, SHEET_LIMITS, TIER_SUGGESTIONS, parseTags, sheetIsEmpty,
} from '../utils/creatureSheet'
import type { CreatureAbility, CreatureAbilityKind, CreatureAttack, CreatureSheet } from '../../../shared/types'
import './CreatureSheet.css'

interface Props {
  value:    CreatureSheet
  onChange: (next: CreatureSheet) => void
  disabled?: boolean
}

const KIND_OPTIONS = ABILITY_KINDS.map((k) => ({ value: k.id, label: k.label }))

/** Campos de texto da ficha: título, descrição, Ataque/Defesa/DB, golpes e habilidades. */
export function CreatureSheetEditor({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(!sheetIsEmpty(value))
  // As tags ficam como texto enquanto se digita (a vírgula não some no meio).
  const [tagsText, setTagsText] = useState(value.tags.join(', '))
  const set = <K extends keyof CreatureSheet>(key: K, v: CreatureSheet[K]) => onChange({ ...value, [key]: v })

  function setAttack(i: number, patch: Partial<CreatureAttack>) {
    set('attacks', value.attacks.map((a, j) => (j === i ? { ...a, ...patch } : a)))
  }
  function setAbility(i: number, patch: Partial<CreatureAbility>) {
    set('abilities', value.abilities.map((a, j) => (j === i ? { ...a, ...patch } : a)))
  }
  function moveAbility(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= value.abilities.length) return
    const next = [...value.abilities]
    ;[next[i], next[j]] = [next[j], next[i]]
    set('abilities', next)
  }

  return (
    <div className="csheet-ed">
      <button type="button" className="csheet-ed__toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span>Ficha da criatura</span>
        <small>título, descrição, Ataque, Defesa, DB, golpes e habilidades</small>
        <span className="csheet-ed__chev" aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="csheet-ed__body">
          {/* Título e descrição */}
          <div className="csheet-ed__field">
            <label className="csheet-ed__label" htmlFor="cs-tier">Título</label>
            <input
              id="cs-tier" className="input" value={value.tier} maxLength={SHEET_LIMITS.tier} disabled={disabled}
              placeholder="Inimigo Extremamente Forte" onChange={(e) => set('tier', e.target.value)}
            />
            <div className="csheet-ed__chips">
              {TIER_SUGGESTIONS.map((t) => (
                <button key={t} type="button" className="csheet-ed__chip" disabled={disabled} onClick={() => set('tier', t)}>{t}</button>
              ))}
            </div>
          </div>

          <div className="csheet-ed__field">
            <label className="csheet-ed__label" htmlFor="cs-lore">Descrição</label>
            <textarea
              id="cs-lore" className="input csheet-ed__area" rows={3} value={value.lore} maxLength={SHEET_LIMITS.lore} disabled={disabled}
              placeholder="O morador do monte mais antigo. Por séculos devorou quem entrou em seu túmulo…"
              onChange={(e) => set('lore', e.target.value)}
            />
          </div>

          <div className="csheet-ed__field">
            <label className="csheet-ed__label" htmlFor="cs-tags">Marcas <small>separadas por vírgula</small></label>
            <input
              id="cs-tags" className="input" value={tagsText} disabled={disabled} placeholder="Morto-vivo, Grande, Antigo"
              onChange={(e) => { setTagsText(e.target.value); set('tags', parseTags(e.target.value)) }}
            />
          </div>

          {/* Números */}
          <div className="csheet-ed__grid">
            <div className="csheet-ed__field">
              <label className="csheet-ed__label" htmlFor="cs-attack">Ataque</label>
              <input id="cs-attack" className="input" value={value.attack} maxLength={SHEET_LIMITS.stat} disabled={disabled}
                placeholder="3d10 + 4 (Luta)" onChange={(e) => set('attack', e.target.value)} />
            </div>
            <div className="csheet-ed__field">
              <label className="csheet-ed__label" htmlFor="cs-defense">Defesa</label>
              <input id="cs-defense" className="input" value={value.defense} maxLength={SHEET_LIMITS.stat} disabled={disabled}
                placeholder="2d10 + 3" onChange={(e) => set('defense', e.target.value)} />
            </div>
            <div className="csheet-ed__field csheet-ed__field--full">
              <label className="csheet-ed__label" htmlFor="cs-db">DB</label>
              <input id="cs-db" className="input" value={value.db} maxLength={SHEET_LIMITS.stat} disabled={disabled}
                placeholder="4 no corpo todo (pele dura)" onChange={(e) => set('db', e.target.value)} />
            </div>
            <div className="csheet-ed__field csheet-ed__field--full">
              <label className="csheet-ed__label" htmlFor="cs-move">Movimento</label>
              <input id="cs-move" className="input" value={value.movement} maxLength={SHEET_LIMITS.movement} disabled={disabled}
                placeholder="5 metros (lento)" onChange={(e) => set('movement', e.target.value)} />
            </div>
          </div>
          <p className="csheet-ed__hint">Vida e Dano continuam sendo os campos acima, com as contas do grupo. Estes aqui são só texto da ficha.</p>

          {/* Ataques */}
          <div className="csheet-ed__field">
            <span className="csheet-ed__label">Ataques</span>
            <datalist id="cs-kinds">{DAMAGE_KINDS.map((k) => <option key={k} value={k} />)}</datalist>
            {value.attacks.map((a, i) => (
              <div key={i} className="csheet-ed__attack">
                <input className="input" aria-label="Nome do golpe" placeholder="Garras" value={a.name} maxLength={SHEET_LIMITS.attackName}
                  disabled={disabled} onChange={(e) => setAttack(i, { name: e.target.value })} />
                <input className="input" aria-label="Dado do golpe" placeholder="2d8" value={a.dice} maxLength={SHEET_LIMITS.attackDice}
                  disabled={disabled} onChange={(e) => setAttack(i, { dice: e.target.value })} />
                <input className="input" aria-label="Tipo de dano" placeholder="C" list="cs-kinds" value={a.kind} maxLength={SHEET_LIMITS.attackKind}
                  disabled={disabled} onChange={(e) => setAttack(i, { kind: e.target.value })} />
                <button type="button" className="csheet-ed__x" aria-label="Remover golpe" disabled={disabled}
                  onClick={() => set('attacks', value.attacks.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            {value.attacks.length < SHEET_LIMITS.attacks && (
              <button type="button" className="btn btn-ghost csheet-ed__add" disabled={disabled}
                onClick={() => set('attacks', [...value.attacks, { name: '', dice: '', kind: '' }])}>+ Golpe</button>
            )}
          </div>

          {/* Habilidades */}
          <div className="csheet-ed__field">
            <span className="csheet-ed__label">Habilidades</span>
            {value.abilities.map((a, i) => (
              <div key={i} className={`csheet-ed__ability csheet-ability--${a.kind}`}>
                <div className="csheet-ed__ability-top">
                  <input className="input" aria-label="Nome da habilidade" placeholder="Agarrar" value={a.name} maxLength={SHEET_LIMITS.abilityName}
                    disabled={disabled} onChange={(e) => setAbility(i, { name: e.target.value })} />
                  <Select value={a.kind} aria-label="Uso da habilidade" disabled={disabled} options={KIND_OPTIONS}
                    onChange={(v) => setAbility(i, { kind: v as CreatureAbilityKind })} />
                  <input className="input" aria-label="Frequência" placeholder="1x por cena" value={a.freq} maxLength={SHEET_LIMITS.abilityFreq}
                    disabled={disabled} onChange={(e) => setAbility(i, { freq: e.target.value })} />
                </div>
                <textarea className="input csheet-ed__area" rows={3} aria-label="Texto da habilidade" value={a.text} maxLength={SHEET_LIMITS.abilityText}
                  disabled={disabled} placeholder="O que ela faz. Linhas com “-” viram lista; dados e DT ganham destaque."
                  onChange={(e) => setAbility(i, { text: e.target.value })} />
                <div className="csheet-ed__ability-actions">
                  <button type="button" className="csheet-ed__mini" disabled={disabled || i === 0} onClick={() => moveAbility(i, -1)}>↑ Subir</button>
                  <button type="button" className="csheet-ed__mini" disabled={disabled || i === value.abilities.length - 1} onClick={() => moveAbility(i, 1)}>↓ Descer</button>
                  <button type="button" className="csheet-ed__mini csheet-ed__mini--danger" disabled={disabled}
                    onClick={() => set('abilities', value.abilities.filter((_, j) => j !== i))}>Remover</button>
                </div>
              </div>
            ))}
            {value.abilities.length < SHEET_LIMITS.abilities && (
              <button type="button" className="btn btn-ghost csheet-ed__add" disabled={disabled}
                onClick={() => set('abilities', [...value.abilities, { name: '', kind: 'padrao', freq: '', text: '' }])}>+ Habilidade</button>
            )}
          </div>

          {/* Táticas e fraquezas */}
          <div className="csheet-ed__field">
            <label className="csheet-ed__label" htmlFor="cs-tactics">Táticas</label>
            <textarea id="cs-tactics" className="input csheet-ed__area" rows={2} value={value.tactics} maxLength={SHEET_LIMITS.tactics} disabled={disabled}
              placeholder="Como joga: mira em quem está sozinho, recua quando um rosto cai…" onChange={(e) => set('tactics', e.target.value)} />
          </div>
          <div className="csheet-ed__field">
            <label className="csheet-ed__label" htmlFor="cs-weak">Fraquezas e resistências</label>
            <textarea id="cs-weak" className="input csheet-ed__area" rows={2} value={value.weak} maxLength={SHEET_LIMITS.weak} disabled={disabled}
              placeholder="Fraco a fogo; imune a veneno" onChange={(e) => set('weak', e.target.value)} />
          </div>
        </div>
      )}
    </div>
  )
}
