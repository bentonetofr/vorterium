// ────────────────────────────────────────────────────────
// Painel de Ficha D&D 5e — edição direta, dados reais
// ────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react'
import { ensureMyDndSheet, getDndSheetDetails, removeDndOverride, saveDndOverride, updateDndSheet } from './services/dndSheetService'
import { rollDice } from '../../dice/services/diceService'
import {
  getAbilityModifier,
  formatModifier,
  getSavingThrowBonus,
  buildRollFormula,
  getInitiativeBonus,
  getProficiencyBonus,
  getSpellAttackBonus,
  getSpellSaveDc,
} from './utils/dndCalculations'
import type { DndCharacterSheet, DndCharacterSheetUpdateInput, DndDerivedField, DndSheetDetails } from '../../../shared/types'
import { DndAttacksEditor, DndInventoryEditor, DndSkillsEditor, DndSpellsEditor } from './DndDetailsEditors'
import './DndCharacterSheet.css'
import { Loader } from '../../../shared/components/Loader'

// ────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────

interface DndCharacterSheetPanelProps {
  campaignId:    string
  currentUserId: string
}

// ────────────────────────────────────────────────────────
// Draft — todos os campos editáveis
// Numéricos como string para permitir digitação livre;
// booleans e inteiros diretos onde não há problema.
// ────────────────────────────────────────────────────────

interface DndDraft {
  // Personagem
  character_name: string
  player_name:    string
  class_name:     string
  subclass:       string
  race:           string
  background:     string
  alignment:      string
  // Progressão
  level:          string
  experience:     string
  inspiration:    boolean
  // Combate
  armor_class:       string
  initiative_bonus:  string
  speed:             string
  proficiency_bonus: string
  // HP
  hp_current: string
  hp_max:     string
  hp_temp:    string
  // Atributos
  strength:     string
  dexterity:    string
  constitution: string
  intelligence: string
  wisdom:       string
  charisma:     string
  // Proficiências de salvaguarda
  strength_save_proficient:     boolean
  dexterity_save_proficient:    boolean
  constitution_save_proficient: boolean
  intelligence_save_proficient: boolean
  wisdom_save_proficient:       boolean
  charisma_save_proficient:     boolean
  // Salvaguardas mortais
  death_save_successes: number
  death_save_failures:  number
  // Conjuração
  spellcasting_ability: string
  spell_save_dc:        string
  spell_attack_bonus:   string
  // Narrativa
  notes:              string
  backstory:          string
  personality_traits: string
  ideals:             string
  bonds:              string
  flaws:              string
}

function sheetToDraft(s: DndCharacterSheet): DndDraft {
  return {
    character_name:               s.character_name               ?? '',
    player_name:                  s.player_name                  ?? '',
    class_name:                   s.class_name                   ?? '',
    subclass:                     s.subclass                     ?? '',
    race:                         s.race                         ?? '',
    background:                   s.background                   ?? '',
    alignment:                    s.alignment                    ?? '',
    level:                        String(s.level),
    experience:                   String(s.experience),
    inspiration:                  s.inspiration,
    armor_class:                  String(s.armor_class),
    initiative_bonus:             String(s.initiative_bonus),
    speed:                        String(s.speed),
    proficiency_bonus:            String(s.proficiency_bonus),
    hp_current:                   String(s.hp_current),
    hp_max:                       String(s.hp_max),
    hp_temp:                      String(s.hp_temp),
    strength:                     String(s.strength),
    dexterity:                    String(s.dexterity),
    constitution:                 String(s.constitution),
    intelligence:                 String(s.intelligence),
    wisdom:                       String(s.wisdom),
    charisma:                     String(s.charisma),
    strength_save_proficient:     s.strength_save_proficient,
    dexterity_save_proficient:    s.dexterity_save_proficient,
    constitution_save_proficient: s.constitution_save_proficient,
    intelligence_save_proficient: s.intelligence_save_proficient,
    wisdom_save_proficient:       s.wisdom_save_proficient,
    charisma_save_proficient:     s.charisma_save_proficient,
    death_save_successes:         s.death_save_successes,
    death_save_failures:          s.death_save_failures,
    spellcasting_ability:         s.spellcasting_ability         ?? '',
    spell_save_dc:                s.spell_save_dc   != null ? String(s.spell_save_dc)   : '',
    spell_attack_bonus:           s.spell_attack_bonus != null ? String(s.spell_attack_bonus) : '',
    notes:                        s.notes                        ?? '',
    backstory:                    s.backstory                    ?? '',
    personality_traits:           s.personality_traits           ?? '',
    ideals:                       s.ideals                       ?? '',
    bonds:                        s.bonds                        ?? '',
    flaws:                        s.flaws                        ?? '',
  }
}

const AUTO_FIELDS: DndDerivedField[] = [
  'proficiency_bonus',
  'initiative_bonus',
  'spell_save_dc',
  'spell_attack_bonus',
]

function DerivedModeButton({ field, automatic, onToggle }: { field: DndDerivedField; automatic: boolean; onToggle: (field: DndDerivedField) => void }) {
  return (
    <button
      type="button"
      className={`dnd-derived-mode${automatic ? ' dnd-derived-mode--auto' : ''}`}
      onClick={() => onToggle(field)}
      title={automatic ? 'Usando cálculo do Livro do Jogador. Clique para editar manualmente.' : 'Valor manual. Clique para restaurar o cálculo automático.'}
    >
      {automatic ? 'AUTO' : 'MANUAL'}
    </button>
  )
}

function spellcastingScore(draft: DndDraft): number | null {
  const key = draft.spellcasting_ability.trim().toLowerCase()
  const scores: Record<string, string> = {
    for: 'strength', str: 'strength', força: 'strength',
    des: 'dexterity', dex: 'dexterity', destreza: 'dexterity',
    con: 'constitution', constituição: 'constitution',
    int: 'intelligence', inteligência: 'intelligence',
    sab: 'wisdom', wis: 'wisdom', sabedoria: 'wisdom',
    car: 'charisma', cha: 'charisma', carisma: 'charisma',
  }
  const field = scores[key]
  return field ? Number(draft[field as keyof DndDraft]) : null
}

function applyAutomaticValues(draft: DndDraft, overrides: DndSheetDetails['overrides']): DndDraft {
  const next = { ...draft }
  const manual = new Set(overrides.map((override) => override.field_key))
  const level = Number(draft.level) || 1
  const proficiency = getProficiencyBonus(level)

  if (!manual.has('proficiency_bonus')) next.proficiency_bonus = String(proficiency)
  if (!manual.has('initiative_bonus')) next.initiative_bonus = String(getInitiativeBonus(Number(draft.dexterity) || 10))
  if (!manual.has('spell_save_dc') || !manual.has('spell_attack_bonus')) {
    const score = spellcastingScore(draft)
    if (score != null) {
      if (!manual.has('spell_save_dc')) next.spell_save_dc = String(getSpellSaveDc(proficiency, score))
      if (!manual.has('spell_attack_bonus')) next.spell_attack_bonus = String(getSpellAttackBonus(proficiency, score))
    }
  }
  return next
}

// ────────────────────────────────────────────────────────
// Validação
// ────────────────────────────────────────────────────────

interface FieldErrors { [k: string]: string }

function validateDraft(d: DndDraft): FieldErrors {
  const e: FieldErrors = {}

  if (d.character_name.trim().length > 120)  e.character_name = 'Máximo 120 caracteres.'
  if (d.player_name.trim().length > 120)     e.player_name    = 'Máximo 120 caracteres.'
  if (d.class_name.trim().length > 80)       e.class_name     = 'Máximo 80 caracteres.'
  if (d.subclass.trim().length > 80)         e.subclass       = 'Máximo 80 caracteres.'
  if (d.race.trim().length > 80)             e.race           = 'Máximo 80 caracteres.'
  if (d.background.trim().length > 120)      e.background     = 'Máximo 120 caracteres.'
  if (d.alignment.trim().length > 80)        e.alignment      = 'Máximo 80 caracteres.'

  const level = parseInt(d.level, 10)
  if (isNaN(level) || level < 1 || level > 20) e.level = 'Nível: 1–20.'

  const xp = parseInt(d.experience, 10)
  if (isNaN(xp) || xp < 0) e.experience = 'XP deve ser ≥ 0.'

  const ac = parseInt(d.armor_class, 10)
  if (isNaN(ac) || ac < 0 || ac > 99) e.armor_class = 'CA: 0–99.'

  const init = parseInt(d.initiative_bonus, 10)
  if (isNaN(init) || init < -99 || init > 99) e.initiative_bonus = 'Iniciativa: -99 a 99.'

  const spd = parseInt(d.speed, 10)
  if (isNaN(spd) || spd < 0 || spd > 999) e.speed = 'Deslocamento: 0–999.'

  const pb = parseInt(d.proficiency_bonus, 10)
  if (isNaN(pb) || pb < 0 || pb > 20) e.proficiency_bonus = 'Proficiência: 0–20.'

  const hpMax = parseInt(d.hp_max, 10)
  if (isNaN(hpMax) || hpMax < 1) e.hp_max = 'PV máximo deve ser ≥ 1.'

  const hpCur = parseInt(d.hp_current, 10)
  if (isNaN(hpCur) || hpCur < 0) e.hp_current = 'PV atual deve ser ≥ 0.'

  const hpTmp = parseInt(d.hp_temp, 10)
  if (isNaN(hpTmp) || hpTmp < 0) e.hp_temp = 'PV temp. deve ser ≥ 0.'

  for (const [key, label] of [
    ['strength',     'Força'],
    ['dexterity',    'Destreza'],
    ['constitution', 'Constituição'],
    ['intelligence', 'Inteligência'],
    ['wisdom',       'Sabedoria'],
    ['charisma',     'Carisma'],
  ] as const) {
    const v = parseInt(d[key], 10)
    if (isNaN(v) || v < 1 || v > 30) e[key] = `${label}: 1–30.`
  }

  return e
}

function draftToUpdate(d: DndDraft): DndCharacterSheetUpdateInput {
  return {
    character_name:               d.character_name.trim()       || null,
    player_name:                  d.player_name.trim()          || null,
    class_name:                   d.class_name.trim()           || null,
    subclass:                     d.subclass.trim()             || null,
    race:                         d.race.trim()                 || null,
    background:                   d.background.trim()           || null,
    alignment:                    d.alignment.trim()            || null,
    level:                        parseInt(d.level, 10)         || 1,
    experience:                   parseInt(d.experience, 10)    || 0,
    inspiration:                  d.inspiration,
    armor_class:                  parseInt(d.armor_class, 10)   || 10,
    initiative_bonus:             parseInt(d.initiative_bonus, 10) || 0,
    speed:                        parseInt(d.speed, 10)         || 30,
    proficiency_bonus:            parseInt(d.proficiency_bonus, 10) || 2,
    hp_current:                   parseInt(d.hp_current, 10)    || 0,
    hp_max:                       parseInt(d.hp_max, 10)        || 10,
    hp_temp:                      parseInt(d.hp_temp, 10)       || 0,
    strength:                     parseInt(d.strength, 10)      || 10,
    dexterity:                    parseInt(d.dexterity, 10)     || 10,
    constitution:                 parseInt(d.constitution, 10)  || 10,
    intelligence:                 parseInt(d.intelligence, 10)  || 10,
    wisdom:                       parseInt(d.wisdom, 10)        || 10,
    charisma:                     parseInt(d.charisma, 10)      || 10,
    strength_save_proficient:     d.strength_save_proficient,
    dexterity_save_proficient:    d.dexterity_save_proficient,
    constitution_save_proficient: d.constitution_save_proficient,
    intelligence_save_proficient: d.intelligence_save_proficient,
    wisdom_save_proficient:       d.wisdom_save_proficient,
    charisma_save_proficient:     d.charisma_save_proficient,
    death_save_successes:         d.death_save_successes,
    death_save_failures:          d.death_save_failures,
    spellcasting_ability:         d.spellcasting_ability.trim() || null,
    spell_save_dc:                d.spell_save_dc   ? parseInt(d.spell_save_dc, 10)   : null,
    spell_attack_bonus:           d.spell_attack_bonus ? parseInt(d.spell_attack_bonus, 10) : null,
    notes:                        d.notes.trim()               || null,
    backstory:                    d.backstory.trim()           || null,
    personality_traits:           d.personality_traits.trim()  || null,
    ideals:                       d.ideals.trim()              || null,
    bonds:                        d.bonds.trim()               || null,
    flaws:                        d.flaws.trim()               || null,
  }
}

// ────────────────────────────────────────────────────────
// Tipos internos
// ────────────────────────────────────────────────────────

type TabId = 'resumo' | 'combate' | 'pericias' | 'magias' | 'inventario' | 'tracos' | 'anotacoes'

type SaveStatus = 'idle' | 'success' | 'error'

// ────────────────────────────────────────────────────────
// Helpers de UI
// ────────────────────────────────────────────────────────

function numVal(s: string): number { return parseInt(s, 10) || 0 }

// ────────────────────────────────────────────────────────
// Sub-componente: Banner de alterações não salvas
// ────────────────────────────────────────────────────────

function DirtyBanner({
  saving, onSave, onDiscard,
}: { saving: boolean; onSave: () => void; onDiscard: () => void }) {
  return (
    <div className="dnd-dirty-banner">
      <span className="dnd-dirty-banner__label">✦ Alterações não salvas</span>
      <div className="dnd-dirty-banner__actions">
        <button className="btn btn-ghost btn-sm" onClick={onDiscard} disabled={saving}>
          Descartar
        </button>
        <button className="btn btn-primary btn-sm" onClick={onSave} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Sub-componente: Cabeçalho editável
// ────────────────────────────────────────────────────────

interface HeaderProps {
  draft:    DndDraft
  errors:   FieldErrors
  onChange: (p: Partial<DndDraft>) => void
}

function DndEditableHeader({ draft, errors, onChange }: HeaderProps) {
  return (
    <div className="dnd-header">
      <div className="dnd-header__left" style={{ flex: 1 }}>
        <div className="dnd-header__avatar">⚔</div>
        <div className="dnd-header__info" style={{ flex: 1 }}>
          {/* Nome do personagem */}
          <input
            type="text"
            value={draft.character_name}
            onChange={(e) => onChange({ character_name: e.target.value })}
            placeholder="Nome do personagem"
            className="dnd-header__name-input"
            maxLength={120}
          />
          {errors.character_name && (
            <span style={{ fontSize: 'var(--text-xs)', color: '#e06060' }}>{errors.character_name}</span>
          )}

          {/* Linha de classe / nível */}
          <div className="dnd-header__class-line" style={{ marginTop: 'var(--space-2)' }}>
            <input
              type="text"
              value={draft.class_name}
              onChange={(e) => onChange({ class_name: e.target.value })}
              placeholder="Classe"
              className="dnd-inline-input dnd-header__class"
              style={{ width: '120px', fontFamily: 'var(--font-label)', fontSize: 'var(--text-sm)', fontWeight: 600 }}
              maxLength={80}
            />
            <span className="dnd-header__sep">·</span>
            <input
              type="text"
              value={draft.subclass}
              onChange={(e) => onChange({ subclass: e.target.value })}
              placeholder="Subclasse"
              className="dnd-inline-input dnd-header__subclass"
              style={{ width: '120px' }}
              maxLength={80}
            />
            <span className="dnd-header__sep">·</span>
            <span className="dnd-header__meta-label" style={{ alignSelf: 'center' }}>Nív.</span>
            <input
              type="number"
              min={1} max={20}
              value={draft.level}
              onChange={(e) => onChange({ level: e.target.value })}
              className="dnd-num-input dnd-level-badge"
              style={{ width: '3.5ch', fontFamily: 'var(--font-label)', fontWeight: 700 }}
            />
            {errors.level && (
              <span style={{ fontSize: 'var(--text-xs)', color: '#e06060' }}>{errors.level}</span>
            )}
          </div>

          {/* Campos de identidade — grade */}
          <div className="dnd-header__fields">
            <HeaderField label="Espécie"       value={draft.race}        onChange={(v) => onChange({ race: v })}        maxLength={80}  placeholder="Espécie"     />
            <HeaderField label="Antecedente"   value={draft.background}  onChange={(v) => onChange({ background: v })}  maxLength={120} placeholder="Antecedente" />
            <HeaderField label="Alinhamento"   value={draft.alignment}   onChange={(v) => onChange({ alignment: v })}   maxLength={80}  placeholder="Alinhamento" />
            <HeaderField label="Nome do jogador" value={draft.player_name} onChange={(v) => onChange({ player_name: v })} maxLength={120} placeholder="Jogador"  />
            <div className="dnd-header__field">
              <span className="dnd-header__field-label">XP</span>
              <input
                type="number"
                min={0}
                value={draft.experience}
                onChange={(e) => onChange({ experience: e.target.value })}
                className="dnd-inline-input"
                style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}
              />
              {errors.experience && (
                <span style={{ fontSize: 'var(--text-xs)', color: '#e06060' }}>{errors.experience}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Inspiração */}
      <div className="dnd-header__actions">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)' }}>
          <span className="dnd-header__meta-label">Inspiração</span>
          <button
            type="button"
            className={`dnd-inspiration__gem-btn${draft.inspiration ? ' dnd-inspiration__gem-btn--active' : ''}`}
            onClick={() => onChange({ inspiration: !draft.inspiration })}
            title={draft.inspiration ? 'Desmarcar inspiração' : 'Marcar inspiração'}
          />
        </div>
      </div>
    </div>
  )
}

function HeaderField({
  label, value, onChange, maxLength, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; maxLength: number; placeholder: string }) {
  return (
    <div className="dnd-header__field">
      <span className="dnd-header__field-label">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="dnd-inline-input"
        style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}
        maxLength={maxLength}
      />
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Sub-componente: Coluna esquerda — estatísticas rápidas
// ────────────────────────────────────────────────────────

interface QuickStatsProps {
  draft:    DndDraft
  errors:   FieldErrors
  onChange: (p: Partial<DndDraft>) => void
  automaticFields: Set<DndDerivedField>
  onToggleAutomatic: (field: DndDerivedField) => void
}

function DndQuickStatsColumn({ draft, errors, onChange, automaticFields, onToggleAutomatic }: QuickStatsProps) {
  const hpCur  = numVal(draft.hp_current)
  const hpMax  = numVal(draft.hp_max)
  const hpPct  = hpMax > 0 ? (hpCur / hpMax) * 100 : 0
  const barCls = hpPct <= 25 ? 'dnd-hp-bar--crit' : hpPct <= 50 ? 'dnd-hp-bar--warn' : ''

  const initNum = parseInt(draft.initiative_bonus, 10) || 0
  const initStr = initNum >= 0 ? `+${initNum}` : `${initNum}`

  return (
    <div className="dnd-quick-stats">
      {/* HP */}
      <div className="dnd-hp-card">
        <p className="dnd-hp-card__label">Pontos de Vida</p>
        <div className="dnd-hp-bar-wrap">
          <div
            className={`dnd-hp-bar ${barCls}`}
            style={{ width: `${Math.min(Math.max(hpPct, 0), 100)}%` }}
          />
        </div>
        <div className="dnd-hp-numbers">
          <input
            type="number"
            value={draft.hp_current}
            onChange={(e) => onChange({ hp_current: e.target.value })}
            className="dnd-hp-input"
            title="PV atual"
          />
          <span className="dnd-hp-sep">/</span>
          <input
            type="number"
            value={draft.hp_max}
            onChange={(e) => onChange({ hp_max: e.target.value })}
            className="dnd-hp-input"
            style={{ fontSize: 'var(--text-md)', color: 'var(--text-muted)' }}
            title="PV máximo"
          />
        </div>
        {(errors.hp_current || errors.hp_max) && (
          <p style={{ fontSize: 'var(--text-xs)', color: '#e06060', textAlign: 'center', marginTop: 2 }}>
            {errors.hp_current || errors.hp_max}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 4 }}>
          <span style={{ fontSize: 'var(--text-xs)', color: '#7ec8e3' }}>PV temp.</span>
          <input
            type="number"
            value={draft.hp_temp}
            onChange={(e) => onChange({ hp_temp: e.target.value })}
            className="dnd-num-input"
            style={{ color: '#7ec8e3', width: '4ch' }}
            title="PV temporário"
          />
        </div>
      </div>

      {/* CA */}
      <div className="dnd-stat-card">
        <p className="dnd-stat-card__label">Classe de Armadura</p>
        <input
          type="number"
          value={draft.armor_class}
          onChange={(e) => onChange({ armor_class: e.target.value })}
          className="dnd-stat-input"
          title="Classe de Armadura"
        />
        {errors.armor_class && <p style={{ fontSize: 9, color: '#e06060' }}>{errors.armor_class}</p>}
      </div>

      {/* Iniciativa */}
      <div className="dnd-stat-card">
        <p className="dnd-stat-card__label dnd-derived-label">
          <span>Iniciativa</span>
          <DerivedModeButton field="initiative_bonus" automatic={automaticFields.has('initiative_bonus')} onToggle={onToggleAutomatic} />
        </p>
        <input
          type="number"
          value={draft.initiative_bonus}
          onChange={(e) => onChange({ initiative_bonus: e.target.value })}
          className="dnd-stat-input"
          disabled={automaticFields.has('initiative_bonus')}
          title="Bônus de iniciativa"
        />
        <p className="dnd-stat-card__sub">{initStr}</p>
      </div>

      {/* Deslocamento */}
      <div className="dnd-stat-card">
        <p className="dnd-stat-card__label">Deslocamento</p>
        <input
          type="number"
          value={draft.speed}
          onChange={(e) => onChange({ speed: e.target.value })}
          className="dnd-stat-input"
          title="Deslocamento"
        />
        <p className="dnd-stat-card__sub">metros</p>
      </div>

      {/* Proficiência */}
      <div className="dnd-stat-card">
        <p className="dnd-stat-card__label dnd-derived-label">
          <span>Proficiência</span>
          <DerivedModeButton field="proficiency_bonus" automatic={automaticFields.has('proficiency_bonus')} onToggle={onToggleAutomatic} />
        </p>
        <input
          type="number"
          value={draft.proficiency_bonus}
          onChange={(e) => onChange({ proficiency_bonus: e.target.value })}
          className="dnd-stat-input"
          disabled={automaticFields.has('proficiency_bonus')}
          title="Bônus de proficiência"
        />
        {errors.proficiency_bonus && <p style={{ fontSize: 9, color: '#e06060' }}>{errors.proficiency_bonus}</p>}
      </div>

      {/* Death saves */}
      <div className="dnd-death-saves">
        <p className="dnd-death-saves__label">Salvaguardas Mortais</p>
        <div className="dnd-death-saves__row">
          <span className="dnd-death-saves__row-label">Sucessos</span>
          <div className="dnd-death-saves__dots">
            {[1, 2, 3].map((i) => (
              <button
                key={i}
                type="button"
                className={`dnd-dot-btn${i <= draft.death_save_successes ? ' dnd-dot-btn--success' : ''}`}
                onClick={() => onChange({
                  death_save_successes: draft.death_save_successes === i ? i - 1 : i,
                })}
                title={`${i} sucesso${i > 1 ? 's' : ''}`}
              />
            ))}
          </div>
        </div>
        <div className="dnd-death-saves__row">
          <span className="dnd-death-saves__row-label">Falhas</span>
          <div className="dnd-death-saves__dots">
            {[1, 2, 3].map((i) => (
              <button
                key={i}
                type="button"
                className={`dnd-dot-btn${i <= draft.death_save_failures ? ' dnd-dot-btn--failure' : ''}`}
                onClick={() => onChange({
                  death_save_failures: draft.death_save_failures === i ? i - 1 : i,
                })}
                title={`${i} falha${i > 1 ? 's' : ''}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Inspiração (alternativa compacta na sidebar) */}
      <div className="dnd-inspiration">
        <span className="dnd-inspiration__label">Inspiração</span>
        <button
          type="button"
          className={`dnd-inspiration__gem-btn${draft.inspiration ? ' dnd-inspiration__gem-btn--active' : ''}`}
          onClick={() => onChange({ inspiration: !draft.inspiration })}
          title={draft.inspiration ? 'Remover inspiração' : 'Ganhar inspiração'}
        />
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Sub-componente: Coluna central — Atributos e Salvaguardas
// ────────────────────────────────────────────────────────

interface AbilitiesProps {
  draft:      DndDraft
  errors:     FieldErrors
  onChange:   (p: Partial<DndDraft>) => void
  campaignId: string
  rolling:    string | null
  onRolling:  (key: string | null) => void
  automaticFields: Set<DndDerivedField>
  onToggleAutomatic: (field: DndDerivedField) => void
}

const ABILITY_KEYS = [
  { key: 'strength',     label: 'FOR', name: 'Força',        saveKey: 'strength_save_proficient'     },
  { key: 'dexterity',    label: 'DES', name: 'Destreza',     saveKey: 'dexterity_save_proficient'    },
  { key: 'constitution', label: 'CON', name: 'Constituição', saveKey: 'constitution_save_proficient' },
  { key: 'intelligence', label: 'INT', name: 'Inteligência', saveKey: 'intelligence_save_proficient' },
  { key: 'wisdom',       label: 'SAB', name: 'Sabedoria',    saveKey: 'wisdom_save_proficient'       },
  { key: 'charisma',     label: 'CAR', name: 'Carisma',      saveKey: 'charisma_save_proficient'     },
] as const

function DndAbilitiesColumn({ draft, errors, onChange, campaignId, rolling, onRolling, automaticFields, onToggleAutomatic }: AbilitiesProps) {
  const pb = numVal(draft.proficiency_bonus)

  const handleRollAbility = async (abilityName: string, score: number) => {
    const mod = getAbilityModifier(score)
    const key = `ability-${abilityName}`
    onRolling(key)
    try {
      await rollDice(campaignId, buildRollFormula(mod))
    } catch { /* silent — dice panel shows result */ }
    finally { onRolling(null) }
  }

  const handleRollSave = async (saveName: string, score: number, proficient: boolean) => {
    const bonus = getSavingThrowBonus(score, proficient, pb)
    const key   = `save-${saveName}`
    onRolling(key)
    try {
      await rollDice(campaignId, buildRollFormula(bonus))
    } catch { /* silent */ }
    finally { onRolling(null) }
  }

  return (
    <div className="dnd-center-col">
      {/* ── Grade de atributos ── */}
      <div className="dnd-abilities-grid">
        {ABILITY_KEYS.map(({ key, label, name }) => {
          const score = numVal(draft[key])
          const mod   = getAbilityModifier(score)
          const rKey  = `ability-${key}`
          return (
            <div key={key} className="dnd-ability">
              <p className="dnd-ability__label" title={name}>{label}</p>
              <p className="dnd-ability__mod">{formatModifier(mod)}</p>
              <input
                type="number"
                min={1} max={30}
                value={draft[key]}
                onChange={(e) => onChange({ [key]: e.target.value } as Partial<DndDraft>)}
                className="dnd-ability-input"
                title={`${name} (1–30)`}
              />
              {errors[key] && (
                <span style={{ fontSize: 8, color: '#e06060', display: 'block' }}>{errors[key]}</span>
              )}
              <div className="dnd-ability__actions">
                <button
                  type="button"
                  className="dnd-roll-btn"
                  disabled={rolling !== null}
                  onClick={() => handleRollAbility(key, score)}
                  title={`Teste de ${name}`}
                >
                  {rolling === rKey ? '…' : 'Rolar'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Salvaguardas ── */}
      <div className="dnd-saves-block">
        <p className="dnd-saves-block__title">Salvaguardas</p>
        {ABILITY_KEYS.map(({ key, label, name, saveKey }) => {
          const score     = numVal(draft[key])
          const proficient = draft[saveKey]
          const bonus     = getSavingThrowBonus(score, proficient, pb)
          const rKey      = `save-${key}`
          return (
            <div key={key} className="dnd-save-row">
              <button
                type="button"
                className={`dnd-prof-btn${proficient ? ' dnd-prof-btn--active' : ''}`}
                onClick={() => onChange({ [saveKey]: !proficient } as Partial<DndDraft>)}
                title={proficient ? `Remover proficiência em ${name}` : `Adicionar proficiência em ${name}`}
              />
              <span className="dnd-save-row__bonus">{formatModifier(bonus)}</span>
              <span className="dnd-save-row__name">{label}</span>
              <div className="dnd-save-row__right">
                <button
                  type="button"
                  className="dnd-roll-btn"
                  disabled={rolling !== null}
                  onClick={() => handleRollSave(key, score, proficient)}
                  title={`Salvaguarda de ${name}`}
                >
                  {rolling === rKey ? '…' : 'Rolar'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Conjuração (compacto) ── */}
      <div className="dnd-saves-block">
        <p className="dnd-saves-block__title">Conjuração</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <div className="dnd-save-row">
            <span className="dnd-save-row__name">Habilidade</span>
            <input
              type="text"
              value={draft.spellcasting_ability}
              onChange={(e) => onChange({ spellcasting_ability: e.target.value })}
              className="dnd-inline-input"
              style={{ fontSize: 'var(--text-xs)', width: '70px', textAlign: 'right' }}
              placeholder="-"
              maxLength={20}
            />
          </div>
          <div className="dnd-save-row">
            <span className="dnd-save-row__name dnd-derived-label">
              <span>CD de magia</span>
              <DerivedModeButton field="spell_save_dc" automatic={automaticFields.has('spell_save_dc')} onToggle={onToggleAutomatic} />
            </span>
            <input
              type="number"
              value={draft.spell_save_dc}
              onChange={(e) => onChange({ spell_save_dc: e.target.value })}
              className="dnd-num-input"
              style={{ marginLeft: 'auto' }}
              disabled={automaticFields.has('spell_save_dc')}
              placeholder="-"
            />
          </div>
          <div className="dnd-save-row">
            <span className="dnd-save-row__name dnd-derived-label">
              <span>Bônus ataque mágico</span>
              <DerivedModeButton field="spell_attack_bonus" automatic={automaticFields.has('spell_attack_bonus')} onToggle={onToggleAutomatic} />
            </span>
            <input
              type="number"
              value={draft.spell_attack_bonus}
              onChange={(e) => onChange({ spell_attack_bonus: e.target.value })}
              className="dnd-num-input"
              style={{ marginLeft: 'auto' }}
              disabled={automaticFields.has('spell_attack_bonus')}
              placeholder="-"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Sub-componente: Coluna direita — abas de conteúdo
// ────────────────────────────────────────────────────────

const TAB_LABELS: { id: TabId; label: string }[] = [
  { id: 'resumo',     label: 'Resumo'    },
  { id: 'combate',    label: 'Combate'   },
  { id: 'pericias',   label: 'Perícias'  },
  { id: 'magias',     label: 'Magias'    },
  { id: 'inventario', label: 'Inventário'},
  { id: 'tracos',     label: 'Traços'    },
  { id: 'anotacoes',  label: 'Anotações' },
]

function TabResumo({ draft }: { draft: DndDraft }) {
  return (
    <div className="dnd-tab-content">
      <div className="dnd-resume-grid">
        <div className="dnd-resume-field">
          <span className="dnd-header__meta-label">Personagem</span>
          <span className="dnd-text-block">
            {draft.character_name.trim() || <em style={{ color: 'var(--text-muted)' }}>Sem nome</em>}
          </span>
        </div>
        <div className="dnd-resume-field">
          <span className="dnd-header__meta-label">Classe / Nível</span>
          <span className="dnd-text-block">
            {[draft.class_name, draft.subclass].filter(Boolean).join(' · ') || '-'} · Nv. {draft.level}
          </span>
        </div>
        <div className="dnd-resume-field">
          <span className="dnd-header__meta-label">Espécie</span>
          <span className="dnd-text-block">{draft.race || '-'}</span>
        </div>
        <div className="dnd-resume-field">
          <span className="dnd-header__meta-label">Antecedente</span>
          <span className="dnd-text-block">{draft.background || '-'}</span>
        </div>
        <div className="dnd-resume-field">
          <span className="dnd-header__meta-label">Alinhamento</span>
          <span className="dnd-text-block">{draft.alignment || '-'}</span>
        </div>
        <div className="dnd-resume-field">
          <span className="dnd-header__meta-label">Experiência</span>
          <span className="dnd-text-block">{(parseInt(draft.experience, 10) || 0).toLocaleString('pt-BR')} XP</span>
        </div>
        {draft.player_name.trim() && (
          <div className="dnd-resume-field">
            <span className="dnd-header__meta-label">Jogador</span>
            <span className="dnd-text-block">{draft.player_name.trim()}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function TabCombate({ sheetId, draft, details, onDetailsChange }: { sheetId: string; draft: DndDraft; details: DndSheetDetails; onDetailsChange: (details: DndSheetDetails) => void }) {
  const init = parseInt(draft.initiative_bonus, 10) || 0
  return (
    <div className="dnd-tab-content">
      <p className="dnd-section-title">Estatísticas de Combate</p>
      <div className="dnd-resume-grid">
        <div className="dnd-resume-field">
          <span className="dnd-header__meta-label">Classe de Armadura</span>
          <span className="dnd-text-block">{draft.armor_class}</span>
        </div>
        <div className="dnd-resume-field">
          <span className="dnd-header__meta-label">Iniciativa</span>
          <span className="dnd-text-block">{init >= 0 ? `+${init}` : `${init}`}</span>
        </div>
        <div className="dnd-resume-field">
          <span className="dnd-header__meta-label">Deslocamento</span>
          <span className="dnd-text-block">{draft.speed} m</span>
        </div>
        <div className="dnd-resume-field">
          <span className="dnd-header__meta-label">Pontos de Vida</span>
          <span className="dnd-text-block">
            {draft.hp_current} / {draft.hp_max}
            {numVal(draft.hp_temp) > 0 && ` (+${draft.hp_temp} temp.)`}
          </span>
        </div>
      </div>
      <DndAttacksEditor
        sheetId={sheetId}
        details={details}
        onDetailsChange={onDetailsChange}
      />
    </div>
  )
}

function TabTracos({ draft, onChange }: { draft: DndDraft; onChange: (p: Partial<DndDraft>) => void }) {
  return (
    <div className="dnd-tab-content">
      <p className="dnd-section-title">Traços de Personalidade</p>
      <textarea
        value={draft.personality_traits}
        onChange={(e) => onChange({ personality_traits: e.target.value })}
        className="dnd-inline-textarea"
        rows={3}
        placeholder="Traços de personalidade…"
      />
      <p className="dnd-section-title">Ideais</p>
      <textarea
        value={draft.ideals}
        onChange={(e) => onChange({ ideals: e.target.value })}
        className="dnd-inline-textarea"
        rows={3}
        placeholder="Ideais…"
      />
      <p className="dnd-section-title">Laços</p>
      <textarea
        value={draft.bonds}
        onChange={(e) => onChange({ bonds: e.target.value })}
        className="dnd-inline-textarea"
        rows={3}
        placeholder="Laços…"
      />
      <p className="dnd-section-title">Fraquezas</p>
      <textarea
        value={draft.flaws}
        onChange={(e) => onChange({ flaws: e.target.value })}
        className="dnd-inline-textarea"
        rows={3}
        placeholder="Fraquezas…"
      />
    </div>
  )
}

function TabAnotacoes({ draft, onChange }: { draft: DndDraft; onChange: (p: Partial<DndDraft>) => void }) {
  return (
    <div className="dnd-tab-content">
      <p className="dnd-section-title">Anotações</p>
      <textarea
        value={draft.notes}
        onChange={(e) => onChange({ notes: e.target.value })}
        className="dnd-inline-textarea"
        rows={5}
        placeholder="Anotações livres…"
        maxLength={5000}
      />
      <p className="dnd-section-title">História do Personagem</p>
      <textarea
        value={draft.backstory}
        onChange={(e) => onChange({ backstory: e.target.value })}
        className="dnd-inline-textarea"
        rows={6}
        placeholder="História do personagem…"
      />
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────────────────

export function DndCharacterSheetPanel({ campaignId }: DndCharacterSheetPanelProps) {
  const [sheet,      setSheet]      = useState<DndCharacterSheet | null>(null)
  const [draft,      setDraft]      = useState<DndDraft | null>(null)
  const [isDirty,    setIsDirty]    = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [loadError,  setLoadError]  = useState<string | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError,  setSaveError]  = useState<string | null>(null)
  const [fieldErrors,setFieldErrors]= useState<FieldErrors>({})
  const [activeTab,  setActiveTab]  = useState<TabId>('resumo')
  const [rolling,    setRolling]    = useState<string | null>(null)
  const [details,    setDetails]    = useState<DndSheetDetails>({ skills: [], attacks: [], inventory: [], spells: [], overrides: [] })

  // Auto-hide success banner
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Carregar ficha ──
  useEffect(() => {
    setLoading(true)
    setLoadError(null)
    ensureMyDndSheet(campaignId)
      .then(async (s) => {
        const loadedDetails = await getDndSheetDetails(s.id)
        setSheet(s)
        setDraft(sheetToDraft(s))
        setDetails(loadedDetails)
        setIsDirty(false)
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Erro ao carregar a ficha.'))
      .finally(() => setLoading(false))
  }, [campaignId])

  // ── Alterar draft ──
  const handleChange = useCallback((patch: Partial<DndDraft>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
    setIsDirty(true)
    setSaveStatus('idle')
    // Limpar erros dos campos modificados
    const keys = Object.keys(patch)
    if (keys.length) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        keys.forEach((k) => { delete next[k] })
        return next
      })
    }
  }, [])

  // ── Descartar ──
  const handleDiscard = useCallback(() => {
    if (!sheet) return
    setDraft(sheetToDraft(sheet))
    setIsDirty(false)
    setFieldErrors({})
    setSaveStatus('idle')
  }, [sheet])

  // ── Salvar ──
  const handleSave = useCallback(async () => {
    if (!draft || !sheet) return
    const effectiveDraft = applyAutomaticValues(draft, details.overrides)
    const errs = validateDraft(effectiveDraft)
    if (Object.keys(errs).length) {
      setFieldErrors(errs)
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await updateDndSheet(
        sheet.id,
        draftToUpdate(effectiveDraft),
        campaignId,
        effectiveDraft.character_name
      )
      setSheet(updated)
      setDraft(sheetToDraft(updated))
      setIsDirty(false)
      setFieldErrors({})
      setSaveStatus('success')
      // auto-hide after 3 s
      if (successTimer.current) clearTimeout(successTimer.current)
      successTimer.current = setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Não foi possível salvar a ficha D&D.')
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }, [draft, sheet, details.overrides, campaignId])

  // ── Loading / error ──
  if (loading) {
    return (
      <div className="dnd-sheet">
        <div className="dnd-panel-state">
          <Loader small />
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="dnd-sheet">
        <p className="dnd-panel-error">{loadError}</p>
      </div>
    )
  }

  if (!draft || !sheet) return null

  const currentSheetId = sheet.id
  const automaticFields = new Set(
    AUTO_FIELDS.filter((field) => !details.overrides.some((override) => override.field_key === field)),
  )
  const effectiveDraft = applyAutomaticValues(draft, details.overrides)

  async function handleToggleAutomatic(field: DndDerivedField) {
    const existing = details.overrides.find((override) => override.field_key === field)
    try {
      if (existing) {
        await removeDndOverride(currentSheetId, field)
        setDetails((current) => ({ ...current, overrides: current.overrides.filter((override) => override.field_key !== field) }))
      } else {
        const value = effectiveDraft[field as keyof DndDraft]
        const saved = await saveDndOverride(currentSheetId, field, String(value ?? ''))
        setDetails((current) => ({ ...current, overrides: [...current.overrides, saved] }))
      }
      setSaveError(null)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Não foi possível alternar o modo do campo.')
      setSaveStatus('error')
    }
  }

  return (
    <div className="dnd-sheet">
      {/* ── Banners ── */}
      {isDirty && (
        <DirtyBanner saving={saving} onSave={handleSave} onDiscard={handleDiscard} />
      )}
      {!isDirty && saveStatus === 'success' && (
        <div className="dnd-save-feedback dnd-save-feedback--success">
          ✓ Ficha D&D salva com sucesso.
        </div>
      )}
      {saveStatus === 'error' && saveError && (
        <div className="dnd-save-feedback dnd-save-feedback--error">
          {saveError}
        </div>
      )}

      {/* ── Cabeçalho ── */}
      <DndEditableHeader
        draft={effectiveDraft}
        errors={fieldErrors}
        onChange={handleChange}
      />

      {/* ── Body ── */}
      <div className="dnd-body">
        {/* Coluna esquerda */}
        <DndQuickStatsColumn
          draft={effectiveDraft}
          errors={fieldErrors}
          onChange={handleChange}
          automaticFields={automaticFields}
          onToggleAutomatic={handleToggleAutomatic}
        />

        {/* Coluna central */}
        <DndAbilitiesColumn
          draft={effectiveDraft}
          errors={fieldErrors}
          onChange={handleChange}
          campaignId={campaignId}
          rolling={rolling}
          onRolling={setRolling}
          automaticFields={automaticFields}
          onToggleAutomatic={handleToggleAutomatic}
        />

        {/* Coluna direita — abas */}
        <div className="dnd-right-col">
          <nav className="dnd-tabs-nav">
            {TAB_LABELS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`dnd-tab-btn${activeTab === id ? ' dnd-tab-btn--active' : ''}`}
                onClick={() => setActiveTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>

          {activeTab === 'resumo'     && <TabResumo    draft={effectiveDraft} />}
          {activeTab === 'combate'    && <TabCombate sheetId={sheet.id} draft={effectiveDraft} details={details} onDetailsChange={setDetails} />}
          {activeTab === 'pericias'   && <DndSkillsEditor sheetId={sheet.id} details={details} onDetailsChange={setDetails} draft={effectiveDraft as unknown as Record<string, string>} />}
          {activeTab === 'magias'     && <DndSpellsEditor sheetId={sheet.id} details={details} onDetailsChange={setDetails} />}
          {activeTab === 'inventario' && <DndInventoryEditor sheetId={sheet.id} details={details} onDetailsChange={setDetails} />}
          {activeTab === 'tracos'     && <TabTracos    draft={effectiveDraft} onChange={handleChange} />}
          {activeTab === 'anotacoes'  && <TabAnotacoes draft={effectiveDraft} onChange={handleChange} />}
        </div>
      </div>
    </div>
  )
}
