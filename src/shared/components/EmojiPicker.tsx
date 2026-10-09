import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import './EmojiPicker.css'
import { Loader } from './Loader'

// ────────────────────────────────────────────────────────
// Seletor de emojis do site (chat e caderno) — a biblioteca inteira do
// Unicode, como no WhatsApp: todas as categorias, busca, tons de pele e
// "usados recentemente". Usa o emoji-mart (componente pronto) com os nomes
// e apelidos em português do emojibase/CLDR ("kkk", "s2", "coração"…),
// então a busca funciona em português, com ou sem acento.
//
// O pacote (≈1 MB) só é baixado quando alguém abre os emojis pela primeira
// vez. A janela abre por cima de tudo (portal), perto do botão.
// ────────────────────────────────────────────────────────

interface Loaded {
  Picker: new (props: Record<string, unknown>) => HTMLElement
  data:   unknown
  i18n:   unknown
}

let loader: Promise<Loaded> | null = null

const strip = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '')

function loadEmojiMart(): Promise<Loaded> {
  loader ??= Promise.all([
    import('emoji-mart'),
    import('@emoji-mart/data'),
    import('@emoji-mart/data/i18n/pt.json'),
    import('emojibase-data/pt/compact.json'),
  ]).then(([mart, dataMod, i18nMod, ptMod]) => {
    const data = dataMod.default as { emojis: Record<string, { name: string; keywords: string[]; skins: { unified: string }[] }> }
    const pt = ptMod.default as { hexcode: string; label: string; tags?: string[] }[]
    const key = (hex: string) => hex.toUpperCase().replace(/-FE0F/g, '')
    const byHex = new Map(pt.map((e) => [key(e.hexcode), e]))
    // Nome e palavras em português (com e sem acento) antes das em inglês.
    for (const e of Object.values(data.emojis)) {
      const p = byHex.get(key(e.skins[0]?.unified ?? ''))
      if (!p) continue
      const words = [p.label, ...(p.tags ?? [])]
      e.keywords = [...new Set([...words, ...words.map(strip), ...e.keywords])]
      e.name = p.label.charAt(0).toUpperCase() + p.label.slice(1)
    }
    return { Picker: mart.Picker as unknown as Loaded['Picker'], data, i18n: i18nMod.default }
  })
  return loader
}

interface EmojiPickerButtonProps {
  /** Emoji escolhido (o caractere, ex.: "😂"). A janela continua aberta. */
  onPick:     (emoji: string) => void
  className?: string
  label?:     string
  /** Não tira o foco do campo ao clicar no botão (ex.: folha do caderno). */
  keepFocus?: boolean
}

export function EmojiPickerButton({ onPick, className, label = 'Emojis', keepFocus }: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState<CSSProperties | null>(null)
  const [loading, setLoading] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const pickRef = useRef(onPick)
  pickRef.current = onPick

  // Posição: acima do botão (ou embaixo, se não couber), alinhada à direita dele.
  useLayoutEffect(() => {
    if (!open || !btn.current) return
    const place = () => {
      const r = btn.current!.getBoundingClientRect()
      const vw = window.innerWidth, vh = window.innerHeight
      const w = Math.min(352, vw - 16), h = 420
      const left = Math.max(8, Math.min(r.right - w, vw - w - 8))
      const top = r.top - h - 8 >= 8 ? r.top - h - 8 : Math.min(r.bottom + 8, vh - h - 8)
      setStyle({ left, top: Math.max(8, top), width: w })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open])

  // Monta o seletor do emoji-mart quando abre.
  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    const perLine = Math.max(6, Math.min(8, Math.floor((Math.min(352, window.innerWidth - 16) - 28) / 36)))
    void loadEmojiMart().then(({ Picker, data, i18n }) => {
      if (!alive || !host.current) return
      const picker = new Picker({
        data,
        i18n,
        set: 'native',
        theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
        previewPosition: 'none',
        skinTonePosition: 'search',
        navPosition: 'top',
        searchPosition: 'sticky',
        maxFrequentRows: 2,
        perLine,
        emojiSize: 22,
        emojiButtonSize: 36,
        autoFocus: !window.matchMedia('(pointer: coarse)').matches,
        onEmojiSelect: (e: { native?: string }) => { if (e.native) pickRef.current(e.native) },
      })
      host.current.replaceChildren(picker)
      setLoading(false)
    }).catch(() => { if (alive) setLoading(false) })
    return () => { alive = false; host.current?.replaceChildren() }
  }, [open])

  // Fecha com clique fora ou Esc (Esc só fecha os emojis, não a janela de trás).
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      const t = e.target as Node
      if (!pop.current?.contains(t) && !btn.current?.contains(t)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      e.preventDefault()
      setOpen(false)
    }
    window.addEventListener('pointerdown', outside, true)
    window.addEventListener('keydown', esc, true)
    return () => { window.removeEventListener('pointerdown', outside, true); window.removeEventListener('keydown', esc, true) }
  }, [open])

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={className}
        onMouseDown={keepFocus ? (e) => e.preventDefault() : undefined}
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        title={label}
      >
        😊
      </button>
      {open && createPortal(
        <div ref={pop} className="emoji-pop" style={style ?? { visibility: 'hidden' }} role="dialog" aria-label="Emojis">
          {loading && <div className="emoji-pop__loading"><Loader small /></div>}
          <div ref={host} />
        </div>,
        document.body,
      )}
    </>
  )
}
