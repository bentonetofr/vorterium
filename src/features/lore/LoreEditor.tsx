import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { confirmDialog } from '../../shared/components/dialogs'
import { Presence } from '../../shared/components/Presence'
import { LORE_ACCEPT, LORE_BODY_MAX, LORE_FILES_MAX, checkLoreFile, countWords } from './lorePure'
import {
  getLore, listLoreFiles, removeLoreFile, saveLoreBody, uploadLoreFile,
  type CharacterLoreFile, type LoreSystem,
} from './loreService'
import { LoreFileCard, LoreViewer } from './LoreFiles'
import './Lore.css'

// ────────────────────────────────────────────────────────
// Aba "Lore" da ficha (Altherium e D&D): o jogador escreve a história do
// personagem e/ou guarda arquivos (PDF, DOCX, texto). O mestre lê tudo na
// aba "Lores" da Sessão. Salva sozinho, como o resto da ficha.
// ────────────────────────────────────────────────────────

interface Props {
  campaignId:    string
  sheetId:       string
  /** Dono da ficha — só ele escreve. */
  ownerId:       string
  system:        LoreSystem
  characterName: string
  /** Fonte caligráfica (Altherium); sem isso, a serifada do site. */
  quill?:        boolean
  readOnly?:     boolean
}

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'
const AUTOSAVE_MS = 900

export function LoreEditor({ campaignId, sheetId, ownerId, system, characterName, quill = false, readOnly = false }: Props) {
  const { user } = useAuth()
  const canEdit = !readOnly && user?.id === ownerId
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<CharacterLoreFile[]>([])
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [uploading, setUploading] = useState<{ index: number; total: number; name: string } | null>(null)
  const [sentNote, setSentNote] = useState<string | null>(null)
  const [uploadErrors, setUploadErrors] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const [opened, setOpened] = useState<CharacterLoreFile | null>(null)
  const [removing, setRemoving] = useState(false)

  const bodyRef = useRef('')
  const savedRef = useRef('')
  const loadedRef = useRef(false)
  const timer = useRef<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    loadedRef.current = false
    Promise.all([getLore(sheetId), listLoreFiles(sheetId)])
      .then(([lore, list]) => {
        if (!alive) return
        const text = lore?.body ?? ''
        bodyRef.current = text; savedRef.current = text; loadedRef.current = true
        setBody(text); setFiles(list); setLoadError(null)
      })
      .catch((e: unknown) => { if (alive) setLoadError(e instanceof Error ? e.message : 'Não foi possível carregar a lore.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [sheetId])

  const flush = useCallback(async () => {
    if (!canEdit || !loadedRef.current || bodyRef.current === savedRef.current) return
    const text = bodyRef.current
    setSaveState('saving')
    try {
      await saveLoreBody({ campaignId, sheetId, system, userId: ownerId, body: text })
      savedRef.current = text
      setSaveState(bodyRef.current === text ? 'saved' : 'pending')
    } catch {
      setSaveState('error')
    }
  }, [canEdit, campaignId, sheetId, system, ownerId])

  // Ao sair da aba com algo pendente, grava na hora.
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
    if (canEdit && loadedRef.current && bodyRef.current !== savedRef.current) {
      void saveLoreBody({ campaignId, sheetId, system, userId: ownerId, body: bodyRef.current }).catch(() => {})
    }
  }, [canEdit, campaignId, sheetId, system, ownerId])

  function onChange(text: string) {
    setBody(text)
    bodyRef.current = text
    setSaveState('pending')
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { void flush() }, AUTOSAVE_MS)
  }

  async function upload(list: FileList | File[]) {
    if (!canEdit) return
    const picked = Array.from(list)
    const errors: string[] = []
    let have = files.length
    let sent = 0
    setSentNote(null)
    for (const [i, file] of picked.entries()) {
      const problem = checkLoreFile(file, have)
      if (problem) { errors.push(problem); continue }
      setUploading({ index: i + 1, total: picked.length, name: file.name })
      try {
        const saved = await uploadLoreFile({ campaignId, sheetId, userId: ownerId, file, alreadyHave: have })
        setFiles((prev) => [...prev, saved])
        have += 1
        sent += 1
      } catch (e) {
        errors.push(e instanceof Error ? e.message : `Erro ao enviar “${file.name}”.`)
      }
    }
    setUploading(null)
    setUploadErrors(errors)
    if (sent > 0) {
      setSentNote(sent === 1 ? '1 arquivo enviado.' : `${sent} arquivos enviados.`)
      window.setTimeout(() => setSentNote(null), 4500)
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) void upload(e.dataTransfer.files)
  }

  async function remove(file: CharacterLoreFile) {
    const ok = await confirmDialog({ title: 'Remover arquivo', message: `Remover “${file.name}” da sua lore? O mestre deixa de ver.`, confirmLabel: 'Remover', tone: 'danger' })
    if (!ok) return
    setRemoving(true)
    try {
      await removeLoreFile(file)
      setFiles((prev) => prev.filter((f) => f.id !== file.id))
    } catch (e) {
      setUploadErrors([e instanceof Error ? e.message : 'Não foi possível remover.'])
    } finally {
      setRemoving(false)
    }
  }

  const words = countWords(body)

  if (loading) return <div className="lore"><div className="lore__loading"><span className="spinner" /> Abrindo a lore…</div></div>
  if (loadError) return <div className="lore"><p className="lore__error" role="alert">{loadError}</p></div>

  return (
    <div className={`lore${quill ? ' lore--quill' : ''}`}>
      <p className="lore__hint">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
        {canEdit
          ? 'O mestre da campanha lê tudo o que você escrever ou guardar aqui.'
          : 'Somente leitura: a lore pertence a quem criou a ficha.'}
      </p>

      <div className="lore__grid">
        <section className="lore-card lore-card--write">
          <header className="lore-card__head">
            <h4 className="lore-card__title">A história{characterName ? ` de ${characterName}` : ''}</h4>
            <span className={`lore-save lore-save--${saveState}`} role="status" aria-live="polite">
              {saveState === 'saved' && '✓ Salvo'}
              {saveState === 'pending' && 'Alterações pendentes…'}
              {saveState === 'saving' && 'Salvando…'}
              {saveState === 'error' && <>Erro ao salvar <button type="button" className="lore-link" onClick={() => void flush()}>tentar de novo</button></>}
            </span>
          </header>
          <textarea
            className="lore-area" value={body} readOnly={!canEdit} maxLength={LORE_BODY_MAX}
            placeholder={canEdit ? 'Era uma vez… De onde veio? O que viveu? O que o move?\n\nEscreva à vontade: o mestre vai ler.' : 'Nada escrito ainda.'}
            aria-label="Lore do personagem" onChange={(e) => onChange(e.target.value)}
          />
          <footer className="lore-card__foot">
            <span>{words} {words === 1 ? 'palavra' : 'palavras'}</span>
            <span>{body.length} / {LORE_BODY_MAX}</span>
          </footer>
        </section>

        <section className="lore-card lore-card--files">
          <header className="lore-card__head">
            <h4 className="lore-card__title">Arquivos</h4>
            <span className="lore-card__count" title={`Até ${LORE_FILES_MAX} arquivos`}>{files.length} / {LORE_FILES_MAX}</span>
          </header>

          {canEdit && (
            <div
              className={`lore-drop${dragging ? ' is-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5M12 17v-6m0 0-2.5 2.5M12 11l2.5 2.5" /></svg>
              <p>{uploading
                ? `Enviando${uploading.total > 1 ? ` ${uploading.index} de ${uploading.total}` : ''}: ${uploading.name}…`
                : 'Solte um ou vários arquivos aqui'}</p>
              <button type="button" className="lore-btn lore-btn--primary" disabled={uploading !== null} onClick={() => inputRef.current?.click()}>
                Escolher arquivos
              </button>
              <small>Pode mandar vários de uma vez (segure Ctrl ou Shift para marcar mais de um) e quantos documentos separados quiser, até {LORE_FILES_MAX}. PDF, DOCX, DOC, ODT, RTF, TXT, MD, JSON ou CSV, até 20 MB cada.</small>
              <input ref={inputRef} type="file" multiple accept={LORE_ACCEPT} hidden
                onChange={(e) => { if (e.target.files) void upload(e.target.files); e.target.value = '' }} />
            </div>
          )}

          {sentNote && <p className="lore__sent" role="status">✓ {sentNote}</p>}
          {uploadErrors.length > 0 && (
            <ul className="lore__errors" role="alert">{uploadErrors.map((m, i) => <li key={i}>{m}</li>)}</ul>
          )}

          {files.length === 0
            ? <p className="lore__empty">{canEdit ? 'Nenhum arquivo ainda. Guarde aqui o PDF ou o documento da história do personagem.' : 'Nenhum arquivo.'}</p>
            : (
              <ul className="lore-files">
                {files.map((f) => <LoreFileCard key={f.id} file={f} onOpen={setOpened} onRemove={canEdit ? remove : undefined} busy={removing} />)}
              </ul>
            )}

          {canEdit && files.length > 0 && files.length < LORE_FILES_MAX && (
            <button type="button" className="lore-btn lore-add-more" disabled={uploading !== null} onClick={() => inputRef.current?.click()}>
              + Adicionar mais arquivos
            </button>
          )}
        </section>
      </div>

      <Presence show={opened !== null} exitMs={220}>
        {() => opened && <LoreViewer file={opened} onClose={() => setOpened(null)} />}
      </Presence>
    </div>
  )
}
