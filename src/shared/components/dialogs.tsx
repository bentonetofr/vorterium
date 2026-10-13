import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { ModalOverlay } from './ModalOverlay'
import { Presence } from './Presence'
import './dialogs.css'

// ────────────────────────────────────────────────────────
// Janelinhas centrais com o visual do site, no lugar dos confirm/alert/prompt do navegador.
//
//   if (await confirmDialog({ message: 'Apagar a ficha?', tone: 'danger', confirmLabel: 'Apagar' })) …
//   await alertDialog('Não deu certo.')
//   const nome = await promptDialog({ title: 'Novo mundo', label: 'Nome do mundo' })   // null = cancelou
//
// <DialogHost /> fica uma vez na raiz do app e mostra uma janela por vez (as seguintes esperam na fila).
// ────────────────────────────────────────────────────────

export type DialogTone = 'default' | 'danger'

interface Base {
  title?:        string
  message?:      string
  confirmLabel?: string
  cancelLabel?:  string
  tone?:         DialogTone
}

export interface ConfirmOptions extends Base {}
export interface AlertOptions extends Omit<Base, 'cancelLabel'> {}
export interface PromptOptions extends Base {
  label?:       string
  initial?:     string
  placeholder?: string
  maxLength?:   number
}

type Entry =
  | { id: number; kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { id: number; kind: 'alert'; opts: AlertOptions; resolve: () => void }
  | { id: number; kind: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void }

let queue: Entry[] = []
let current: Entry | null = null
let version = 0
const listeners = new Set<() => void>()
let seq = 0

function emit() {
  version++
  listeners.forEach((l) => l())
}

function pump() {
  if (current || queue.length === 0) return
  current = queue.shift()!
  emit()
}

function push(entry: Entry) {
  queue.push(entry)
  pump()
}

function finish() {
  current = null
  emit()
  // a próxima só aparece depois da saída da anterior
  window.setTimeout(pump, 230)
}

const asOpts = <T extends Base>(o: string | T): T => (typeof o === 'string' ? ({ message: o } as T) : o)

/** Pergunta sim ou não. Resolve true se a pessoa confirmou. */
export function confirmDialog(options: string | ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => push({ id: ++seq, kind: 'confirm', opts: asOpts<ConfirmOptions>(options), resolve }))
}

/** Atalho pros botões: pergunta e, se a pessoa confirmar, roda `onYes`. */
export function ask(options: string | ConfirmOptions, onYes: () => void): void {
  void confirmDialog(options).then((ok) => { if (ok) onYes() })
}

/** Avisa algo (um botão só). */
export function alertDialog(options: string | AlertOptions): Promise<void> {
  return new Promise((resolve) => push({ id: ++seq, kind: 'alert', opts: asOpts<AlertOptions>(options), resolve }))
}

/** Pede um texto. Resolve com o texto (sem espaços nas pontas) ou null se cancelou. */
export function promptDialog(options: string | PromptOptions): Promise<string | null> {
  return new Promise((resolve) => push({ id: ++seq, kind: 'prompt', opts: asOpts<PromptOptions>(options), resolve }))
}

// o motor do Vortable (criador de personagem, editor de zonas) pergunta por aqui, com a mesma janelinha
;(window as unknown as { __vtConfirm?: (message: string, options?: ConfirmOptions) => Promise<boolean> }).__vtConfirm =
  (message, options) => confirmDialog({ ...options, message })

function useCurrent(): Entry | null {
  useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => version,
  )
  return current
}

function Icon({ tone, kind }: { tone: DialogTone; kind: Entry['kind'] }) {
  return (
    <span className={`dlg__icon dlg__icon--${tone}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {tone === 'danger'
          ? <><path d="M12 3.5 2.8 19.5h18.4z" /><path d="M12 10v4.5" /><circle cx="12" cy="17.2" r="0.6" fill="currentColor" /></>
          : kind === 'alert'
            ? <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" /><circle cx="12" cy="7.8" r="0.6" fill="currentColor" /></>
            : <><circle cx="12" cy="12" r="9" /><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.2c-.8.5-1.2 1-1.2 1.9" /><circle cx="12" cy="17" r="0.6" fill="currentColor" /></>}
      </svg>
    </span>
  )
}

function DialogWindow({ entry, onDone }: { entry: Entry; onDone: (value: boolean | string | null | undefined) => void }) {
  const tone: DialogTone = entry.opts.tone ?? 'default'
  const isPrompt = entry.kind === 'prompt'
  const [text, setText] = useState(isPrompt ? (entry.opts as PromptOptions).initial ?? '' : '')
  const confirmRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // pergunta perigosa: o foco começa em Cancelar (um Enter sem querer não apaga nada)
    if (isPrompt) { inputRef.current?.focus(); inputRef.current?.select() }
    else if (tone === 'danger' && entry.kind === 'confirm') cancelRef.current?.focus()
    else confirmRef.current?.focus()
  }, [entry, isPrompt, tone])

  const title = entry.opts.title ?? (entry.kind === 'alert' ? 'Aviso' : tone === 'danger' ? 'Tem certeza?' : isPrompt ? 'Digite' : 'Confirmar')
  const confirmLabel = entry.opts.confirmLabel ?? (entry.kind === 'alert' ? 'Entendi' : tone === 'danger' ? 'Confirmar' : 'OK')
  const cancelLabel = (entry.opts as Base).cancelLabel ?? 'Cancelar'

  function cancel() { onDone(entry.kind === 'confirm' ? false : entry.kind === 'prompt' ? null : undefined) }
  function accept() { onDone(entry.kind === 'prompt' ? text.trim() : entry.kind === 'confirm' ? true : undefined) }
  function submit(e: FormEvent) {
    e.preventDefault()
    if (isPrompt && !text.trim()) return
    accept()
  }

  return (
    <ModalOverlay onClose={cancel}>
      <form className={`dlg dlg--${tone}`} role={entry.kind === 'alert' ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby="dlg-title" onSubmit={submit}>
        <div className="dlg__head">
          <Icon tone={tone} kind={entry.kind} />
          <h4 id="dlg-title" className="dlg__title">{title}</h4>
        </div>
        {entry.opts.message && <p className="dlg__message">{entry.opts.message}</p>}
        {isPrompt && (
          <div className="dlg__field">
            {(entry.opts as PromptOptions).label && <label className="dlg__label" htmlFor="dlg-input">{(entry.opts as PromptOptions).label}</label>}
            <input
              id="dlg-input"
              ref={inputRef}
              className="input"
              value={text}
              maxLength={(entry.opts as PromptOptions).maxLength ?? 120}
              placeholder={(entry.opts as PromptOptions).placeholder}
              autoComplete="off"
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        )}
        <div className="dlg__actions">
          {entry.kind !== 'alert' && (
            <button ref={cancelRef} type="button" className="btn btn-ghost" onClick={cancel}>{cancelLabel}</button>
          )}
          <button
            ref={confirmRef}
            type="submit"
            className={`btn ${tone === 'danger' ? 'dlg__danger' : 'btn-primary'}`}
            disabled={isPrompt && !text.trim()}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </ModalOverlay>
  )
}

/** Mostra a janela atual da fila. Fica uma vez só, na raiz do app. */
export function DialogHost() {
  const entry = useCurrent()
  // guarda a janela atual por mais um instante pra animação de saída rodar
  const [shown, setShown] = useState<Entry | null>(null)
  useEffect(() => { if (entry) setShown(entry) }, [entry])

  function done(value: boolean | string | null | undefined) {
    const e = current
    if (!e) return
    finish()
    if (e.kind === 'confirm') e.resolve(value === true)
    else if (e.kind === 'prompt') e.resolve(typeof value === 'string' ? value : null)
    else e.resolve()
  }

  return (
    <Presence show={entry !== null} exitMs={220}>
      {() => (entry ?? shown) && <DialogWindow key={(entry ?? shown)!.id} entry={(entry ?? shown)!} onDone={done} />}
    </Presence>
  )
}
