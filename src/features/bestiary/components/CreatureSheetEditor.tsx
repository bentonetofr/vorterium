import { ABILITY_KINDS, SHEET_LIMITS, STRIKE_TYPES, emptyAbility, emptyStrike } from '../utils/creatureSheet'
import type { CreatureAbility, CreatureAbilityKind, CreatureSheet, CreatureStrike } from '../../../shared/types'
import './CreatureSheet.css'

// ────────────────────────────────────────────────────────
// Campos da ficha detalhada da criatura (classificação, descrição, Ataque, Defesa, DB, Movimento, golpes e habilidades). É só
// texto de mesa: não entra em nenhuma conta do bestiário. Vale pro bestiário da campanha e pro Meu bestiário.
// ────────────────────────────────────────────────────────

const TIER_SUGGESTIONS = ['Inimigo Fraco', 'Inimigo Comum', 'Inimigo Forte', 'Inimigo Extremamente Forte', 'Chefe', 'Chefe Lendário']

interface Props {
  value:     CreatureSheet
  onChange:  (next: CreatureSheet) => void
  disabled?: boolean
  /** `intro` = só Apresentação; `rest` = Combate, Golpes e Habilidades; sem isso, tudo. */
  part?:     'intro' | 'rest'
}

export function CreatureSheetEditor({ value, onChange, disabled, part }: Props) {
  const showIntro = part !== 'rest'
  const showRest = part !== 'intro'
  const strikes = value.strikes ?? []
  const abilities = value.abilities ?? []
  const set = (patch: Partial<CreatureSheet>) => onChange({ ...value, ...patch })

  function setStrike(i: number, patch: Partial<CreatureStrike>) {
    set({ strikes: strikes.map((s, k) => (k === i ? { ...s, ...patch } : s)) })
  }
  function setAbility(i: number, patch: Partial<CreatureAbility>) {
    set({ abilities: abilities.map((a, k) => (k === i ? { ...a, ...patch } : a)) })
  }
  function moveAbility(i: number, d: -1 | 1) {
    const j = i + d
    if (j < 0 || j >= abilities.length) return
    const next = [...abilities]
    ;[next[i], next[j]] = [next[j], next[i]]
    set({ abilities: next })
  }

  return (
    <div className="cs-editor">
      {/* Apresentação */}
      {showIntro && <fieldset className="cs-section" disabled={disabled}>
        <legend className="cs-section__title">Apresentação</legend>
        <div className="cs-field">
          <label className="cs-label" htmlFor="cs-tier">Classificação</label>
          <input
            id="cs-tier" className="input" list="cs-tier-list" value={value.tier ?? ''} maxLength={SHEET_LIMITS.tier}
            placeholder="Inimigo Extremamente Forte" onChange={(e) => set({ tier: e.target.value })}
          />
          <datalist id="cs-tier-list">{TIER_SUGGESTIONS.map((t) => <option key={t} value={t} />)}</datalist>
        </div>
        <div className="cs-field">
          <label className="cs-label" htmlFor="cs-lore">Descrição</label>
          <textarea
            id="cs-lore" className="input cs-textarea" rows={3} value={value.lore ?? ''} maxLength={SHEET_LIMITS.lore}
            placeholder="O morador do monte mais antigo. Por séculos devorou quem entrou em seu túmulo…" onChange={(e) => set({ lore: e.target.value })}
          />
          <span className="cs-count">{(value.lore ?? '').length}/{SHEET_LIMITS.lore}</span>
        </div>
      </fieldset>}

      {/* Combate */}
      {showRest && <fieldset className="cs-section" disabled={disabled}>
        <legend className="cs-section__title">Combate</legend>
        <div className="cs-grid">
          <div className="cs-field">
            <label className="cs-label" htmlFor="cs-attack">Ataque</label>
            <input id="cs-attack" className="input cs-mono" value={value.attack ?? ''} maxLength={SHEET_LIMITS.stat} placeholder="3d10 + 4 (Luta)" onChange={(e) => set({ attack: e.target.value })} />
          </div>
          <div className="cs-field">
            <label className="cs-label" htmlFor="cs-defense">Defesa</label>
            <input id="cs-defense" className="input cs-mono" value={value.defense ?? ''} maxLength={SHEET_LIMITS.stat} placeholder="2d10 + 3" onChange={(e) => set({ defense: e.target.value })} />
          </div>
          <div className="cs-field">
            <label className="cs-label" htmlFor="cs-db">DB</label>
            <input id="cs-db" className="input" value={value.db ?? ''} maxLength={SHEET_LIMITS.stat} placeholder="4 no corpo todo (pele dura como casca)" onChange={(e) => set({ db: e.target.value })} />
          </div>
          <div className="cs-field">
            <label className="cs-label" htmlFor="cs-move">Movimento</label>
            <input id="cs-move" className="input" value={value.movement ?? ''} maxLength={SHEET_LIMITS.stat} placeholder="5 metros (lento)" onChange={(e) => set({ movement: e.target.value })} />
          </div>
        </div>
        <p className="cs-hint">Vida e Dano por rodada ficam nos campos acima, com a conta do grupo. Estes aqui são só a ficha de mesa.</p>
      </fieldset>}

      {/* Golpes */}
      {showRest && <fieldset className="cs-section" disabled={disabled}>
        <legend className="cs-section__title">Golpes</legend>
        {strikes.length === 0 && <p className="cs-empty">Nenhum golpe. Ex.: Garras 2d8 (C), Mordida 2d6 (P).</p>}
        {strikes.map((s, i) => (
          <div key={i} className="cs-row">
            <input className="input cs-row__name" aria-label={`Nome do golpe ${i + 1}`} value={s.name} maxLength={SHEET_LIMITS.strikeName} placeholder="Garras" onChange={(e) => setStrike(i, { name: e.target.value })} />
            <input className="input cs-row__dice cs-mono" aria-label={`Dados do golpe ${i + 1}`} value={s.dice} maxLength={SHEET_LIMITS.strikeDice} placeholder="2d8" onChange={(e) => setStrike(i, { dice: e.target.value })} />
            <input className="input cs-row__type" aria-label={`Tipo do golpe ${i + 1}`} list="cs-type-list" value={s.type} maxLength={SHEET_LIMITS.strikeType} placeholder="C" onChange={(e) => setStrike(i, { type: e.target.value })} />
            <button type="button" className="cs-icon-btn" aria-label={`Tirar o golpe ${i + 1}`} onClick={() => set({ strikes: strikes.filter((_, k) => k !== i) })}>✕</button>
          </div>
        ))}
        <datalist id="cs-type-list">{STRIKE_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
        {strikes.length < SHEET_LIMITS.strikes && (
          <button type="button" className="btn btn-ghost cs-add" onClick={() => set({ strikes: [...strikes, emptyStrike()] })}>+ Golpe</button>
        )}
      </fieldset>}

      {/* Habilidades */}
      {showRest && <fieldset className="cs-section" disabled={disabled}>
        <legend className="cs-section__title">Habilidades</legend>
        {abilities.length === 0 && <p className="cs-empty">Nenhuma habilidade. Passivas, ações, reações e regras próprias da criatura.</p>}
        {abilities.map((a, i) => (
          <div key={i} className={`cs-ability cs-ability--${a.kind}`}>
            <div className="cs-ability__top">
              <select className="input cs-ability__kind" aria-label={`Tipo da habilidade ${i + 1}`} value={a.kind} onChange={(e) => setAbility(i, { kind: e.target.value as CreatureAbilityKind })}>
                {ABILITY_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
              <input className="input cs-ability__name" aria-label={`Nome da habilidade ${i + 1}`} value={a.name} maxLength={SHEET_LIMITS.abilityName} placeholder="Agarrar" onChange={(e) => setAbility(i, { name: e.target.value })} />
              <input className="input cs-ability__uses" aria-label={`Limite de uso da habilidade ${i + 1}`} value={a.uses} maxLength={SHEET_LIMITS.abilityUses} placeholder="1x por cena" onChange={(e) => setAbility(i, { uses: e.target.value })} />
              <span className="cs-ability__tools">
                <button type="button" className="cs-icon-btn" aria-label="Subir" disabled={i === 0} onClick={() => moveAbility(i, -1)}>↑</button>
                <button type="button" className="cs-icon-btn" aria-label="Descer" disabled={i === abilities.length - 1} onClick={() => moveAbility(i, 1)}>↓</button>
                <button type="button" className="cs-icon-btn" aria-label={`Tirar a habilidade ${i + 1}`} onClick={() => set({ abilities: abilities.filter((_, k) => k !== i) })}>✕</button>
              </span>
            </div>
            <textarea className="input cs-textarea" rows={3} aria-label={`Texto da habilidade ${i + 1}`} value={a.text} maxLength={SHEET_LIMITS.abilityText} placeholder="O que ela faz, as DTs e o que acontece quando funciona." onChange={(e) => setAbility(i, { text: e.target.value })} />
          </div>
        ))}
        {abilities.length < SHEET_LIMITS.abilities && (
          <div className="cs-quickadd" role="group" aria-label="Acrescentar habilidade">
            {ABILITY_KINDS.map((k) => (
              <button key={k.id} type="button" className="btn btn-ghost cs-add" title={k.hint} onClick={() => set({ abilities: [...abilities, emptyAbility(k.id)] })}>+ {k.label}</button>
            ))}
          </div>
        )}
      </fieldset>}
    </div>
  )
}
