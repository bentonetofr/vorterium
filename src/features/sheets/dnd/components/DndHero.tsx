import { useRef, useState, type ChangeEvent } from 'react'
import { getBackground, getClass, getRace, getSubrace } from '../catalog'
import { DND_PORTRAIT_PICK_MAX_BYTES, DND_PORTRAIT_TYPES } from '../constants/dnd'
import { AvatarCropEditor } from '../../../users/components/AvatarCropEditor'
import { classLine } from '../model/sheetModel'
import { formatMeters } from '../model/format'
import { DND_TEXT_LIMITS } from '../model/sheetForm'
import { CreateCharacterButton } from '../../../vortable/components/CreateCharacterButton'
import { DndAutomationPanel } from './DndAutomationPanel'
import { Presence } from '../../../../shared/components/Presence'
import { DerivedField, NumberField } from './DndControls'
import { DndDragBar } from './DndDragBar'
import type { SheetCtx } from './sheetContext'

// ────────────────────────────────────────────────────────
// Cabeçalho da ficha de D&D: retrato, nome, raça, classe e nível, os números
// que se usa na mesa (CA, iniciativa, deslocamento, proficiência, percepção
// passiva), a barra de PV e os descansos.
// ────────────────────────────────────────────────────────

interface DndHeroProps {
  ctx:              SheetCtx
  portraitBusy:     boolean
  onPortraitChange: (file: File) => Promise<void>
  onPortraitRemove: () => void
  onShortRest:      () => void
  onLongRest:       () => void
  restBusy:         boolean
  isNpc:            boolean
  /** Abre a janela de importar a ficha por PDF. */
  onImport:         () => void
}

export function DndHero({ ctx, portraitBusy, onPortraitChange, onPortraitRemove, onShortRest, onLongRest, restBusy, isNpc, onImport }: DndHeroProps) {
  const { form, set, update, derived, data, sheet, readOnly } = ctx
  const fileRef = useRef<HTMLInputElement>(null)
  const [autoOpen, setAutoOpen] = useState(false)
  const [portraitDraft, setPortraitDraft] = useState<File | null>(null)
  const feet = form.speed_unit === 'ft'

  const hpMax = derived.hpMax ?? form.hp_max
  const hp = Math.max(0, Math.min(hpMax, form.hp_current))
  const tone = hp === 0 ? 'down' : 'ok'

  const race = form.race_key ? getRace(form.race_key) : undefined
  const subrace = form.race_key && form.subrace_key ? getSubrace(form.race_key, form.subrace_key) : undefined
  /** Visão no escuro, em pés (0 = visão normal): a digitada na ficha ou, sem ela, a da raça. */
  const raceVision = race?.darkvision ?? 0
  const vision = form.vision_ft ?? raceVision
  const [editVision, setEditVision] = useState(false)
  const [visionDraft, setVisionDraft] = useState(0)
  const toShown = (ft: number) => (feet ? ft : Math.round(ft * 0.3 * 100) / 100)
  const fromShown = (n: number) => Math.max(0, feet ? Math.round(n) : Math.round(n / 0.3))
  function startVision() { setVisionDraft(toShown(vision)); setEditVision(true) }
  function commitVision() {
    setEditVision(false)
    const ft = fromShown(visionDraft)
    set('vision_ft', ft === raceVision ? null : ft)
  }
  const background = form.background_key ? getBackground(form.background_key) : undefined
  const initialClass = getClass(data.classes.find((c) => c.is_initial)?.class_key ?? data.classes[0]?.class_key ?? '')
  const hasIdentity = !!race || !!form.race_custom.trim() || data.classes.length > 0 || !!sheet.class_name?.trim() || !!background || !!form.background_custom.trim()
  const subline = hasIdentity ? [
    subrace?.name ?? race?.name ?? (form.race_custom.trim() || undefined),
    classLine(data.classes, sheet.class_name, form.class_names),
    `nível ${derived.totalLevel}`,
    background?.name ?? (form.background_custom.trim() || undefined),
  ].filter(Boolean).join(' · ') : ''

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!DND_PORTRAIT_TYPES.includes(f.type as (typeof DND_PORTRAIT_TYPES)[number])) { ctx.report('Escolha uma imagem JPG, PNG ou WebP.'); return }
    if (f.size > DND_PORTRAIT_PICK_MAX_BYTES) { ctx.report('A imagem deve ter no máximo 10 MB.'); return }
    ctx.report(null)
    setPortraitDraft(f)
  }

  async function savePortrait(file: File) {
    await onPortraitChange(file)
    setPortraitDraft(null)
  }

  return (
    <>
    <header className="dsh-hero">
      <div className="dsh-hero__id">
        <div className="dsh-portrait">
          <button
            type="button" className="dsh-portrait__img" onClick={() => fileRef.current?.click()} disabled={portraitBusy || readOnly}
            aria-label={sheet.portrait_url ? 'Trocar o retrato' : 'Enviar um retrato'}
          >
            {sheet.portrait_url
              ? <img key={sheet.portrait_url} src={sheet.portrait_url} alt="" />
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
            {!readOnly && (
              <button type="button" className="dsh-chip dsh-chip--primary" onClick={() => setAutoOpen(true)}
                title="Escolha o que a ficha calcula sozinha e o que você preenche à mão.">Automatizar</button>
            )}
            {!readOnly && !isNpc && (
              <button type="button" className="dsh-chip" onClick={onImport}
                title="Preenche a ficha a partir do PDF da sua ficha (a ficha preenchível JohnBard DnD 5e CS).">Importar PDF</button>
            )}
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
          <DerivedField
            ctx={ctx} field="speed" value={derived.speed} label={feet ? 'Deslocamento em pés' : 'Deslocamento em metros'}
            show={feet ? undefined : (ft) => Math.round(ft * 0.3 * 100) / 100} unshow={feet ? undefined : (m) => Math.round(m / 0.3)}
            suffix={feet ? ' ft' : ' m'} min={0} max={feet ? 1000 : 300} step={feet ? 5 : 0.5}
            onUnitClick={() => set('speed_unit', feet ? 'm' : 'ft')} unitTitle={feet ? 'Em pés. Clique para ver em metros.' : 'Em metros. Clique para ver em pés.'}
          />
        </div>
        <div className="dsh-stat" title={vision > 0 ? 'Visão no escuro: enxerga na penumbra como se fosse luz plena e no escuro como se fosse penumbra, nesta distância (só em tons de cinza).' : race || form.vision_ft !== null ? 'Visão normal: sem visão no escuro.' : 'Escolha a raça para ver a visão no escuro.'}>
          <span className="dsh-stat__label">Visão{form.vision_ft !== null && !readOnly && (
            <button type="button" className="dsh-stat__reset" onClick={() => set('vision_ft', null)} title="Voltar à visão da raça" aria-label="Voltar à visão da raça">↺</button>
          )}</span>
          {editVision && !readOnly ? (
            <span className="dsh-derived" onBlur={commitVision} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitVision() } else if (e.key === 'Escape') setEditVision(false) }}>
              <NumberField value={visionDraft} onChange={setVisionDraft} min={0} max={feet ? 1000 : 300} step={feet ? 5 : 0.5} label={feet ? 'Visão no escuro em pés' : 'Visão no escuro em metros'} className="dsh-num--manual" />
              <span className="dsh-derived__suffix">{feet ? 'ft' : 'm'}</span>
            </span>
          ) : (
            <button type="button" className={`dsh-stat__value dsh-stat__edit${vision > 0 ? ' dsh-stat__value--bone' : ''}`} disabled={readOnly} onClick={startVision}
              aria-label="Visão no escuro" title={readOnly ? undefined : 'Clique para personalizar a visão no escuro'}>
              {vision > 0 ? (feet ? `${vision} ft` : formatMeters(vision)) : race || form.vision_ft !== null ? 'Normal' : '—'}
            </button>
          )}
          {/* marcar liga a visão no escuro (a distância da raça, ou 18 m); desmarcar deixa visão normal */}
          <label className={`dsh-stat__check${vision > 0 ? ' is-on' : ''}`}>
            <input type="checkbox" checked={vision > 0} disabled={readOnly}
              onChange={(e) => { setEditVision(false); set('vision_ft', e.target.checked ? (raceVision > 0 ? raceVision : 60) : 0) }} />
            <span>Visão no escuro</span>
          </label>
        </div>
        <div className="dsh-stat">
          <span className="dsh-stat__label">Proficiência</span>
          <DerivedField ctx={ctx} field="proficiency_bonus" value={derived.proficiencyBonus} label="Bônus de proficiência" signed min={0} max={20} />
        </div>
        <div className="dsh-stat" title="10 + bônus de Percepção">
          <span className="dsh-stat__label">Percepção passiva</span>
          <DerivedField ctx={ctx} field="passive_perception" value={derived.passivePerception} label="Percepção passiva" min={0} max={99} />
        </div>
        <button
          type="button" className={`dsh-stat dsh-stat--click${form.inspiration ? ' is-on' : ''}`} aria-pressed={form.inspiration} disabled={readOnly}
          onClick={() => set('inspiration', !form.inspiration)} title="Clique para alternar. Com inspiração, você ganha vantagem em uma jogada."
        >
          <span className="dsh-stat__label">Inspiração</span>
          <strong key={String(form.inspiration)} className="dsh-stat__value">{form.inspiration ? 'Sim' : 'Não'}</strong>
        </button>
      </div>

      <div className={`dsh-hp dsh-hp--${tone}`}>
        <div className="dsh-hp__head">
          <span className="dsh-hp__title">Pontos de Vida</span>
          <span className="dsh-hp__values">
            <NumberField
              className="dsh-hp__input" value={hp} onChange={(n) => set('hp_current', n)} min={0} max={hpMax}
              label="PV atuais" disabled={readOnly}
            />
            <span className="dsh-hp__sep">/</span>
            {derived.hpMax != null
              ? <DerivedField ctx={ctx} field="hp_max" value={derived.hpMax} label="PV máximo" min={1} max={9999} />
              : <NumberField className="dsh-hp__input dsh-hp__input--max" value={form.hp_max} onChange={(n) => set('hp_max', n)} min={1} max={9999} label="PV máximo" disabled={readOnly} />}
            <label className="dsh-hp__tempfield" title="PV temporários: o dano gasta eles primeiro">
              <span>+</span>
              <NumberField className="dsh-hp__input dsh-hp__input--temp" value={form.hp_temp} onChange={(n) => set('hp_temp', n)} min={0} max={9999} label="PV temporários" disabled={readOnly} />
              <span>temp.</span>
            </label>
          </span>
        </div>
        <DndDragBar value={hp} max={hpMax} temp={form.hp_temp} onChange={({ hp: nextHp, temp }) => update((f) => ({ ...f, hp_current: nextHp, hp_temp: temp }))} disabled={readOnly} label="Pontos de vida" />
      </div>
    </header>
    <Presence show={!!portraitDraft} exitMs={220}>
      {() => portraitDraft && (
        <AvatarCropEditor
          file={portraitDraft} saving={portraitBusy} onCancel={() => setPortraitDraft(null)} onSave={savePortrait}
          title="Ajustar retrato" description="Escolha o enquadramento que será exibido no cabeçalho da ficha." confirmLabel="Usar este retrato"
        />
      )}
    </Presence>
    <Presence show={autoOpen}>{() => <DndAutomationPanel ctx={ctx} onClose={() => setAutoOpen(false)} />}</Presence>
    </>
  )
}
