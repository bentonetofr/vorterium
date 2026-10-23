import { useState } from 'react'
import { Select } from '../../../../shared/components/Select'
import type { DndCharacterFeature, DndCharacterResource, DndFeatureSource, DndRecharge } from '../../../../shared/types'
import { DND_TEXT_LIMITS } from '../model/sheetForm'
import { homebrewKeyFromName } from '../catalog/homebrewKey'
import { CLASS_OPTIONS, CLASS_OPTION_LABEL, classOptionFeatureKey, type ClassOptionEntry, type ClassOptionKind } from '../catalog/classOptions'
import { AUTO_RESOURCE_KEYS } from '../model/classResources'
import { availableFeatures, classOptionAllowance, findCatalogFeature, missingFeatures } from '../model/features'
import { createDndFeature, removeDndFeature, removeDndResource, saveDndResource, setDndResourceCurrent, updateDndFeature } from '../services/dndResourceService'
import { NumberField, Pips } from './DndControls'
import { RechargeLegend } from './DndVisuals'
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
/** Siglas da tabela de recursos: DC (descanso curto), DL (descanso longo), AM (amanhecer). */
const RECHARGE_SHORT: Record<DndRecharge, string> = { short: 'DC', long: 'DL', dawn: 'AM', manual: 'Manual' }

const SOURCE_LABEL: Record<DndFeatureSource, string> = {
  class: 'Classe', subclass: 'Subclasse', race: 'Raça', subrace: 'Sub-raça', background: 'Antecedente', feat: 'Talento', item: 'Item', manual: 'Própria',
}
const SOURCE_ORDER: DndFeatureSource[] = ['race', 'subrace', 'background', 'class', 'subclass', 'feat', 'item', 'manual']

const NOTES = [
  { key: 'notes_racial', title: 'Traços raciais', hint: 'Visão no escuro, resistências, idiomas e o que mais a raça dá.' },
  { key: 'notes_background', title: 'Traços de antecedente', hint: 'A característica do antecedente, contatos e favores.' },
  { key: 'notes_class', title: 'Características de classe', hint: 'Anotações sobre as características das classes e subclasses.' },
] as const

export function DndCaracteristicasTab({ ctx }: { ctx: SheetCtx }) {
  const { data, sheet, form, set, readOnly, report } = ctx
  const [busy, setBusy] = useState<string | null>(null)
  const [resLabel, setResLabel] = useState('')
  const [resMax, setResMax] = useState(1)
  const [resRecharge, setResRecharge] = useState<DndRecharge>('long')
  const [featName, setFeatName] = useState('')
  const [srcFilter, setSrcFilter] = useState<DndFeatureSource | ''>('')
  const [pick, setPick] = useState<Record<ClassOptionKind, string>>({ metamagic: '', invocation: '' })

  const resources = data.resources.filter((r) => r.source !== 'spell_slots').sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, 'pt-BR'))
  const features = [...data.features].sort((a, b) =>
    SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source) || (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name, 'pt-BR'))
  const sourceCounts = SOURCE_ORDER.map((src) => ({ src, n: features.filter((f) => f.source === src).length })).filter((x) => x.n > 0)
  const shownFeatures = srcFilter ? features.filter((f) => f.source === srcFilter) : features
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

  const optionKinds = (['metamagic', 'invocation'] as ClassOptionKind[]).filter((k) => classOptionAllowance(k, data.classes) > 0)

  const addOption = (o: ClassOptionEntry) => run(`opt-${o.kind}`, async () => {
    const saved = await createDndFeature(sheet.id, { source: 'class', feature_key: classOptionFeatureKey(o), name: o.name, level: o.minLevel ?? null, sort_order: data.features.length })
    data.setFeatures((fs) => [...fs, saved])
    setPick((p) => ({ ...p, [o.kind]: '' }))
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
    <div className="dsh-tab dsh-cols anim-tab-panel">
      <section className="dsh-card dsh-wide">
        <div className="dsh-card__header">
          <h4 className="dsh-card__title">Recursos</h4>
          {resources.length > 0 && <span className="dsh-badge">{resources.length}</span>}
        </div>
        {resources.length === 0 && (
          <div className="dsh-noattack">
            <strong>Nenhum recurso ainda</strong>
            <span>Fúria, Ki, Inspiração de Bardo e outros que a classe dá aparecem sozinhos. Para criar um seu, use o formulário abaixo.</span>
          </div>
        )}
        {resources.length > 0 && (
          <ul className="dsh-resgrid">
            {resources.map((r) => {
              const auto = AUTO_RESOURCE_KEYS.has(r.key) && !form.manual_modes.includes('class_resources')
              const left = Math.min(r.current_value, r.max_value)
              const locked = readOnly || busy === r.id
              return (
                <li key={r.id} className={`dsh-restile${r.max_value > 0 && left === 0 ? ' is-empty' : ''}`}>
                  <div className="dsh-restile__head">
                    <strong className="dsh-restile__name">{r.label}</strong>
                    {!readOnly && !auto && <button type="button" className="dsh-x" onClick={() => void removeResource(r)} disabled={busy === r.id} aria-label={`Remover ${r.label}`}>×</button>}
                  </div>
                  <div className="dsh-restile__use">
                    {r.max_value > 0 && r.max_value <= 12
                      ? <Pips total={r.max_value} filled={left} label={`${r.label} restantes`} onChange={locked ? undefined : (n) => void setCurrent(r, n)} />
                      : <NumberField value={left} min={0} max={r.max_value} label={`${r.label} restantes`} disabled={locked} onChange={(n) => void setCurrent(r, n)} className="dsh-restile__num" />}
                    <span className="dsh-restile__count" title="Restante / total">
                      <strong>{left}</strong>/
                      {readOnly || auto
                        ? r.max_value
                        : <NumberField value={r.max_value} min={0} max={999} label={`Total de ${r.label}`} disabled={busy === r.id} onChange={(n) => void patchResource(r, { max_value: n })} className="dsh-restile__total" />}
                    </span>
                  </div>
                  <div className="dsh-restile__foot">
                    {readOnly || auto
                      ? <abbr className="dsh-legend__code" title={RECHARGE_LABEL[r.recharge]}>{RECHARGE_SHORT[r.recharge]}</abbr>
                      : (
                        <div className="dsh-seg" role="group" aria-label={`Recarga de ${r.label}`}>
                          {RECHARGE_OPTIONS.map((o) => (
                            <button key={o.value} type="button" className={`dsh-seg__btn${r.recharge === o.value ? ' is-on' : ''}`} aria-pressed={r.recharge === o.value}
                              title={o.label} disabled={busy === r.id} onClick={() => { if (r.recharge !== o.value) void patchResource(r, { recharge: o.value }) }}>{RECHARGE_SHORT[o.value]}</button>
                          ))}
                        </div>
                      )}
                    {auto && <span className="dsh-cardchip" title="O total vem das tabelas do livro. Para editar, ponha os recursos em manual no botão Automatizar.">Total automático</span>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {!readOnly && (
          <div className="dsh-newattack">
            <label className="dsh-field dsh-field--tile dsh-newattack__wide"><span className="dsh-label">Novo recurso</span>
              <input type="text" className="dsh-focus__input" value={resLabel} maxLength={80} placeholder="Nome do recurso (ex.: Fúria)"
                onChange={(e) => setResLabel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addResource() } }} /></label>
            <label className="dsh-field dsh-field--tile"><span className="dsh-label">Total</span>
              <NumberField value={resMax} onChange={setResMax} min={1} max={999} label="Máximo" className="dsh-num--field" /></label>
            <div className="dsh-field dsh-field--tile"><span className="dsh-label">Recarga</span>
              <div className="dsh-seg" role="group" aria-label="Recarga">
                {RECHARGE_OPTIONS.map((o) => (
                  <button key={o.value} type="button" className={`dsh-seg__btn${resRecharge === o.value ? ' is-on' : ''}`} aria-pressed={resRecharge === o.value}
                    title={o.label} onClick={() => setResRecharge(o.value)}>{RECHARGE_SHORT[o.value]}</button>
                ))}
              </div></div>
            <button type="button" className="dsh-newattack__add" onClick={() => void addResource()} disabled={busy === 'res'}>+ Adicionar recurso</button>
          </div>
        )}
        <RechargeLegend />
      </section>

      <section className="dsh-card dsh-wide">
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
        {optionKinds.map((kind) => {
          const allowed = classOptionAllowance(kind, data.classes)
          const chosen = new Set(data.features.filter((f) => f.source === 'class' && f.feature_key).map((f) => f.feature_key))
          const have = CLASS_OPTIONS.filter((o) => o.kind === kind && chosen.has(classOptionFeatureKey(o))).length
          const level = data.classes.find((c) => c.class_key === (kind === 'metamagic' ? 'sorcerer' : 'warlock'))?.level ?? 0
          const options = CLASS_OPTIONS.filter((o) => o.kind === kind && !chosen.has(classOptionFeatureKey(o)))
            .map((o) => ({ value: o.key, label: `${o.name}${o.prerequisite ? ` (${o.prerequisite})` : ''}` }))
          const selected = CLASS_OPTIONS.find((o) => o.kind === kind && o.key === pick[kind])
          const unmet = selected?.minLevel != null && level < selected.minLevel
          return (
            <div className="dsh-callout" key={kind}>
              <span><strong>{CLASS_OPTION_LABEL[kind]}</strong>: {have} de {allowed} escolhidas{have > allowed ? ' (passou do limite do nível)' : ''}.</span>
              {!readOnly && (
                <>
                  <Select options={options} value={pick[kind]} onChange={(v) => setPick((p) => ({ ...p, [kind]: v }))} aria-label={`Escolher ${CLASS_OPTION_LABEL[kind]}`} />
                  <button type="button" className="dsh-chip dsh-chip--primary" disabled={!selected || busy === `opt-${kind}`} onClick={() => selected && void addOption(selected)}>Escolher</button>
                  {unmet && <span className="dsh-faint">Pede {selected?.prerequisite}; você ainda é de nível {level}.</span>}
                </>
              )}
            </div>
          )
        })}
        {features.length === 0 && (
          <div className="dsh-noattack">
            <strong>Nenhuma característica ainda</strong>
            <span>Traga as de raça, classe e antecedente do catálogo, ou escreva uma sua (talento, dádiva, item mágico...).</span>
          </div>
        )}
        {sourceCounts.length > 1 && (
          <div className="dsh-book__row" role="group" aria-label="Filtrar por origem">
            <button type="button" className={`dsh-bookchip${srcFilter === '' ? ' is-on' : ''}`} aria-pressed={srcFilter === ''} onClick={() => setSrcFilter('')}>Todas ({features.length})</button>
            {sourceCounts.map(({ src, n }) => (
              <button key={src} type="button" className={`dsh-bookchip${srcFilter === src ? ' is-on' : ''}`} aria-pressed={srcFilter === src} onClick={() => setSrcFilter(srcFilter === src ? '' : src)}>{SOURCE_LABEL[src]} ({n})</button>
            ))}
          </div>
        )}
        <ul className="dsh-list">
          {shownFeatures.map((f) => {
            const cat = f.feature_key ? findCatalogFeature(f.source, f.feature_key) : undefined
            const hasUses = f.uses_max != null
            return (
              <li key={f.id} className="dsh-feature">
                <details>
                  <summary>
                    <span className="dsh-tag">{SOURCE_LABEL[f.source]}</span>
                    <strong>{f.name}</strong>
                    {f.level != null && f.level > 1 && <span className="dsh-cardchip">nível {f.level}</span>}
                    {hasUses && <span className="dsh-cardchip dsh-feature__uses-chip" title="Usos restantes / total">usos {f.uses_current ?? 0}/{f.uses_max}</span>}
                    {!readOnly && (
                      <button type="button" className="dsh-x dsh-feature__x" disabled={busy === f.id} aria-label={`Remover ${f.name}`} title="Remover da ficha"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); void removeFeature(f) }}>×</button>
                    )}
                  </summary>
                  <div className="dsh-feature__body">
                    {cat && <p className="dsh-feature__summary">{cat.summary}</p>}
                    {cat && cat.origin && <p className="dsh-faint">Origem: {cat.origin}{cat.original ? ` · ${cat.original}` : ''}</p>}
                    <div className="dsh-feature__uses">
                      <label className="dsh-itemnum" title="Quantas vezes pode usar entre as recargas (0 = sem limite)"><small>Usos</small>
                        <NumberField value={f.uses_max ?? 0} min={0} max={99} label={`Usos de ${f.name}`} disabled={readOnly || busy === f.id} className="dsh-itemnum__input"
                          onChange={(n) => void patchFeature(f, n === 0 ? { uses_max: null, uses_current: null, recharge: null } : { uses_max: n, uses_current: Math.min(f.uses_current ?? n, n), recharge: f.recharge ?? 'long' })} /></label>
                      {hasUses && (
                        <>
                          <Pips total={Math.min(f.uses_max ?? 0, 12)} filled={Math.min(f.uses_current ?? 0, 12)} label={`Usos disponíveis de ${f.name}`}
                            onChange={readOnly || busy === f.id ? undefined : (n) => void patchFeature(f, { uses_current: n })} />
                          <div className="dsh-seg" role="group" aria-label={`Recarga de ${f.name}`}>
                            {RECHARGE_OPTIONS.map((o) => (
                              <button key={o.value} type="button" className={`dsh-seg__btn${(f.recharge ?? 'long') === o.value ? ' is-on' : ''}`} aria-pressed={(f.recharge ?? 'long') === o.value}
                                title={o.label} disabled={readOnly || busy === f.id} onClick={() => { if ((f.recharge ?? 'long') !== o.value) void patchFeature(f, { recharge: o.value }) }}>{RECHARGE_SHORT[o.value]}</button>
                            ))}
                          </div>
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
          <div className="dsh-newattack">
            <label className="dsh-field dsh-field--tile dsh-newattack__wide"><span className="dsh-label">Característica própria</span>
              <input type="text" className="dsh-focus__input" value={featName} maxLength={120} placeholder="Talento, dádiva, item mágico..."
                onChange={(e) => setFeatName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addFeature() } }} /></label>
            <button type="button" className="dsh-newattack__add" onClick={() => void addFeature()} disabled={busy === 'feat'}>+ Adicionar característica</button>
          </div>
        )}
      </section>

      <div className="dsh-notes dsh-wide">
        {NOTES.map((n) => {
          const used = form[n.key].length
          const limit = DND_TEXT_LIMITS[n.key]
          return (
            <section className="dsh-card dsh-notecard" key={n.key}>
              <div className="dsh-card__header"><h4 className="dsh-card__title">{n.title}</h4></div>
              <p className="dsh-notecard__hint">{n.hint}</p>
              <textarea className="dsh-notearea" maxLength={limit} value={form[n.key]} readOnly={readOnly}
                placeholder="Escreva aqui..." aria-label={n.title} onChange={(e) => set(n.key, e.target.value)} />
              <span className={`dsh-notecard__count${used >= limit * 0.9 ? ' is-near' : ''}`} title="Caracteres usados / limite">{used.toLocaleString('pt-BR')} / {limit.toLocaleString('pt-BR')}</span>
            </section>
          )
        })}
      </div>
    </div>
  )
}
