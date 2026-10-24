/** A ficha "desenhada em cinza" enquanto carrega: o lugar de cada coisa já aparece, com um brilho passando. */
export function DndSkeleton() {
  return (
    <div className="dsh-sheet dsh-skel" role="status" aria-busy="true" aria-label="Carregando a ficha">
      <div className="dsh-skel__hero">
        <span className="dsh-skel__block dsh-skel__avatar" />
        <div className="dsh-skel__lines">
          <span className="dsh-skel__block dsh-skel__line dsh-skel__line--title" />
          <span className="dsh-skel__block dsh-skel__line" />
          <span className="dsh-skel__block dsh-skel__line dsh-skel__line--short" />
        </div>
      </div>
      <div className="dsh-skel__stats">
        {Array.from({ length: 7 }, (_, i) => <span key={i} className="dsh-skel__block dsh-skel__stat" />)}
      </div>
      <span className="dsh-skel__block dsh-skel__tabs" />
      <div className="dsh-skel__cards">
        {Array.from({ length: 3 }, (_, i) => <span key={i} className="dsh-skel__block dsh-skel__card" />)}
      </div>
    </div>
  )
}
