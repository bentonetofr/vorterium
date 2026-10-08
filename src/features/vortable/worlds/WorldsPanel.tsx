import { useRef, useState } from 'react'
import type { CampaignWorld } from '../services/vortableService'
import { createWorld, deleteWorld, importWorldBundle, renameWorld, setActiveWorld } from '../services/vortableService'
import { useVortableWorlds } from './VortableWorldProvider'
import { useMesaStream } from '../../mesa/MesaStreamProvider'
import './WorldsPanel.css'

/** Mundos prontos que vêm com o site (viram um mundo seu ao importar). */
const TEMPLATES = [
  { id: 'torvallen', label: 'TORVALLEN', text: 'Grande Biblioteca do palácio: 4 andares, saguão e seção proibida (6 zonas)', url: `${import.meta.env.BASE_URL}vortable/maps/torvallen.mundo.json` },
]

interface WorldsPanelProps {
  campaignId: string
  onClose: () => void
  /** O mestre escolheu editar um mundo: a página vai pra aba do editor. */
  onEdit: () => void
}

/**
 * Mundos do mestre (cada mundo é um conjunto de zonas). Abrir um mundo coloca
 * os jogadores nele, na hora; o "+" cria um mundo novo.
 */
export function WorldsPanel({ campaignId, onClose, onEdit }: WorldsPanelProps) {
  const { worlds, active, editing, setEditId, refresh } = useVortableWorlds()
  const mesa = useMesaStream()
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key)
    setError(null)
    try {
      await action()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não deu certo.')
    } finally {
      setBusy(null)
    }
  }

  function create() {
    const name = prompt('Nome do novo mundo:')?.trim()
    if (!name) return
    void run('new', async () => {
      const world = await createWorld(campaignId, name.slice(0, 80))
      setEditId(world.id)
    })
  }

  async function importFile(file: File) {
    await run('import', async () => {
      let json: unknown
      try { json = JSON.parse(await file.text()) } catch { throw new Error('O arquivo não é um JSON válido.') }
      const world = await importWorldBundle(campaignId, json)
      setEditId(world.id)
    })
  }

  async function importTemplate(t: (typeof TEMPLATES)[number]) {
    await run(`tpl:${t.id}`, async () => {
      const res = await fetch(t.url)
      if (!res.ok) throw new Error(`Não deu pra baixar o mundo pronto (${res.status}).`)
      const world = await importWorldBundle(campaignId, await res.json())
      setEditId(world.id)
    })
  }

  function open(w: CampaignWorld) {
    if (w.active) return
    if (!confirm(`Abrir "${w.name}"? Os jogadores que estão no Vortable vão para ele agora.`)) return
    void run(`open:${w.id}`, async () => {
      await setActiveWorld(campaignId, w.id)
      mesa.setWorldId(w.id) // os jogadores trocam de mundo na hora, mesmo se o tempo real do banco atrasar
    })
  }

  function rename(w: CampaignWorld) {
    const name = prompt('Novo nome do mundo:', w.name)?.trim()
    if (!name || name === w.name) return
    void run(`rename:${w.id}`, () => renameWorld(campaignId, w.id, name.slice(0, 80)))
  }

  function remove(w: CampaignWorld) {
    if (w.active) return
    if (!confirm(`Apagar "${w.name}" e as ${w.zones} zona(s) dele? Não dá pra desfazer.`)) return
    void run(`del:${w.id}`, () => deleteWorld(campaignId, w.id))
  }

  function edit(w: CampaignWorld) {
    setEditId(w.id)
    onEdit()
  }

  return (
    <div className="worlds" role="dialog" aria-label="Mundos">
      <header className="worlds__head">
        <h3 className="worlds__title">Mundos</h3>
        <div className="worlds__head-actions">
          <button type="button" className="btn btn-ghost" onClick={() => fileInput.current?.click()} disabled={busy !== null}>
            {busy === 'import' ? 'Importando…' : 'Importar mundo'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Fechar</button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void importFile(file)
          }}
        />
      </header>
      {error && <p className="worlds__error" role="alert">{error}</p>}

      <ul className="worlds__grid">
        {worlds.map((w) => (
          <li key={w.id} className={`world${w.active ? ' world--open' : ''}`}>
            <div className="world__top">
              <strong className="world__name" title={w.name}>{w.name}</strong>
              {w.active && <span className="world__badge">Aberto</span>}
              {editing?.id === w.id && !w.active && <span className="world__badge world__badge--edit">Editando</span>}
            </div>
            <span className="world__meta">{w.zones} {w.zones === 1 ? 'zona' : 'zonas'}</span>
            <div className="world__actions">
              <button type="button" className="btn btn-primary" onClick={() => open(w)} disabled={w.active || busy !== null}>
                {w.active ? 'Os jogadores estão aqui' : 'Abrir pros jogadores'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => edit(w)}>Editar</button>
              <button type="button" className="btn btn-ghost" onClick={() => rename(w)} disabled={busy !== null}>Renomear</button>
              <button type="button" className="btn btn-ghost" onClick={() => remove(w)} disabled={w.active || busy !== null || worlds.length < 2}>Apagar</button>
            </div>
          </li>
        ))}
        <li>
          <button type="button" className="world world--new" onClick={create} disabled={busy !== null} aria-label="Criar um mundo novo">
            <span className="world__plus" aria-hidden="true">+</span>
            <span>Novo mundo</span>
          </button>
        </li>
      </ul>
      <section className="worlds__templates">
        <h4 className="worlds__sub">Mundos prontos</h4>
        <ul className="worlds__tpl-list">
          {TEMPLATES.map((t) => (
            <li key={t.id} className="worlds__tpl">
              <div><strong>{t.label}</strong><span>{t.text}</span></div>
              <button type="button" className="btn btn-ghost" onClick={() => void importTemplate(t)} disabled={busy !== null}>
                {busy === `tpl:${t.id}` ? 'Criando…' : 'Criar este mundo'}
              </button>
            </li>
          ))}
        </ul>
      </section>
      {active && <p className="worlds__hint">Aberto agora: {active.name}</p>}
    </div>
  )
}
