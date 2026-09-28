import { useEffect } from 'react'
import { CHANGELOG, markChangelogSeen } from '../../../shared/constants/changelog'
import '../../../shared/theme/toolPage.css'
import './NewsPage.css'

// ────────────────────────────────────────────────────────
// Novidades — o que mudou em cada versão. Abrir a página apaga o ponto de
// "novidade" do menu.
// ────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function NewsPage() {
  useEffect(() => { markChangelogSeen() }, [])

  return (
    <div className="tool-page news-page">
      <div className="tool-page__header">
        <div className="tool-page__titles">
          <h1 className="tool-page__title">Novidades</h1>
          <p className="tool-page__sub">O que mudou no Vorterium, da versão mais nova pra mais antiga.</p>
        </div>
      </div>

      <ol className="news-timeline anim-stagger">
        {CHANGELOG.map((entry, i) => (
          <li key={entry.version} className={`news-entry${i === 0 ? ' news-entry--latest' : ''}`}>
            <div className="news-entry__head">
              <span className="news-entry__version">v{entry.version}</span>
              <h2 className="news-entry__title">{entry.title}</h2>
              <time className="news-entry__date" dateTime={entry.date}>{formatDate(entry.date)}</time>
            </div>
            <ul className="news-entry__items">
              {entry.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  )
}
