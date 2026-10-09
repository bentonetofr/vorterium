/**
 * Tela de carregando: o cavaleiro correndo em volta de um círculo, em looping (ver `.loader` em index.css).
 * No lugar do texto "Carregando…". Pra botões ocupados, use o `.spinner` pequeno.
 */
export function Loader({ small = false, className = '' }: { small?: boolean; className?: string }) {
  return <div className={`loader${small ? ' loader--sm' : ''}${className ? ` ${className}` : ''}`} role="status" aria-label="Carregando"><span className="loader__run"><i className="loader__knight" /></span></div>
}
