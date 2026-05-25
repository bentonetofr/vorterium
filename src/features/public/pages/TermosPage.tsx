import { Link } from 'react-router-dom'
import './PublicPages.css'

export function TermosPage() {
  return (
    <div className="public-page animate-fade-up">
      <header className="public-page__header">
        <Link to="/" className="public-page__back">← Início</Link>
        <h1 className="public-page__title">Termos de Uso</h1>
        <p className="public-page__updated">Versão inicial · sujeito a revisão</p>
      </header>

      <div className="public-page__note">
        Este documento é uma versão simplificada dos termos de uso do Campaign Lab.
        Ele pode ser atualizado futuramente para refletir mudanças no serviço ou
        adequações legais. Ao usar o Campaign Lab, você concorda com os termos abaixo.
      </div>

      <section className="public-page__section">
        <h2 className="public-page__section-title">1. Uso do serviço</h2>
        <p className="public-page__text">
          O Campaign Lab é uma plataforma para organização de campanhas de RPG de
          mesa. O uso do serviço é pessoal e não comercial, salvo acordo explícito.
        </p>
        <p className="public-page__text">
          Você é responsável por manter a confidencialidade das suas credenciais de
          acesso e por todas as ações realizadas com sua conta.
        </p>
      </section>

      <section className="public-page__section">
        <h2 className="public-page__section-title">2. Responsabilidade pelo conteúdo</h2>
        <p className="public-page__text">
          O conteúdo inserido no sistema — nomes de campanhas, fichas de personagem,
          anotações e demais dados — é de responsabilidade exclusiva do usuário que
          os cadastrou.
        </p>
        <p className="public-page__text">
          Não é permitido inserir no sistema conteúdo ilegal, ofensivo, que viole
          direitos de terceiros ou que infrinja leis aplicáveis.
        </p>
      </section>

      <section className="public-page__section">
        <h2 className="public-page__section-title">3. Disponibilidade do serviço</h2>
        <p className="public-page__text">
          O Campaign Lab é oferecido sem garantia de disponibilidade contínua ou
          permanente. O serviço pode passar por manutenção, atualizações ou
          indisponibilidades sem aviso prévio.
        </p>
        <p className="public-page__text">
          Não nos responsabilizamos por perda de dados decorrente de falhas técnicas,
          embora busquemos manter a integridade das informações armazenadas.
        </p>
      </section>

      <section className="public-page__section">
        <h2 className="public-page__section-title">4. Mudanças no serviço</h2>
        <p className="public-page__text">
          O Campaign Lab está em desenvolvimento. Funcionalidades podem ser
          adicionadas, modificadas ou removidas ao longo do tempo. Estes termos
          também podem ser atualizados. O uso continuado do serviço após alterações
          implica aceite dos novos termos.
        </p>
      </section>

      <section className="public-page__section">
        <h2 className="public-page__section-title">5. Encerramento de acesso</h2>
        <p className="public-page__text">
          Reservamo-nos o direito de suspender ou encerrar o acesso de contas que
          violem estes termos ou que façam uso indevido do serviço.
        </p>
      </section>

      <nav style={{ borderTop: '1px solid var(--border-dim)', paddingTop: 'var(--space-5)', display: 'flex', gap: 'var(--space-6)' }}>
        <Link to="/sobre" className="landing__link">Sobre</Link>
        <Link to="/privacidade" className="landing__link">Privacidade</Link>
        <Link to="/login" className="landing__link">Entrar</Link>
      </nav>
    </div>
  )
}
