import { describe, expect, it } from 'vitest'
import stylesSource from './styles.ts?raw'

// ────────────────────────────────────────────────────────
// Guarda do src/styles.ts: todo .css do site tem que estar lá (senão ele
// chega junto com o código da página, depois dos globais, e passa por cima
// do acabamento) e os globais têm que ser os últimos, na ordem certa.
// ────────────────────────────────────────────────────────

/** CSS que fica de fora de propósito (chega com a tela, sob demanda). */
const LAZY_CSS = [
  // assistente de importar ficha por PDF: só classes próprias (dimp-*)
  'features/sheets/dnd/import/DndImport.css',
]

const GLOBAIS = ['index.css', 'shared/theme/motion.css', 'shared/theme/refine.css', 'shared/theme/touch.css']

// Só os caminhos interessam (nada é carregado): o Vite lista os arquivos.
const onDisk = Object.keys(import.meta.glob(['./**/*.css', '!./vendor/**']))
  .map((path) => path.replace(/^\.\//, ''))

const imported = [...stylesSource.matchAll(/^import '\.\/(.+\.css)'/gm)].map((m) => m[1])

describe('src/styles.ts', () => {
  it('enxerga os arquivos do site', () => {
    expect(onDisk.length).toBeGreaterThan(50)
    expect(imported.length).toBeGreaterThan(50)
  })

  it('importa todo .css do site (menos os de LAZY_CSS)', () => {
    const missing = onDisk.filter((f) => !imported.includes(f) && !LAZY_CSS.includes(f))
    expect(missing, 'acrescente estes arquivos em src/styles.ts, antes do bloco "globais"').toEqual([])
  })

  it('não importa arquivo que não existe mais', () => {
    expect(imported.filter((f) => !onDisk.includes(f))).toEqual([])
  })

  it('termina com os globais, nesta ordem', () => {
    expect(imported.slice(-GLOBAIS.length)).toEqual(GLOBAIS)
  })

  it('não repete arquivo', () => {
    expect(new Set(imported).size).toBe(imported.length)
  })
})
