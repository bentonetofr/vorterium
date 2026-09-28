import { useEffect, useState, type ClipboardEvent, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import {
  FEEDBACK_IMAGE_TYPES,
  FEEDBACK_MESSAGE_MAX,
  getMyFeedback,
  sendFeedback,
  validateFeedbackImage,
  type FeedbackKind,
  type SiteFeedback,
} from '../services/feedbackService'
import '../../../shared/theme/toolPage.css'
import './FeedbackPage.css'

// ────────────────────────────────────────────────────────
// Enviar feedback — problema, sugestão ou outro, com print opcional
// (dá pra colar com Ctrl+V). A página de onde a pessoa veio vai junto,
// pra quem cuida do site saber onde olhar.
// ────────────────────────────────────────────────────────

const KINDS: { id: FeedbackKind; label: string; hint: string }[] = [
  { id: 'problema', label: 'Problema',  hint: 'Algo quebrou ou não funciona como deveria.' },
  { id: 'sugestao', label: 'Sugestão',  hint: 'Uma ideia pra melhorar o site.' },
  { id: 'outro',    label: 'Outro',     hint: 'Dúvida, elogio ou qualquer outra coisa.' },
]

const KIND_LABELS: Record<FeedbackKind, string> = { problema: 'Problema', sugestao: 'Sugestão', outro: 'Outro' }
const STATUS_LABELS: Record<SiteFeedback['status'], string> = { novo: 'Enviado', lido: 'Lido', resolvido: 'Resolvido' }

interface FromState { from?: string }

export function FeedbackPage() {
  const location = useLocation()
  const from = (location.state as FromState | null)?.from ?? ''

  const [kind, setKind]         = useState<FeedbackKind>('problema')
  const [message, setMessage]   = useState('')
  const [page, setPage]         = useState(from)
  const [image, setImage]       = useState<File | null>(null)
  const [preview, setPreview]   = useState<string | null>(null)
  const [sending, setSending]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [sent, setSent]         = useState(false)
  const [history, setHistory]   = useState<SiteFeedback[]>([])

  useEffect(() => {
    getMyFeedback().then(setHistory).catch(() => { /* histórico só não aparece */ })
  }, [])

  useEffect(() => {
    if (!image) { setPreview(null); return }
    const url = URL.createObjectURL(image)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  function pickImage(file: File | null | undefined) {
    if (!file) return
    const problem = validateFeedbackImage(file)
    if (problem) { setError(problem); return }
    setError(null)
    setImage(file)
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith('image/'))
    if (file) {
      e.preventDefault()
      pickImage(file)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSending(true)
    setError(null)
    try {
      const created = await sendFeedback({ kind, message, page, image })
      setHistory((prev) => [created, ...prev])
      setMessage('')
      setImage(null)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o feedback.')
    } finally {
      setSending(false)
    }
  }

  const kindInfo = KINDS.find((k) => k.id === kind)!

  return (
    <div className="tool-page feedback-page">
      <div className="tool-page__header">
        <div className="tool-page__titles">
          <h1 className="tool-page__title">Enviar feedback</h1>
          <p className="tool-page__sub">Achou um problema ou tem uma ideia? Conte aqui — chega direto pra quem cuida do site.</p>
        </div>
      </div>

      {sent && (
        <div className="tool-page__notice" role="status">
          Obrigado! Seu feedback foi enviado. <button type="button" className="feedback-page__again" onClick={() => setSent(false)}>Enviar outro</button>
        </div>
      )}

      {!sent && (
        <form className="tool-card feedback-form" onSubmit={handleSubmit} noValidate>
          <div className="feedback-kinds" role="radiogroup" aria-label="Tipo">
            {KINDS.map((k) => (
              <button
                key={k.id} type="button" role="radio" aria-checked={kind === k.id}
                className={`feedback-kind${kind === k.id ? ' feedback-kind--active' : ''}`}
                onClick={() => setKind(k.id)}
              >
                {k.label}
              </button>
            ))}
          </div>
          <p className="tool-hint">{kindInfo.hint}</p>

          <label className="feedback-field">
            <span className="tool-label">{kind === 'problema' ? 'O que aconteceu?' : 'Conte pra gente'}</span>
            <textarea
              className="input feedback-form__message" rows={7} maxLength={FEEDBACK_MESSAGE_MAX}
              placeholder={kind === 'problema'
                ? 'O que você fez, o que esperava e o que aconteceu. Ex.: coloquei 2 pontos em Resiliência e apareceu 3d10 em vez de 4d10.'
                : 'Escreva à vontade.'}
              value={message} onChange={(e) => setMessage(e.target.value)} onPaste={handlePaste}
            />
            <span className="feedback-form__count">{message.length}/{FEEDBACK_MESSAGE_MAX}</span>
          </label>

          <label className="feedback-field">
            <span className="tool-label">Onde foi? (opcional)</span>
            <input
              type="text" className="input" maxLength={300}
              placeholder="Ex.: ficha Altherium, aba Domínios"
              value={page} onChange={(e) => setPage(e.target.value)}
            />
          </label>

          <div className="feedback-field">
            <span className="tool-label">Print (opcional)</span>
            {preview ? (
              <div className="feedback-form__preview">
                <img src={preview} alt="Print anexado" />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setImage(null)}>Remover</button>
              </div>
            ) : (
              <label className="feedback-form__drop">
                <input
                  type="file" hidden accept={FEEDBACK_IMAGE_TYPES.join(',')}
                  onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = '' }}
                />
                <span>Escolher imagem</span>
                <span className="tool-hint">ou cole um print (Ctrl+V) na caixa de texto · até 5 MB</span>
              </label>
            )}
          </div>

          {error && <p className="tool-page__error" role="alert">{error}</p>}

          <div className="tool-card__actions feedback-form__actions">
            <button type="submit" className="btn btn-primary" disabled={sending || !message.trim()}>
              {sending ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </form>
      )}

      {history.length > 0 && (
        <section className="feedback-history">
          <h2 className="tool-label">Seus envios</h2>
          <ul className="feedback-history__list">
            {history.map((f) => (
              <li key={f.id} className="feedback-item">
                <div className="feedback-item__head">
                  <span className={`feedback-item__kind feedback-item__kind--${f.kind}`}>{KIND_LABELS[f.kind]}</span>
                  <span className={`feedback-item__status feedback-item__status--${f.status}`}>{STATUS_LABELS[f.status]}</span>
                  <time className="tool-card__meta" dateTime={f.created_at}>
                    {new Date(f.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </time>
                </div>
                <p className="feedback-item__message">{f.message}</p>
                {(f.page || f.image_path) && (
                  <span className="tool-card__meta">
                    {f.page && <>Onde: {f.page}</>}
                    {f.page && f.image_path && ' · '}
                    {f.image_path && 'com print'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
