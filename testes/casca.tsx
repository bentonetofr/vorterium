// ────────────────────────────────────────────────────────
// Prévia da casca do site (só no `npm run dev`; fora do build):
// /testes/casca.html. A barra lateral, a barra de cima e a doca do celular,
// os cabeçalhos de página, cartões, abas, botões e campos — tudo com os
// estilos de verdade, sem login e sem banco. Serve pra conferir o visual
// geral (tema escuro e claro, computador e celular) depois de mexer no
// index.css, no motion.css ou no refine.css.
// `?pagina=campanhas|campanha|ferramenta|novidades|primeiros` troca o miolo; `?tema=light` abre no claro.
// ────────────────────────────────────────────────────────
import { createRoot } from 'react-dom/client'
import '../src/styles' // todo o CSS do site, na ordem do site
import { AppLogo } from '../src/shared/components/AppLogo'
import { NavIcon } from '../src/shared/components/NavIcon'
import { SITE_NAV, TOOL_NAV } from '../src/app/navigation'
import { NewsPage } from '../src/features/news/pages/NewsPage'
import { FirstSteps } from '../src/features/campaigns/components/FirstSteps'
import { MemoryRouter } from 'react-router-dom'

const params = new URLSearchParams(location.search)
const pagina = params.get('pagina') ?? 'campanhas'
if (params.get('tema') === 'light') document.documentElement.setAttribute('data-theme', 'light')

const CAPA = 'linear-gradient(135deg, #2c4a7a, #7a3b2c 55%, #c9983a)'

const MAIN = [
  { to: '/campanhas',     label: 'Campanhas' },
  { to: '/minhas-fichas', label: 'Minhas fichas' },
  { to: '/atividade',     label: 'Atividade' },
  { to: '/perfil',        label: 'Perfil' },
]
const DOCK = [
  { to: '/campanhas', label: 'Campanhas' }, { to: '/minhas-fichas', label: 'Fichas' },
  { to: '/atividade', label: 'Atividade' }, { to: '/perfil', label: 'Perfil' }, { to: '/mais', label: 'Mais' },
]
const ativo = pagina === 'ferramenta' ? '/biblioteca' : '/campanhas'

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand"><AppLogo size="sm" showText /></div>
      <a className="sidebar__user sidebar__user--link" href="#">
        <div className="sidebar__avatar">F</div>
        <div className="sidebar__user-info">
          <span className="sidebar__user-name">Fulano de Tal</span>
          <span className="sidebar__user-email">fulano@exemplo.com</span>
        </div>
      </a>
      <nav className="sidebar__nav">
        {MAIN.map((i) => (
          <a key={i.to} href="#" className={`sidebar__link${i.to === ativo ? ' sidebar__link--active' : ''}`}>
            <span className="sidebar__link-icon"><NavIcon to={i.to} /></span>{i.label}
          </a>
        ))}
        <span className="sidebar__group">Ferramentas</span>
        {TOOL_NAV.map((i) => (
          <a key={i.to} href="#" className={`sidebar__link${i.to === ativo ? ' sidebar__link--active' : ''}`}>
            <span className="sidebar__link-icon"><NavIcon to={i.to} /></span>{i.label}
          </a>
        ))}
        <span className="sidebar__group">Vorterium</span>
        {SITE_NAV.map((i) => (
          <a key={i.to} href="#" className="sidebar__link">
            <span className="sidebar__link-icon"><NavIcon to={i.to} /></span>{i.label}
            {i.to === '/novidades' && <span className="sidebar__dot" />}
          </a>
        ))}
      </nav>
      <div className="sidebar__footer">
        <div className="sidebar__footer-actions">
          <button className="btn btn-ghost sidebar__signout">Sair</button>
        </div>
        <nav className="sidebar__legal">
          <a className="sidebar__legal-link" href="#">Sobre</a>
          <a className="sidebar__legal-link" href="#">Termos</a>
          <a className="sidebar__legal-link" href="#">Privacidade</a>
        </nav>
      </div>
    </aside>
  )
}

function Topbar() {
  return (
    <header className="topbar">
      <div className="topbar__row">
        <AppLogo size="sm" showText />
        <div className="topbar__actions">
          <button className="topbar__btn"><span aria-hidden="true">↩</span> Sair</button>
        </div>
      </div>
      {pagina === 'campanha' && (
        <div className="topbar__campaign-row">
          <button type="button" className="topbar__campaign-toggle" aria-expanded="false">
            <span className="topbar__campaign-name">A Coroa de Cinzas</span>
            <span className="topbar__campaign-chevron" aria-hidden="true">▼</span>
          </button>
        </div>
      )}
    </header>
  )
}

function Row({ nome, papel, capa, desc }: { nome: string; papel: 'master' | 'player'; capa?: boolean; desc?: string }) {
  return (
    <div className="campaign-line">
      <div className="campaign-card-row">
        <div className={`campaign-card-row__cover${capa ? '' : ' campaign-card-row__cover--empty'}`} style={capa ? { backgroundImage: CAPA } : undefined}>
          {!capa && '◈'}
        </div>
        <div className="campaign-card-row__info">
          <span className="campaign-card-row__name">{nome}</span>
          <div className="campaign-card-row__meta">
            <span className="badge">D&amp;D 5e</span>
            <span className={`campaign-card-role campaign-card-role--${papel}`}>{papel === 'master' ? 'Mestre' : 'Jogador'}</span>
            <span className="campaign-status campaign-status--active">Ativa</span>
          </div>
          {desc && <p className="campaign-card-row__desc">{desc}</p>}
        </div>
        <a href="#" className="btn btn-ghost campaign-card-row__enter">Entrar →</a>
      </div>
      {papel === 'master' && <button className="campaign-line__archive" aria-label="Arquivar">✉</button>}
    </div>
  )
}

function MCard({ nome, aberto }: { nome: string; aberto?: boolean }) {
  return (
    <div className={`mcard${aberto ? ' mcard--open' : ''}`}>
      <button type="button" className="mcard__head">
        <span className="mcard__cover" style={{ backgroundImage: CAPA }} />
        <span className="mcard__main">
          <span className="mcard__name">{nome}</span>
          <span className="mcard__sub">
            <span className="campaign-card-role campaign-card-role--master">Mestre</span>
            <span className="campaign-status campaign-status--active">Ativa</span>
          </span>
        </span>
        <span className="mcard__chev" aria-hidden="true">▾</span>
      </button>
      <div className="mcard__body">
        <div className="mcard__inner">
          <div className="mcard__banner" style={{ backgroundImage: CAPA }} />
          <div className="mcard__meta"><span className="badge">Altherium</span></div>
          <p className="mcard__desc">Jovens em busca de salvar o seu povo e as suas histórias.</p>
          <div className="mcard__actions"><a href="#" className="btn btn-primary mcard__enter">Entrar →</a></div>
        </div>
      </div>
    </div>
  )
}

function Campanhas() {
  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h2 className="page__title" style={{ fontSize: 'var(--text-3xl)' }}>Olá, Fulano de Tal</h2>
          <p className="page__meta">Escolha uma campanha para continuar ou crie uma nova.</p>
        </div>
        <div className="campaigns-header-actions">
          <a href="#" className="btn btn-primary">+ Criar campanha</a>
          <button className="btn btn-ghost campaigns-archived-btn">Arquivadas (2)</button>
        </div>
      </header>
      <div className="campaigns-list">
        <section>
          <h3 className="campaigns-section__title"><span className="campaigns-section__title-icon">◈</span>Campanhas como mestre</h3>
          <div className="campaign-cards casca-so-desktop">
            <Row nome="A Coroa de Cinzas" papel="master" capa desc="Jovens em busca de salvar o seu povo e as suas histórias." />
            <Row nome="teste" papel="master" />
          </div>
          <div className="campaign-cards casca-so-celular">
            <MCard nome="A Coroa de Cinzas" aberto />
            <MCard nome="teste" />
          </div>
        </section>
        <section>
          <h3 className="campaigns-section__title"><span className="campaigns-section__title-icon">◈</span>Campanhas como jogador</h3>
          <div className="campaign-cards casca-so-desktop"><Row nome="O Legado" papel="player" capa /></div>
          <div className="campaign-cards casca-so-celular"><MCard nome="O Legado" /></div>
        </section>
      </div>
      <div className="page__empty">
        <span className="page__empty-icon">◈</span>
        <h3 className="page__empty-title">Nenhuma campanha ainda</h3>
        <p className="page__empty-text">Crie a primeira ou peça o link de convite ao mestre.</p>
      </div>
    </div>
  )
}

function Campanha() {
  const abas = ['Mesa', 'Fichas', 'Atividade', 'Iniciativa', 'Bestiário', 'Lores', 'Livro']
  return (
    <div className="page campaign-area-page">
      <header className="page__header campaign-area__page-header">
        <div className="campaign-area__cover" style={{ backgroundImage: CAPA }} />
        <div>
          <a href="#" className="page__back"><span className="page__back-arrow">←</span> Campanhas</a>
          <h2 className="page__title">A Coroa de Cinzas</h2>
          <div className="campaign-area__header-meta">
            <span className="badge">Altherium</span>
            <span className="campaign-card-role campaign-card-role--master">Mestre</span>
            <span className="campaign-status campaign-status--active">Ativa</span>
          </div>
        </div>
      </header>
      <div className="session-table">
        <div className="campaign-tabs session-table__subtabs" role="tablist">
          {abas.map((a, i) => (
            <button key={a} role="tab" aria-selected={i === 1} className={`campaign-tab${i === 1 ? ' campaign-tab--active' : ''}`}>
              <span className="campaign-tab__label">{a}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="ov-description">
        <span className="ov-description__label">Descrição</span>
        <p className="ov-description__text">Jovens em busca de salvar o seu povo e as suas histórias.</p>
      </div>
      <div className="ov-stats">
        {['Sessão', 'Membros', 'Episódios'].map((t, i) => (
          <div className="ov-stat" key={t}>
            <div className="ov-stat__header"><span className="ov-stat__icon">⚜</span><span className="ov-stat__title">{t}</span></div>
            <div className="ov-stat__body"><span className="ov-stat__num">{[6, 7, 22][i]}</span><span className="ov-stat__detail">resumo da seção</span></div>
            <button className="btn btn-ghost ov-stat__action">Abrir →</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function Ferramenta() {
  return (
    <div className="tool-page">
      <div className="tool-page__header">
        <div className="tool-page__titles">
          <h1 className="tool-page__title">Meu bestiário</h1>
          <p className="tool-page__sub">Suas criaturas pra usar em qualquer campanha. Só você vê.</p>
        </div>
        <button className="btn btn-primary">+ Nova criatura</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
        {['Draugr', 'Lobo das Neves', 'Troll'].map((n) => (
          <article className="tool-card" key={n}>
            <h2 className="tool-card__title">{n}</h2>
            <span className="tool-card__meta">Criatura · ND 5</span>
            <div className="tool-card__actions"><button className="btn btn-ghost btn-sm">Editar</button><button className="btn btn-danger btn-sm">Excluir</button></div>
          </article>
        ))}
      </div>
      <div className="tool-card" style={{ maxWidth: 520 }}>
        <label className="label" htmlFor="x">Nome</label>
        <input id="x" className="input" placeholder="Ex.: Draugr Bestial" />
        <div className="tool-card__actions">
          <button className="btn btn-primary">Salvar</button>
          <button className="btn btn-ghost">Cancelar</button>
          <button className="btn btn-primary" disabled>Desligado</button>
        </div>
      </div>
      <div className="tool-page__empty">
        <p className="tool-page__empty-icon">❧</p>
        <p className="tool-page__empty-title">A biblioteca ainda está vazia.</p>
        <p className="tool-page__empty-text">Quando o mestre guardar um livro ou documento, ele aparece aqui.</p>
      </div>
    </div>
  )
}

function Casca() {
  return (
    <>
      <style>{`
        .casca-so-celular { display: none; }
        @media (max-width: 900px) { .casca-so-celular { display: flex; } .casca-so-desktop { display: none; } }
      `}</style>
      <div className="private-layout">
        <Sidebar />
        <Topbar />
        <main className="private-layout__main">
          <div className="private-layout__page">
            {pagina === 'campanha' ? <Campanha />
              : pagina === 'ferramenta' ? <Ferramenta />
              : pagina === 'novidades' ? <NewsPage />
              : pagina === 'primeiros' ? <div className="page"><FirstSteps /></div>
              : <Campanhas />}
          </div>
        </main>
        <nav className="bottom-nav">
          {DOCK.map((i) => (
            <a key={i.to} href="#" className={`bottom-nav__link${i.to === '/campanhas' ? ' bottom-nav__link--active' : ''}`}>
              <span className="bottom-nav__icon"><NavIcon to={i.to} size={22} /></span>
              <span className="bottom-nav__label">{i.label}</span>
            </a>
          ))}
        </nav>
      </div>
      <div className="dice-fab-wrapper site-tools">
        <button type="button" className="site-tools__toggle" aria-label="Ferramentas">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          <span className="site-tools__badge">3</span>
        </button>
      </div>
    </>
  )
}

createRoot(document.getElementById('root')!).render(<MemoryRouter><Casca /></MemoryRouter>)
