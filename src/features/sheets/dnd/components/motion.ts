import { useRef, useState } from 'react'

// ────────────────────────────────────────────────────────
// Movimento da ficha de D&D que o CSS sozinho não faz: a linha removida
// encolhe e some antes de sair da lista, a linha recém-adicionada ganha um
// brilho (as que já estavam não) e o número que mudou dá um pulinho. Com
// "menos movimento" no sistema, tudo acontece na hora (DndMotion.css).
// ────────────────────────────────────────────────────────

const LEAVE_MS = 280

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  // a opção "Reduzir animações" das Configurações do site vale tanto quanto o pedido do sistema
  return document.documentElement.hasAttribute('data-reduce-motion') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * Tira uma linha da ficha com animação. `from` é o botão clicado: a linha dele
 * (o <li>, ou o elemento com data-leave) encolhe e some enquanto o servidor
 * apaga (`remote`); só com as duas coisas prontas a lista perde o item
 * (`commit`). Se o servidor falhar, a linha volta e o erro segue para quem chamou.
 */
export async function leaveThen(from: Element | null | undefined, remote: () => Promise<unknown>, commit: () => void): Promise<void> {
  const el = from?.closest<HTMLElement>('[data-leave], li') ?? null
  if (!el || prefersReducedMotion() || typeof el.animate !== 'function') {
    await remote()
    commit()
    return
  }

  // Numa coluna (lista empilhada) a linha fecha a altura e o vão; numa grade ou numa fileira de etiquetas ela só encolhe.
  const parent = el.parentElement ? getComputedStyle(el.parentElement) : null
  const stacked = !!parent && (parent.display === 'block' || (parent.display.endsWith('flex') && parent.flexDirection.startsWith('column')))
  const gap = stacked ? Number.parseFloat(parent!.rowGap) || 0 : 0
  const height = el.getBoundingClientRect().height
  const keyframes: Keyframe[] = stacked
    ? [
        { height: `${height}px`, opacity: 1, transform: 'none', marginBottom: '0px' },
        { height: `${height}px`, opacity: 0, transform: 'translateX(24px) scale(0.97)', marginBottom: '0px', offset: 0.5 },
        { height: '0px', opacity: 0, transform: 'translateX(24px) scale(0.97)', marginBottom: `${-gap}px`, paddingTop: '0px', paddingBottom: '0px', borderTopWidth: '0px', borderBottomWidth: '0px' },
      ]
    : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.7)' }]

  el.style.overflow = 'hidden'
  el.style.pointerEvents = 'none'
  const anim = el.animate(keyframes, { duration: LEAVE_MS, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' })
  const restore = () => { anim.cancel(); el.style.overflow = ''; el.style.pointerEvents = '' }
  try {
    await Promise.all([remote(), anim.finished.then(() => {}, () => {})])
  } catch (err) {
    restore()
    throw err
  }
  commit()
  // se a lista não tirou a linha (outra pessoa a recriou, por exemplo), ela volta ao normal em vez de ficar escondida
  window.setTimeout(() => { if (el.isConnected) restore() }, 120)
}

/**
 * Diz quais chaves entraram depois que a lista apareceu: as linhas
 * recém-adicionadas ganham um brilho; as que já estavam (ao abrir a aba) não.
 * `keys` são as da lista inteira (com filtros, passar todas, não só as visíveis).
 */
export function useFreshKeys(keys: readonly string[]): (key: string) => boolean {
  const initial = useRef<Set<string> | null>(null)
  if (initial.current === null) initial.current = new Set(keys)
  return (key) => !initial.current!.has(key)
}

/**
 * Conta quantas vezes o valor mudou desde que apareceu (0 = ainda não mudou).
 * Usado como `key` do número para ele dar um pulinho só quando muda, e não ao abrir a aba.
 */
export function useChangeTick(value: unknown): number {
  const [seen, setSeen] = useState({ value, tick: 0 })
  if (!Object.is(seen.value, value)) {
    const next = { value, tick: seen.tick + 1 }
    setSeen(next)
    return next.tick
  }
  return seen.tick
}
