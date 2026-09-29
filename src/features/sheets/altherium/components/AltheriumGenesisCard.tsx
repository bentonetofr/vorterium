import { useState } from 'react'
import { GENESIS } from '../constants/altherium'
import type { AltheriumGenesisAbility } from '../../../../shared/types'

// ────────────────────────────────────────────────────────
// Gênesis — o efeito do livro e as habilidades de gênesis que o mestre
// deu ao personagem (ex.: "Sem passado: o mestre define sua habilidade").
// As habilidades são texto livre, criadas aqui e salvas com a ficha.
// ────────────────────────────────────────────────────────

interface AltheriumGenesisCardProps {
  genesis:   string
  abilities: AltheriumGenesisAbility[]
  disabled?: boolean
  onChange:  (next: AltheriumGenesisAbility[]) => void
}

export function AltheriumGenesisCard({ genesis, abilities, disabled, onChange }: AltheriumGenesisCardProps) {
  const book = GENESIS.find((g) => g.id === genesis) ?? null
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function start(a?: AltheriumGenesisAbility) {
    setEditing(a?.id ?? 'new')
    setName(a?.name ?? '')
    setDescription(a?.description ?? '')
  }

  function save() {
    const clean = { name: name.trim(), description: description.trim() }
    if (!clean.name) return
    if (editing === 'new') onChange([...abilities, { id: crypto.randomUUID(), ...clean }])
    else onChange(abilities.map((a) => (a.id === editing ? { ...a, ...clean } : a)))
    setEditing(null)
  }

  const editor = (
    <div className="alth-genesis__editor">
      <input
        type="text" className="input" placeholder="Nome da habilidade" maxLength={80} autoFocus
        value={name} onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save() } }}
        aria-label="Nome da habilidade"
      />
      <textarea
        className="input" rows={3} placeholder="O que ela faz" maxLength={1000}
        value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Descrição da habilidade"
      />
      <div className="alth-triumph__actions">
        <button type="button" className="alth-triumph__btn" onClick={() => setEditing(null)}>Cancelar</button>
        <button type="button" className="alth-triumph__btn alth-triumph__btn--add" onClick={save} disabled={!name.trim()}>
          Salvar habilidade
        </button>
      </div>
    </div>
  )

  return (
    <section className="alth-card alth-genesis">
      <div className="alth-card__header">
        <h4 className="alth-card__title">Gênesis{book ? ` · ${book.label}` : ''}</h4>
        {editing === null && (
          <button type="button" className="alth-triumph__btn alth-triumph__btn--add" onClick={() => start()} disabled={disabled}>
            + Habilidade
          </button>
        )}
      </div>

      {book
        ? <p className="alth-genesis__book"><span>Do livro:</span> {book.effect}</p>
        : <p className="alth-hint">Escolha a gênesis no topo da ficha.</p>}

      <ul className="alth-genesis__list">
        {abilities.map((a) => (
          <li key={a.id} className="alth-genesis__item">
            {editing === a.id ? editor : (
              <>
                <div className="alth-genesis__text">
                  <strong>{a.name}</strong>
                  {a.description && <p>{a.description}</p>}
                </div>
                <div className="alth-genesis__actions">
                  {confirmDelete === a.id ? (
                    <>
                      <button type="button" className="alth-triumph__btn" onClick={() => setConfirmDelete(null)}>Cancelar</button>
                      <button
                        type="button" className="alth-triumph__btn alth-triumph__btn--remove"
                        onClick={() => { setConfirmDelete(null); onChange(abilities.filter((x) => x.id !== a.id)) }}
                      >
                        Confirmar
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="alth-triumph__btn" onClick={() => start(a)} disabled={disabled}>Editar</button>
                      <button type="button" className="alth-triumph__btn alth-triumph__btn--remove" onClick={() => setConfirmDelete(a.id)} disabled={disabled}>
                        Excluir
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
        {editing === 'new' && <li className="alth-genesis__item">{editor}</li>}
      </ul>
      {abilities.length === 0 && editing === null && (
        <p className="alth-hint">Ganhou uma habilidade de gênesis do mestre? Anote aqui em "+ Habilidade".</p>
      )}
    </section>
  )
}
