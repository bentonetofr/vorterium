import { useRef, type ChangeEvent } from 'react'
import { getBackground, getClass, getRace, getSubrace } from '../catalog'
import { DND_PORTRAIT_TYPES } from '../constants/dnd'
import { classLine } from '../model/sheetModel'
import { formatSigned } from '../model/format'
import { DND_TEXT_LIMITS } from '../model/sheetForm'
import { CreateCharacterButton } from '../../../vortable/components/CreateCharacterButton'
import { DerivedField, Toggle } from './DndControls'
import type { SheetCtx } from './sheetContext'

// ────────────────────────────────────────────────────────
// Cabeçalho da ficha de D&D: retrato, nome, raça, classe e nível, os números
// que se usa na mesa (CA, iniciativa, deslocamento, proficiência, percepção
// passiva), a barra de PV e os descansos.
// ────────────────────────────────────────────────────────

interface DndHeroProps {
  ctx:              SheetCtx
  portraitBusy:     boolean
  onPortraitChange: (file: File) => void
  onPortraitRemove: () => void
  onShortRest:      () => void
  onLongRest:       () => void
  restBusy:         boolean
  isNpc:            boolean
}

export function DndHero({ ctx, portraitBusy, onPortraitChange, onPortraitRemove, onShortRest, onLongRest, restBusy, isNpc }: DndHeroProps) {
  const { form, set, derived, data, sheet, readOnly } = ctx
  const fileRef = useRef<HTMLInputElement>(null)

  const hpMax = derived.hpMax ?? form.hp_max
  const hp = Math.max(0, Math.min(hpMax, form.hp_current))
  const pct = Math.max(0, Math.min(100, (hp / Math.max(1, hpMax)) * 100))
  const tone = hp === 0 ? 'down' : pct <= 25 ? 'low' : pct <= 50 ? 'mid' : 'ok'

  const race = form.race_key ? getRace(form.race_key) : undefined
  const subrace = form.race_key && form.subrace_key ? getSubrace(form.race_key, form.subrace_key) : undefined
  const background = form.background_key ? getBackground(form.background_key) : undefined
  const initialClass = getClass(data.classes.find((c) => c.is_initial)?.class_key ?? data.classes[0]?.class_key ?? '')
  const hasIdentity = !!race || data.classes.length > 0 || !!sheet.class_name?.trim() || !!background
  const subline = hasIdentity ? [
    subrace?.name ?? race?.name,
    classLine(data.classes, sheet.class_name),
    `nível ${derived.totalLevel}`,
    background?.name,
  ].filter(Boolean).join(' · ') : ''

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) onPortraitChange(f)
  }

  function heal(delta: number) {
    if (readOnly) return
    if (delta >= 0) { set('hp_current', Math.min(hpMax, hp + delta)); return }
    // dano: os PV temporários absorvem primeiro
    let dmg = -delta
    const absorbed = Math.min(form.hp_temp, dmg)
    dmg -= absorbed
    if (absorbed) set('hp_temp', form.hp_temp - absorbed)
    set('hp_current', Math.max(0, hp - dmg))
  }

  return (
    <header className="dsh-hero">
      <div className="dsh-hero__id">
        <div className="dsh-portrait">
          <button
            type="button" className="dsh-portrait__img" onClick={() => fileRef.current?.click()} disabled={portraitBusy || readOnly}
            aria-label={sheet.portrait_url ? 'Trocar o retrato' : 'Enviar um retrato'}
          >
            {sheet.portrait_url
              ? <img src={sheet.portrait_url} alt="" />
              : <span className="dsh-portrait__empty" aria-hidden="true">{initialClass ? initialClass.name.charAt(0) : '⚔'}</span>}
            {portraitBusy && <span className="dsh-portrait__busy"><span className="spinner spinner--sm" /></span>}
          </button>
          {sheet.portrait_url && !portraitBusy && !readOnly && (
            <button type="button" className="dsh-portrait__remove" onClick={onPortraitRemove} aria-label="Remover o retrato">×</button>
          )}
          <input ref={fileRef} type="file" accept={DND_PORTRAIT_TYPES.join(',')} hidden onChange={onFile} />
          {!isNpc && !readOnly && <CreateCharacterButton campaignId={sheet.campaign_id} ownerId={sheet.user_id} />}
        </div>

        <div className="dsh-hero__fields">
          <input
            type="text" className="dsh-hero__name" placeholder="Nome do personagem" maxLength={DND_TEXT_LIMITS.character_name}
            value={form.character_name} onChange={(e) => set('character_name', e.target.value)} aria-label="Nome" readOnly={readOnly}
          />
          <p className="dsh-hero__line">{subline || 'Escolha raça e classe na aba Personagem.'}</p>
          <div className="dsh-hero__rests">
            <button type="button" className="dsh-chip" onClick={onShortRest} disabled={readOnly || restBusy}
              title="Recarrega o que volta no descanso curto. Os dados de vida você gasta na aba Combate.">Descanso curto</button>
            <button type="button" className="dsh-chip" onClick={onLongRest} disabled={readOnly || restBusy}
              title="PV ao máximo, recarrega tudo, recupera metade dos dados de vida e tira 1 nível de exaustão.">Descanso longo</button>
          </div>
        </div>
      </div>

      <div className="dsh-hero__stats">
        <div className="dsh-stat">
          <span className="dsh-stat__label">CA</span>
          <DerivedField ctx={ctx} field="armor_class" value={derived.armorClass} label="Classe de Armadura" min={0} max={99} />
        </div>
        <div className="dsh-stat">
          <span className="dsh-stat__label">Iniciativa</span>
          <DerivedField ctx={ctx} field="initiative_bonus" value={derived.initiative} label="Iniciativa" signed min={-20} max={30} />
        </div>
        <div className="dsh-stat">
          <span className="dsh-stat__label">Deslocamento</span>
          <DerivedField ctx={ctx} field="speed" value={derived.speed} label="Deslocamento em metros" show={(ft) => Math.round(ft * 0.3 * 100) / 100} unshow={(m) => Math.round(m / 0.3)} suffix=" m" min={0} max={300} step={0.5} />
        </div>
        <div className="dsh-stat">
          <span className="dsh-stat__label">Proficiência</span>
          <DerivedField ctx={ctx} field="proficiency_bonus" value={derived.proficiencyBonus} label="Bônus de proficiência" signed min={0} max={20} />
        </div>
        <div className="dsh-stat" title="10 + bônus de Percepção">
          <span className="dsh-stat__label">Percepção passiva</span>
          <strong className="dsh-derived__value">{derived.passivePerception}</strong>
        </div>
        <div className="dsh-stat dsh-stat--toggle">
          <span className="dsh-stat__label">Inspiração</span>
          <Toggle checked={form.inspiration} onChange={readOnly ? undefined : (v) => set('inspiration', v)} label={form.inspiration ? 'Tem' : 'Não'} />
        </div>
      </div>

      <div className={`dsh-hp dsh-hp--${tone}`}>
        <div className="dsh-hp__head">
          <span className="dsh-hp__title">Pontos de Vida</span>
          <span className="dsh-hp__nums">
            <strong>{hp}</strong> / {hpMax}
            {form.hp_temp > 0 && <span className="dsh-hp__temp" title="PV temporários">+{form.hp_temp} temp.</span>}
          </span>
        </div>
        <div className="dsh-hp__track" role="progressbar" aria-label="Pontos de vida" aria-valuemin={0} aria-valuemax={hpMax} aria-valuenow={hp}>
          <div className="dsh-hp__fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="dsh-hp__btns">
          {[-5, -1, 1, 5].map((d) => (
            <button key={d} type="button" className="dsh-mini" disabled={readOnly} onClick={() => heal(d)}
              aria-label={d < 0 ? `Dano de ${-d}` : `Cura de ${d}`}>{d > 0 ? `+${d}` : formatSigned(d).replace('-', '−')}</button>
          ))}
        </div>
      </div>
    </header>
  )
}
