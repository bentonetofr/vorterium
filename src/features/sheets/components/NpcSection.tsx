import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type SyntheticEvent } from 'react'
import {
  createNpc,
  deleteNpc,
  listNpcs,
  npcReady,
  setNpcVisible,
  subscribeNpcs,
  type NpcFeed,
  type NpcSheetBase,
  type SheetTable,
} from '../services/npcService'
import './SheetPanel.css'

// ────────────────────────────────────────────────────────
// Seção de NPCs na aba Ficha, igual pra todos os sistemas.
//   • Mestre: "+ Nova ficha de NPC", os cards dos NPCs (mostrar/esconder
//     dos jogadores, apagar) e a ficha completa do NPC aberto, editável.
//   • Jogador: só aparece se o mestre mostrou algum NPC; abre a ficha
//     completa em modo leitura.
// Cada painel de sistema diz como resumir o card e como desenhar a ficha.
// ────────────────────────────────────────────────────────

export interface NpcSummary {
  /** Linha do card, ex.: "Berserker · Nv 3". */
  line:      string
  portrait?: string | null
  bars?:     ReactNode
}

interface NpcSectionProps<T extends NpcSheetBase> {
  table:      SheetTable
  campaignId: string
  userRole:   'master' | 'player'
  summary:    (sheet: T) => NpcSummary
  /** A ficha completa do sistema. readOnly = jogador lendo NPC mostrado. */
  renderSheet: (sheet: T, opts: { readOnly: boolean; onUpdated: (sheet: T) => void }) => ReactNode
}

export function NpcSection<T extends NpcSheetBase>({ table, campaignId, userRole, summary, renderSheet }: NpcSectionProps<T>) {
  const isMaster = userRole === 'master'
  const [ready, setReady]     = useState(false)
  const [npcs, setNpcs]       = useState<T[]>([])
  const [error, setError]     = useState<string | null>(null)
  const [busy, setBusy]       = useState<string | null>(null)
  // Cópia tirada ao abrir (igual à visão do mestre): a lista segue o
  // Realtime, a ficha aberta só muda com os saves de quem está editando.
  const [open, setOpen]       = useState<T | null>(null)
  const feed    = useRef<NpcFeed | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => { void npcReady().then(setReady) }, [])

  const load = useCallback(async () => {
    try {
      const list = await listNpcs<T>(table, campaignId)
      setNpcs(list)
      setError(null)
      // NPC aberto sumiu (apagado, ou o mestre escondeu): fecha.
      setOpen((prev) => (prev && !list.some((n) => n.id === prev.id) ? null : prev))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as fichas de NPC.')
    }
  }, [table, campaignId])

  useEffect(() => {
    if (!ready) return
    void load()
    const f = subscribeNpcs(table, campaignId, () => { void load() })
    feed.current = f
    // Voltou pra aba depois de um tempo: confere de novo (a conexão pode ter caído).
    const onVisible = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { f.stop(); feed.current = null; document.removeEventListener('visibilitychange', onVisible) }
  }, [ready, table, campaignId, load])

  useEffect(() => {
    if (!open || !window.matchMedia('(max-width: 768px)').matches) return
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [open?.id])

  function handleUpdated(updated: T) {
    setNpcs((prev) => prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n)))
    setOpen((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev))
  }

  async function run(key: string, job: () => Promise<void>) {
    setBusy(key)
    setError(null)
    try { await job() } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado. Tente de novo.')
    } finally { setBusy(null) }
  }

  const create = () => run('new', async () => {
    const npc = await createNpc<T>(table, campaignId)
    setNpcs((prev) => [...prev, npc])
    setOpen(npc)
  })

  const toggle = (npc: T) => run(npc.id, async () => {
    handleUpdated(await setNpcVisible<T>(table, npc.id, !npc.npc_visible))
    feed.current?.ping()
  })

  const remove = (npc: T) => {
    const name = npc.character_name?.trim() || 'este NPC'
    if (!window.confirm(`Apagar a ficha de ${name}? Não dá pra desfazer.`)) return
    void run(npc.id, async () => {
      await deleteNpc(table, npc.id)
      setNpcs((prev) => prev.filter((n) => n.id !== npc.id))
      setOpen((prev) => (prev?.id === npc.id ? null : prev))
      feed.current?.ping()
    })
  }

  if (!ready) return null
  // Jogador sem NPC mostrado: a seção nem aparece.
  if (!isMaster && npcs.length === 0) return null

  const latest = open ? npcs.find((n) => n.id === open.id) ?? null : null
  const outdated = !!(latest && open && Date.parse(latest.updated_at) > Date.parse(open.updated_at))

  return (
    <section className="npc-section" aria-label={isMaster ? 'NPCs' : 'Fichas da mesa'}>
      <header className="npc-section__head">
        <h4 className="npc-section__title">
          {isMaster ? 'NPCs' : 'Fichas da mesa'}
          <span className="npc-section__count">{npcs.length}</span>
        </h4>
        {isMaster && (
          <button type="button" className="btn btn-primary npc-section__new" onClick={() => void create()} disabled={busy === 'new'}>
            {busy === 'new' ? 'Criando...' : '+ Nova ficha de NPC'}
          </button>
        )}
      </header>

      <p className="npc-section__hint">
        {isMaster
          ? 'Fichas suas pra aliados, inimigos e figurantes. Toda ficha nasce escondida: os jogadores só veem as que você mostrar, e só leem.'
          : 'NPCs que o mestre mostrou pra mesa. Você pode ler, mas só o mestre mexe.'}
      </p>

      {error && <div className="sheet-feedback sheet-feedback--error" role="alert">{error}</div>}

      {npcs.length === 0
        ? <p className="sheet-empty">Nenhum NPC ainda. Crie o primeiro no botão acima.</p>
        : (
          <div className="sheets-cards anim-stagger">
            {npcs.map((npc) => {
              const sum = summary(npc)
              const name = npc.character_name?.trim() || 'Sem nome'
              const active = open?.id === npc.id
              return (
                <div key={npc.id} className={`sheet-card npc-card ${active ? 'sheet-card--active' : ''}${isMaster && !npc.npc_visible ? ' npc-card--hidden' : ''}`}>
                  <button type="button" className="npc-card__open" onClick={() => setOpen(active ? null : npc)} aria-pressed={active}>
                    <div className="sheet-card__top">
                      <span className="sheet-card__avatar" aria-hidden={sum.portrait ? undefined : true}>
                        {sum.portrait ? <img src={sum.portrait} alt="" loading="lazy" /> : name.charAt(0).toUpperCase()}
                      </span>
                      <span className="sheet-card__player">{name}</span>
                    </div>
                    <span className="sheet-card__char">{sum.line}</span>
                    {sum.bars && <div className="sheet-card__bars">{sum.bars}</div>}
                  </button>
                  {isMaster && (
                    <div className="npc-card__actions">
                      <button
                        type="button"
                        className={`npc-card__eye ${npc.npc_visible ? 'is-on' : ''}`}
                        onClick={() => void toggle(npc)} disabled={busy === npc.id}
                        aria-pressed={!!npc.npc_visible}
                        title={npc.npc_visible ? 'Os jogadores veem esta ficha. Clique pra esconder.' : 'Só você vê esta ficha. Clique pra mostrar aos jogadores.'}
                      >
                        {npc.npc_visible ? '◉ Visível pros jogadores' : '◌ Escondido'}
                      </button>
                      <button type="button" className="npc-card__del" onClick={() => remove(npc)} disabled={busy === npc.id} aria-label={`Apagar a ficha de ${name}`} title="Apagar">
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      {open && (
        <div className="sheets-list__form" ref={formRef}>
          {outdated && latest && (
            <div className="sheet-outdated" role="status">
              <span>{isMaster ? 'Esta ficha mudou em outra aba. Recarregar?' : 'O mestre atualizou esta ficha. Recarregar?'}</span>
              <button type="button" className="btn btn-ghost sheet-outdated__btn" onClick={() => setOpen(latest)}>Recarregar</button>
            </div>
          )}
          <div key={open.id} className="anim-page">
            {isMaster
              ? renderSheet(open, { readOnly: false, onUpdated: handleUpdated })
              : <ReadOnlyFrame>{renderSheet(open, { readOnly: true, onUpdated: () => {} })}</ReadOnlyFrame>}
          </div>
        </div>
      )}
    </section>
  )
}

// ────────────────────────────────────────────────────────
// Moldura "só leitura": a ficha aparece inteira (com as abas funcionando),
// mas nada muda. Campos de texto viram readOnly; cliques e teclas em
// botões, pontinhos e seletores são barrados. O banco também barra
// (só o mestre altera NPC), isso aqui é pra ninguém achar que mexeu.
// ────────────────────────────────────────────────────────

const TEXT_FIELDS = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=color]), textarea'
const CONTROLS = 'button, input, select, textarea, label, a, summary, [role="slider"], [role="button"], [role="checkbox"], [contenteditable]'
const READ_KEYS = new Set(['Tab', 'Escape', 'Shift', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'])

export function ReadOnlyFrame({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const lock = () => {
      root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(TEXT_FIELDS).forEach((el) => { el.readOnly = true })
    }
    lock()
    const watch = new MutationObserver(lock)
    watch.observe(root, { childList: true, subtree: true })
    return () => watch.disconnect()
  }, [])

  const isTab = (t: HTMLElement) => !!t.closest('[role="tab"]')

  const blockPointer = (e: SyntheticEvent) => {
    const t = e.target as HTMLElement
    if (isTab(t)) return
    const el = t.closest(CONTROLS)
    // Texto readOnly pode ser clicado (pra selecionar e copiar).
    if (!el || el.matches(TEXT_FIELDS)) return
    e.preventDefault()
    e.stopPropagation()
  }

  const blockKeys = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement
    if (isTab(t)) return
    if (t.matches(TEXT_FIELDS)) {
      // Ler e copiar à vontade; o readOnly já impede de digitar.
      if (READ_KEYS.has(e.key) || e.ctrlKey || e.metaKey) return
    } else if (e.key === 'Tab' || e.key === 'Shift' || e.key === 'Escape') return
    e.preventDefault()
    e.stopPropagation()
  }

  const stop = (e: SyntheticEvent) => { e.preventDefault(); e.stopPropagation() }

  return (
    <div
      ref={ref}
      className="npc-readonly"
      onClickCapture={blockPointer}
      onMouseDownCapture={blockPointer}
      onPointerDownCapture={blockPointer}
      onKeyDownCapture={blockKeys}
      onBeforeInputCapture={stop}
      onPasteCapture={stop}
      onCutCapture={stop}
      onDropCapture={stop}
    >
      <div className="npc-readonly__badge" role="note">Só leitura: esta ficha é do mestre.</div>
      {children}
    </div>
  )
}
