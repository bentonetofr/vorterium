// Fontes do Quadro: a galeria é a do site (shared/lib/googleFonts).
export * from '../../shared/lib/googleFonts'

/** Itens com texto que aceitam fonte: post-it, texto, forma e título da moldura. */
export const FONT_KINDS: ReadonlySet<string> = new Set(['note', 'text', 'shape', 'frame'])
