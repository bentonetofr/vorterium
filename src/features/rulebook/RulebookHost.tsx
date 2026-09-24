import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import './RulebookHost.css'

// ────────────────────────────────────────────────────────
// Leitor do livro que sobrevive à troca de aba/seção.
//
// O leitor de PDF do navegador não deixa o site ler (nem guardar) a
// página em que a pessoa está — e desmontar o <iframe> faz o livro voltar
// pro começo. Então o <iframe> é criado UMA vez aqui, no layout privado, e
// nunca desmonta enquanto a pessoa navega pelo site. A aba "Livro" só
// reserva o espaço (RulebookSlot) e o leitor é desenhado por cima desse
// espaço, acompanhando a posição dele a cada quadro. Fora da aba, o leitor
// fica invisível, mas com a mesma página, zoom e rolagem.
// ────────────────────────────────────────────────────────

interface RulebookHostValue {
  /** Mostra o livro `url` sobre `slot`; devolve a função que o esconde de novo. */
  attach: (url: string, title: string, slot: HTMLElement) => () => void
}

const RulebookHostContext = createContext<RulebookHostValue | null>(null)

export function RulebookHostProvider({ children }: { children: ReactNode }) {
  const [book, setBook]       = useState<{ url: string; title: string } | null>(null)
  const [visible, setVisible] = useState(false)
  const slotRef  = useRef<HTMLElement | null>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)

  const attach = useCallback((url: string, title: string, slot: HTMLElement) => {
    slotRef.current = slot
    setBook((prev) => (prev?.url === url ? prev : { url, title }))
    setVisible(true)
    return () => {
      if (slotRef.current !== slot) return
      slotRef.current = null
      setVisible(false)
    }
  }, [])

  // Cola o leitor no espaço reservado, em coordenadas da PÁGINA (position:
  // absolute) — ele rola junto com o site sozinho, sem código rodando
  // durante a rolagem (nem a do site, nem a de dentro do livro). Só
  // reposiciona quando algo muda de tamanho e, por um instante, durante a
  // animação de entrada da aba. E só escreve no estilo se a posição mudou:
  // redimensionar o leitor à toa faz o PDF se recalcular inteiro.
  useEffect(() => {
    if (!visible) return
    let last = ''
    let frame = 0
    function place() {
      const slot = slotRef.current
      const iframe = frameRef.current
      if (!slot || !iframe) return
      const r = slot.getBoundingClientRect()
      const left = Math.round(r.left + window.scrollX)
      const top  = Math.round(r.top + window.scrollY)
      const next = `${left},${top},${Math.round(r.width)},${Math.round(r.height)}`
      if (next === last) return
      last = next
      iframe.style.transform = `translate(${left}px, ${top}px)`
      iframe.style.width  = `${Math.round(r.width)}px`
      iframe.style.height = `${Math.round(r.height)}px`
    }
    // Acompanha a animação de entrada da aba (~0,5 s) quadro a quadro.
    const followUntil = performance.now() + 700
    function follow() {
      place()
      if (performance.now() < followUntil) frame = requestAnimationFrame(follow)
    }
    follow()

    const observer = new ResizeObserver(place)
    if (slotRef.current) observer.observe(slotRef.current)
    observer.observe(document.body)
    window.addEventListener('resize', place)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', place)
    }
  }, [visible, book])

  return (
    <RulebookHostContext.Provider value={{ attach }}>
      {children}
      {book && (
        <iframe
          ref={frameRef}
          className={`rulebook-host${visible ? ' rulebook-host--visible' : ''}`}
          src={`${book.url}#navpanes=0&view=FitH`}
          title={book.title}
          aria-hidden={!visible || undefined}
          tabIndex={visible ? undefined : -1}
        />
      )}
    </RulebookHostContext.Provider>
  )
}

/** Espaço da aba "Livro" onde o leitor persistente aparece. */
export function RulebookSlot({ url, title, className }: { url: string; title: string; className?: string }) {
  const host = useContext(RulebookHostContext)
  const slotRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!host || !slotRef.current) return
    return host.attach(url, title, slotRef.current)
  }, [host, url, title])

  // Fora do provider (não deveria acontecer): leitor comum, sem memória.
  if (!host) return <iframe className={className} src={`${url}#navpanes=0&view=FitH`} title={title} />
  return <div ref={slotRef} className={className} />
}
