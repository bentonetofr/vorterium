import { useCallback, useEffect, useState } from 'react'
import { Loader } from '../../../../shared/components/Loader'
import { confirmDialog } from '../../../../shared/components/dialogs'
import { RANGE_INFO, RANGE_ORDER } from '../catalog/rules'
import { ADVERSARY_KINDS, ENVIRONMENT_KINDS, ENVIRONMENT_PRESETS, duplicateGm, emptyAdversary, emptyEnvironment, newFeature, nextCopyName, type DhAdversary, type DhEnvironment, type DhGmFeature, type DhGmKind } from '../model/gm'
import { newId } from '../model/defaults'
import { counterSummary } from '../model/counters'
import { createGmSheet, deleteGmSheet, listGmSheets, setGmVisible, subscribeGmSheets, useGmSheet, type GmRow } from '../services/dhGmService'
import { useFear } from '../services/dhFearService'
import { rollFree } from '../services/dhRolls'
import { Inline, RuleText, Slots, Stepper, signed, DhSelect } from './DhUi'
import { DhCounters } from './DhCounters'

// ────────────────────────────────────────────────────────
// Adversários e ambientes (capítulo 4): na aba Ficha, o mestre cria e edita os blocos no formato do livro, joga o ataque e o dano
// do adversário na mesa e gasta o Medo das habilidades (o Medo é o contador público da campanha). Os jogadores veem só o que o mestre mostrar.
// ────────────────────────────────────────────────────────

type Row = GmRow<DhAdversary | DhEnvironment>
type Tab = 'adversary' | 'environment'

const KIND_LABEL = { passiva: 'Passiva', acao: 'Ação', reacao: 'Reação' } as const
const TAB_LABEL: Record<Tab, string> = { adversary: 'Adversários', environment: 'Ambientes' }

export function DhGmSection({ campaignId, isMaster }: { campaignId: string; isMaster: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('adversary')
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { setRows(await listGmSheets(campaignId)); setError(null) } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar.') }
  }, [campaignId])
  useEffect(() => { void load(); return subscribeGmSheets(campaignId, () => { void load() }) }, [campaignId, load])

  if (!isMaster && (!rows || rows.length === 0)) return null
  const list = (rows ?? []).filter((r) => r.kind === tab)
  const open = (rows ?? []).find((r) => r.id === openId) ?? null

  async function create(kind: DhGmKind, data: DhAdversary | DhEnvironment) {
    try { const row = await createGmSheet(campaignId, kind, data); setRows((r) => [...(r ?? []), row]); setOpenId(row.id) } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível criar.') }
  }

  async function remove(row: Row) {
    if (!(await confirmDialog({ title: `Apagar “${row.data.name}”?`, message: 'A ficha some para todos e não dá para desfazer.', confirmLabel: 'Apagar', tone: 'danger' }))) return
    try { await deleteGmSheet(row.id); setRows((r) => (r ?? []).filter((x) => x.id !== row.id)); if (openId === row.id) setOpenId(null) } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível apagar.') }
  }

  async function toggleVisible(row: Row) {
    try { await setGmVisible(row.id, !row.visible); setRows((r) => (r ?? []).map((x) => (x.id === row.id ? { ...x, visible: !x.visible } : x))) } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível mudar.') }
  }

  /** Uma cópia pronta para usar (mais de um inimigo igual): mesmo bloco, Vida e marcadores zerados, nome "Goblin (2)". Fica visível se o original estiver. */
  async function duplicate(row: Row) {
    try {
      const name = nextCopyName(row.data.name, (rows ?? []).filter((r) => r.kind === row.kind).map((r) => r.data.name))
      const created = await createGmSheet(campaignId, row.kind, duplicateGm(row.data, name))
      let copy: Row = created
      if (row.visible) { await setGmVisible(created.id, true); copy = { ...created, visible: true } }
      setRows((r) => [...(r ?? []), copy])
      setNotice(`Criado “${name}”.`)
      setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível duplicar.') }
  }

  return (
    <section className="dh-gm" aria-label="Adversários e ambientes">
      <header className="dh-gm__head">
        <h3>{isMaster ? 'Adversários e ambientes' : 'Mostrados pelo mestre'}</h3>
        <span className="dh-seg" role="tablist" aria-label="Tipo de ficha">
          {(Object.keys(TAB_LABEL) as Tab[]).map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'is-on' : ''} onClick={() => { setTab(t); setOpenId(null) }}>{TAB_LABEL[t]}</button>)}
        </span>
      </header>
      {error && <p className="sheet-feedback sheet-feedback--error" role="alert">{error}</p>}
      {notice && <p className="dh-notice" role="status" onClick={() => setNotice(null)}>{notice}</p>}
      {!rows && !error && <div className="sheet-loading"><Loader small /></div>}

      {rows && (
        <>
          <div className="dh-gm__actions">
            {isMaster && tab === 'adversary' && <button type="button" className="btn" onClick={() => void create('adversary', emptyAdversary())}>+ Novo adversário</button>}
            {isMaster && tab === 'environment' && <button type="button" className="btn" onClick={() => void create('environment', emptyEnvironment())}>+ Novo ambiente</button>}
            {isMaster && tab === 'environment' && ENVIRONMENT_PRESETS.map((p) => <button key={p.id} type="button" className="btn" onClick={() => void create('environment', p.build())}>+ {p.build().name} (do livro)</button>)}
          </div>
          {list.length === 0 && <p className="dh-empty">{isMaster ? `Nenhum ${tab === 'adversary' ? 'adversário' : 'ambiente'} ainda.` : 'Nada mostrado ainda.'}</p>}
          <div className="dh-gm__cards">
            {list.map((r) => (
              <article key={r.id} className={`dh-gm__card${openId === r.id ? ' is-on' : ''}`}>
                <button type="button" className="dh-gm__open" onClick={() => setOpenId(openId === r.id ? null : r.id)} aria-pressed={openId === r.id}>
                  <b>{r.data.name}</b>
                  <small>Patamar {r.data.tier} · {r.data.kind} · Dif. {r.data.difficulty}{r.kind === 'adversary' ? ` · Vida ${(r.data as DhAdversary).hp}` : ''}</small>
                  {counterSummary(r.data.counters) && <small className="dh-gm__ctrs">{counterSummary(r.data.counters)}</small>}
                </button>
                {isMaster && (
                  <span className="dh-gm__tools">
                    <button type="button" className="dh-link" onClick={() => void duplicate(r)} title="Cria uma cópia pronta para usar (Vida e marcadores zerados)">Duplicar</button>
                    <button type="button" className="dh-link" onClick={() => void toggleVisible(r)}>{r.visible ? 'Esconder' : 'Mostrar aos jogadores'}</button>
                    <button type="button" className="dh-link" onClick={() => void remove(r)}>Apagar</button>
                  </span>
                )}
                {isMaster && r.visible && <i className="dh-gm__badge">visível</i>}
              </article>
            ))}
          </div>
          {open && (open.kind === 'adversary'
            ? <AdversarySheet key={open.id} row={open as GmRow<DhAdversary>} campaignId={campaignId} canEdit={isMaster} />
            : <EnvironmentSheet key={open.id} row={open as GmRow<DhEnvironment>} campaignId={campaignId} canEdit={isMaster} />)}
        </>
      )}
    </section>
  )
}

// ── peças comuns ──

function Title({ children, right }: { children: string; right?: React.ReactNode }) {
  return <div className="dh-gmtitle"><span>{children}</span>{right}</div>
}

function Fld({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={`dh-fld${wide ? ' dh-fld--wide' : ''}`}><span>{label}</span>{children}</label>
}

function SaveState({ status }: { status: 'ok' | 'salvando' | 'erro' }) {
  return <span className={`dh-status__dot dh-status__dot--${status}`}>{status === 'salvando' ? 'Salvando…' : status === 'erro' ? 'Erro ao salvar' : 'Salvo'}</span>
}

// ── blocos de habilidades (iguais nos dois) ──

function FeatureBlock({ f, canEdit, onChange, onRemove, onUse, fear }: { f: DhGmFeature; canEdit: boolean; onChange: (f: DhGmFeature) => void; onRemove: () => void; onUse?: () => void; fear: number }) {
  return (
    <div className="dh-gmfeat" data-kind={f.kind}>
      <div className="dh-gmfeat__head">
        <Inline value={f.name} onChange={(v) => onChange({ ...f, name: v })} disabled={!canEdit} placeholder="Nome da habilidade" maxLength={120} aria-label="Nome da habilidade" />
        {canEdit
          ? <DhSelect label="Tipo da habilidade" value={f.kind} onChange={(v) => onChange({ ...f, kind: v as DhGmFeature['kind'] })} options={Object.entries(KIND_LABEL).map(([k, v]) => ({ value: k, label: v }))} />
          : <em>({KIND_LABEL[f.kind]})</em>}
        {canEdit
          ? <label className="dh-miniedit">Medo <Stepper value={f.fearCost} min={0} max={12} label="Custo em Medo" onChange={(v) => onChange({ ...f, fearCost: v })} /></label>
          : f.fearCost > 0 && <em>gasta {f.fearCost} Medo</em>}
        {canEdit && f.kind !== 'passiva' && onUse && <button type="button" className="btn" disabled={f.fearCost > fear} onClick={onUse} title={f.fearCost > 0 ? `Tira ${f.fearCost} do Medo público` : 'Registra o uso'}>{f.fearCost > 0 ? `Usar (−${f.fearCost} Medo)` : 'Usar'}</button>}
        {canEdit && <button type="button" className="dh-x" aria-label="Remover habilidade" onClick={onRemove}>×</button>}
      </div>
      {canEdit
        ? <Inline multiline rows={3} maxLength={3000} value={f.text} onChange={(v) => onChange({ ...f, text: v })} placeholder="O que a habilidade faz (use • para listas)" aria-label="Texto da habilidade" />
        : <RuleText text={f.text} />}
      {(canEdit || f.questions) && (canEdit
        ? <Inline multiline rows={2} maxLength={1500} value={f.questions} onChange={(v) => onChange({ ...f, questions: v })} placeholder="Perguntas para a mesa (opcional)" className="dh-gmfeat__q" aria-label="Perguntas" />
        : <p className="dh-gmfeat__q">{f.questions}</p>)}
    </div>
  )
}

function Features({ features, canEdit, onChange, fear, onUse }: { features: DhGmFeature[]; canEdit: boolean; onChange: (f: DhGmFeature[]) => void; fear: ReturnType<typeof useFear>; onUse: (f: DhGmFeature) => void }) {
  return (
    <>
      <Title right={canEdit ? <button type="button" className="dh-link" onClick={() => onChange([...features, newFeature('acao')])}>+ Habilidade</button> : null}>Habilidades</Title>
      {features.length === 0 && <p className="dh-empty">Sem habilidades.</p>}
      {features.map((f) => (
        <FeatureBlock key={f.id} f={f} canEdit={canEdit} fear={fear.value}
          onChange={(nf) => onChange(features.map((x) => (x.id === f.id ? nf : x)))} onRemove={() => onChange(features.filter((x) => x.id !== f.id))} onUse={() => onUse(f)} />
      ))}
    </>
  )
}

function useUse(campaignId: string, fear: ReturnType<typeof useFear>) {
  const [msg, setMsg] = useState<string | null>(null)
  async function use(f: DhGmFeature, who: string) {
    try {
      if (f.fearCost > 0) await fear.set(fear.value - f.fearCost)
      setMsg(`${who}: ${f.name || 'habilidade'}${f.fearCost > 0 ? ` (−${f.fearCost} Medo)` : ''}.`)
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Não deu para gastar o Medo.') }
  }
  return { msg, setMsg, use, campaignId }
}

// ── ficha de adversário ──

export function AdversarySheet({ row, campaignId, canEdit }: { row: GmRow<DhAdversary>; campaignId: string; canEdit: boolean }) {
  const { data: a, update, status } = useGmSheet<DhAdversary>(row.id, row.data, canEdit)
  const fear = useFear(campaignId)
  const { msg, setMsg, use } = useUse(campaignId, fear)
  const [adv, setAdv] = useState<'normal' | 'vant' | 'desv'>('normal')
  const [out, setOut] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof DhAdversary>(k: K, v: DhAdversary[K]) => update((d) => ({ ...d, [k]: v }))
  const target = { campaignId, sheetId: null, character: a.name }

  async function attack() {
    setBusy(true); setOut(null)
    try {
      const f = `${adv === 'vant' ? '2#d20' : adv === 'desv' ? '2@d20' : '1d20'}${a.attackBonus ? (a.attackBonus > 0 ? `+${a.attackBonus}` : `${a.attackBonus}`) : ''}`
      const total = await rollFree({ ...target, label: `Ataque de ${a.name} (${a.attackName})`, formula: f })
      setOut(`Ataque: ${total} (contra a Evasão do alvo)`)
    } catch (e) { setOut(e instanceof Error ? e.message : 'Não foi possível rolar.') } finally { setBusy(false) }
  }
  async function damage() {
    setBusy(true); setOut(null)
    try { const total = await rollFree({ ...target, label: `Dano de ${a.name} (${a.attackName})`, formula: a.damage.replace(/\s/g, '').replace(/^d/, '1d') }); setOut(`Dano: ${total} ${a.damageType === 'mag' ? 'mágico' : 'físico'}`) } catch (e) { setOut(e instanceof Error ? e.message : 'Dano inválido (use algo como 2d8+3).') } finally { setBusy(false) }
  }

  return (
    <section className="dh-box dh-gmsheet">
      <header className="dh-gmhead">
        <div className="dh-gmhead__main">
          <p className="dh-gmhead__meta"><span>Adversário</span>{canEdit && <SaveState status={status} />}</p>
          <Inline className="dh-gmsheet__name" value={a.name} onChange={(v) => set('name', v)} disabled={!canEdit} maxLength={120} aria-label="Nome" />
          <div className="dh-gmtags">
            {canEdit ? (
              <>
                <DhSelect label="Patamar" value={String(a.tier)} onChange={(v) => set('tier', Number(v) as DhAdversary['tier'])} options={[1, 2, 3, 4].map((t) => ({ value: String(t), label: `Patamar ${t}` }))} />
                <DhSelect label="Tipo" value={ADVERSARY_KINDS.includes(a.kind as typeof ADVERSARY_KINDS[number]) ? a.kind : 'Padrão'} onChange={(v) => set('kind', v)} options={ADVERSARY_KINDS.map((k) => ({ value: k, label: k }))} />
              </>
            ) : <><em>Patamar {a.tier}</em><em>{a.kind}</em></>}
          </div>
        </div>
        <div className="dh-gmdif">
          <span>Dificuldade</span>
          {canEdit ? <Stepper value={a.difficulty} min={0} max={40} label="Dificuldade" onChange={(v) => set('difficulty', v)} /> : <b>{a.difficulty}</b>}
        </div>
      </header>

      <div className="dh-gmbody">
        <Inline multiline rows={2} maxLength={1500} value={a.description} onChange={(v) => set('description', v)} disabled={!canEdit} placeholder="Descrição" aria-label="Descrição" />
        <Fld label="Motivações e impulsos"><Inline value={a.motives} onChange={(v) => set('motives', v)} disabled={!canEdit} maxLength={600} placeholder="Ex.: caçar, proteger, enganar" aria-label="Motivações e impulsos" /></Fld>

        <div className="dh-track" aria-label="Limiares de dano do adversário">
          <div className="dh-track__seg dh-track__seg--minor"><b>Menor</b><small>1 PV</small></div>
          <div className="dh-track__cut"><small>a partir de</small>{canEdit ? <Stepper value={a.major} min={0} max={80} label="Limiar maior" onChange={(v) => set('major', v)} /> : <b>{a.major}</b>}</div>
          <div className="dh-track__seg dh-track__seg--major"><b>Maior</b><small>2 PV</small></div>
          <div className="dh-track__cut"><small>a partir de</small>{canEdit ? <Stepper value={a.severe} min={0} max={120} label="Limiar grave" onChange={(v) => set('severe', v)} /> : <b>{a.severe}</b>}</div>
          <div className="dh-track__seg dh-track__seg--severe"><b>Grave</b><small>3 PV</small></div>
        </div>

        <div className="dh-vitals">
          <div className="dh-vital dh-vital--hp">
            <div className="dh-vital__top"><span>Vida</span><b key={a.hp - a.hpMarked} className="dh-num">{a.hp - a.hpMarked}<small>/{a.hp}</small></b>{canEdit && <Stepper value={a.hp} min={1} max={30} label="Vida" onChange={(v) => set('hp', v)} />}</div>
            <Slots open={a.hp} total={Math.max(a.hp, 1)} marked={a.hpMarked} label="Vida do adversário" tone="hp" onChange={canEdit ? (n) => set('hpMarked', n) : undefined} />
          </div>
          <div className="dh-vital dh-vital--stress">
            <div className="dh-vital__top"><span>Fadiga</span><b key={a.stress - a.stressMarked} className="dh-num">{a.stress - a.stressMarked}<small>/{a.stress}</small></b>{canEdit && <Stepper value={a.stress} min={0} max={20} label="Fadiga" onChange={(v) => set('stress', v)} />}</div>
            <Slots open={a.stress} total={Math.max(a.stress, 1)} marked={a.stressMarked} label="Fadiga do adversário" tone="stress" onChange={canEdit ? (n) => set('stressMarked', n) : undefined} />
          </div>
        </div>

        {(canEdit || a.counters.length > 0) && (
          <>
            <Title>Marcadores</Title>
            <DhCounters counters={a.counters} canEdit={canEdit} label="Marcadores do adversário" onChange={(c) => set('counters', c)} />
          </>
        )}

        <div className="dh-atk">
          <Title>Ataque padrão</Title>
          <div className="dh-atk__grid">
            <Fld label="Nome" wide><Inline value={a.attackName} onChange={(v) => set('attackName', v)} disabled={!canEdit} maxLength={80} aria-label="Nome do ataque" /></Fld>
            <Fld label="Bônus">{canEdit ? <Stepper value={a.attackBonus} min={-5} max={20} label="Bônus de ataque" format={signed} onChange={(v) => set('attackBonus', v)} /> : <b>{signed(a.attackBonus)}</b>}</Fld>
            <Fld label="Alcance">{canEdit
              ? <DhSelect label="Alcance" value={a.attackRange} onChange={(v) => set('attackRange', v as DhAdversary['attackRange'])} options={RANGE_ORDER.map((r) => ({ value: r, label: RANGE_INFO[r].label }))} />
              : <b>{RANGE_INFO[a.attackRange].label}</b>}</Fld>
            <Fld label="Dano">{canEdit ? <Inline value={a.damage} onChange={(v) => set('damage', v)} maxLength={30} placeholder="2d8+3" aria-label="Dano" /> : <b>{a.damage}</b>}</Fld>
            <Fld label="Tipo">{canEdit
              ? <DhSelect label="Tipo de dano" value={a.damageType} onChange={(v) => set('damageType', v as DhAdversary['damageType'])} options={[{ value: 'fis', label: 'Físico' }, { value: 'mag', label: 'Mágico' }]} />
              : <b>{a.damageType === 'mag' ? 'Mágico' : 'Físico'}</b>}</Fld>
          </div>
          {canEdit && (
            <div className="dh-atk__roll">
              <span className="dh-seg" role="group" aria-label="Como rolar"><button type="button" className={adv === 'desv' ? 'is-on' : ''} onClick={() => setAdv(adv === 'desv' ? 'normal' : 'desv')}>Desvantagem</button><button type="button" className={adv === 'vant' ? 'is-on' : ''} onClick={() => setAdv(adv === 'vant' ? 'normal' : 'vant')}>Vantagem</button></span>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void attack()}>Rolar ataque (d20)</button>
              <button type="button" className="btn" disabled={busy} onClick={() => void damage()}>Rolar dano</button>
            </div>
          )}
          {out && <p className="dh-notice" role="status" onClick={() => setOut(null)}>{out}</p>}
        </div>

        <Title right={canEdit ? <button type="button" className="dh-link" onClick={() => set('experiences', [...a.experiences, { id: newId(), name: '', mod: 2 }])}>+ Experiência</button> : null}>Experiências</Title>
        <ul className="dh-gmexps">
          {a.experiences.map((e) => (
            <li key={e.id}>
              <Inline value={e.name} onChange={(v) => set('experiences', a.experiences.map((x) => (x.id === e.id ? { ...x, name: v } : x)))} disabled={!canEdit} placeholder="Experiência do adversário" maxLength={80} aria-label="Experiência" />
              {canEdit ? <Stepper value={e.mod} min={-5} max={12} label="Bônus" format={signed} onChange={(v) => set('experiences', a.experiences.map((x) => (x.id === e.id ? { ...x, mod: v } : x)))} /> : <b>{signed(e.mod)}</b>}
              {canEdit && <button type="button" className="dh-x" aria-label="Remover Experiência" onClick={() => set('experiences', a.experiences.filter((x) => x.id !== e.id))}>×</button>}
            </li>
          ))}
          {a.experiences.length === 0 && <li className="dh-empty">Nenhuma.</li>}
        </ul>

        <Features features={a.features} canEdit={canEdit} fear={fear} onChange={(f) => set('features', f)} onUse={(f) => void use(f, a.name)} />
        {msg && <p className="dh-notice" role="status" onClick={() => setMsg(null)}>{msg}</p>}
        {canEdit && <Fld label="Anotações do mestre"><Inline multiline rows={3} maxLength={8000} value={a.notes} onChange={(v) => set('notes', v)} aria-label="Anotações" /></Fld>}
      </div>
    </section>
  )
}

// ── ficha de ambiente ──

export function EnvironmentSheet({ row, campaignId, canEdit }: { row: GmRow<DhEnvironment>; campaignId: string; canEdit: boolean }) {
  const { data: e, update, status } = useGmSheet<DhEnvironment>(row.id, row.data, canEdit)
  const fear = useFear(campaignId)
  const { msg, setMsg, use } = useUse(campaignId, fear)
  const set = <K extends keyof DhEnvironment>(k: K, v: DhEnvironment[K]) => update((d) => ({ ...d, [k]: v }))
  return (
    <section className="dh-box dh-gmsheet">
      <header className="dh-gmhead">
        <div className="dh-gmhead__main">
          <p className="dh-gmhead__meta"><span>Ambiente</span>{canEdit && <SaveState status={status} />}</p>
          <Inline className="dh-gmsheet__name" value={e.name} onChange={(v) => set('name', v)} disabled={!canEdit} maxLength={120} aria-label="Nome" />
          <div className="dh-gmtags">
            {canEdit ? (
              <>
                <DhSelect label="Patamar" value={String(e.tier)} onChange={(v) => set('tier', Number(v) as DhEnvironment['tier'])} options={[1, 2, 3, 4].map((t) => ({ value: String(t), label: `Patamar ${t}` }))} />
                <DhSelect label="Tipo" value={ENVIRONMENT_KINDS.includes(e.kind as typeof ENVIRONMENT_KINDS[number]) ? e.kind : 'Exploração'} onChange={(v) => set('kind', v)} options={ENVIRONMENT_KINDS.map((k) => ({ value: k, label: k }))} />
              </>
            ) : <><em>Patamar {e.tier}</em><em>{e.kind}</em></>}
          </div>
        </div>
        <div className="dh-gmdif">
          <span>Dificuldade</span>
          {canEdit ? <Stepper value={e.difficulty} min={0} max={40} label="Dificuldade" onChange={(v) => set('difficulty', v)} /> : <b>{e.difficulty}</b>}
        </div>
      </header>
      <div className="dh-gmbody">
        <Inline multiline rows={2} maxLength={1500} value={e.description} onChange={(v) => set('description', v)} disabled={!canEdit} placeholder="Descrição" aria-label="Descrição" />
        <Fld label="Impulsos"><Inline value={e.impulses} onChange={(v) => set('impulses', v)} disabled={!canEdit} maxLength={600} placeholder="Ex.: desorientar e confundir" aria-label="Impulsos" /></Fld>
        <Fld label="Adversários"><Inline multiline rows={2} maxLength={800} value={e.adversaries} onChange={(v) => set('adversaries', v)} disabled={!canEdit} placeholder="Quem costuma aparecer aqui" aria-label="Adversários" /></Fld>
        {(canEdit || e.counters.length > 0) && (
          <>
            <Title>Marcadores</Title>
            <DhCounters counters={e.counters} canEdit={canEdit} label="Marcadores do ambiente" onChange={(c) => set('counters', c)} />
          </>
        )}
        <Features features={e.features} canEdit={canEdit} fear={fear} onChange={(f) => set('features', f)} onUse={(f) => void use(f, e.name)} />
        {msg && <p className="dh-notice" role="status" onClick={() => setMsg(null)}>{msg}</p>}
        {canEdit && <Fld label="Anotações do mestre"><Inline multiline rows={3} maxLength={8000} value={e.notes} onChange={(v) => set('notes', v)} aria-label="Anotações" /></Fld>}
      </div>
    </section>
  )
}
