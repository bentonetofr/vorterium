import { Link } from 'react-router-dom'
import './PublicPages.css'

export function PrivacidadePage() {
  return (
    <div className="public-page animate-fade-up">
      <header className="public-page__header">
        <Link to="/" className="public-page__back">← Início</Link>
        <h1 className="public-page__title">Política de Privacidade</h1>
        <p className="public-page__updated">Versão inicial · sujeito a revisão</p>
      </header>

      <div className="public-page__note">
        Esta é uma versão simplificada da política de privacidade do Vorterium.
        O texto pode ser atualizado conforme o projeto evolui. Esta política não
        constitui aconselhamento jurídico.
      </div>

      <section className="public-page__section">
        <h2 className="public-page__section-title">1. Dados coletados</h2>
        <p className="public-page__text">
          Ao usar o Vorterium, coletamos e armazenamos os seguintes dados:
        </p>
        <ul className="public-page__list">
          <li><strong>Conta:</strong> e-mail e nome público informados no cadastro ou fornecidos pelo login com Google.</li>
          <li><strong>Campanhas:</strong> nome e configurações das campanhas criadas.</li>
          <li><strong>Membros:</strong> e-mails e papéis (mestre/jogador) vinculados às campanhas.</li>
          <li><strong>Fichas:</strong> dados inseridos nas fichas de personagem (nome, atributos, pontos de vida, anotações).</li>
          <li><strong>Rolagens:</strong> resultados de rolagens de dados registrados no sistema.</li>
        </ul>
      </section>

      <section className="public-page__section">
        <h2 className="public-page__section-title">2. Uso dos dados</h2>
        <p className="public-page__text">
          Os dados coletados são usados exclusivamente para o funcionamento do
          Vorterium: autenticar usuários, exibir campanhas e fichas, registrar
          rolagens e associar membros às campanhas.
        </p>
        <p className="public-page__text">
          Não vendemos, alugamos nem compartilhamos dados pessoais com terceiros
          para fins comerciais ou publicitários.
        </p>
      </section>

      <section className="public-page__section">
        <h2 className="public-page__section-title">3. Infraestrutura</h2>
        <p className="public-page__text">
          O Vorterium utiliza o <strong>Supabase</strong> como plataforma de
          autenticação e banco de dados. Os dados são armazenados nos servidores do
          Supabase. Consulte a{' '}
          <a
            href="https://supabase.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            política de privacidade do Supabase
          </a>{' '}
          para mais detalhes sobre como eles tratam os dados.
        </p>
      </section>

      <section className="public-page__section">
        <h2 className="public-page__section-title">4. Login com Google</h2>
        <p className="public-page__text">
          Se você optar pelo login com Google, o Vorterium recebe da Google os
          dados básicos da sua conta, como e-mail e nome. Esses dados são usados
          apenas para criar e identificar sua conta no sistema.
        </p>
      </section>

      <section className="public-page__section">
        <h2 className="public-page__section-title">5. Solicitação de remoção de dados</h2>
        <p className="public-page__text">
          Você pode solicitar a exclusão dos seus dados a qualquer momento. Para
          isso, entre em contato pelo canal oficial:
        </p>
        <div className="public-page__note">
          Contato: definir e-mail oficial antes do lançamento público.
        </div>
        <p className="public-page__text">
          Após solicitação, os dados serão removidos dentro de um prazo razoável,
          respeitando eventuais obrigações técnicas ou legais de retenção.
        </p>
      </section>

      <section className="public-page__section">
        <h2 className="public-page__section-title">6. Alterações nesta política</h2>
        <p className="public-page__text">
          Esta política pode ser atualizada conforme o projeto evolui. Mudanças
          relevantes serão comunicadas na plataforma quando possível.
        </p>
      </section>

      <nav style={{ borderTop: '1px solid var(--border-dim)', paddingTop: 'var(--space-5)', display: 'flex', gap: 'var(--space-6)' }}>
        <Link to="/sobre" className="landing__link">Sobre</Link>
        <Link to="/termos" className="landing__link">Termos de uso</Link>
        <Link to="/login" className="landing__link">Entrar</Link>
      </nav>
    </div>
  )
}
