import type { VtCode } from './catalog'

/** Erro do Vortable com o código do catálogo (a tela mostra "VT-... · mensagem"). */
export class VortableError extends Error {
  constructor(readonly code: VtCode, message: string) {
    super(message)
    this.name = 'VortableError'
  }
}

/** Texto pra mostrar na tela: com o código, quando o erro tem um. */
export function errorText(err: unknown, fallback: string): string {
  if (err instanceof VortableError) return `${err.code} · ${err.message}`
  if (err instanceof Error && err.message) return err.message
  return fallback
}

/** O arquivo do motor (ou outro pedaço do site) não carregou: em geral o site foi atualizado. */
export function isChunkError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err)
  return /dynamically imported module|Importing a module script failed|error loading dynamically|ChunkLoadError|Loading chunk|Failed to fetch dynamically/i.test(msg)
}
