import { useState } from 'react'
import { Select } from '../../../../shared/components/Select'
import type { DndCharacterFeature, DndCharacterResource, DndFeatureSource, DndRecharge } from '../../../../shared/types'
import { homebrewKeyFromName } from '../catalog/homebrewKey'
import { availableFeatures, findCatalogFeature, missingFeatures } from '../model/features'
import { createDndFeature, removeDndFeature, removeDndResource, saveDndResource, setDndResourceCurrent, updateDndFeature } from '../services/dndResourceService'
import { NumberField, Pips } from './DndControls'
import type { SheetCtx } from './sheetContext'

// ────────────────────────────────────────────────────────
// Aba Características: recursos que gastam e recarregam (Fúria, Ki, Inspiração
// de Bardo...) e as características de classe, subclasse, raça e antecedente.
// O botão "Trazer do catálogo" adiciona o que o catálogo do SRD dá ao
// personagem pelo nível; cada característica tem usos e anotações próprios.
// ────────────────────────────────────────────────────────

const RECHARGE_OPTIONS: { value: DndRecharge; label: string }[] = [
  { value: 'short', label: 'Descanso curto' }, { value: 'long', label: 'Descanso longo' },
  { value: 'dawn', label: 'Amanhecer' }, { value: 'manual', label: 'Manual' },
]
const RECHARGE_LABEL = Object.fromEntries(RECHARGE_OPTIONS.map((r) => [r.value, r.label])) as Record<DndRecharge, string>

const SOURCE_LABEL: Record<DndFeatureSource, string> = {
  class: 'Classe', subclass: 'Subclasse', race: 'Raça', subrace: 'Sub-raça', background: 'Antecedente', feat: 'Talento', item: 'Item', manual: 'Própria',
}
const SOURCE_ORDER: DndFeatureSource[] = ['race', 'subrace', 'background', 'class', 'subclass', 'feat', 'item', 'manual']

export function DndCaracteristicasTab({ ctx }: { ctx: SheetCtx }) {
  const { data, sheet, form, readOnly, report } = ctx
  const [busy, setBusy] = useState<string | null>(null)
  const [resLabel, setResLabel] = useState('')
  const [resMax, setResMax] = useState(1)
  const [resRecharge, setResRecharge] = useState<DndRecharge>('long')
  const [featName, setFeatName] = useState('')

  const resources = data.resources.filter((r) => r.source !== 'spell_slots')
  const features = [...data.features].sort((a, b) =>
    SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source) || (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name, 'pt-BR'))
  const missing = missingFeatures(
    availableFeatures(data.classes, form.race_key || null, form.subrace_key || null, form.background_key || null),
    data.features,
  )

  async function run(key: string, job: () => Promise<void>) {
    setBusy(key)
    report(null)
    try { await job() } catch (err) { report(err instanceof Error ? err.message : 'Algo deu errado. Tente de novo.') } finally { setBusy(null) }
  }

  const replaceResource = (saved: DndCharacterResource) => data.setResources((rs) => rs.map((r) => (r.id === saved.id ? saved : r)))
  const replaceFeature = (saved: DndCharacterFeature) => data.setFeatures((fs) => fs.map((f) => (f.id === saved.id ? saved : f)))

  const addResource = () => run('res', async () => {
    const label = resLabel.trim()
    if (!label) { report('Escreva o nome do recurso.'); return }
    let key = homebrewKeyFromName(label)
    const taken = new Set(data.resources.map((r) => r.key))
    for (let n = 2; taken.has(key); n++) key = `${homebrewKeyFromName(label).slice(0, 55)}_${n}`
    const saved = await saveDndResource(sheet.id, { key, label: label.slice(0, 80), current_value: resMax, max_value: resMax, recharge: resRecharge, source: 'manual', sort_order: resources.length + 30 })
    data.setResources((rs) => [...rs, saved])
    setResLabel('')
  })

  const patchResource = (r: DndCharacterResource, patch: { max_value?: number; recharge?: DndRecharge }) => run(r.id, async () => {
    const max = patch.max_value ?? r.max_value
    const saved = await saveDndResource(sheet.id, { key: r.key, label: r.label, max_value: max, current_value: Math.min(r.current_value, max), recharge: patch.recharge ?? r.recharge, source: r.source })
    replaceResource(saved)
  })

  const setCurrent = (r: DndCharacterResource, value: number) => run(r.id, async () => { replaceResource(await setDndResourceCurrent(r, value)) })

  const removeResource = (r: DndCharacterResource) => run(r.id, async () => {
    await removeDndResource(r.id)
    data.setResources((rs) => rs.filter((x) => x.id !== r.id))
  })

  const importFeatures = () => run('import', async () => {
    const created: DndCharacterFeature[] = []
    for (const f of missing) {
      created.push(await createDndFeature(sheet.id, { source: f.source, feature_key: f.key, name: f.name, level: f.level, sort_order: data.features.length + created.length }))
    }
    data.setFeatures((fs) => [...fs, ...created])
  })

  const addFeature = () => run('feat', async () => {
    const name = featName.trim()
    if (!name) { report('Escreva o nome da característica.'); return }
    const saved = await createDndFeature(sheet.id, { source: 'manual', name: name.slice(0, 120), sort_order: data.features.length })
    data.setFeatures((fs) => [...fs, saved])
    setFeatName('')
  })

  const patchFeature = (f: DndCharacterFeature, patch: Partial<Pick<DndCharacterFeature, 'notes' | 'uses_current' | 'uses_max' | 'recharge'>>) =>
    run(f.id, async () => { replaceFeature(await updateDndFeature(f.id, patch)) })

  const removeFeature = (f: DndCharacterFeature) => run(f.id, async () => {
    await removeDndFeature(f.id)
    data.setFeatures((fs) => fs.filter((x) => x.id !== f.id))
  })

  return (
    <div className="dsh-tab dsh-columns anim-tab-panel">
      <section className="dsh-card">
        <div className="dsh-card__header"><h4 className="dsh-card__title">Recursos</h4></div>
        {resources.length === 0 && <p className="dsh-faint">Nenhum recurso. Crie os que o personagem gasta e recarrega, como Fúria, pontos de ki ou Inspiração de Bardo.</p>}
        <ul className="dsh-list">
          {resources.map((r) => (
            <li key={r.id} className="dsh-resource">
              <div className="dsh-resource__main">
                <strong>{r.label}</strong>
                {r.max_value <= 10
                  ? <Pips total={r.max_value} filled={Math.min(r.current_value, r.max_value)} label={`${r.label} disponíveis`} onChange={readOnly || busy === r.id ? undefined : (n) => void setCurrent(r, n)} />
                  : <NumberField value={r.current_value} min={0} max={r.max_value} label={`${r.label} atuais`} disabled={readOnly || busy === r.id} onChange={(n) => void setCurrent(r, n)} className="dsh-num--sm" />}
                <span className="dsh-faint">{Math.min(r.current_value, r.max_value)}/{r.max_value}</span>
                {!readOnly && <button type="button" className="dsh-x" onClick={() => void removeResource(r)} disabled={busy === r.id} aria-label={`Remover ${r.label}`}>×</button>}
              </div>
              {!readOnly && (
                <div className="dsh-resource__edit">
                  <label className="dsh-field dsh-field--inline"><span className="dsh-faint">Máximo</span>
                    <NumberField value={r.max_value} min={0} max={999} label={`Máximo de ${r.label}`} onChange={(n) => void patchResource(r, { max_value: n })} className="dsh-num--sm" /></label>
                  <Select options={RECHARGE_OPTIONS} value={r.recharge} onChange={(v) => void patchResource(r, { recharge: v as DndRecharge })} aria-label={`Recarga de ${r.label}`} />
                </div>
              )}
              {readOnly && <span className="dsh-faint">Recarrega: {RECHARGE_LABEL[r.recharge]}</span>}
            </li>
          ))}
        </ul>
        {!readOnly && (
          <div className="dsh-add-row">
            <input type="text" className="dsh-input" value={resLabel} maxLength={80} placeholder="Nome do recurso (ex.: Fúria)"
              onChange={(e) => setResLabel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addResource() } }} />
            <NumberField value={resMax} onChange={setResMax} min={1} max={999} label="Máximo" className="dsh-num--sm" />
            <Select options={RECHARGE_OPTIONS} value={resRecharge} onChange={(v) => setResRecharge(v as DndRecharge)} aria-label="Recarga" />
            <button type="button" className="dsh-chip dsh-chip--primary" onClick={() => void addResource()} disabled={busy === 'res'}>Adicionar</button>
          </div>
        )}
        <p className="dsh-note">Os descansos (botões no alto da ficha) recarregam os recursos conforme a recarga de cada um. Os espaços de magia ficam na aba Magias.</p>
      </section>

      <section className="dsh-card dsh-card--wide">
        <div className="dsh-card__header">
          <h4 className="dsh-card__title">Características</h4>
          <span className="dsh-badge">{features.length}</span>
        </div>
        {!readOnly && missing.length > 0 && (
          <div className="dsh-callout">
            <span>O catálogo tem <strong>{missing.length}</strong> característica{missing.length > 1 ? 's' : ''} de raça, classe e antecedente que ainda não estão na ficha.</span>
            <button type="button" className="dsh-chip dsh-chip--primary" onClick={() => void importFeatures()} disabled={busy === 'import'}>
              {busy === 'import' ? 'Trazendo...' : 'Trazer do catálogo'}
            </button>
          </div>
        )}
        {features.length === 0 && <p className="dsh-faint">Nenhuma característica ainda.</p>}
        <ul className="dsh-list">
          {features.map((f) => {
            const cat = f.feature_key ? findCatalogFeature(f.source, f.feature_key) : undefined
            const hasUses = f.uses_max != null
            return (
              <li key={f.id} className="dsh-feature">
                <details>
                  <summary>
                    <span className="dsh-tag">{SOURCE_LABEL[f.source]}</span>
                    <strong>{f.name}</strong>
                    {f.level != null && f.level > 1 && <span className="dsh-faint">nível {f.level}</span>}
                    {hasUses && <span className="dsh-faint">{f.uses_current ?? 0}/{f.uses_max}</span>}
                  </summary>
                  <div className="dsh-feature__body">
                    {cat && <p className="dsh-feature__summary">{cat.summary}</p>}
                    {cat && cat.origin && <p className="dsh-faint">Origem: {cat.origin}{cat.original ? ` · ${cat.original}` : ''}</p>}
                    <div className="dsh-feature__uses">
                      <label className="dsh-field dsh-field--inline"><span className="dsh-faint">Usos</span>
                        <NumberField value={f.uses_max ?? 0} min={0} max={99} label={`Usos de ${f.name}`} disabled={readOnly || busy === f.id} className="dsh-num--sm"
                          onChange={(n) => void patchFeature(f, n === 0 ? { uses_max: null, uses_current: null, recharge: null } : { uses_max: n, uses_current: Math.min(f.uses_current ?? n, n), recharge: f.recharge ?? 'long' })} /></label>
                      {hasUses && (
                        <>
                          <Pips total={Math.min(f.uses_max ?? 0, 12)} filled={Math.min(f.uses_current ?? 0, 12)} label={`Usos disponíveis de ${f.name}`}
                            onChange={readOnly || busy === f.id ? undefined : (n) => void patchFeature(f, { uses_current: n })} />
                          <Select options={RECHARGE_OPTIONS} value={f.recharge ?? 'long'} disabled={readOnly} onChange={(v) => void patchFeature(f, { recharge: v as DndRecharge })} aria-label={`Recarga de ${f.name}`} />
                        </>
                      )}
                    </div>
                    <textarea className="dsh-input dsh-textarea dsh-textarea--sm" rows={2} defaultValue={f.notes} readOnly={readOnly} maxLength={2000}
                      placeholder="Anotações sobre esta característica" aria-label={`Anotações de ${f.name}`}
                      onBlur={(e) => { if (e.target.value !== f.notes) void patchFeature(f, { notes: e.target.value }) }} />
                    {!readOnly && <button type="button" className="dsh-link dsh-link--danger" onClick={() => void removeFeature(f)} disabled={busy === f.id}>Remover da ficha</button>}
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
        {!readOnly && (
          <div className="dsh-add-row">
            <input type="text" className="dsh-input" value={featName} maxLength={120} placeholder="Característica própria (talento, dádiva, item mágico...)"
              onChange={(e) => setFeatName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addFeature() } }} />
            <button type="button" className="dsh-chip" onClick={() => void addFeature()} disabled={busy === 'feat'}>Adicionar</button>
          </div>
        )}
      </section>
    </div>
  )
}
