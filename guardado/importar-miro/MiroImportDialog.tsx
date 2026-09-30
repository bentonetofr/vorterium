import { useState } from 'react'
import { ModalOverlay } from '../../../shared/components/ModalOverlay'
import type { BoardItem } from '../services/boardService'
import { importMiroBoard, parseBoardId, type MiroImportResult, type MiroProgress } from '../services/miroImport'
import type { Point } from '../boardGeometry'

// ────────────────────────────────────────────────────────
// Janela "Importar do Miro": link do board + chave de acesso do Miro (a
// pessoa gera na própria conta Miro). A chave vai só pro pedido de
// importação e não fica salva; o campo nem é lembrado pelo navegador.
// ────────────────────────────────────────────────────────

const LABEL: Record<string, [string, string]> = {
  note:      ['post-it', 'post-its'],
  text:      ['texto', 'textos'],
  shape:     ['forma', 'formas'],
  frame:     ['moldura', 'molduras'],
  connector: ['seta', 'setas'],
  image:     ['imagem', 'imagens'],
  file:      ['arquivo', 'arquivos'],
  link:      ['link', 'links'],
}

function summary(r: MiroImportResult): string {
  const parts = Object.entries(r.counts)
    .filter(([, n]) => n)
    .map(([k, n]) => `${n} ${LABEL[k]?.[n === 1 ? 0 : 1] ?? k}`)
  return parts.join(', ')
}

interface Props {
  campaignId: string
  myId:       string
  at:         Point
  zTop:       number
  onImported: (items: BoardItem[]) => void
  onClose:    () => void
}

export function MiroImportDialog({ campaignId, myId, at, zTop, onImported, onClose }: Props) {
  const [link, setLink]         = useState('')
  const [token, setToken]       = useState('')
  const [busy, setBusy]         = useState(false)
  const [progress, setProgress] = useState<MiroProgress | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [result, setResult]     = useState<MiroImportResult | null>(null)
  const [howTo, setHowTo]       = useState(false)

  const linkOk = parseBoardId(link) !== null

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const r = await importMiroBoard({ link, token, campaignId, myId, at, zTop, onProgress: setProgress })
      setToken('')
      setResult(r)
      onImported(r.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível importar o board.')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <ModalOverlay onClose={onClose} closeDisabled={busy}>
      <div className="board-modal" role="dialog" aria-modal="true" aria-labelledby="board-miro-title">
        <header className="board-modal__head">
          <h3 id="board-miro-title" className="board-modal__title">Importar do Miro</h3>
          <button type="button" className="board-modal__close" onClick={onClose} disabled={busy} aria-label="Fechar">✕</button>
        </header>

        {result ? (
          <>
            <div className="board-modal__body">
              <p className="board-miro__done">
                <strong>{result.boardName}</strong> chegou no quadro, dentro de uma moldura com o nome dele: {summary(result)}.
              </p>
              {(result.counts.image || result.counts.file) && (
                <p className="board-modal__hint">As imagens e arquivos também estão na Biblioteca da campanha.</p>
              )}
              {result.failed.length > 0 && (
                <p className="board-modal__hint">
                  Não deu pra trazer {result.failed.length === 1 ? 'este arquivo' : 'estes arquivos'} (formato não aceito ou grande demais): {result.failed.slice(0, 8).join(', ')}{result.failed.length > 8 ? '…' : ''}.
                </p>
              )}
              {result.skipped > 0 && (
                <p className="board-modal__hint">
                  {result.skipped} {result.skipped === 1 ? 'item ficou' : 'itens ficaram'} de fora (tipos que o Quadro ainda não tem, ou setas soltas).
                  Desenho à mão do Miro não vem: a API do Miro não entrega esses traços.
                </p>
              )}
            </div>
            <footer className="board-modal__foot">
              <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>Ver no quadro</button>
            </footer>
          </>
        ) : (
          <>
            <form
              className="board-modal__body"
              onSubmit={(e) => { e.preventDefault(); if (linkOk && token.trim() && !busy) void run() }}
              autoComplete="off"
            >
              <p className="board-modal__hint">
                Traz post-its, textos, formas, molduras, setas, cards e imagens do board, no mesmo lugar.
                As imagens vão pra Biblioteca da campanha.
              </p>

              <label className="board-miro__field">
                <span className="label">Link do board</span>
                <input
                  className="input"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://miro.com/app/board/…"
                  disabled={busy}
                  spellCheck={false}
                />
              </label>

              <label className="board-miro__field">
                <span className="label">Chave de acesso do Miro</span>
                <input
                  className="input"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Cole aqui a chave (token)"
                  disabled={busy}
                  autoComplete="new-password"
                  spellCheck={false}
                />
                <span className="board-modal__hint">Usada só nesta importação. Não fica salva no Vorterium.</span>
              </label>

              <button type="button" className="board-miro__howto-toggle" onClick={() => setHowTo((v) => !v)} aria-expanded={howTo}>
                {howTo ? '▾' : '▸'} Como pegar a chave no Miro
              </button>
              {howTo && (
                <ol className="board-miro__howto">
                  <li>
                    O Miro só deixa criar apps num <strong>time de desenvolvedor</strong> (Developer team), que é gratuito.
                    Se ainda não tiver um,{' '}
                    <a href="https://developers.miro.com/docs/create-a-developer-team" target="_blank" rel="noopener noreferrer">crie aqui</a>.
                  </li>
                  <li>
                    No Miro, clique na sua foto → <strong>Configurações</strong> (Settings) → aba <strong>Seus apps</strong> (Your apps)
                    → <strong>+ Criar novo app</strong> (Create new app). Dê um nome (ex.: Vorterium), escolha o time de desenvolvedor
                    e clique em <strong>Criar app</strong> (Create app). Se marcar a opção de token que expira, a chave vale 1 hora,
                    que é tempo de sobra pra importar.
                  </li>
                  <li>Na página do app, em <strong>Permissões</strong> (Permissions), marque <code>boards:read</code>.</li>
                  <li>
                    Clique em <strong>Instalar app e pegar o token OAuth</strong> (Install app and get OAuth token), escolha na lista
                    o <strong>time onde está o board</strong>, clique em <strong>Instalar e autorizar</strong> (Install &amp; authorize)
                    e copie o token que aparece.
                  </li>
                  <li>
                    Se o time do board não aparecer na lista, mova ou copie o board pro time de desenvolvedor
                    (ele aceita até 3 boards) e instale o app lá.
                  </li>
                  <li>Cole o token aqui. Depois de importar, pode apagar o app no Miro se quiser.</li>
                </ol>
              )}

              {error && <p className="board-modal__error" role="alert">{error}</p>}
              {busy && progress && (
                <div className="board-miro__progress" role="status">
                  <span className="spinner spinner--sm" />
                  <span>{progress.label}{progress.total ? ` ${progress.done ?? 0}/${progress.total}` : ''}</span>
                </div>
              )}
              <button type="submit" hidden />
            </form>
            <footer className="board-modal__foot">
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>Cancelar</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void run()} disabled={busy || !linkOk || !token.trim()}>
                {busy ? 'Importando…' : 'Importar'}
              </button>
            </footer>
          </>
        )}
      </div>
    </ModalOverlay>
  )
}
