import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMesaStream } from '../MesaStreamProvider'
import {
  createDocument, deleteDocument, getDocument, listDocuments, setDocumentVisible, subscribeDocuments,
  type DocKind, type MesaDocument,
} from './documentsService'
import { DocumentEditor } from './DocumentEditor'
import { BookCover, DocumentView, PaperPage } from './DocViews'
import { pageSeed, pageStyle } from './paperStyles'
import './Documents.css'

// ────────────────────────────────────────────────────────
// Documentos (aba Mesa): cartas e livros que o mestre escreve em papel
// antigo, com letra à mão. Nascem escondidos; o mestre libera quando os
// jogadores encontram o documento — e pode pôr na transmissão (no livro,
// a página que ele vira, vira pra todos). Jogador lê o que foi liberado.
// ────────────────────────────────────────────────────────

export function MesaDocuments({ campaignId }: { campaignId: string }) {
  const mesa = useMesaStream()
  const isMaster = mesa.isMaster
  const [docs, setDocs]       = useState<MesaDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [busyId, setBusyId]   = useState<string | null>(null)
  const [editing, setEditing] = useState<MesaDocument | null>(null)
  const [reading, setReading] = useState<MesaDocument | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const shownId = mesa.stage.document?.id ?? null

  const load = useCallback(async () => { setDocs(await listDocuments(campaignId)) }, [campaignId])

  useEffect(() => {
    let alive = true
    load()
      .catch((err) => { if (alive) setError(err instanceof Error ? err.message : 'Não foi possível carregar os documentos.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [load])
  useEffect(() => subscribeDocuments(campaignId, () => { void load().catch(() => {}) }), [campaignId, load])

  async function run(id: string, fn: () => Promise<void>) {
    setError(null)
    setBusyId(id)
    try { await fn() } catch (err) { setError(err instanceof Error ? err.message : 'Não deu certo.') } finally { setBusyId(null) }
  }

  async function create(kind: DocKind) {
    await run('new', async () => {
      const doc = await createDocument(campaignId, kind)
      setDocs((list) => [doc, ...list])
      setEditing(doc)
    })
  }

  const visibleDocs = isMaster ? docs : docs.filter((d) => d.visible)

  // O documento aberto no leitor sumiu (excluído, ou o mestre escondeu de novo): fecha.
  useEffect(() => {
    if (reading && !loading && !visibleDocs.some((d) => d.id === reading.id)) setReading(null)
  }, [reading, loading, visibleDocs])

  return (
    <section className="mesa-gallery" aria-labelledby="mesa-docs-title">
      <header className="mesa-gallery__head">
        <div>
          <h5 id="mesa-docs-title" className="mesa-gallery__title">Documentos</h5>
          <p className="mesa-gallery__sub">
            {isMaster
              ? 'Cartas e livros em papel antigo, escritos à mão. Nascem escondidos: libere quando os jogadores encontrarem, ou ponha na mesa.'
              : 'Cartas e livros que o mestre entregou à mesa.'}
          </p>
        </div>
        {isMaster && (
          <div className="mesa-docs__new">
            <button type="button" className="btn btn-ghost mesa-gallery__add" onClick={() => void create('paper')} disabled={busyId === 'new'}>+ Folha</button>
            <button type="button" className="btn btn-ghost mesa-gallery__add" onClick={() => void create('book')} disabled={busyId === 'new'}>+ Livro</button>
          </div>
        )}
      </header>

      {error && <p className="mesa-msg mesa-msg--error" role="alert">{error}</p>}

      {loading ? (
        <div className="mesa-gallery__state"><div className="spinner spinner--sm" /> Carregando…</div>
      ) : visibleDocs.length === 0 ? (
        <p className="mesa-gallery__empty">{isMaster ? 'Nenhum documento ainda. Crie uma folha ou um livro.' : 'O mestre ainda não entregou nenhum documento.'}</p>
      ) : (
        <ul className="mesa-docs__grid">
          {visibleDocs.map((doc) => {
            const shown = shownId === doc.id
            const busy = busyId === doc.id
            return (
              <li key={doc.id} className={`mesa-doc${shown ? ' mesa-doc--shown' : ''}`}>
                <button type="button" className="mesa-doc__preview" onClick={() => setReading(doc)} aria-label={`Ler ${doc.title}`}>
                  {shown && <span className="mesa-doc__tag">Na mesa</span>}
                  {isMaster && !doc.visible && !shown && <span className="mesa-doc__tag mesa-doc__tag--hidden">Escondido</span>}
                  {doc.kind === 'book'
                    ? <BookCover title={doc.title} style={doc.style} />
                    : (
                      <div className="doc-sheet">
                        <PaperPage text={doc.pages[0]?.text ?? ''} style={pageStyle(doc.style, doc.pages[0]?.style)} seed={pageSeed(doc.id, 0)} />
                      </div>
                    )}
                </button>
                <span className="mesa-doc__name" title={doc.title}>{doc.title}</span>
                <span className="mesa-doc__meta">{doc.kind === 'book' ? `Livro · ${doc.pages.length} ${doc.pages.length === 1 ? 'página' : 'páginas'}` : 'Folha'}</span>
                {isMaster && (
                  <div className="mesa-doc__actions">
                    <button type="button" className="mesa-doc__btn" onClick={() => setEditing(doc)}>Editar</button>
                    <button
                      type="button"
                      className={`mesa-doc__btn${shown ? ' is-on' : ''}`}
                      disabled={busy}
                      onClick={() => void run(doc.id, async () => {
                        if (shown) mesa.hideDocument()
                        else await mesa.showDocument(doc)
                      })}
                    >
                      {shown ? 'Tirar da mesa' : 'Pôr na mesa'}
                    </button>
                    <button
                      type="button"
                      className={`mesa-doc__btn${doc.visible ? ' is-on' : ''}`}
                      disabled={busy || (shown && doc.visible)}
                      title={doc.visible ? 'Os jogadores leem este documento' : 'Só você vê'}
                      onClick={() => void run(doc.id, async () => { await setDocumentVisible(doc.id, !doc.visible); await load() })}
                    >
                      {doc.visible ? 'Liberado' : 'Liberar'}
                    </button>
                    {confirmId === doc.id ? (
                      <>
                        <button
                          type="button"
                          className="mesa-doc__btn mesa-doc__btn--danger"
                          disabled={busy}
                          onClick={() => void run(doc.id, async () => {
                            if (shown) mesa.hideDocument()
                            await deleteDocument(doc.id)
                            setDocs((list) => list.filter((d) => d.id !== doc.id))
                            setConfirmId(null)
                          })}
                        >
                          Excluir
                        </button>
                        <button type="button" className="mesa-doc__btn" onClick={() => setConfirmId(null)}>Não</button>
                      </>
                    ) : (
                      <button type="button" className="mesa-doc__btn mesa-doc__btn--danger" onClick={() => setConfirmId(doc.id)} aria-label={`Excluir ${doc.title}`}>✕</button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {editing && (
        <DocumentEditor
          doc={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setDocs((list) => list.map((d) => (d.id === saved.id ? saved : d)))
            setEditing(saved)
          }}
        />
      )}
      {reading && <DocumentReader doc={docs.find((d) => d.id === reading.id) ?? reading} onClose={() => setReading(null)} />}
    </section>
  )
}

/** Leitor por cima de tudo: a folha grande, ou o livro pra folhear (← →). */
export function DocumentReader({ doc, onClose }: { doc: MesaDocument; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return createPortal(
    <div className="doc-reader" role="dialog" aria-modal="true" aria-label={doc.title} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <button type="button" className="doc-reader__close" onClick={onClose} aria-label="Fechar">×</button>
      <h2 className="doc-reader__title">{doc.title}</h2>
      <div className="doc-reader__body">
        <DocumentView doc={doc} keys />
      </div>
    </div>,
    document.body,
  )
}

/**
 * O documento no palco da Mesa. O mestre vira as páginas e leva todo mundo
 * junto; o jogador também pode folhear por conta própria (ex.: no celular,
 * que mostra uma página por vez, ver a segunda página da abertura do
 * mestre) — e volta pra página do mestre assim que ele virar de novo.
 */
export function DocumentStage({ campaignId, docId, page }: { campaignId: string; docId: string; page: number }) {
  const mesa = useMesaStream()
  const [doc, setDoc] = useState<MesaDocument | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let alive = true
    const fetchDoc = () => getDocument(docId)
      .then((d) => { if (!alive) return; setDoc(d); setMissing(!d) })
      .catch(() => { if (alive) setMissing(true) })
    void fetchDoc()
    const off = subscribeDocuments(campaignId, () => { void fetchDoc() })
    return () => { alive = false; off() }
  }, [campaignId, docId])

  if (!doc) {
    return <div className="mesa-doc-stage"><p className="mesa-gallery__empty">{missing ? 'Documento indisponível.' : 'Abrindo o documento…'}</p></div>
  }
  return (
    <div className="mesa-doc-stage" onClick={(e) => e.stopPropagation()}>
      <DocumentView
        doc={doc}
        page={page}
        onPage={mesa.isMaster ? mesa.setDocumentPage : undefined}
        keys
      />
    </div>
  )
}
