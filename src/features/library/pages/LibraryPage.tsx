import { useState } from 'react'
import { RulebookPanel, rulebookSystems } from '../../rulebook/components/RulebookPanel'
import { getSystemLabel, type CampaignSystem } from '../../../shared/constants/systems'
import '../../../shared/theme/toolPage.css'
import './LibraryPage.css'

// ────────────────────────────────────────────────────────
// Biblioteca — os livros de regras dos sistemas, abertos sem entrar numa
// campanha. É o mesmo leitor da aba Livro da Sessão.
// ────────────────────────────────────────────────────────

export function LibraryPage() {
  const books = rulebookSystems()
  const [open, setOpen] = useState<CampaignSystem | null>(books.length === 1 ? books[0].system : null)

  return (
    <div className="tool-page library-page">
      <div className="tool-page__header">
        <div className="tool-page__titles">
          <h1 className="tool-page__title">Biblioteca</h1>
          <p className="tool-page__sub">Os livros de regras dos sistemas do Vorterium.</p>
        </div>
      </div>

      {books.length === 0 ? (
        <div className="tool-page__empty">
          <p className="tool-page__empty-icon">❧</p>
          <p className="tool-page__empty-title">Nenhum livro disponível ainda.</p>
        </div>
      ) : (
        <div className="library-shelf" role="tablist" aria-label="Livros">
          {books.map((b) => (
            <button
              key={b.system}
              type="button"
              role="tab"
              aria-selected={open === b.system}
              className={`library-book${open === b.system ? ' library-book--open' : ''}`}
              onClick={() => setOpen(b.system)}
            >
              <span className="library-book__spine" aria-hidden="true" />
              <span className="library-book__system">{getSystemLabel(b.system)}</span>
              <span className="library-book__title">{b.title}</span>
              <span className="library-book__subtitle">{b.subtitle}</span>
            </button>
          ))}
        </div>
      )}

      {open && <RulebookPanel system={open} />}

      <p className="tool-hint">
        Livros de outros sistemas entram aqui quando houver autorização dos autores pra publicá-los no site.
      </p>
    </div>
  )
}
