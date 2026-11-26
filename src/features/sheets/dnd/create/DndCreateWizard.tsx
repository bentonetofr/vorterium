import { useEffect, useMemo, useState } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import type { DndCharacterSheet, DndCharacterSheetUpdateInput } from '../../../../shared/types'
import type { SpellEntry } from '../catalog'
import type { DndSheetData } from '../hooks/useDndSheetData'
import { ImportQuestionCard } from '../import/ImportQuestionCard'
import { applyImport } from '../import/importService'
import { emptyAnswers, goBack, withAnswer } from '../import/wizardState'
import type { CreationKind } from './blank'
import type { NarrativeResult } from './narrative'
import { runCreate } from './plan'
import '../import/DndImport.css'
import './DndCreate.css'

// ────────────────────────────────────────────────────────
// O assistente de criação: faz as perguntas do planejador (runCreate) uma por vez, mostra o resumo do que vai ser criado e
// grava pelo mesmo caminho do importador de PDF (com cópia de segurança e desfazer se algo falhar). Vindo da narrativa, as
// perguntas já trazem a escolha do site marcada como recomendada, e o resumo pode ser aceito de uma vez ("auto").
// ────────────────────────────────────────────────────────

interface Props {
  mode: Extract<CreationKind, 'quick' | 'narrative'>
  sheet: DndCharacterSheet
  data: DndSheetData
  /** Salva a ficha pelo caminho normal (atualiza a tela). */
  saveSheet: (payload: DndCharacterSheetUpdateInput) => Promise<void>
  /** Liga e desliga o bloqueio do salvamento automático enquanto grava. */
  lock: (on: boolean) => void
  /** Cancelar ou voltar à janela de escolha. */
  onClose: () => void
  /** A ficha foi criada: fecha tudo. */
  onCreated: () => void
  /** Vindo da narrativa: as sugestões e os textos de personalidade. */
  narrative?: NarrativeResult
  /** Abre direto no resumo, com as sugestões aceitas. */
  autoStart?: boolean
  /** Voltar às perguntas da narrativa. */
  onBackToNarrative?: () => void
}

type Stage = 'working' | 'applying' | 'done' | 'failed'

export function DndCreateWizard({ mode, sheet, data, saveSheet, lock, onClose, onCreated, narrative, autoStart = false, onBackToNarrative }: Props) {
  const [catalog, setCatalog] = useState<readonly SpellEntry[] | null>(null)
  const [state, setState] = useState(emptyAnswers)
  const [auto, setAuto] = useState(autoStart)
  const [stage, setStage] = useState<Stage>('working')
  const [failure, setFailure] = useState('')
  const busy = stage === 'applying'

  // o catálogo de magias (grande) só é carregado aqui
  useEffect(() => { void import('../catalog/spells').then((m) => setCatalog(m.SPELLS)) }, [])

  const plan = useMemo(
    () => (catalog ? runCreate({ existing: sheet, spells: catalog, suggester: narrative?.suggester, extras: narrative?.extras, auto }, state.answers) : null),
    [catalog, sheet, narrative, auto, state.answers],
  )
  const draft = plan?.done ? plan.draft : null

  async function create() {
    if (!plan?.done) return
    setStage('applying')
    lock(true)
    try {
      await applyImport({ sheet, draft: plan.draft, saveSheet: (payload) => saveSheet({ ...payload, choices: { ...((payload.choices ?? {}) as Record<string, unknown>), creation: mode } }) })
      await data.reload()
      setStage('done')
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Não foi possível criar a ficha.')
      setStage('failed')
      try { await data.reload() } catch { /* a ficha segue como estava */ }
    } finally { lock(false) }
  }

  function back() {
    if (state.order.length > 0) { setState((s) => goBack(s)); return }
    if (!auto && narrative) { setAuto(true); return }
    if (narrative && onBackToNarrative) { onBackToNarrative(); return }
    onClose()
  }

  return (
    <ModalOverlay onClose={onClose} closeDisabled={busy}>
      <div className="dsh-sheet dimp dcr" role="dialog" aria-modal="true" aria-labelledby="dcr-wiz-title">
        <header className="dimp__head">
          <div>
            <span className="dimp__kicker">{mode === 'narrative' ? 'Ficha por narrativa' : 'Ficha rápida'}</span>
            <h2 id="dcr-wiz-title" className="dimp__heading">{draft?.form.character_name || 'Nova ficha de D&D'}</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} disabled={busy} aria-label="Fechar">×</button>
        </header>

        {stage === 'working' && !plan && <div className="dimp__card dimp__card--center"><span className="spinner" /><p className="dimp__body">Abrindo o catálogo…</p></div>}

        {stage === 'working' && plan && !plan.done && (
          <>
            <p className="dimp__step">Pergunta {state.order.length + 1}</p>
            <ImportQuestionCard key={`${plan.question.id}:${plan.question.error ?? ''}`} q={plan.question} onAnswer={(a) => setState((s) => withAnswer(s, plan.question.id, a))} />
          </>
        )}

        {stage === 'working' && draft && plan?.done && (
          <div className="dimp__card">
            <span className="dimp__section">Resumo</span>
            <h3 className="dimp__title">{auto ? 'Montei a ficha com o que você contou' : 'Tudo pronto para criar'}</h3>
            <ul className="dimp__report">{plan.summary.map((line, i) => <li key={i}>{line}</li>)}</ul>
            {narrative && auto && <p className="dimp__body">Cada escolha está marcada como recomendada se você quiser conferir uma por uma em “Ajustar passo a passo”.</p>}
            <div className="dimp__warn">Depois de criada, tudo na ficha continua editável: nome, raça, classe, atributos, perícias, equipamento, magias e o que mais você quiser.</div>
            <div className="dimp__actions">
              {narrative && auto && <button type="button" className="dimp__go" onClick={() => { setState(emptyAnswers()); setAuto(false) }}>Ajustar passo a passo</button>}
              <button type="button" className="dimp__go dimp__go--primary" onClick={() => void create()}>Criar a ficha</button>
            </div>
          </div>
        )}

        {stage === 'applying' && <div className="dimp__card dimp__card--center"><span className="spinner" /><p className="dimp__body">Criando a ficha…</p></div>}

        {stage === 'done' && (
          <div className="dimp__card">
            <span className="dimp__section">Pronto</span>
            <h3 className="dimp__title">Ficha criada</h3>
            <p className="dimp__body">A ficha de {draft?.form.character_name ?? 'o personagem'} está pronta, com tudo calculado. Confira as abas e mude o que quiser: nada fica travado.</p>
            <div className="dimp__actions"><button type="button" className="dimp__go dimp__go--primary" onClick={onCreated}>Ver a ficha</button></div>
          </div>
        )}

        {stage === 'failed' && (
          <div className="dimp__card">
            <h3 className="dimp__title">A criação não terminou</h3>
            <p className="dimp__error" role="alert">{failure}</p>
            <div className="dimp__actions">
              <button type="button" className="dimp__go" onClick={() => setStage('working')}>Voltar ao resumo</button>
              <button type="button" className="dimp__go" onClick={onClose}>Fechar</button>
            </div>
          </div>
        )}

        {stage === 'working' && plan && (
          <footer className="dimp__foot">
            <button type="button" className="dimp__link" onClick={back}>← Voltar</button>
            <button type="button" className="dimp__link" onClick={onClose}>Cancelar</button>
          </footer>
        )}
      </div>
    </ModalOverlay>
  )
}
