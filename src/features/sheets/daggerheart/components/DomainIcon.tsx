import type { DhDomain } from '../model/types'
import { DOMAINS } from '../catalog/rules'

// ────────────────────────────────────────────────────────
// A faixa de cada domínio, igual à do livro (cor própria e o emblema branco). Fica no cabeçalho da classe, nos seletores de
// domínio e onde mais o domínio precisar de marca. São vetores (SVG) em public/dh/dominios, nítidos em qualquer tamanho: a faixa
// foi montada aqui e os emblemas vêm do repositório Foundryborne/daggerheart (assets/icons/domains), que os distribui sob a
// Darrington Press Community Gaming License (DPCGL). Daggerheart é marca da Critical Role / Darrington Press.
// ────────────────────────────────────────────────────────

export function domainBanner(domain: DhDomain): string {
  return `${import.meta.env.BASE_URL}dh/dominios/${domain}.svg`
}

interface Props {
  domain: DhDomain
  /** Largura da faixa em pixels (a altura segue a proporção do desenho). */
  size?: number
  /** Mantido por compatibilidade: a faixa do livro já tem cor própria. */
  colored?: boolean
  title?: boolean
}

export function DomainIcon({ domain, size = 18, title = true }: Props) {
  const d = DOMAINS[domain]
  return (
    <img className="dh-domain-icon" src={domainBanner(domain)} width={size} height={Math.round(size * 1.4)} alt={d.name} title={title ? d.name : undefined} draggable={false} />
  )
}
