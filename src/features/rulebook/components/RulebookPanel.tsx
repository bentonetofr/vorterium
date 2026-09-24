import { useEffect, useState } from 'react'
import type { CampaignSystem } from '../../../shared/constants/systems'
import { RulebookSlot } from '../RulebookHost'
import './RulebookPanel.css'

// ────────────────────────────────────────────────────────
// Livro de regras do sistema da campanha — aba "Livro" da Mesa da Sessão.
// O PDF é arquivo estático em public/livros (servido junto com o site) e
// abre no leitor de PDF do próprio navegador. No celular, onde o leitor
// embutido não funciona bem (Android não mostra; iOS só a 1ª página), a
// aba mostra um botão de abrir no lugar do leitor — e o <iframe> nem é
// criado, pra não baixar o PDF (~37 MB) à toa. O leitor em si mora no
// RulebookHost (layout privado), pra continuar na mesma página quando a
// pessoa troca de aba e volta.
// ────────────────────────────────────────────────────────

interface Rulebook {
  title:    string
  subtitle: string
  url:      string
}

const RULEBOOKS: Partial<Record<CampaignSystem, Rulebook>> = {
  altherium: {
    title:    'Livro de regras básicas',
    subtitle: 'Altherium · versão 1.0',
    url:      '/livros/altherium-livro-de-regras-1.0.pdf',
  },
}

// Tela onde o leitor de PDF embutido funciona: larga e com mouse.
const EMBED_QUERY = '(min-width: 769px) and (pointer: fine)'

function useCanEmbedPdf(): boolean {
  const [canEmbed, setCanEmbed] = useState(() => window.matchMedia(EMBED_QUERY).matches)
  useEffect(() => {
    const media = window.matchMedia(EMBED_QUERY)
    const onChange = () => setCanEmbed(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return canEmbed
}

/** O sistema tem livro de regras pra mostrar na Mesa da Sessão? */
export function hasRulebook(system: CampaignSystem): boolean {
  return system in RULEBOOKS
}

export function RulebookPanel({ system }: { system: CampaignSystem }) {
  const book = RULEBOOKS[system]
  const canEmbed = useCanEmbedPdf()
  if (!book) return null

  return (
    <section className="rulebook">
      <header className="rulebook__header">
        <div className="rulebook__titles">
          <h4 className="rulebook__title">{book.title}</h4>
          <span className="rulebook__subtitle">{book.subtitle}</span>
        </div>
        {canEmbed && (
          <div className="rulebook__actions">
            <a className="btn btn-ghost rulebook__btn" href={book.url} target="_blank" rel="noopener noreferrer">
              Abrir em nova aba
            </a>
            <a className="btn btn-ghost rulebook__btn" href={book.url} download>
              Baixar PDF
            </a>
          </div>
        )}
      </header>

      {canEmbed ? (
        <RulebookSlot className="rulebook__viewer" url={book.url} title={`${book.title} — ${book.subtitle}`} />
      ) : (
        <div className="rulebook__mobile">
          <p>No celular, o livro abre no leitor de PDF do aparelho.</p>
          <a className="btn btn-primary" href={book.url} target="_blank" rel="noopener noreferrer">
            Abrir o livro
          </a>
        </div>
      )}
    </section>
  )
}
