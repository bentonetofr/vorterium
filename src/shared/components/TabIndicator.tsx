import { useLayoutEffect, useRef, useState } from 'react'

// ────────────────────────────────────────────────────────
// Destaque que desliza até a aba ativa. Vai DENTRO da barra de abas
// (role="tablist"), procura o [aria-selected="true"] do mesmo pai e se
// posiciona embaixo dele — as abas ficam por cima (motion.css). Funciona
// com barra em linha ou em grade (celular), e acompanha redimensionamento.
// ────────────────────────────────────────────────────────

/**
 * Tem mais abas escondidas de cada lado da barra que rola pro lado? (folga de 2 px por causa de arredondamento)
 */
export function scrollHints(scrollLeft: number, clientWidth: number, scrollWidth: number): { left: boolean; right: boolean } {
  return { left: scrollLeft > 2, right: scrollLeft + clientWidth < scrollWidth - 2 }
}

/** Largura da vaga de cada seta, fora da barra (a seta tem 30 px e 4 px de respiro). */
const ARROW_SLOT = 34

/**
 * Setas FORA da barra de abas, uma de cada lado dela, quando a barra rola pro lado: avisam que há mais abas à esquerda ou à direita
 * (a de Lore, por exemplo, ficava escondida sem ninguém perceber). Clicar anda a barra.
 *
 * As setas vão como irmãs da barra, em posição absoluta nas margens que a barra reserva (data-scrolls, em motion.css), então nunca
 * cobrem uma aba. Só aparece a seta do lado que tem o que mostrar; a vaga do outro lado fica vazia pra a barra não mudar de largura.
 */
function useScrollArrows(list: HTMLElement | null | undefined) {
  useLayoutEffect(() => {
    const parent = list?.parentElement
    if (!list || !parent) return
    // os irmãos absolutos se medem pelo pai: ele precisa ser a referência de posição
    const madeRelative = getComputedStyle(parent).position === 'static'
    if (madeRelative) parent.style.position = 'relative'
    const make = (side: 'left' | 'right') => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = `tabs-more tabs-more--${side}`
      btn.tabIndex = -1
      btn.setAttribute('aria-hidden', 'true')
      btn.textContent = side === 'left' ? '‹' : '›'
      btn.title = side === 'left' ? 'Mais abas à esquerda' : 'Mais abas à direita'
      btn.style.display = 'none'
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        list.scrollBy({ left: (side === 'left' ? -1 : 1) * Math.max(120, list.clientWidth * 0.6), behavior: 'smooth' })
      })
      return btn
    }
    const left = make('left')
    const right = make('right')
    parent.insertBefore(left, list)
    list.after(right)

    const update = () => {
      // com as margens reservadas a barra fica menor; a largura de verdade é a de agora mais o que está reservado
      const reserved = list.hasAttribute('data-scrolls') ? ARROW_SLOT * 2 : 0
      const scrolls = list.scrollWidth > list.clientWidth + reserved + 2
      list.toggleAttribute('data-scrolls', scrolls)
      const h = scrolls ? scrollHints(list.scrollLeft, list.clientWidth, list.scrollWidth) : { left: false, right: false }
      const place = (btn: HTMLElement, show: boolean, x: number) => {
        btn.style.display = show ? '' : 'none'
        btn.style.top = `${list.offsetTop}px`
        btn.style.height = `${list.offsetHeight}px`
        btn.style.left = `${x}px`
      }
      place(left, h.left, list.offsetLeft - ARROW_SLOT)
      place(right, h.right, list.offsetLeft + list.offsetWidth + 4)
    }
    update()
    list.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(list)
    observer.observe(parent)
    list.querySelectorAll('[role="tab"]').forEach((tab) => observer.observe(tab))
    return () => {
      list.removeEventListener('scroll', update)
      observer.disconnect()
      left.remove()
      right.remove()
      list.removeAttribute('data-scrolls')
      if (madeRelative) parent.style.position = ''
    }
  }, [list])
}

interface TabIndicatorProps {
  /** Muda sempre que a aba ativa muda — dispara o reposicionamento. */
  activeKey: string
}

export function TabIndicator({ activeKey }: TabIndicatorProps) {
  const ref = useRef<HTMLSpanElement>(null)
  // Só liga a transição depois da 1ª posição — senão ele "voa" do canto
  // ao abrir a página.
  const [ready, setReady] = useState(false)
  // a barra (pai do destaque) ganha as setas de "tem mais abas pro lado"
  const [list, setList] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => { setList(ref.current?.parentElement ?? null) }, [])
  useScrollArrows(list)

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
