import { useEffect, useState } from 'react'

/** `true` enquanto a media query casa (acompanha a tela girar ou a janela mudar de tamanho). */
export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const sync = () => setMatch(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [query])
  return match
}

/** Tela de celular ou tablet em pé: estreita ou de toque. Menus e painéis trocam o jeito de aparecer. */
export const COMPACT_QUERY = '(max-width: 900px), (pointer: coarse)'
