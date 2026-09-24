import { useLayoutEffect, useRef, useState } from 'react'

// ────────────────────────────────────────────────────────
// Destaque que desliza até a aba ativa. Vai DENTRO da barra de abas
// (role="tablist"), procura o [aria-selected="true"] do mesmo pai e se
// posiciona embaixo dele — as abas ficam por cima (motion.css). Funciona
// com barra em linha ou em grade (celular), e acompanha redimensionamento.
// ────────────────────────────────────────────────────────

interface TabIndicatorProps {
  /** Muda sempre que a aba ativa muda — dispara o reposicionamento. */
  activeKey: string
}

export function TabIndicator({ activeKey }: TabIndicatorProps) {
  const ref = useRef<HTMLSpanElement>(null)
  // Só liga a transição depois da 1ª posição — senão ele "voa" do canto
  // ao abrir a página.
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    const indicator = ref.current
    const list = indicator?.parentElement
    if (!indicator || !list) return

    function place() {
      const active = list!.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
      if (!active) { indicator!.style.opacity = '0'; return }
      indicator!.style.opacity = '1'
      indicator!.style.width  = `${active.offsetWidth}px`
      indicator!.style.height = `${active.offsetHeight}px`
      indicator!.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`

      // Barra que rola pro lado: traz a aba ativa pra dentro da vista.
      if (list!.scrollWidth > list!.clientWidth) {
        const left  = active.offsetLeft - 16
        const right = active.offsetLeft + active.offsetWidth + 16 - list!.clientWidth
        if (list!.scrollLeft > left) list!.scrollTo({ left, behavior: 'smooth' })
        else if (list!.scrollLeft < right) list!.scrollTo({ left: right, behavior: 'smooth' })
      }
    }

    place()
    const frame = requestAnimationFrame(() => setReady(true))
    const observer = new ResizeObserver(place)
    observer.observe(list)
    list.querySelectorAll('[role="tab"]').forEach((tab) => observer.observe(tab))
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [activeKey])

  return (
    <span
      ref={ref}
      className={`tab-indicator${ready ? ' tab-indicator--ready' : ''}`}
      aria-hidden="true"
    />
  )
}

/**
 * Direção da troca de aba (1 = foi pra direita, -1 = pra esquerda) — o
 * painel novo entra deslizando do lado certo (classe .anim-tab-panel).
 */
export function useTabDirection<T>(tabs: readonly T[], active: T): 1 | -1 {
  const index = tabs.indexOf(active)
  const [seen, setSeen] = useState<{ index: number; direction: 1 | -1 }>({ index, direction: 1 })
  // Ajuste de estado durante a renderização (padrão do React pra "valor
  // anterior") — sem efeito, a direção já vale na mesma renderização.
  if (seen.index !== index) {
    const direction = index > seen.index ? 1 : -1
    setSeen({ index, direction })
    return direction
  }
  return seen.direction
}

/**
 * Mantém a barra de abas parada na tela ao trocar de aba. Sem isso, sair
 * de uma aba comprida (Inventário) pra uma curta (Atributos) encolhe a
 * página, o navegador puxa a rolagem pra cima e a barra "desce".
 *
 * `selectTab` mede quanto espaço há da barra até o fim da tela e reserva
 * essa altura mínima pros painéis (`panelsStyle`) — a página nunca fica
 * mais curta que isso, então a rolagem não muda. A altura é recalculada a
 * cada troca, então sobra só o necessário.
 */
export function useStableTabPanels<T>(setActive: (tab: T) => void) {
  const tabsRef = useRef<HTMLElement>(null)
  const [minHeight, setMinHeight] = useState<number | undefined>(undefined)

  function selectTab(tab: T) {
    const tabs = tabsRef.current
    if (tabs) {
      const { bottom } = tabs.getBoundingClientRect()
      setMinHeight(Math.max(0, Math.ceil(window.innerHeight - bottom)))
    }
    setActive(tab)
  }

  return { tabsRef, selectTab, panelsStyle: { minHeight } }
}
