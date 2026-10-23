import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import type { DndCharacterSheet, DndCharacterSheetUpdateInput } from '../../../../shared/types'
import type { SpellEntry } from '../catalog'
import type { DndSheetData } from '../hooks/useDndSheetData'
import { ImportQuestionCard } from './ImportQuestionCard'
import { applyImport } from './importService'
import { runImport } from './plan'
import type { PdfFieldsRead } from './pdfFields'
import { readSheetFromPdf } from './readPdf'
import type { SheetRead } from './readTypes'
import { emptyAnswers, goBack, withAnswer } from './wizardState'
import './DndImport.css'

// ────────────────────────────────────────────────────────
// A janela de importar a ficha por PDF: escolher o arquivo, ler, responder
// às perguntas (um card por vez, com Voltar), conferir o resumo do que vai
// ser gravado e do que será substituído, e importar. Nada é gravado antes da
// confirmação do resumo.
// ────────────────────────────────────────────────────────

type Stage = 'pick' | 'reading' | 'refused' | 'working' | 'applying' | 'done' | 'failed'
const MAX_BYTES = 40 * 1024 * 1024

interface Props {
  sheet:     DndCharacterSheet
  data:      DndSheetData
  /** Salva a ficha pelo caminho normal (atualiza a tela da ficha). */
  saveSheet: (payload: DndCharacterSheetUpdateInput) => Promise<void>
  /** Liga e desliga o bloqueio do salvamento automático enquanto grava. */
  lock:      (on: boolean) => void
  onClose:   () => void
}

async function readFile(file: File): Promise<{ read: SheetRead } | { refused: string }> {
  const [{ loadPdfLib }, { readPdfFields }] = await Promise.all([import('./pdfLoader'), import('./pdfFields')])
  let fields: PdfFieldsRead
  try { fields = await readPdfFields(await file.arrayBuffer(), await loadPdfLib()) } catch {
    return { refused: 'Não consegui abrir este arquivo como PDF. Confira se ele não está protegido por senha ou corrompido.' }
  }
  const out = readSheetFromPdf(fields)
  return out.ok ? { read: out.sheet } : { refused: out.message }
}

export function DndImportWizard({ sheet, data, saveSheet, lock, onClose }: Props) {
  const [stage, setStage] = useState<Stage>('pick')
  const [fileName, setFileName] = useState('')
  const [refusal, setRefusal] = useState('')
  const [read, setRead] = useState<SheetRead | null>(null)
  const [catalog, setCatalog] = useState<readonly SpellEntry[] | null>(null)
  const [state, setState] = useState(emptyAnswers)
  const [failure, setFailure] = useState('')
  const [over, setOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const busy = stage === 'reading' || stage === 'applying'

  // o catálogo de magias (grande) só é carregado aqui
  useEffect(() => { void import('../catalog/spells').then((m) => setCatalog(m.SPELLS)) }, [])

  const plan = useMemo(() => (read && catalog ? runImport({ read, existing: sheet, spells: catalog }, state.answers) : null), [read, catalog, sheet, state.answers])

  async function open(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_BYTES) { setRefusal('Este arquivo é grande demais para ser uma ficha (mais de 40 MB).'); setStage('refused'); return }
    setFileName(file.name)
    setStage('reading')
    const result = await readFile(file)
    if ('refused' in result) { setRefusal(result.refused); setStage('refused'); return }
    setRead(result.read)
    setState(emptyAnswers())
    setStage('working')
  }

  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); void open(e.dataTransfer.files?.[0]) }

  async function apply() {
    if (!plan?.done) return
    setStage('applying')
    lock(true)
    try {
      await applyImport({ sheet, draft: plan.draft, saveSheet })
      await data.reload()
      setStage('done')
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Não foi possível importar a ficha.')
      setStage('failed')
      try { await data.reload() } catch { /* a ficha segue como estava */ }
    } finally { lock(false) }
  }

  function back() {
    if (state.order.length === 0) { setStage('pick'); setRead(null); return }
    setState((s) => goBack(s))
  }

  const draft = plan?.done ? plan.draft : null

  return (
    <ModalOverlay onClose={onClose} closeDisabled={busy}>
      <div className="dsh-sheet dimp" role="dialog" aria-modal="true" aria-labelledby="dimp-title">
        <header className="dimp__head">
          <div>
            <span className="dimp__kicker">Importar ficha</span>
            <h2 id="dimp-title" className="dimp__heading">{fileName || 'Ficha em PDF'}</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} disabled={busy} aria-label="Fechar">×</button>
        </header>

        {stage === 'pick' && (
          <div className="dimp__card">
            <h3 className="dimp__title">Escolha o PDF da ficha</h3>
            <p className="dimp__body">O sistema lê o arquivo aqui no seu computador (ele não é enviado a lugar nenhum), faz algumas perguntas quando não tiver certeza de onde algo vai e só grava depois que você confirmar o resumo. Funciona com a ficha preenchível <strong>JohnBard.com DnD 5e CS</strong>, em português ou inglês.</p>
            <div className={`dimp__drop${over ? ' is-over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
              <button type="button" className="dimp__go" onClick={() => fileRef.current?.click()}>Escolher o PDF</button>
              <span>ou arraste o arquivo para cá</span>
            </div>
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void open(f) }} />
          </div>
        )}

        {stage === 'reading' && <div className="dimp__card dimp__card--center"><span className="spinner" /><p className="dimp__body">Lendo o PDF…</p></div>}

        {stage === 'refused' && (
          <div className="dimp__card">
            <h3 className="dimp__title">Não consegui ler esta ficha</h3>
            <p className="dimp__body">{refusal}</p>
            <div className="dimp__actions"><button type="button" className="dimp__go" onClick={() => setStage('pick')}>Escolher outro PDF</button></div>
          </div>
        )}

        {stage === 'working' && !plan && <div className="dimp__card dimp__card--center"><span className="spinner" /><p className="dimp__body">Abrindo o catálogo…</p></div>}

        {stage === 'working' && plan && !plan.done && (
          <>
            <p className="dimp__step">Pergunta {state.order.length + 1}</p>
            <ImportQuestionCard key={`${plan.question.id}:${plan.question.error ?? ''}`} q={plan.question} onAnswer={(a) => setState((s) => withAnswer(s, plan.question.id, a))} />
          </>
        )}

        {stage === 'working' && draft && (
          <div className="dimp__card">
            <span className="dimp__section">Resumo</span>
            <h3 className="dimp__title">Tudo pronto para importar</h3>
            <ul className="dimp__report">{draft.report.map((line, i) => <li key={i}>{line}</li>)}</ul>
            <div className="dimp__warn">
              <strong>Isto substitui o que a ficha tem hoje:</strong> {data.classes.length} classe(s), {data.details.skills.length} perícia(s), {data.details.attacks.length} ataque(s), {data.details.inventory.length} item(ns), {data.details.spells.length} magia(s), {data.features.length} característica(s) e as proficiências extras. Os campos de texto (história, anotações) continuam, com o texto do PDF embaixo.
            </div>
            <div className="dimp__actions">
              <button type="button" className="dimp__go dimp__go--primary" onClick={() => void apply()}>Importar para a ficha</button>
            </div>
          </div>
        )}

        {stage === 'applying' && <div className="dimp__card dimp__card--center"><span className="spinner" /><p className="dimp__body">Importando a ficha…</p></div>}

        {stage === 'done' && (
          <div className="dimp__card">
            <span className="dimp__section">Pronto</span>
            <h3 className="dimp__title">Ficha importada</h3>
            <p className="dimp__body">A ficha de {draft?.form.character_name ?? sheet.character_name ?? 'o personagem'} foi atualizada com o conteúdo do PDF. Confira as abas: o que o PDF não trazia continua como estava.</p>
            <div className="dimp__actions"><button type="button" className="dimp__go dimp__go--primary" onClick={onClose}>Ver a ficha</button></div>
          </div>
        )}

        {stage === 'failed' && (
          <div className="dimp__card">
            <h3 className="dimp__title">A importação não terminou</h3>
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
            <button type="button" className="dimp__link" onClick={onClose}>Cancelar a importação</button>
          </footer>
        )}
      </div>
    </ModalOverlay>
  )
}
