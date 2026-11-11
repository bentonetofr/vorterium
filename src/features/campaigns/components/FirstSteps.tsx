import { Link } from 'react-router-dom'

// ────────────────────────────────────────────────────────
// Primeiros passos — o que aparece em Campanhas pra quem acabou de criar
// a conta e ainda não tem nenhuma campanha. Dois caminhos: mestrar ou
// jogar. Some sozinho assim que a primeira campanha existe.
// ────────────────────────────────────────────────────────

const MASTER_STEPS = [
  { title: 'Crie a campanha', text: 'Dê um nome e escolha o sistema. Quem cria é o mestre.' },
  { title: 'Chame os jogadores', text: 'Em Membros, gere o link de convite e mande pro grupo.' },
  { title: 'Abra a Sessão', text: 'Fichas, Mesa, iniciativa e bestiário ficam ali; dados e chat, nos botões do canto.' },
]

const PLAYER_STEPS = [
  { title: 'Peça o link de convite', text: 'O mestre gera o link na campanha dele. Abrindo logado, você já entra.' },
  { title: 'Monte a sua ficha', text: 'Na Sessão da campanha, aba Ficha. Ela salva sozinha.' },
  { title: 'Role os dados', text: 'O botão do dado fica no canto da tela, em qualquer página.' },
]

function Path({ kicker, title, steps, children }: {
  kicker: string; title: string; steps: { title: string; text: string }[]; children?: React.ReactNode
}) {
  return (
    <section className="first-steps__path">
      <span className="first-steps__kicker">{kicker}</span>
      <h3 className="first-steps__title">{title}</h3>
      <ol className="first-steps__list">
        {steps.map((s, i) => (
          <li key={s.title} className="first-steps__step">
            <span className="first-steps__num" aria-hidden="true">{i + 1}</span>
            <span className="first-steps__body">
              <strong>{s.title}</strong>
              <span>{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
      {children}
    </section>
  )
}

export function FirstSteps() {
  return (
    <div className="first-steps animate-fade-up">
      <div className="first-steps__head">
        <h3 className="first-steps__heading">Primeiros passos</h3>
        <p className="first-steps__lead">Você ainda não está em nenhuma campanha. Escolha por onde começar.</p>
      </div>
      <div className="first-steps__paths">
        <Path kicker="Vou mestrar" title="Comece uma campanha" steps={MASTER_STEPS}>
          <Link to="/campanhas/nova" className="btn btn-primary first-steps__cta">Criar campanha</Link>
        </Path>
        <Path kicker="Vou jogar" title="Entre na campanha de alguém" steps={PLAYER_STEPS}>
          <Link to="/ajuda" className="btn btn-ghost first-steps__cta">Ver a Ajuda</Link>
        </Path>
      </div>
    </div>
  )
}
