import { Link } from 'react-router-dom'
import './PublicPages.css'

export function SobrePage() {
  return (
    <div className="public-page animate-fade-up">
      <header className="public-page__header">
        <Link to="/" className="public-page__back">← Início</Link>
        <h1 className="public-page__title">Sobre o Vorterium</h1>
      </header>

      <section className="public-page__section">
        <h2 className="public-page__section-title">O que é</h2>
        <p className="public-page__text">
          Vorterium é uma plataforma web para organização e gerenciamento de
          campanhas de RPG de mesa. O objetivo é centralizar o que acontece em uma
          campanha: quem são os participantes, quais são os personagens e como estão
          progredindo as sessões.
        </p>
      </section>

      <section className="public-page__section">
        <h2 className="public-page__section-title">Funcionalidades atuais</h2>
        <ul className="public-page__list">
          <li><strong>Campanhas:</strong> crie e gerencie campanhas de RPG com sistema Genérico.</li>
          <li><strong>Membros:</strong> adicione jogadores por e-mail e controle quem é mestre ou jogador.</li>
          <li><strong>Ficha simples:</strong> cada jogador pode preencher uma ficha básica com atributos, pontos de vida e anotações.</li>
          <li><strong>Rolagem de dados:</strong> role d4, d6, d8, d10, d12, d20 ou d100 diretamente no sistema, com histórico por campanha.</li>
          <li><strong>Autenticação:</strong> login com e-mail e senha ou via conta Google.</li>
        </ul>
      </section>

      <section className="public-page__section">
        <h2 className="public-page__section-title">Status do projeto</h2>
        <p className="public-page__text">
          O Vorterium está em desenvolvimento ativo. A versão atual é um MVP
          (Minimum Viable Product) — uma primeira versão funcional com as
          funcionalidades essenciais.
        </p>
        <p className="public-page__text">
          Funcionalidades como chat entre membros, suporte a sistemas específicos de
          regras, upload de imagens, notificações e outras melhorias podem ser
          adicionadas em versões futuras.
        </p>
        <div className="public-page__note">
          Este projeto não é afiliado a nenhuma editora ou sistema de RPG específico.
          O sistema Genérico disponível pode ser usado com qualquer conjunto de regras.
        </div>
      </section>

      <nav style={{ borderTop: '1px solid var(--border-dim)', paddingTop: 'var(--space-5)', display: 'flex', gap: 'var(--space-6)' }}>
        <Link to="/termos" className="landing__link">Termos de uso</Link>
        <Link to="/privacidade" className="landing__link">Privacidade</Link>
        <Link to="/login" className="landing__link">Entrar</Link>
      </nav>
    </div>
  )
}
