import { useEffect } from 'react'

// ────────────────────────────────────────────────────────
// Letras da ficha Terra Devastada Adaptada (visual de The Last of Us
// Parte II): condensada de menu (Barlow Condensed), texto (Barlow) e a
// letra de diário à mão (Reenie Beanie). Baixadas só quando a ficha abre.
// ────────────────────────────────────────────────────────

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@500;600;700&family=Reenie+Beanie&display=swap'

export function useTdaFonts(): void {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONT_HREF}"]`)) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = FONT_HREF
    document.head.appendChild(link)
  }, [])
}
