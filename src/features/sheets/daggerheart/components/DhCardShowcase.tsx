import { useState } from 'react'
import { DOMAINS } from '../catalog/rules'
import { CARD_TYPE_LABEL } from '../catalog/rules'
import { cardImage } from '../catalog/domainCards'
import type { DhDomain, DhDomainCard } from '../model/types'
import { DomainIcon } from './DomainIcon'

// ────────────────────────────────────────────────────────
// A escolha de uma carta de domínio como vitrine: a carta em tamanho grande à esquerda (a que está sob o mouse ou o foco e,
// se não houver, a escolhida) e a estante de miniaturas à direita, por domínio. Clicar (ou tocar) escolhe; no celular, onde não
// há mouse, a carta escolhida fica na vitrine. As imagens são as das cartas do jogo.
// ────────────────────────────────────────────────────────

interface Props {
  cards: DhDomainCard[]
  /** Os domínios na ordem em que aparecem na estante. */
  domains: DhDomain[]
  value: string
  onChange: (id: string) => void
  /** Texto de apoio sobre o que aparece (o teto de nível, por exemplo). */
  hint?: string
}

export function DhCardShowcase({ cards, domains, value, onChange, hint }: Props) {
  const [hover, setHover] = useState<string | null>(null)
  const shown = cards.find((c) => c.id === (hover ?? value)) ?? cards.find((c) => c.id === value) ?? null
  const chosen = cards.find((c) => c.id === value) ?? null

  return (
    <div className="dh-show">
      <div className={`dh-show__big${shown ? '' : ' is-empty'}`} aria-live="polite">
        {shown ? (
          <>
            <img key={shown.id} src={cardImage(shown.id)} width={360} height={504} alt={`${shown.name}: ${CARD_TYPE_LABEL[shown.type]} de ${DOMAINS[shown.domain].name}, nível ${shown.level}, custo de troca ${shown.recall}`} draggable={false} />
            <p className="dh-show__cap">
              <b>{shown.name}</b>
              <span>{DOMAINS[shown.domain].name} · {CARD_TYPE_LABEL[shown.type]} · nível {shown.level}</span>
              {shown.id === value ? <em className="is-on">Escolhida</em> : <em>Clique para escolher</em>}
            </p>
          </>
        ) : (
          <p className="dh-show__empty">Passe o mouse ou toque numa carta da estante para vê-la inteira aqui.</p>
        )}
      </div>

      <div className="dh-show__shelf">
        {cards.length === 0 && <p className="dh-empty">Nenhuma carta disponível agora.</p>}
        {domains.map((d) => {
          const list = cards.filter((c) => c.domain === d)
          if (list.length === 0) return null
          return (
            <section key={d} className="dh-show__group" style={{ '--dh-domain': DOMAINS[d].color } as React.CSSProperties}>
              <h5><DomainIcon domain={d} size={16} title={false} />{DOMAINS[d].name} <small>{list.length} {list.length === 1 ? 'carta' : 'cartas'}</small></h5>
              <ul>
                {list.map((c) => (
                  <li key={c.id}>
                    <button type="button" className={`dh-show__thumb${c.id === value ? ' is-on' : ''}`} aria-pressed={c.id === value} title={c.name}
                      onClick={() => onChange(c.id === value ? '' : c.id)}
                      onMouseEnter={() => setHover(c.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(c.id)} onBlur={() => setHover(null)}>
                      <img src={cardImage(c.id)} width={360} height={504} alt={c.name} loading="lazy" draggable={false} />
                      <span>{c.name}</span>
                      {c.id === value && <i className="dh-show__check" aria-hidden="true">✓</i>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
        {hint && <p className="dh-hint dh-show__hint">{hint}</p>}
        {chosen && <p className="dh-show__chosen">Carta escolhida: <b>{chosen.name}</b></p>}
      </div>
    </div>
  )
}
