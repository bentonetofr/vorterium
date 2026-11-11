import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { AppLogo } from '../../../shared/components/AppLogo'
import './PublicPages.css'

const FEATURES = [
  { title: 'Campanhas e convites',  desc: 'Crie campanhas no Genérico, em Altherium ou em Terra Devastada e chame os jogadores por e-mail ou link de convite.' },
  { title: 'Quadro da campanha',    desc: 'Um quadro infinito que a mesa monta junta, em tempo real: post-its, setas, linhas do tempo e fotos.' },
  { title: 'Fichas',                desc: 'Fichas completas de Altherium e de Terra Devastada (com testes de pares, Horror e Convicção), ou ficha simples no Genérico.' },
  { title: 'Mesa em mundo 2D',       desc: 'Monte o mundo da campanha com terrenos, objetos, luz e clima, e cada jogador anda nele com o seu boneco.' },
  { title: 'Dados, chat e combate', desc: 'Role dados com histórico, converse no chat da mesa e conduza a ordem de iniciativa.' },
  { title: 'Ferramentas do mestre', desc: 'Bestiário com inimigos calculados pelas fichas do grupo, notas e o livro de regras à mão.' },
]

/** Ordem de entrada de cada peça do topo (classe .anim-rise). */
const step = (i: number) => ({ '--i': i } as CSSProperties)

export function LandingPage() {
  return (
    <div className="landing">

      {/* ── Hero ── */}
      <section className="landing__hero">
        <div className="landing__logo anim-rise" style={step(0)}>
          <span className="landing__logo-halo" aria-hidden="true" />
          <AppLogo size="lg" className="anim-float" />
        </div>
        <h1 className="landing__title anim-rise" style={step(1)}>Vorterium</h1>
        <p className="landing__tagline anim-rise" style={step(2)}>
          Organize suas campanhas de RPG em um só lugar.
        </p>
        <p className="landing__subtitle anim-rise" style={step(3)}>
          Campanhas, fichas, dados, chat e uma mesa em mundo 2D:
          tudo o que a sessão precisa, em um só lugar.
        </p>
        <div className="landing__actions anim-rise" style={step(4)}>
          <Link to="/login"    className="btn btn-primary landing__btn-main">Entrar</Link>
          <Link to="/cadastro" className="btn btn-ghost">Criar conta</Link>
        </div>
        <Link to="/sobre" className="landing__more-link anim-rise" style={step(5)}>Saiba mais sobre o projeto</Link>
        <a href="#features-heading" className="landing__scroll-hint anim-rise" style={step(7)} aria-label="Ver os recursos">
          <span aria-hidden="true" />
        </a>
      </section>

      {/* ── Recursos disponíveis ── */}
      <section className="landing__section" aria-labelledby="features-heading">
        <div className="landing__section-inner">
          <h2 id="features-heading" className="landing__section-title" data-reveal>
            Recursos disponíveis
          </h2>
          <div className="landing__cards-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="landing__feature-card" data-reveal>
                <h3 className="landing__feature-title">{f.title}</h3>
                <p className="landing__feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Para quem é ── */}
      <section className="landing__section landing__section--alt" aria-labelledby="roles-heading">
        <div className="landing__section-inner">
          <h2 id="roles-heading" className="landing__section-title" data-reveal>Para quem é</h2>
          <div className="landing__roles">
            <div className="landing__role-block" data-reveal="left">
              <h3 className="landing__role-title">Para mestres</h3>
              <p className="landing__role-desc">
                Crie a campanha, convide jogadores, monte o mundo na Mesa, monte
                inimigos no bestiário e acompanhe fichas, iniciativa e sessões em um
                único painel.
              </p>
            </div>
            <div className="landing__role-block" data-reveal="right">
              <h3 className="landing__role-title">Para jogadores</h3>
              <p className="landing__role-desc">
                Entre na campanha pelo link de convite, preencha sua ficha, role dados,
                converse no chat e assista à Mesa do mestre durante a sessão, tudo sem
                sair da plataforma.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Como começar ── */}
      <section className="landing__section" aria-labelledby="steps-heading">
        <div className="landing__section-inner landing__section-inner--narrow">
          <h2 id="steps-heading" className="landing__section-title" data-reveal>Como começar</h2>
          <ol className="landing__steps">
            <li className="landing__step" data-reveal="left">
              <span className="landing__step-num" aria-hidden="true">1</span>
              <div className="landing__step-body">
                <strong className="landing__step-label">Crie sua conta</strong>
                <p className="landing__step-desc">Cadastro gratuito, sem necessidade de cartão.</p>
              </div>
            </li>
            <li className="landing__step" data-reveal="left">
              <span className="landing__step-num" aria-hidden="true">2</span>
              <div className="landing__step-body">
                <strong className="landing__step-label">Crie uma campanha</strong>
                <p className="landing__step-desc">Dê um nome e configure sua mesa.</p>
              </div>
            </li>
            <li className="landing__step" data-reveal="left">
              <span className="landing__step-num" aria-hidden="true">3</span>
              <div className="landing__step-body">
                <strong className="landing__step-label">Convide jogadores</strong>
                <p className="landing__step-desc">Por e-mail ou pelo link de convite da campanha.</p>
              </div>
            </li>
            <li className="landing__step" data-reveal="left">
              <span className="landing__step-num" aria-hidden="true">4</span>
              <div className="landing__step-body">
                <strong className="landing__step-label">Jogue a sessão</strong>
                <p className="landing__step-desc">
                  Fichas e a Mesa ao vivo ficam na aba Sessão da campanha; dados e chat ficam nos botões do canto, em qualquer tela.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="landing__cta-section" aria-label="Chamada para ação">
        <div className="landing__section-inner landing__cta-inner" data-reveal="scale">
          <p className="landing__cta-text">
            Comece organizando sua primeira campanha agora.
          </p>
          <div className="landing__actions">
            <Link to="/cadastro" className="btn btn-primary landing__btn-main">Criar conta</Link>
            <Link to="/login"    className="btn btn-ghost">Entrar</Link>
          </div>
        </div>
      </section>

    </div>
  )
}
