import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { createNote, updateNote, type NotebookNote } from '../services/notebookService'

// ────────────────────────────────────────────────────────
// Folha de anotação com salvamento automático (≈0,6 s depois de parar de
// digitar, e na hora ao fechar/trocar). Nota nova só vai pro banco quando
// ganha o primeiro texto. Pautada, no tema do site.
// ────────────────────────────────────────────────────────

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const SAVE_DELAY_MS = 600

interface NoteEditorProps {
  /** Nota existente, ou null pra uma nova (criada ao digitar). */
  note:        NotebookNote | null
  campaignId:  string
  sessionId:   string | null
  autoFocus?:  boolean
  placeholder?: string
  className?:  string
  onSaved:     (note: NotebookNote) => void
  onStatus?:   (status: SaveStatus) => void
  /** Imagens coladas (Ctrl+V) ou arrastadas pra folha. */
  onFiles?:    (files: File[]) => void
}

export interface NoteEditorHandle {
  /** Põe o texto onde está o cursor (ex.: um emoji). */
  insert: (text: string) => void
}

export const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(function NoteEditor(
  { note, campaignId, sessionId, autoFocus, placeholder, className, onSaved, onStatus, onFiles },
  handle,
) {
  const [text, setText] = useState(note?.content ?? '')
  const idRef      = useRef<string | null>(note?.id ?? null)
  const savedText  = useRef(note?.content ?? '')
  const timer      = useRef<number | undefined>(undefined)
  const chain      = useRef<Promise<void>>(Promise.resolve())
  const latestText = useRef(text)
  const ref        = useRef<HTMLTextAreaElement>(null)
  const cb         = useRef({ onSaved, onStatus, campaignId, sessionId })
  cb.current = { onSaved, onStatus, campaignId, sessionId }

  // A nota passou a existir por fora (ex.: criada ao colar uma imagem):
  // o texto daqui em diante atualiza ela em vez de criar outra.
  useEffect(() => { if (note?.id && !idRef.current) idRef.current = note.id }, [note?.id])

  // Outra pessoa (o mestre, ou a Bruna em outra aba) mudou a nota e aqui
  // não há nada por salvar: mostra a versão nova.
  useEffect(() => {
    if (!note) return
    if (note.content !== savedText.current && latestText.current === savedText.current) {
      savedText.current = note.content
      latestText.current = note.content
      setText(note.content)
    }
  }, [note])

  useEffect(() => {
    if (!autoFocus) return
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [autoFocus])

  function save() {
    window.clearTimeout(timer.current)
    chain.current = chain.current.then(async () => {
      const value = latestText.current
      if (value === savedText.current) return
      if (!idRef.current && !value.trim()) return
      cb.current.onStatus?.('saving')
      try {
        const saved = idRef.current
          ? await updateNote(idRef.current, { content: value })
          : await createNote(cb.current.campaignId, cb.current.sessionId, value)
        idRef.current = saved.id
        savedText.current = value
        cb.current.onSaved(saved)
        cb.current.onStatus?.(latestText.current === value ? 'saved' : 'saving')
      } catch {
        cb.current.onStatus?.('error')
      }
    })
  }

  // Fechou a janela / trocou de nota: salva o que ficou pendente.
  useEffect(() => () => { if (latestText.current !== savedText.current) save() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  function change(value: string) {
    setText(value)
    latestText.current = value
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(save, SAVE_DELAY_MS)
    cb.current.onStatus?.('saving')
  }

  // Cursor logo depois do que foi inserido (aplicado assim que a folha atualiza).
  const pendingCaret = useRef<number | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    const pos = pendingCaret.current
    if (!el || pos === null) return
    pendingCaret.current = null
    el.focus()
    el.setSelectionRange(pos, pos)
  })

  useImperativeHandle(handle, () => ({
    insert(piece: string) {
      const el = ref.current
      const cur = latestText.current
      const start = el?.selectionStart ?? cur.length
      const end = el?.selectionEnd ?? cur.length
      pendingCaret.current = start + piece.length
      change(cur.slice(0, start) + piece + cur.slice(end))
    },
  }))

  const images = (list: DataTransferItemList | null | undefined, files: FileList | null | undefined) => {
    const out = [...(files ?? [])].filter((f) => f.type.startsWith('image/'))
    if (out.length === 0 && list) for (const it of list) { const f = it.kind === 'file' ? it.getAsFile() : null; if (f?.type.startsWith('image/')) out.push(f) }
    return out
  }

  return (
    <textarea
      ref={ref}
      className={`note-sheet${className ? ` ${className}` : ''}`}
      value={text}
      placeholder={placeholder ?? 'Escreva aqui… salva sozinho.'}
      maxLength={20000}
      spellCheck
      onChange={(e) => change(e.target.value)}
      onPaste={(e) => {
        if (!onFiles) return
        const files = images(e.clipboardData.items, e.clipboardData.files)
        if (files.length) { e.preventDefault(); onFiles(files) }
      }}
      onDragOver={(e) => { if (onFiles && e.dataTransfer.types.includes('Files')) e.preventDefault() }}
      onDrop={(e) => {
        if (!onFiles) return
        const files = images(null, e.dataTransfer.files)
        if (files.length) { e.preventDefault(); onFiles(files) }
      }}
      onBlur={save}
      aria-label="Anotação"
    />
  )
})
