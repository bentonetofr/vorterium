import { useEffect, useRef, useState } from 'react'
import type { CampaignWorld } from '../services/vortableService'
import { createWorld, deleteWorld, importWorldBundle, renameWorld, setActiveWorld } from '../services/vortableService'
import { useVortableWorlds } from './VortableWorldProvider'
import { useMesaStream } from '../../mesa/MesaStreamProvider'
import './WorldsPanel.css'
import { confirmDialog, promptDialog } from '../../../shared/components/dialogs'
import { ModalOverlay } from '../../../shared/components/ModalOverlay'
import { Presence } from '../../../shared/components/Presence'

/** Mundos prontos que vêm com o site (viram um mundo seu ao importar). */
const TEMPLATES = [
  { id: 'torvallen', label: 'TORVALLEN', text: 'Grande Biblioteca do palácio: 4 andares, saguão e seção proibida (6 zonas)', url: `${import.meta.env.BASE_URL}vortable/maps/torvallen.mundo.json` },
  { id: 'ruinas', label: 'CIDADE EM RUÍNAS', text: 'Apocalipse no clima de The Last of Us: rua bloqueada, posto de quarentena, hospital abandonado e subsolo infectado (4 zonas, 10 NPCs)', url: `${import.meta.env.BASE_URL}vortable/maps/ruinas.mundo.json` },
  { id: 'saltmore', label: 'SALTMORE', text: 'Floresta montanhosa e escura, de pinheiros e trilha de terra: cabana abandonada de dois andares, clareira, mata fechada com santuário e acampamento, riacho com cascata e ponte, passo rochoso com mirante, a Vila de Pedraverde (muralha, praça com feira, estalagem por dentro, capela, ferreiro, hortas) e a estrada até a ponte da cidade (9 zonas, 24 NPCs)', url: `${import.meta.env.BASE_URL}vortable/maps/saltmore.mundo.json` },
  { id: 'nova-york', label: 'NOVA YORK: ZONA MORTA', text: 'Cidade enorme no clima de The Last of Us: avenida e becos, prédios para explorar, estrada na mata, escola com porão, metrô infectado, rio e restaurante (37 zonas)', url: `${import.meta.env.BASE_URL}vortable/maps/nova-york.mundo.json` },
]

interface WorldsPanelProps {
  campaignId: string
  onClose: () => void
  /** O mestre escolheu editar um mundo: a página vai pra aba do editor. */
  onEdit: () => void
}

const MAP_ICON = <path d="M9 4 3 6.5v13L9 17l6 3 6-2.5v-13L15 7 9 4ZM9 4v13M15 7v13" />

/**
 * Mundos do mestre (cada mundo é um conjunto de zonas). Abrir um mundo coloca
 * os jogadores nele, na hora; o "Novo mundo" abre uma janela com "Em branco",
 * "Importar arquivo" e os mundos prontos do site.
 */
export function WorldsPanel({ campaignId, onClose, onEdit }: WorldsPanelProps) {
  const { worlds, active, editing, setEditId, refresh } = useVortableWorlds()
  const mesa = useMesaStream()
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)

  // Menu de três pontos: fecha ao clicar fora ou com Esc.
  useEffect(() => {
    if (!menuFor) return
    const onDown = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.world__menu-wrap')) setMenuFor(null) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuFor(null) }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [menuFor])

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

  async function create() {
    setNewOpen(false)
    const name = (await promptDialog({ title: 'Novo mundo', label: 'Nome do novo mundo', confirmLabel: 'Criar', maxLength: 80 }))?.trim()
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
      setNewOpen(false)
    })
  }

  async function open(w: CampaignWorld) {
    if (w.active) return
    if (!(await confirmDialog({ title: 'Abrir o mundo', message: `Abrir "${w.name}"? Os jogadores que estão no Vortable vão para ele agora.`, confirmLabel: 'Abrir' }))) return
    void run(`open:${w.id}`, async () => {
      await setActiveWorld(campaignId, w.id)
      mesa.setWorldId(w.id) // os jogadores trocam de mundo na hora, mesmo se o tempo real do banco atrasar
    })
  }

  async function rename(w: CampaignWorld) {
    const name = (await promptDialog({ title: 'Renomear o mundo', label: 'Novo nome do mundo', initial: w.name, confirmLabel: 'Renomear', maxLength: 80 }))?.trim()
    if (!name || name === w.name) return
    void run(`rename:${w.id}`, () => renameWorld(campaignId, w.id, name.slice(0, 80)))
  }

  async function remove(w: CampaignWorld) {
    if (w.active) return
    if (!(await confirmDialog({ title: 'Apagar o mundo', message: `Apagar "${w.name}" e as ${w.zones} zona(s) dele? Não dá pra desfazer.`, tone: 'danger', confirmLabel: 'Apagar' }))) return
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
        {[...worlds].sort((a, b) => Number(b.active) - Number(a.active)).map((w) => {
          const lastOne = worlds.length < 2
          return (
            <li key={w.id} className={`world${w.active ? ' world--open' : ''}`}>
              <div className="world__cover" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{MAP_ICON}</svg>
                {w.active && <span className="world__badge world__ribbon">Aberto</span>}
                {editing?.id === w.id && !w.active && <span className="world__badge world__badge--edit world__ribbon">Editando</span>}
              </div>
              <div className="world__body">
                <strong className="world__name" title={w.name}>{w.name}</strong>
                <span className="world__meta">{w.zones} {w.zones === 1 ? 'zona' : 'zonas'}</span>
                <div className="world__actions">
                  {w.active ? (
                    <span className="world__here"><i className="world__live" aria-hidden="true" />Jogadores aqui</span>
                  ) : (
                    <button type="button" className="btn btn-primary" onClick={() => open(w)} disabled={busy !== null}>Abrir</button>
                  )}
                  <div className="world__menu-wrap">
                    <button
                      type="button" className="world__more" aria-label={`Mais ações de ${w.name}`} aria-haspopup="menu" aria-expanded={menuFor === w.id}
                      onClick={() => setMenuFor(menuFor === w.id ? null : w.id)}
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
                    </button>
                    {menuFor === w.id && (
                      <div className="world__menu anim-drop" role="menu">
                        <button type="button" role="menuitem" onClick={() => { setMenuFor(null); edit(w) }}>Editar</button>
                        <button type="button" role="menuitem" disabled={busy !== null} onClick={() => { setMenuFor(null); void rename(w) }}>Renomear</button>
                        <button
                          type="button" role="menuitem" className="world__menu-danger" disabled={w.active || lastOne || busy !== null}
                          title={w.active ? 'Abra outro mundo antes de apagar este.' : lastOne ? 'É o único mundo da campanha.' : undefined}
                          onClick={() => { setMenuFor(null); void remove(w) }}
                        >
                          Apagar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </li>
          )
        })}
        <li>
          <button type="button" className="world world--new" onClick={() => setNewOpen(true)} disabled={busy !== null} aria-label="Criar um mundo novo">
            <span className="world__plus" aria-hidden="true">+</span>
            <span>Novo mundo</span>
          </button>
        </li>
      </ul>
      {active && <p className="worlds__hint">Aberto agora: {active.name}</p>}

      <Presence show={newOpen} exitMs={220}>
        {() => (
          <ModalOverlay onClose={() => setNewOpen(false)} closeDisabled={busy !== null}>
            <div className="worlds-new" role="dialog" aria-modal="true" aria-labelledby="worlds-new-title">
              <header className="worlds-new__head">
                <h4 id="worlds-new-title" className="worlds-new__title">Novo mundo</h4>
                <button type="button" className="modal-close" onClick={() => setNewOpen(false)} disabled={busy !== null} aria-label="Fechar">×</button>
              </header>
              <div className="worlds-new__opts">
                <button type="button" className="worlds-new__opt" onClick={() => void create()} disabled={busy !== null}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5ZM14 3v5h5M12 17v-6M9 14h6" /></svg>
                  <span><strong>Em branco</strong><small>Começar do zero</small></span>
                </button>
                <button type="button" className="worlds-new__opt" onClick={() => { setNewOpen(false); fileInput.current?.click() }} disabled={busy !== null}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4m0 0-4 4m4-4 4 4M5 20h14" /></svg>
                  <span><strong>Importar arquivo</strong><small>Um .json de mundo</small></span>
                </button>
              </div>
              <h5 className="worlds__sub worlds-new__sub">Ou comece por um mundo pronto</h5>
              <ul className="worlds-new__list">
                {TEMPLATES.map((t) => (
                  <li key={t.id} className="worlds-new__tpl">
                    <div><strong>{t.label}</strong><span title={t.text}>{t.text}</span></div>
                    <button type="button" className="btn btn-ghost" onClick={() => void importTemplate(t)} disabled={busy !== null}>
                      {busy === `tpl:${t.id}` ? 'Criando…' : 'Criar'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </ModalOverlay>
        )}
      </Presence>
    </div>
  )
}
