import { Link } from 'react-router-dom'
import { AppLogo } from '../../../shared/components/AppLogo'
import './PublicPages.css'

const FEATURES = [
  { title: 'Campanhas',         desc: 'Crie campanhas e organize suas mesas em um painel central.' },
  { title: 'Membros',           desc: 'Adicione jogadores por e-mail ou envie convites por link.' },
  { title: 'Ficha simples',     desc: 'Registre informações básicas dos personagens sem complexidade.' },
  { title: 'Rolagem de dados',  desc: 'Role dados comuns de RPG e acompanhe o histórico da campanha.' },
  { title: 'Convites por link', desc: 'Compartilhe um link para que jogadores entrem na campanha com facilidade.' },
]

export function LandingPage() {
  return (
    <div className="landing animate-fade-in">

      {/* ── Hero ── */}
      <section className="landing__hero">
        <AppLogo size="lg" />
        <h1 className="landing__title">Campaign Lab</h1>
        <p className="landing__tagline">
          Organize suas campanhas de RPG em um só lugar.
        </p>
        <p className="landing__subtitle">
          Gerencie campanhas, membros, fichas simples, rolagens de dados e convites
          por link com uma interface prática e centralizada.
        </p>
        <div className="landing__actions">
          <Link to="/login"    className="btn btn-primary landing__btn-main">Entrar</Link>
          <Link to="/cadastro" className="btn btn-ghost">Criar conta</Link>
        </div>
        <Link to="/sobre" className="landing__more-link">Saiba mais sobre o projeto</Link>
      </section>

      {/* ── Recursos disponíveis ── */}
      <section className="landing__section" aria-labelledby="features-heading">
        <div className="landing__section-inner">
          <h2 id="features-heading" className="landing__section-title">
            Recursos disponíveis
          </h2>
          <div className="landing__cards-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="landing__feature-card">
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
          <h2 id="roles-heading" className="landing__section-title">Para quem é</h2>
          <div className="landing__roles">
            <div className="landing__role-block">
              <h3 className="landing__role-title">Para mestres</h3>
              <p className="landing__role-desc">
                O Campaign Lab centraliza a organização da campanha, os participantes
                e os recursos básicos da mesa. Crie uma campanha, adicione jogadores,
                acompanhe membros, visualize fichas e gerencie a mesa em um único painel.
              </p>
            </div>
            <div className="landing__role-block">
              <h3 className="landing__role-title">Para jogadores</h3>
              <p className="landing__role-desc">
                Entre na campanha pelo link de convite, acesse sua ficha simples,
                registre informações do personagem e acompanhe o histórico de rolagens
                durante a sessão — tudo sem sair da plataforma.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Como começar ── */}
      <section className="landing__section" aria-labelledby="steps-heading">
        <div className="landing__section-inner landing__section-inner--narrow">
          <h2 id="steps-heading" className="landing__section-title">Como começar</h2>
          <ol className="landing__steps">
            <li className="landing__step">
              <span className="landing__step-num" aria-hidden="true">1</span>
              <div className="landing__step-body">
                <strong className="landing__step-label">Crie sua conta</strong>
                <p className="landing__step-desc">Cadastro gratuito, sem necessidade de cartão.</p>
              </div>
            </li>
            <li className="landing__step">
              <span className="landing__step-num" aria-hidden="true">2</span>
              <div className="landing__step-body">
                <strong className="landing__step-label">Crie uma campanha</strong>
                <p className="landing__step-desc">Dê um nome e configure sua mesa.</p>
              </div>
            </li>
            <li className="landing__step">
              <span className="landing__step-num" aria-hidden="true">3</span>
              <div className="landing__step-body">
                <strong className="landing__step-label">Convide jogadores</strong>
                <p className="landing__step-desc">Por e-mail ou pelo link de convite da campanha.</p>
              </div>
            </li>
            <li className="landing__step">
              <span className="landing__step-num" aria-hidden="true">4</span>
              <div className="landing__step-body">
                <strong className="landing__step-label">Use ficha simples e rolagens</strong>
                <p className="landing__step-desc">
                  Cada jogador gerencia sua própria ficha e rola dados na sessão.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="landing__cta-section" aria-label="Chamada para ação">
        <div className="landing__section-inner landing__cta-inner">
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
