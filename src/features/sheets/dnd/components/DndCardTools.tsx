import type { ReactNode } from 'react'

// ────────────────────────────────────────────────────────
// Lápis e lixeira no canto de cima de cada cartão da ficha (arma, magia,
// item, característica, recurso): o lápis abre (e fecha) o painel de edição
// com todos os campos; a lixeira tira o cartão da ficha.
// ────────────────────────────────────────────────────────

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M9 7V4.5h6V7" />
      <path d="M6.5 7l1 13h9l1-13" />
      <path d="M10 11v5.5M14 11v5.5" />
    </svg>
  )
}

interface CardToolsProps {
  /** Nome do cartão, para os rótulos de leitor de tela ("Editar Espada longa"). */
  name:      string
  editing:   boolean
  onEdit:    () => void
  /** Recebe o botão clicado (a linha sai animada a partir dele, motion.ts). Sem ela, só o lápis. */
  onDelete?: (from: Element) => void
  busy?:     boolean
}

export function CardTools({ name, editing, onEdit, onDelete, busy }: CardToolsProps) {
  return (
    <span className="dsh-tools">
      <button type="button" className={`dsh-tool${editing ? ' is-on' : ''}`} onClick={onEdit} aria-pressed={editing}
        aria-label={editing ? `Concluir a edição de ${name}` : `Editar ${name}`} title={editing ? 'Concluir a edição' : 'Editar'}>
        <PencilIcon />
      </button>
      {onDelete && (
        <button type="button" className="dsh-tool dsh-tool--bad" disabled={busy} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(e.currentTarget) }}
          aria-label={`Excluir ${name}`} title="Excluir da ficha">
          <TrashIcon />
        </button>
      )}
    </span>
  )
}

interface EditFieldProps {
  label:        string
  value:        string
  /** Chamado ao sair do campo (ou Enter), só se o texto mudou; já vem sem espaços nas pontas e no tamanho máximo. */
  onSave:       (next: string) => void
  placeholder?: string
  max?:         number
  wide?:        boolean
  /** Texto longo (descrição): caixa de várias linhas, sempre na largura toda. */
  multiline?:   boolean
  rows?:        number
  /** Não aceita vazio (o nome): apagar tudo volta o que estava. */
  required?:    boolean
}

/** Um campo do painel de edição: salva sozinho ao sair dele. */
export function EditField({ label, value, onSave, placeholder, max = 120, wide, multiline, rows = 4, required }: EditFieldProps) {
  const commit = (el: HTMLInputElement | HTMLTextAreaElement) => {
    const next = el.value.trim().slice(0, max)
    if (required && !next) { el.value = value; return }
    if (next !== value) onSave(next)
  }
  return (
    <label className={`dsh-field dsh-field--tile${wide || multiline ? ' dsh-editbox__wide' : ''}`}>
      <span className="dsh-label">{label}</span>
      {multiline
        ? <textarea className="dsh-input dsh-textarea dsh-textarea--sm dsh-editbox__area" rows={rows} defaultValue={value} maxLength={max} placeholder={placeholder}
            onBlur={(e) => commit(e.target)} />
        : <input type="text" className="dsh-tileinput" defaultValue={value} maxLength={max} placeholder={placeholder}
            onBlur={(e) => commit(e.target)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }} />}
    </label>
  )
}

/** O painel de edição que abre embaixo do cartão: os campos em grade e o botão de concluir. */
export function EditBox({ children, onDone }: { children: ReactNode; onDone: () => void }) {
  return (
    <div className="dsh-editbox">
      <div className="dsh-editbox__fields">{children}</div>
      <button type="button" className="dsh-chip dsh-chip--primary dsh-editbox__done" onClick={onDone}>Concluir</button>
    </div>
  )
}
