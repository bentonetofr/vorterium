import { useState } from 'react'
import { downloadTextFile, sheetFileName } from './sheetText'

interface ExportSheetButtonProps {
  /** Nome do personagem e do sistema (viram o nome do arquivo). */
  character: string | null | undefined
  system:    string
  /** Monta o texto na hora do clique (pode buscar o que falta no banco). */
  build:     () => string | Promise<string>
  className?: string
}

/** Botão "Exportar TXT" das fichas: baixa a ficha inteira em um arquivo de texto. */
export function ExportSheetButton({ character, system, build, className = 'btn btn-ghost' }: ExportSheetButtonProps) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function run() {
    setBusy(true)
    setFailed(false)
    try {
      downloadTextFile(sheetFileName(character, system), await build())
    } catch (err) {
      console.error('Erro ao exportar a ficha:', err)
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button type="button" className={className} onClick={run} disabled={busy}
      title="Baixa a ficha inteira em um arquivo de texto (.txt)">
      {busy ? 'Exportando…' : failed ? 'Não deu: tentar de novo' : 'Exportar TXT'}
    </button>
  )
}
