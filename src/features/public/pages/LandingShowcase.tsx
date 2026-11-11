import type { CSSProperties } from 'react'
import { NavIcon } from '../../../shared/components/NavIcon'

// ────────────────────────────────────────────────────────
// Vitrine da página inicial: uma miniatura do site desenhada em HTML (não
// é foto), com dados de mentira — a tela de uma campanha no computador e,
// por cima, a mesma campanha no celular. É só enfeite: fica fora da
// leitura de tela e não recebe clique.
// ────────────────────────────────────────────────────────

const HEROES = [
  { name: 'Kareena', role: 'Pilar · Nv 4', hp: 0.86, mp: 0.62, hue: 18 },
  { name: 'Leona', role: 'Runaskin · Nv 4', hp: 0.54, mp: 0.9, hue: 205 },
  { name: 'Gutris', role: 'Berserker · Nv 4', hp: 0.97, mp: 0.38, hue: 130 },
]

const NAV = ['/campanhas', '/minhas-fichas', '/atividade', '/biblioteca', '/galeria']
const TABS = ['Mesa', 'Fichas', 'Iniciativa', 'Bestiário']

function Bars({ hp, mp }: { hp: number; mp: number }) {
  return (
    <span className="showcase__bars">
      <i className="showcase__bar showcase__bar--hp" style={{ '--fill': hp } as CSSProperties} />
      <i className="showcase__bar showcase__bar--mp" style={{ '--fill': mp } as CSSProperties} />
    </span>
  )
}

export function LandingShowcase() {
  return (
    <div className="showcase" aria-hidden="true" data-reveal="scale">
      {/* ── a janela do computador ── */}
      <div className="showcase__window">
        <div className="showcase__chrome">
          <i /><i /><i />
          <span className="showcase__url">vorterium · A Coroa de Cinzas</span>
        </div>
        <div className="showcase__app">
          <div className="showcase__side">
            <span className="showcase__logo" />
            {NAV.map((to, i) => (
              <span key={to} className={`showcase__nav${i === 0 ? ' showcase__nav--on' : ''}`}>
                <NavIcon to={to} size={14} />
                <i />
              </span>
            ))}
          </div>
          <div className="showcase__main">
            <div className="showcase__head">
              <span className="showcase__cover" />
              <span className="showcase__titles">
                <strong>A Coroa de Cinzas</strong>
                <span className="showcase__chips"><i>Altherium</i><i className="showcase__chip--gold">Mestre</i><i className="showcase__chip--ok">Ao vivo</i></span>
              </span>
            </div>
            <div className="showcase__tabs">
              {TABS.map((t, i) => <span key={t} className={i === 1 ? 'showcase__tab--on' : undefined}>{t}</span>)}
            </div>
            <div className="showcase__cards">
              {HEROES.map((h) => (
                <span key={h.name} className="showcase__card">
                  <span className="showcase__who">
                    <i className="showcase__face" style={{ '--hue': h.hue } as CSSProperties} />
                    <span><strong>{h.name}</strong><em>{h.role}</em></span>
                  </span>
                  <Bars hp={h.hp} mp={h.mp} />
                </span>
              ))}
            </div>
            <div className="showcase__order">
              <span className="showcase__order-title">Iniciativa</span>
              {['Leona', 'Draugr', 'Kareena', 'Gutris'].map((n, i) => (
                <span key={n} className={`showcase__turn${i === 0 ? ' showcase__turn--now' : ''}`}><b>{[19, 16, 12, 7][i]}</b>{n}</span>
              ))}
            </div>
          </div>
        </div>
        {/* o resultado de uma rolagem, pousado no canto */}
        <div className="showcase__roll">
          <span className="showcase__die">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M12 2.5 21 7.5v9L12 21.5 3 16.5v-9Z" /><path d="M12 2.5v19M3 7.5l9 5 9-5" /></svg>
          </span>
          <span className="showcase__roll-text"><em>Kareena · Resiliência</em><strong>4d10 + 8 <b>= 31</b></strong></span>
        </div>
      </div>

      {/* ── o celular, por cima ── */}
      <div className="showcase__phone">
        <span className="showcase__notch" />
        <span className="showcase__phone-cover"><strong>A Coroa de Cinzas</strong></span>
        <span className="showcase__phone-card">
          <span className="showcase__who">
            <i className="showcase__face" style={{ '--hue': 18 } as CSSProperties} />
            <span><strong>Kareena</strong><em>Pilar · Nv 4</em></span>
          </span>
          <Bars hp={0.86} mp={0.62} />
        </span>
        <span className="showcase__phone-card showcase__phone-card--chat">
          <em>Mestre</em>
          <span>A porta range. Quem entra primeiro?</span>
        </span>
        <span className="showcase__dock">
          {['/campanhas', '/minhas-fichas', '/atividade', '/perfil'].map((to, i) => (
            <span key={to} className={i === 0 ? 'showcase__dock--on' : undefined}><NavIcon to={to} size={13} /></span>
          ))}
        </span>
      </div>
    </div>
  )
}
