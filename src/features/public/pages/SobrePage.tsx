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
          <li><strong>Campanhas:</strong> crie e gerencie campanhas nos sistemas Genérico e Altherium, com capa, descrição e status.</li>
          <li><strong>Membros e convites:</strong> adicione jogadores por e-mail ou por link de convite e controle quem é mestre ou jogador.</li>
          <li><strong>Fichas:</strong> ficha completa de Altherium (atributos, domínios, inventário, triunfos, retrato) ou ficha simples no sistema Genérico.</li>
          <li><strong>Mesa ao vivo:</strong> o mestre transmite a tela com som, mostra imagens da galeria, aponta lugares e pausa a cena.</li>
          <li><strong>Dados, chat e iniciativa:</strong> rolagens com histórico, chat da mesa com mensagens privadas e ordem de combate.</li>
          <li><strong>Ferramentas do mestre:</strong> bestiário com inimigos calculados pelas fichas do grupo, sessões, notas e o livro de regras de Altherium.</li>
          <li><strong>Autenticação:</strong> login com e-mail e senha ou via conta Google.</li>
        </ul>
      </section>

      <section className="public-page__section">
        <h2 className="public-page__section-title">Status do projeto</h2>
        <p className="public-page__text">
          O Vorterium está em desenvolvimento ativo, e novas funcionalidades chegam
          a cada versão.
        </p>
        <p className="public-page__text">
          A ficha de D&amp;D 5e está em desenvolvimento, e outros sistemas de regras e
          melhorias podem ser adicionados em versões futuras.
        </p>
        <div className="public-page__note">
          Este projeto não é afiliado a nenhuma editora ou sistema de RPG específico.
          O sistema Genérico pode ser usado com qualquer conjunto de regras.
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
