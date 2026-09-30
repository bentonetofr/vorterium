import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { createNote, updateNote, type NotebookNote } from '../services/notebookService'
import { noteToHtml, notePlainText, sanitizeNoteHtml } from '../noteHtml'

// ────────────────────────────────────────────────────────
// Folha de anotação com formatação (negrito, itálico, cor, tamanho,
// listas…) e salvamento automático (≈0,6 s depois de parar de digitar, e
// na hora ao fechar/trocar). Nota nova só vai pro banco quando ganha o
// primeiro texto. Pautada, no tema do site.
//
// É um bloco editável (contentEditable); o conteúdo vai pro banco como HTML
// já limpo por sanitizeNoteHtml. A barra de formatação (NoteFormatBar)
// comanda a folha pelo handle (format/insert).
// ────────────────────────────────────────────────────────

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export type FormatCommand =
  | 'bold' | 'italic' | 'underline' | 'strikeThrough'
  | 'insertUnorderedList' | 'insertOrderedList' | 'removeFormat'
  | 'foreColor' | 'hiliteColor' | 'fontSize'

const SAVE_DELAY_MS = 600
/** Limite do banco (caracteres do HTML guardado). */
export const NOTE_MAX_CHARS = 100000

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
  /** Aplica uma formatação no trecho selecionado (ou no que for digitado a seguir). */
  format: (command: FormatCommand, value?: string) => void
  /** A folha (pra barra saber o que está ativo no cursor). */
  element: () => HTMLDivElement | null
}

/** HTML do bloco editável → o que vai pro banco ('' se não tem texto nenhum). */
function readContent(el: HTMLElement): string {
  if (!(el.textContent ?? '').trim() && !el.querySelector('li')) return ''
  return sanitizeNoteHtml(el.innerHTML)
}

export const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(function NoteEditor(
  { note, campaignId, sessionId, autoFocus, placeholder, className, onSaved, onStatus, onFiles },
  handle,
) {
  const idRef      = useRef<string | null>(note?.id ?? null)
  const savedText  = useRef(note?.content ?? '')
  const latestText = useRef(note?.content ?? '')
  const timer      = useRef<number | undefined>(undefined)
  const chain      = useRef<Promise<void>>(Promise.resolve())
  const ref        = useRef<HTMLDivElement>(null)
  /** Último trecho selecionado dentro da folha (a barra devolve o cursor pra cá). */
  const range      = useRef<Range | null>(null)
  const [empty, setEmpty] = useState(!notePlainText(note?.content ?? '').trim())
  const cb         = useRef({ onSaved, onStatus, campaignId, sessionId })
  cb.current = { onSaved, onStatus, campaignId, sessionId }

  // Conteúdo inicial (a folha é "não controlada": o React não reescreve o HTML).
  useLayoutEffect(() => {
    if (ref.current) ref.current.innerHTML = noteToHtml(note?.content ?? '')
  // Só ao montar; trocas de nota recriam a folha (key).
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // A nota passou a existir por fora (ex.: criada ao colar uma imagem):
  // o texto daqui em diante atualiza ela em vez de criar outra.
  useEffect(() => { if (note?.id && !idRef.current) idRef.current = note.id }, [note?.id])

  // Outra pessoa (o mestre, ou a Bruna em outra aba) mudou a nota e aqui
  // não há nada por salvar: mostra a versão nova.
  useEffect(() => {
    if (!note || !ref.current) return
    if (note.content !== savedText.current && latestText.current === savedText.current) {
      savedText.current = note.content
      latestText.current = note.content
      ref.current.innerHTML = noteToHtml(note.content)
      setEmpty(!notePlainText(note.content).trim())
    }
  }, [note])

  useEffect(() => {
    if (!autoFocus) return
    const el = ref.current
    if (!el) return
    el.focus()
    const r = document.createRange()
    r.selectNodeContents(el)
    r.collapse(false)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(r)
  }, [autoFocus])

  // Guarda a seleção da folha (clicar num botão/lista da barra tira o foco).
  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection()
      const el = ref.current
      if (el && sel && sel.rangeCount && el.contains(sel.anchorNode)) range.current = sel.getRangeAt(0).cloneRange()
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [])

  function save() {
    window.clearTimeout(timer.current)
    chain.current = chain.current.then(async () => {
      const value = latestText.current
      if (value === savedText.current) return
      if (!idRef.current && !value) return
      if (value.length > NOTE_MAX_CHARS) { cb.current.onStatus?.('error'); return }
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

  function changed() {
    const el = ref.current
    if (!el) return
    const value = readContent(el)
    setEmpty(!value)
    if (value === latestText.current) return
    latestText.current = value
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(save, SAVE_DELAY_MS)
    cb.current.onStatus?.('saving')
  }

  /** Foco de volta na folha, no último trecho selecionado. */
  function restore() {
    const el = ref.current
    if (!el) return
    el.focus({ preventScroll: true })
    const sel = window.getSelection()
    if (range.current && sel) {
      sel.removeAllRanges()
      sel.addRange(range.current)
    }
  }

  useImperativeHandle(handle, () => ({
    insert(piece: string) {
      restore()
      document.execCommand('insertText', false, piece)
      changed()
    },
    format(command: FormatCommand, value?: string) {
      const el = ref.current
      if (!el) return
      restore()
      // Cor e tamanho como estilo (span style=…), não <font>.
      document.execCommand('styleWithCSS', false, 'true')
      if ((command === 'foreColor' || command === 'hiliteColor') && value === 'default') {
        // "Cor normal"/"sem marca-texto": pinta com uma cor-marcador e tira
        // essa cor dos trechos (sobra a cor do tema, clara ou escura).
        document.execCommand(command, false, 'rgb(1, 2, 3)')
        const prop = command === 'foreColor' ? 'color' : 'background-color'
        for (const node of [...el.querySelectorAll<HTMLElement>('[style]')]) {
          if (node.style.getPropertyValue(prop).replace(/\s/g, '') !== 'rgb(1,2,3)') continue
          node.style.removeProperty(prop)
          if (!node.getAttribute('style')?.trim() && node.tagName === 'SPAN') node.replaceWith(...node.childNodes)
        }
      } else {
        document.execCommand(command, false, value)
      }
      changed()
    },
    element: () => ref.current,
  }))

  const images = (list: DataTransferItemList | null | undefined, files: FileList | null | undefined) => {
    const out = [...(files ?? [])].filter((f) => f.type.startsWith('image/'))
    if (out.length === 0 && list) for (const it of list) { const f = it.kind === 'file' ? it.getAsFile() : null; if (f?.type.startsWith('image/')) out.push(f) }
    return out
  }

  return (
    <div
      ref={ref}
      className={`note-sheet${empty ? ' note-sheet--empty' : ''}${className ? ` ${className}` : ''}`}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label="Anotação"
      data-placeholder={placeholder ?? 'Escreva aqui… salva sozinho.'}
      spellCheck
      onInput={changed}
      onPaste={(e) => {
        const files = onFiles ? images(e.clipboardData.items, e.clipboardData.files) : []
        if (files.length) { e.preventDefault(); onFiles!(files); return }
        // Colar traz só o texto: o navegador grudaria cor/tamanho fixos da
        // origem (e de sites), que ficam estranhos na folha. A formatação
        // se aplica depois, pela barra.
        e.preventDefault()
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
        changed()
      }}
      onDragOver={(e) => { if (onFiles && e.dataTransfer.types.includes('Files')) e.preventDefault() }}
      onDrop={(e) => {
        if (!onFiles) return
        const files = images(null, e.dataTransfer.files)
        if (files.length) { e.preventDefault(); onFiles(files) }
      }}
      onBlur={save}
    />
  )
})
