import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { FloatingStore, type FloatingState, type WinState } from './floatingStore'
import './Floating.css'

// ────────────────────────────────────────────────────────
// A mesa de janelas: uma loja por campanha (lembra o que estava aberto), os ganchos para as telas abrirem e fecharem janelas
// e a barra de baixo com as janelas abertas e minimizadas.
// ────────────────────────────────────────────────────────

const Ctx = createContext<FloatingStore | null>(null)

const viewport = () => ({ vw: window.innerWidth, vh: window.innerHeight })

export function FloatingProvider({ scope, children }: { scope: string; children: ReactNode }) {
  const store = useMemo(() => new FloatingStore(`vorterium:janelas:${scope}`, viewport), [scope])

  useEffect(() => {
    store.fit()
    const onResize = () => store.fit()
    const onHide = () => store.flush()
    window.addEventListener('resize', onResize)
    window.addEventListener('pagehide', onHide)
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('pagehide', onHide); store.flush() }
  }, [store])

  return (
    <Ctx.Provider value={store}>
      {children}
      <FloatingDock store={store} />
    </Ctx.Provider>
  )
}

export function useFloatingStore(): FloatingStore {
  const s = useContext(Ctx)
  if (!s) throw new Error('useFloatingStore fora do FloatingProvider')
  return s
}

/** Para telas que funcionam com ou sem janelas (null = sem provedor). */
export function useFloatingStoreOptional(): FloatingStore | null {
  return useContext(Ctx)
}

const never = () => () => {}

/** A janela de um id (muda só quando ela mesma muda). */
export function useFloatingWin(id: string): WinState | undefined {
  const store = useContext(Ctx)
  return useSyncExternalStore(store ? store.subscribe : never, () => store?.getState().wins.find((w) => w.id === id), () => undefined)
}

/** Os ids abertos que começam com o prefixo, em ordem de id (a tela redesenha só quando a lista muda). */
export function useOpenIds(prefix: string): string[] {
  const store = useContext(Ctx)
  const key = useSyncExternalStore(store ? store.subscribe : never, () => (store ? store.idsWithPrefix(prefix).join('\n') : ''), () => '')
  return useMemo(() => (key ? key.split('\n') : []), [key])
}

/** A janela que está na frente (a do topo entre as que não estão minimizadas). */
export function frontId(state: FloatingState): string | null {
  let best: WinState | null = null
  for (const w of state.wins) if (!w.min && (!best || w.z > best.z)) best = w
  return best?.id ?? null
}

export function useIsFront(id: string): boolean {
  const store = useContext(Ctx)
  return useSyncExternalStore(store ? store.subscribe : never, () => (store ? frontId(store.getState()) === id : false), () => false)
}

// ── barra de baixo ─────────────────────────────────────────

function FloatingDock({ store }: { store: FloatingStore }) {
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState)
  useSyncExternalStore(store.subscribe, store.getMetaVersion, store.getMetaVersion)
  // só entram na barra as janelas que alguma tela está mesmo desenhando (têm título)
  const list = state.wins.filter((w) => store.getMeta(w.id))
  if (list.length === 0) return null
  const front = frontId(state)
  const shown = list.filter((w) => !w.min).length

  return createPortal(
    <div className="fwdock" role="toolbar" aria-label="Janelas abertas">
      <ul className="fwdock__list">
        {list.map((w) => {
          const meta = store.getMeta(w.id)!
          const cls = `fwchip${w.min ? ' is-min' : ''}${front === w.id ? ' is-front' : ''}`
          return (
            <li key={w.id} className={cls}>
              <button type="button" className="fwchip__main" aria-pressed={!w.min}
                title={w.min ? 'Mostrar a janela' : front === w.id ? 'Minimizar a janela' : 'Trazer para a frente'}
                onClick={() => { if (w.min || front !== w.id) store.open(w.id); else store.dispatch({ type: 'min', id: w.id, value: true }) }}>
                <span className="fwchip__name">{meta.title}</span>
                {meta.badge && <small>{meta.badge}</small>}
              </button>
              <button type="button" className="fwchip__x" aria-label={`Fechar ${meta.title}`} onClick={() => store.close(w.id)}>×</button>
            </li>
          )
        })}
      </ul>
      <div className="fwdock__tools">
        <button type="button" className="fwdock__btn" disabled={shown === 0} onClick={() => store.arrange('cascade')}>Cascata</button>
        <button type="button" className="fwdock__btn" disabled={shown === 0} onClick={() => store.arrange('tile')}>Lado a lado</button>
        <button type="button" className="fwdock__btn fwdock__btn--danger" onClick={() => store.closeAll()}>Fechar todas</button>
      </div>
    </div>,
    document.body,
  )
}
