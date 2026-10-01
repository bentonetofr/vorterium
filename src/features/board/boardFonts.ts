// Fontes do Quadro: a galeria é a do site (shared/lib/googleFonts).
export * from '../../shared/lib/googleFonts'

/** Itens com texto que aceitam fonte: post-it, texto, forma e título da moldura. */
export const FONT_KINDS: ReadonlySet<string> = new Set(['note', 'text', 'shape', 'frame'])

/** Itens com texto que dá pra alinhar (esquerda, centro, direita). */
export const ALIGN_KINDS: ReadonlySet<string> = new Set(['note', 'text', 'shape'])
export type TextAlign = 'left' | 'center' | 'right'
/** Alinhamento em uso (sem escolha: texto solto à esquerda, o resto no centro). */
export const alignOf = (kind: string, align?: TextAlign): TextAlign => align ?? (kind === 'text' ? 'left' : 'center')
