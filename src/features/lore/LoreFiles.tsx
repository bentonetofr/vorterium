import { useEffect, useState } from 'react'
import { ModalOverlay } from '../../shared/components/ModalOverlay'
import { docxToBlocks, type DocxBlock } from './docxText'
import { formatBytes, loreFileExt, loreFileKind, loreImageViewable, relativeTime, type LoreFileKind } from './lorePure'
import { downloadLoreFile, loreFileUrl, type CharacterLoreFile } from './loreService'

// ────────────────────────────────────────────────────────
// Arquivos da lore: o cartão de cada arquivo e o leitor (janela) que abre
// PDF, DOCX e arquivos de texto sem sair do site.
// ────────────────────────────────────────────────────────

const KIND_TONE: Record<LoreFileKind, string> = { pdf: 'pdf', docx: 'doc', text: 'txt', image: 'img', other: 'doc' }

/** Quadradinho com a extensão, na cor do tipo. */
export function LoreFileBadge({ name }: { name: string }) {
  const kind = loreFileKind(name) ?? 'other'
  return <span className={`lore-badge lore-badge--${KIND_TONE[kind]}`} aria-hidden="true">{loreFileExt(name).slice(0, 4)}</span>
}

export async function saveLoreFile(file: CharacterLoreFile): Promise<void> {
  const url = await loreFileUrl(file, true)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

interface CardProps {
  file:      CharacterLoreFile
  onOpen:    (file: CharacterLoreFile) => void
  onRemove?: (file: CharacterLoreFile) => void
  busy?:     boolean
}

export function LoreFileCard({ file, onOpen, onRemove, busy = false }: CardProps) {
  const [error, setError] = useState<string | null>(null)
  return (
    <li className="lore-file">
      <button type="button" className="lore-file__main" onClick={() => onOpen(file)} title="Ler aqui">
        <LoreFileBadge name={file.name} />
        <span className="lore-file__text">
          <strong>{file.name}</strong>
          <small>{formatBytes(file.size_bytes)} · {relativeTime(file.created_at)}</small>
        </span>
      </button>
      <div className="lore-file__actions">
        <button type="button" className="lore-icon-btn" aria-label={`Baixar ${file.name}`} title="Baixar"
          onClick={() => { setError(null); saveLoreFile(file).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Erro ao baixar.')) }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" /></svg>
        </button>
        {onRemove && (
          <button type="button" className="lore-icon-btn lore-icon-btn--danger" aria-label={`Remover ${file.name}`} title="Remover" disabled={busy}
            onClick={() => onRemove(file)}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        )}
      </div>
      {error && <p className="lore-file__error" role="alert">{error}</p>}
    </li>
  )
}

// ── Leitor ──────────────────────────────────────────────

type Loaded =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'pdf'; url: string }
  | { state: 'docx'; blocks: DocxBlock[] }
  | { state: 'text'; text: string }
  | { state: 'image'; url: string }
  | { state: 'other' }

export function LoreViewer({ file, onClose }: { file: CharacterLoreFile; onClose: () => void }) {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' })
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const kind = loreFileKind(file.name) ?? 'other'
    setLoaded({ state: 'loading' })
    ;(async () => {
      try {
        if (kind === 'pdf') {
          const url = await loreFileUrl(file)
          if (alive) setLoaded({ state: 'pdf', url })
        } else if (kind === 'docx') {
          const blob = await downloadLoreFile(file)
          const blocks = await docxToBlocks(await blob.arrayBuffer())
          if (alive) setLoaded({ state: 'docx', blocks })
        } else if (kind === 'text') {
          const blob = await downloadLoreFile(file)
          const text = await blob.text()
          if (alive) setLoaded({ state: 'text', text })
        } else if (kind === 'image' && loreImageViewable(file.name)) {
          const url = await loreFileUrl(file)
          if (alive) setLoaded({ state: 'image', url })
        } else if (alive) setLoaded({ state: 'other' })
      } catch (e) {
        if (alive) setLoaded({ state: 'error', message: e instanceof Error ? e.message : 'Não foi possível abrir o arquivo.' })
      }
    })()
    return () => { alive = false }
  }, [file])

  return (
    <ModalOverlay onClose={onClose}>
      <div className="lore-viewer" role="dialog" aria-modal="true" aria-label={file.name}>
        <header className="lore-viewer__head">
          <LoreFileBadge name={file.name} />
          <div className="lore-viewer__title">
            <strong>{file.name}</strong>
            <small>{formatBytes(file.size_bytes)}</small>
          </div>
          <button type="button" className="lore-btn" onClick={() => { setSaveError(null); saveLoreFile(file).catch((e: unknown) => setSaveError(e instanceof Error ? e.message : 'Erro ao baixar.')) }}>
            Baixar
          </button>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </header>
        {saveError && <p className="lore-file__error" role="alert">{saveError}</p>}

        <div className="lore-viewer__body">
          {loaded.state === 'loading' && <div className="lore-viewer__center"><span className="spinner" /> Abrindo…</div>}
          {loaded.state === 'error' && <div className="lore-viewer__center" role="alert">{loaded.message}</div>}
          {loaded.state === 'pdf' && <iframe className="lore-viewer__pdf" src={loaded.url} title={file.name} />}
          {loaded.state === 'docx' && (
            <article className="lore-paper">
              {loaded.blocks.length === 0 && <p className="lore-paper__empty">Este documento não tem texto.</p>}
              {loaded.blocks.map((b, i) => {
                if (!b.text.trim()) return <div key={i} className="lore-paper__gap" />
                if (b.heading) return <h3 key={i} className={`lore-paper__h lore-paper__h--${b.heading}`}>{b.text}</h3>
                return <p key={i}>{b.text}</p>
              })}
            </article>
          )}
          {loaded.state === 'text' && <pre className="lore-text">{loaded.text}</pre>}
          {loaded.state === 'image' && (
            <div className="lore-viewer__image">
              <img src={loaded.url} alt={file.name} onError={() => setLoaded({ state: 'other' })} />
            </div>
          )}
          {loaded.state === 'other' && (
            <div className="lore-viewer__center">
              Este formato (.{loreFileExt(file.name)}) não abre aqui. Use o botão Baixar para ler no seu programa.
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>
  )
}
