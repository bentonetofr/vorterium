import { useEffect, useState, type ReactNode } from 'react'

// ────────────────────────────────────────────────────────
// Foto de perfil que não quebra. Fotos de conta Google
// (lh3.googleusercontent.com) recusam pedidos que levam o endereço do
// site de origem — sem `referrerPolicy`, de vez em quando vinha o ícone
// de imagem quebrada. Se mesmo assim a foto falhar, mostra o `fallback`
// (a inicial do nome) em vez do ícone quebrado e tenta de novo uma vez,
// alguns segundos depois (o servidor de fotos às vezes só está ocupado).
// ────────────────────────────────────────────────────────

interface AvatarImageProps {
  src:        string | null | undefined
  /** O que mostrar sem foto, ou quando ela não carrega. */
  fallback:   ReactNode
  className?: string
  lazy?:      boolean
}

const RETRY_MS = 6000

export function AvatarImage({ src, fallback, className, lazy = false }: AvatarImageProps) {
  // Qual endereço falhou e quantas vezes — outra foto começa do zero.
  const [failure, setFailure] = useState<{ src: string; times: number; waiting: boolean } | null>(null)
  const current = failure && failure.src === src ? failure : null

  useEffect(() => {
    if (!current?.waiting || current.times > 1) return
    const timer = window.setTimeout(() => {
      setFailure((f) => (f && f.src === current.src ? { ...f, waiting: false } : f))
    }, RETRY_MS)
    return () => window.clearTimeout(timer)
  }, [current?.waiting, current?.times, current?.src])

  if (!src || current?.waiting) return <>{fallback}</>
  return (
    <img
      key={`${src}#${current?.times ?? 0}`}
      src={src}
      alt=""
      className={className}
      referrerPolicy="no-referrer"
      loading={lazy ? 'lazy' : undefined}
      onError={() => setFailure({ src, times: (current?.times ?? 0) + 1, waiting: true })}
    />
  )
}
