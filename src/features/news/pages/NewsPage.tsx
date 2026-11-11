import { useEffect, useMemo } from 'react'
import { CHANGELOG, markChangelogSeen, type ChangelogEntry } from '../../../shared/constants/changelog'
import '../../../shared/theme/toolPage.css'
import './NewsPage.css'

// ────────────────────────────────────────────────────────
// Novidades — o que mudou em cada versão. As mais recentes aparecem
// abertas; as antigas ficam guardadas por mês, pra página não virar um
// rolo sem fim. Abrir a página apaga o ponto de "novidade" do menu.
// ────────────────────────────────────────────────────────

/** Quantas versões aparecem abertas no topo. */
const RECENT_COUNT = 8

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function monthLabel(iso: string): string {
  const label = new Date(`${iso.slice(0, 7)}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Agrupa por mês (AAAA-MM), mantendo a ordem da lista (mais nova primeiro). */
export function groupByMonth(entries: ChangelogEntry[]): { month: string; entries: ChangelogEntry[] }[] {
  const groups: { month: string; entries: ChangelogEntry[] }[] = []
  for (const entry of entries) {
    const month = entry.date.slice(0, 7)
    const last = groups[groups.length - 1]
    if (last && last.month === month) last.entries.push(entry)
    else groups.push({ month, entries: [entry] })
  }
  return groups
}

function Entry({ entry, latest = false }: { entry: ChangelogEntry; latest?: boolean }) {
  return (
    <li className={`news-entry${latest ? ' news-entry--latest' : ''}`} data-reveal>
      <div className="news-entry__head">
        <span className="news-entry__version">v{entry.version}</span>
        <h2 className="news-entry__title">{entry.title}</h2>
        <time className="news-entry__date" dateTime={entry.date}>{formatDate(entry.date)}</time>
      </div>
      <ul className="news-entry__items">
        {entry.items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </li>
  )
}

export function NewsPage() {
  useEffect(() => { markChangelogSeen() }, [])

  const recent = CHANGELOG.slice(0, RECENT_COUNT)
  const older = useMemo(() => groupByMonth(CHANGELOG.slice(RECENT_COUNT)), [])

  return (
    <div className="tool-page news-page">
      <div className="tool-page__header">
        <div className="tool-page__titles">
          <h1 className="tool-page__title">Novidades</h1>
          <p className="tool-page__sub">O que mudou no Vorterium, da versão mais nova pra mais antiga.</p>
        </div>
      </div>

      <ol className="news-timeline">
        {recent.map((entry, i) => (
          // versão + título: já houve duas entradas com o mesmo número de versão
          <Entry key={`${entry.version}:${entry.title}`} entry={entry} latest={i === 0} />
        ))}
      </ol>

      {older.length > 0 && (
        <section className="news-archive" aria-labelledby="news-archive-title">
          <h2 id="news-archive-title" className="tool-label">Versões anteriores</h2>
          {older.map((group) => (
            <details key={group.month} className="news-month anim-details">
              <summary className="news-month__summary">
                <span className="news-month__name">{monthLabel(group.entries[0].date)}</span>
                <span className="news-month__count">
                  {group.entries.length} {group.entries.length === 1 ? 'versão' : 'versões'}
                </span>
                <span className="news-month__range">
                  v{group.entries[group.entries.length - 1].version} a v{group.entries[0].version}
                </span>
                <span className="news-month__chevron" aria-hidden="true">▾</span>
              </summary>
              <ol className="news-timeline news-timeline--month">
                {group.entries.map((entry) => (
                  <Entry key={`${entry.version}:${entry.title}`} entry={entry} />
                ))}
              </ol>
            </details>
          ))}
        </section>
      )}
    </div>
  )
}
