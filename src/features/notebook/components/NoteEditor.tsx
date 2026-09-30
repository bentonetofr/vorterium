import { useEffect, useRef, useState } from 'react'
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
}

export function NoteEditor({ note, campaignId, sessionId, autoFocus, placeholder, className, onSaved, onStatus }: NoteEditorProps) {
  const [text, setText] = useState(note?.content ?? '')
  const idRef      = useRef<string | null>(note?.id ?? null)
  const savedText  = useRef(note?.content ?? '')
  const timer      = useRef<number | undefined>(undefined)
  const chain      = useRef<Promise<void>>(Promise.resolve())
  const latestText = useRef(text)
  const ref        = useRef<HTMLTextAreaElement>(null)
  const cb         = useRef({ onSaved, onStatus, campaignId, sessionId })
  cb.current = { onSaved, onStatus, campaignId, sessionId }

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

  return (
    <textarea
      ref={ref}
      className={`note-sheet${className ? ` ${className}` : ''}`}
      value={text}
      placeholder={placeholder ?? 'Escreva aqui… salva sozinho.'}
      maxLength={20000}
      spellCheck
      onChange={(e) => {
        setText(e.target.value)
        latestText.current = e.target.value
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(save, SAVE_DELAY_MS)
        cb.current.onStatus?.('saving')
      }}
      onBlur={save}
      aria-label="Anotação"
    />
  )
}
