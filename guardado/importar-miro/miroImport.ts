import { supabase } from '../../../shared/lib/supabase'
import { uploadDocument, validateDocument } from '../../library/services/campaignDocumentsService'
import type { BoardData, BoardItem, BoardKind, ShapeType } from './boardService'
import { INK, OUTLINE, newId, unionRect, type Point } from '../boardGeometry'

// ────────────────────────────────────────────────────────
// Importar um board do Miro pro Quadro. Lê tudo pela função /api/miro (a
// chave do Miro só passa por lá, nesse pedido) e traduz cada tipo de item
// do Miro pro equivalente no Quadro, no mesmo lugar e tamanho. Imagens e
// PDFs vão pra Biblioteca da campanha. Desenho à mão não vem: a API do
// Miro não entrega esses traços.
// ────────────────────────────────────────────────────────

interface MiroPosition { x?: number; y?: number; origin?: string; relativeTo?: string }
interface MiroItem {
  id:        string
  type:      string
  data?:     Record<string, unknown>
  style?:    Record<string, unknown>
  position?: MiroPosition
  geometry?: { width?: number; height?: number }
  parent?:   { id?: string } | null
}
interface MiroConnector {
  id:          string
  startItem?:  { id?: string }
  endItem?:    { id?: string }
  style?:      Record<string, string | undefined>
  captions?:   { content?: string }[]
}
interface MiroPage<T> { data?: T[]; cursor?: string }

export interface MiroProgress { label: string; done?: number; total?: number }

export interface MiroImportResult {
  items:     BoardItem[]
  boardName: string
  counts:    Partial<Record<BoardKind | 'link', number>>
  skipped:   number
  failed:    string[]
}

/** Id do board a partir do link (ou o próprio id colado). */
export function parseBoardId(link: string): string | null {
  const trimmed = link.trim()
  const m = trimmed.match(/board\/([^/?#\s]+)/)
  let id = m ? m[1] : trimmed
  try { id = decodeURIComponent(id) } catch { /* fica como veio */ }
  return /^[A-Za-z0-9_=\-]{4,64}$/.test(id) ? id : null
}

class MiroError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

async function call(body: Record<string, unknown>): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()
  const r = await fetch('/api/miro', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session?.access_token ?? ''}` },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    let msg = `Erro ${r.status} ao falar com o Miro.`
    try { msg = ((await r.json()) as { error?: string }).error ?? msg } catch { /* sem corpo */ }
    throw new MiroError(msg, r.status)
  }
  return r
}

async function allPages<T>(action: 'items' | 'connectors', token: string, board: string, onPage: (n: number) => void): Promise<T[]> {
  const out: T[] = []
  let cursor: string | undefined
  for (let guard = 0; guard < 200; guard++) {
    const page = (await (await call({ action, token, board, cursor })).json()) as MiroPage<T>
    out.push(...(page.data ?? []))
    onPage(out.length)
    if (!page.cursor || !page.data?.length) break
    cursor = page.cursor
  }
  return out
}

// ── Tradução ────────────────────────────────────────────

export function htmlToText(html: unknown): string {
  if (typeof html !== 'string' || !html) return ''
  const marked = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
  const doc = new DOMParser().parseFromString(marked, 'text/html')
  return (doc.body.textContent ?? '').replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

/** '#rrggbb' (ignora a transparência de '#rrggbbaa'); null se transparente/inválida. */
function hex(color: unknown): string | null {
  if (typeof color !== 'string') return null
  const c = color.trim().toLowerCase()
  if (c === 'transparent') return null
  const m = c.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/)
  if (!m) return null
  if (m[2] === '00') return null
  return `#${m[1]}`
}

/** Cor escura some no fundo azul do quadro → vira a cor do texto do tema. */
function readable(color: unknown): string {
  const h = hex(color)
  if (!h) return INK
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum < 0.45 ? INK : h
}

const STICKY_COLORS: Record<string, string> = {
  gray: '#e6e6e6', light_yellow: '#fff9b1', yellow: '#f5d128', orange: '#ff9d48',
  light_green: '#d5f692', green: '#c9df56', dark_green: '#93d275', cyan: '#67c6c0',
  light_pink: '#ffcee0', pink: '#ea94bb', violet: '#be88c7', red: '#f16c7f',
  light_blue: '#a6ccf5', blue: '#6cd8fa', dark_blue: '#9ea9ff', black: '#b8bcc6',
}

function shapeType(miro: unknown): ShapeType {
  if (miro === 'circle') return 'ellipse'
  if (miro === 'triangle') return 'triangle'
  if (miro === 'rhombus') return 'diamond'
  return 'rect'
}

const SUPPORTED_UPLOAD = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])

async function download(token: string, url: string, name: string): Promise<File | null> {
  for (const format of ['original', 'preview'] as const) {
    try {
      const r = await call({ action: 'resource', token, url, format })
      const type = (r.headers.get('content-type') ?? '').split(';')[0].trim()
      if (!SUPPORTED_UPLOAD.has(type)) continue
      const ext = type === 'application/pdf' ? 'pdf' : type.split('/')[1].replace('jpeg', 'jpg')
      return new File([await r.blob()], `${name}.${ext}`, { type })
    } catch (err) {
      if (err instanceof MiroError && err.status === 413) continue
      throw err
    }
  }
  return null
}

interface ImportOptions {
  link:       string
  token:      string
  campaignId: string
  myId:       string
  /** Onde fica o canto de cima/esquerda do que foi importado. */
  at:         Point
  /** Maior z do quadro hoje (o importado vem por cima). */
  zTop:       number
  onProgress: (p: MiroProgress) => void
}

export async function importMiroBoard(o: ImportOptions): Promise<MiroImportResult> {
  const board = parseBoardId(o.link)
  if (!board) throw new Error('Cole o link do board do Miro (algo como miro.com/app/board/…).')

  o.onProgress({ label: 'Abrindo o board…' })
  const info = (await (await call({ action: 'board', token: o.token, board })).json()) as { name?: string }
  const boardName = (info.name ?? 'Board do Miro').slice(0, 80)

  const raw = await allPages<MiroItem>('items', o.token, board, (n) => o.onProgress({ label: `Lendo itens… ${n}` }))
  const connectors = await allPages<MiroConnector>('connectors', o.token, board, (n) => o.onProgress({ label: `Lendo setas… ${n}` }))

  // Posição absoluta (centro) — filhos de moldura vêm relativos ao canto dela.
  const byId = new Map(raw.map((i) => [i.id, i]))
  const centers = new Map<string, Point>()
  const size = (i: MiroItem) => ({ w: i.geometry?.width ?? 200, h: i.geometry?.height ?? i.geometry?.width ?? 200 })
  const centerOf = (i: MiroItem, depth = 0): Point => {
    const hit = centers.get(i.id)
    if (hit) return hit
    let p: Point = { x: i.position?.x ?? 0, y: i.position?.y ?? 0 }
    const parent = i.parent?.id ? byId.get(i.parent.id) : undefined
    if (parent && i.position?.relativeTo === 'parent_top_left' && depth < 20) {
      const pc = centerOf(parent, depth + 1)
      const ps = size(parent)
      p = { x: pc.x - ps.w / 2 + p.x, y: pc.y - ps.h / 2 + p.y }
    }
    centers.set(i.id, p)
    return p
  }

  const idMap = new Map<string, string>()
  const counts: MiroImportResult['counts'] = {}
  const failed: string[] = []
  let skipped = 0
  const bump = (k: BoardKind | 'link') => { counts[k] = (counts[k] ?? 0) + 1 }
  // Camadas: molduras embaixo, depois imagens, formas e o resto por cima.
  const layer: Partial<Record<BoardKind, number>> = { frame: 0, image: 1, file: 1, shape: 2 }
  const pending: { item: BoardItem; order: number }[] = []

  const add = (m: MiroItem, kind: BoardKind, data: BoardData, box?: { w: number; h: number }) => {
    const c = centerOf(m)
    const s = box ?? size(m)
    const id = newId()
    idMap.set(m.id, id)
    const item: BoardItem = {
      id, campaign_id: o.campaignId, kind,
      x: c.x - s.w / 2, y: c.y - s.h / 2, w: s.w, h: s.h, z: 0,
      data, locked: false, created_by: o.myId, updated_by: o.myId, updated_at: new Date().toISOString(),
    }
    pending.push({ item, order: (layer[kind] ?? 3) * 100000 + pending.length })
    return item
  }

  const files: { m: MiroItem; url: string; name: string; kind: 'image' | 'file' }[] = []

  for (const m of raw) {
    const d = m.data ?? {}
    const st = m.style ?? {}
    switch (m.type) {
      case 'sticky_note':
        add(m, 'note', { text: htmlToText(d.content), color: STICKY_COLORS[String(st.fillColor)] ?? STICKY_COLORS.light_yellow })
        bump('note')
        break
      case 'text': {
        const fs = Number(st.fontSize)
        add(m, 'text', { text: htmlToText(d.content), color: readable(st.color), size: Number.isFinite(fs) ? Math.min(160, Math.max(10, Math.round(fs))) : 24 })
        bump('text')
        break
      }
      case 'shape': {
        const fill = hex(st.fillColor)
        add(m, 'shape', { text: htmlToText(d.content), shape: shapeType(d.shape), color: fill ?? OUTLINE })
        bump('shape')
        break
      }
      case 'frame': {
        const fill = hex(st.fillColor)
        add(m, 'frame', { title: String(d.title ?? '').slice(0, 120) || 'Moldura', color: fill && fill !== '#ffffff' ? readable(fill) : '#ffc174' })
        bump('frame')
        break
      }
      case 'card':
      case 'app_card': {
        const title = htmlToText(d.title)
        const desc = htmlToText(d.description)
        const s = size(m)
        add(m, 'note', { text: [title, desc].filter(Boolean).join('\n\n'), color: '#e9dcb8' }, { w: s.w, h: Math.max(s.h, 140) })
        bump('note')
        break
      }
      case 'image':
      case 'document': {
        const url = String(m.type === 'image' ? d.imageUrl ?? '' : d.documentUrl ?? '')
        const name = (htmlToText(d.title) || (m.type === 'image' ? 'Imagem do Miro' : 'Arquivo do Miro')).slice(0, 100)
        if (url) files.push({ m, url, name, kind: m.type === 'image' ? 'image' : 'file' })
        else skipped++
        break
      }
      case 'embed':
      case 'preview': {
        const url = String(d.url ?? d.previewUrl ?? '')
        const title = htmlToText(d.title)
        if (!url && !title) { skipped++; break }
        add(m, 'note', { text: [title, url].filter(Boolean).join('\n'), color: '#c8ccd6' }, { w: 260, h: 160 })
        bump('link')
        break
      }
      default: {
        // Tipo que o Quadro não tem (tabela, mapa mental…): vira post-it se tiver texto.
        const text = htmlToText(d.content ?? d.title)
        if (text) { add(m, 'note', { text, color: '#c8ccd6' }); bump('note') }
        else skipped++
      }
    }
  }

  // Imagens e PDFs: baixa do Miro e guarda na Biblioteca (3 de cada vez).
  let done = 0
  const queue = [...files]
  const worker = async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      o.onProgress({ label: 'Trazendo imagens e arquivos pra Biblioteca…', done, total: files.length })
      try {
        const file = await download(o.token, f.url, f.name)
        if (!file || validateDocument(file)) throw new Error('formato')
        const doc = await uploadDocument(o.campaignId, file, 'quadro')
        const isImage = doc.mime_type.startsWith('image/')
        const s = isImage ? size(f.m) : { w: 280, h: 96 }
        add(f.m, isImage ? 'image' : 'file', { docId: doc.id, path: doc.path, name: doc.name, mime: doc.mime_type }, s)
        bump(isImage ? 'image' : 'file')
      } catch (err) {
        if (err instanceof MiroError && err.status === 401) throw err
        failed.push(f.name)
      }
      done++
    }
  }
  await Promise.all([worker(), worker(), worker()])
  o.onProgress({ label: 'Montando o quadro…' })

  // Setas: só as que ligam dois itens que vieram.
  for (const c of connectors) {
    const from = c.startItem?.id ? idMap.get(c.startItem.id) : undefined
    const to = c.endItem?.id ? idMap.get(c.endItem.id) : undefined
    if (!from || !to) { skipped++; continue }
    const st = c.style ?? {}
    const startCap = st.startStrokeCap && st.startStrokeCap !== 'none'
    const endCap = st.endStrokeCap ? st.endStrokeCap !== 'none' : true
    const swap = startCap && !endCap
    const id = newId()
    const item: BoardItem = {
      id, campaign_id: o.campaignId, kind: 'connector', x: 0, y: 0, w: 0, h: 0, z: 0,
      data: {
        from: { id: swap ? to : from },
        to: { id: swap ? from : to },
        arrow: startCap && endCap ? 'both' : startCap || endCap ? 'end' : 'none',
        dashed: !!st.strokeStyle && st.strokeStyle !== 'normal',
        color: readable(st.strokeColor),
        text: htmlToText(c.captions?.[0]?.content) || undefined,
      },
      locked: false, created_by: o.myId, updated_by: o.myId, updated_at: new Date().toISOString(),
    }
    pending.push({ item, order: 250000 + pending.length })
    bump('connector')
  }

  if (pending.length === 0) throw new Error('Não achei nada que dê pra trazer desse board.')

  // Leva tudo pro lugar escolhido e põe numa moldura com o nome do board.
  pending.sort((a, b) => a.order - b.order)
  const placed = pending.map((p) => p.item)
  const bounds = unionRect(placed.filter((i) => i.kind !== 'connector').map((i) => ({ x: i.x, y: i.y, w: i.w, h: i.h })))!
  const pad = 80
  const dx = o.at.x + pad - bounds.x
  const dy = o.at.y + pad - bounds.y
  placed.forEach((it, i) => {
    if (it.kind !== 'connector') { it.x += dx; it.y += dy }
    it.z = o.zTop + 1 + i
  })
  const frame: BoardItem = {
    id: newId(), campaign_id: o.campaignId, kind: 'frame',
    x: o.at.x, y: o.at.y, w: bounds.w + pad * 2, h: bounds.h + pad * 2,
    // Abaixo das molduras que vieram do Miro (molduras se ordenam entre si pelo z).
    z: o.zTop + 0.5,
    data: { title: `Miro: ${boardName}`, color: '#ffc174' },
    locked: false, created_by: o.myId, updated_by: o.myId, updated_at: new Date().toISOString(),
  }

  return { items: [frame, ...placed], boardName, counts, skipped, failed }
}
