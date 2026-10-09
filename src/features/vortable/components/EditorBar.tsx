import { useEffect, useRef, useState } from 'react'
import type { EditorBarState, EditorControls } from '../../../vendor/vortable/vortable'
import './EditorBar.css'

export interface EditorBarHandle {
  controls: EditorControls
  /** Ícones do editor (SVG em texto), os mesmos do painel. */
  icons: Record<string, string>
}

/**
 * Ações do editor do mundo (nome da zona, Nova, Abrir, Mundo, Salvar, Exportar, Importar,
 * desfazer, refazer, Personagem, Testar) na faixa de cima, ao lado do botão de modo.
 */
export function EditorBar({ editor }: { editor: EditorBarHandle }) {
  const { controls, icons } = editor
  const [st, setSt] = useState<EditorBarState>(() => controls.state())
  const file = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSt(controls.state())
    return controls.subscribe(() => setSt(controls.state()))
  }, [controls])

  const btn = (icon: string, label: string, onClick: () => void, opts: { primary?: boolean; on?: boolean; disabled?: boolean; iconOnly?: boolean; dot?: boolean } = {}) => (
    <button
      type="button"
      className={`editor-bar__btn${opts.primary ? ' editor-bar__btn--primary' : ''}${opts.on ? ' editor-bar__btn--on' : ''}`}
      onClick={onClick}
      disabled={opts.disabled || st.testing}
      title={label}
      aria-label={label}
    >
      <span className="editor-bar__icon" dangerouslySetInnerHTML={{ __html: icons[icon] ?? '' }} />
      {!opts.iconOnly && <span className="editor-bar__label">{label}</span>}
      {opts.dot && <span className="editor-bar__dot" aria-hidden="true" />}
    </button>
  )

  return (
    <div className="editor-bar" role="toolbar" aria-label="Editor do mundo">
      {btn('menu', st.panel ? 'Fechar o painel de terrenos e objetos' : 'Abrir o painel de terrenos e objetos', controls.togglePanel, { iconOnly: true, on: st.panel })}
      <input
        className="editor-bar__name"
        value={st.name}
        onChange={(e) => controls.setName(e.target.value)}
        title="Nome da zona"
        aria-label="Nome da zona"
        disabled={st.testing}
      />
      {btn('plus', 'Nova', controls.newZone)}
      {btn('open', 'Abrir', controls.open)}
      {btn('world', 'Mundo', controls.world)}
      {btn('save', 'Salvar', controls.save, { dot: st.dirty })}
      {btn('download', 'Exportar', controls.exportZone)}
      {btn('upload', 'Importar', () => file.current?.click())}
      <input
        ref={file}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) controls.importZone(f)
        }}
      />
      {btn('undo', 'Desfazer (Ctrl+Z)', controls.undo, { iconOnly: true, disabled: !st.canUndo })}
      {btn('redo', 'Refazer (Ctrl+Y)', controls.redo, { iconOnly: true, disabled: !st.canRedo })}
      {st.character && btn('person', 'Personagem', controls.character)}
      {btn('play', 'Testar', controls.test, { primary: true })}
    </div>
  )
}
