import { ANCESTRIES, COMMUNITIES, ancestry, community } from '../catalog/heritage'
import { CLASSES } from '../catalog/classes'
import { DESCRIPTION_HINTS, EXPERIENCE_EXAMPLES } from '../catalog/rules'
import { currentClass, currentSubclass } from '../model/derive'
import type { DhSheetData } from '../model/types'
import { confirmDialog } from '../../../../shared/components/dialogs'
import { Banner, Inline, RuleText } from './DhUi'

// ────────────────────────────────────────────────────────
// Personagem: classe e subclasse, herança (ancestralidade, mista, comunidade), descrição, perguntas de origem e vínculos.
// ────────────────────────────────────────────────────────

interface Props {
  data: DhSheetData
  update: (fn: (d: DhSheetData) => DhSheetData) => void
  canEdit: boolean
}

export function DhPersonTab({ data, update, canEdit }: Props) {
  const cls = currentClass(data)
  const sub = currentSubclass(data)
  const a1 = ancestry(data.ancestryKey)
  const comm = community(data.communityKey)
  const set = (patch: Partial<DhSheetData>) => update((d) => ({ ...d, ...patch }))

  async function changeClass(key: string) {
    if (key === data.classKey) return
    if (data.level > 1 || data.advancements.length > 0) {
      if (!(await confirmDialog({ title: 'Trocar de classe?', message: 'Isso muda os domínios. As cartas de domínio que você já tem continuam na ficha, mas confira se ainda servem.', confirmLabel: 'Trocar', tone: 'danger' }))) return
    }
    const c = CLASSES.find((x) => x.key === key)
    update((d) => ({ ...d, classKey: c?.key ?? null, subclassKey: null }))
  }

  return (
    <div className="dh-person">
      <section className="dh-box">
        <Banner>Classe</Banner>
        <div className="dh-form">
          <label>Classe
            <select value={data.classKey ?? ''} disabled={!canEdit} onChange={(e) => void changeClass(e.target.value)}>
              <option value="">Escolha…</option>
              {CLASSES.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
            </select>
          </label>
          <label>Subclasse
            <select value={data.subclassKey ?? ''} disabled={!canEdit || !cls} onChange={(e) => set({ subclassKey: e.target.value || null })}>
              <option value="">Escolha…</option>
              {cls?.subclasses.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
          </label>
        </div>
        {cls && <p className="dh-hint">{cls.description}</p>}
        {sub && <p className="dh-hint"><em>{sub.tagline}</em></p>}
      </section>

      <section className="dh-box">
        <Banner>Herança</Banner>
        <div className="dh-form">
          <label>Ancestralidade
            <select value={data.ancestryKey ?? ''} disabled={!canEdit} onChange={(e) => set({ ancestryKey: e.target.value || null })}>
              <option value="">Escolha…</option>
              {ANCESTRIES.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
            </select>
          </label>
          <label>Segunda ancestralidade (mista)
            <select value={data.ancestry2Key ?? ''} disabled={!canEdit || !data.ancestryKey} onChange={(e) => set({ ancestry2Key: e.target.value || null })}>
              <option value="">Nenhuma</option>
              {ANCESTRIES.filter((a) => a.key !== data.ancestryKey).map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
            </select>
          </label>
          <label>Comunidade
            <select value={data.communityKey ?? ''} disabled={!canEdit} onChange={(e) => set({ communityKey: e.target.value || null })}>
              <option value="">Escolha…</option>
              {COMMUNITIES.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
            </select>
          </label>
          <label>Como o personagem se define (ex.: goblin-orc)
            <Inline value={data.ancestryName} onChange={(v) => set({ ancestryName: v })} disabled={!canEdit} maxLength={120} aria-label="Nome da herança" />
          </label>
        </div>
        {data.ancestry2Key && <p className="dh-hint">Ancestralidade mista: a 1ª habilidade vem de {a1?.name} e a 2ª de {ancestry(data.ancestry2Key)?.name}.</p>}
        {a1 && <p className="dh-hint">{a1.description}</p>}
        {comm && (
          <>
            <p className="dh-hint">{comm.description}</p>
            <p className="dh-hint">Personagens dessa comunidade costumam ser: {comm.traits.join(', ').toLowerCase()}.</p>
          </>
        )}
      </section>

      <section className="dh-box">
        <Banner>Descrição</Banner>
        <div className="dh-form">
          {(Object.keys(DESCRIPTION_HINTS) as (keyof typeof DESCRIPTION_HINTS)[]).map((k) => (
            <div key={k} className="dh-desc">
              <label>{DESCRIPTION_HINTS[k].label}<Inline value={data.description[k]} disabled={!canEdit} maxLength={200} aria-label={DESCRIPTION_HINTS[k].label} onChange={(v) => update((d) => ({ ...d, description: { ...d.description, [k]: v } }))} /></label>
              {canEdit && <div className="dh-chips">{DESCRIPTION_HINTS[k].items.map((it) => <button key={it} type="button" onClick={() => update((d) => ({ ...d, description: { ...d.description, [k]: d.description[k] ? `${d.description[k]}, ${it}` : it } }))}>{it}</button>)}</div>}
            </div>
          ))}
        </div>
      </section>

      {cls && (
        <>
          <section className="dh-box">
            <Banner>Perguntas de Origem</Banner>
            <p className="dh-hint">Responda a quaisquer das perguntas, ou crie as suas.</p>
            {cls.background.map((q, i) => (
              <label key={q} className="dh-qa">{q}
                <Inline multiline rows={3} maxLength={2000} value={data.background[i] ?? ''} disabled={!canEdit} aria-label={q} onChange={(v) => update((d) => { const b = [...d.background]; b[i] = v; return { ...d, background: b } })} />
              </label>
            ))}
          </section>
          <section className="dh-box">
            <Banner>Vínculos</Banner>
            <p className="dh-hint">Faça uma das perguntas a outro jogador para o personagem dele responder, ou invente a sua.</p>
            {cls.connections.map((q, i) => (
              <label key={q} className="dh-qa">{q}
                <Inline multiline rows={2} maxLength={2000} value={data.connections[i] ?? ''} disabled={!canEdit} aria-label={q} onChange={(v) => update((d) => { const b = [...d.connections]; b[i] = v; return { ...d, connections: b } })} />
              </label>
            ))}
          </section>
        </>
      )}

      <section className="dh-box">
        <Banner>Ideias de Experiência</Banner>
        <p className="dh-hint">Específicas, sem dar magias nem habilidades. Dá para acrescentar uma marca de mundo, como “Assassino da Sindicato Safira”.</p>
        {EXPERIENCE_EXAMPLES.map((g) => <p key={g.label} className="dh-hint"><strong>{g.label}:</strong> {g.items.join(', ')}.</p>)}
      </section>
    </div>
  )
}

export function Notes({ data, update, canEdit }: Props) {
  return (
    <section className="dh-box">
      <Banner>Anotações</Banner>
      <RuleText text="" />
      <textarea className="dh-notes" value={data.notes} rows={14} maxLength={20000} disabled={!canEdit} placeholder="Anotações da campanha, contatos, pistas…" onChange={(e) => update((d) => ({ ...d, notes: e.target.value }))} />
    </section>
  )
}
