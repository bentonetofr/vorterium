import { SEVERITY_LABEL } from './catalog'
import { useVtIssues, vtDismiss, type VtIssue } from './vtErrors'
import './errors.css'

/**
 * Pop-ups dos erros do Vortable: código, o que aconteceu e o que fazer. Os graves abrem
 * uma janela no meio da tela; os outros ficam no canto e somem sozinhos (os de
 * "reconectando" somem quando a conexão volta).
 */
export function VtErrorPopups() {
  const issues = useVtIssues()
  const grave = issues.find((i) => i.def.severity === 'grave')
  const others = issues.filter((i) => i !== grave)
  return (
    <>
      {others.length > 0 && (
        <div className="vt-pops" aria-live="polite">
          {others.map((i) => <Pop key={i.id} issue={i} />)}
        </div>
      )}
      {grave && (
        <div className="vt-grave" role="alertdialog" aria-modal="true" aria-labelledby={`vt-pop-${grave.id}`}>
          <Pop issue={grave} />
        </div>
      )}
    </>
  )
}

function Pop({ issue }: { issue: VtIssue }) {
  const sev = issue.def.severity
  return (
    <section className={`vt-pop vt-pop--${sev}`} role={sev === 'erro' || sev === 'grave' ? 'alert' : 'status'}>
      <div className="vt-pop__head">
        <code className={`vt-code vt-code--${sev}`}>{issue.code}</code>
        <h4 className="vt-pop__title" id={`vt-pop-${issue.id}`}>{issue.from ? `${issue.from}: ${issue.title}` : issue.title}</h4>
        <button type="button" className="vt-pop__close" onClick={() => vtDismiss(issue.id)} aria-label="Fechar aviso">✕</button>
      </div>
      <p className="vt-pop__what">{issue.what}</p>
      <p className="vt-pop__fix"><b>O que fazer:</b> {issue.fix}</p>
      <div className="vt-pop__meta">
        <span>{SEVERITY_LABEL[sev]}</span>
        {issue.repeat > 1 && <span>repetiu {issue.repeat}×</span>}
        {issue.from && <span>erro de outro jogador</span>}
      </div>
      {!issue.from && issue.def.action === 'reload' && (
        <div className="vt-pop__btns">
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Recarregar a página</button>
          {sev === 'grave' && <button type="button" className="btn btn-ghost" onClick={() => vtDismiss(issue.id)}>Fechar</button>}
        </div>
      )}
      {sev === 'grave' && issue.def.action !== 'reload' && (
        <div className="vt-pop__btns">
          <button type="button" className="btn btn-primary" onClick={() => vtDismiss(issue.id)}>Entendi</button>
        </div>
      )}
    </section>
  )
}
