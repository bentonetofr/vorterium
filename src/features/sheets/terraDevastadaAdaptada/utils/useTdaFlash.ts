import { useEffect, useRef, useState } from 'react'

export type TdaFlash = '' | 'up' | 'down'

/**
 * Diz se um número acabou de subir ou descer (por ~0,9 s), pra ficha dar um susto, um brilho ou um tremor.
 * Não dispara na primeira exibição, só quando o valor muda de verdade.
 */
export function useTdaFlash(value: number): TdaFlash {
  const prev = useRef(value)
  const [flash, setFlash] = useState<TdaFlash>('')
  useEffect(() => {
    if (prev.current === value) return
    setFlash(value > prev.current ? 'up' : 'down')
    prev.current = value
    const t = window.setTimeout(() => setFlash(''), 900)
    return () => window.clearTimeout(t)
  }, [value])
  return flash
}

/** Efeito do cabeçalho inteiro: Horror subindo assusta, Vida caindo machuca, Vida/Convicção subindo cura. */
export function heroEffect(health: TdaFlash, horror: TdaFlash, conviction: TdaFlash): string {
  if (horror === 'up') return 'scare'
  if (health === 'down') return 'hurt'
  if (health === 'up' || conviction === 'up' || horror === 'down') return 'heal'
  return ''
}
