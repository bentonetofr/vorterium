// ────────────────────────────────────────────────────────
// Banco falso da prévia viva da ficha de D&D: responde às chamadas REST do
// Supabase (select, insert, upsert, update, delete com filtros eq/in) a partir
// da memória, com um atraso de rede. Precisa ser o PRIMEIRO import da página,
// antes do cliente do Supabase guardar o fetch do navegador (por isso não importa nada:
// as linhas de exemplo entram depois, por seedFakeDb).
// ────────────────────────────────────────────────────────
type Row = Record<string, unknown>
const DELAY_MS = Number(new URLSearchParams(location.search).get('atraso') ?? 250)
const db: Record<string, Row[]> = {}

/** Põe as linhas de exemplo nas tabelas (chamar antes de desenhar a ficha). */
export function seedFakeDb(tables: Record<string, readonly object[]>) {
  for (const [name, rows] of Object.entries(tables)) db[name] = rows.map((r) => ({ ...r }) as Row)
}

let seq = 1
const stamp = () => new Date().toISOString()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const realFetch = window.fetch.bind(window)
const SKIP = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  if (url.pathname.includes('/storage/v1/object/') && new URLSearchParams(location.search).has('storage')) return fakeStorage(url, init)
  if (!url.pathname.includes('/rest/v1/')) {
    if (url.pathname.includes('/auth/v1/') || url.pathname.includes('/storage/v1/')) return json(401, { message: 'prévia sem login' })
    return realFetch(input, init)
  }
  await sleep(DELAY_MS)
  const table = url.pathname.split('/rest/v1/')[1]
  if (table.startsWith('rpc/')) return json(200, null)
  const method = (init?.method ?? 'GET').toUpperCase()
  const single = (new Headers(init?.headers).get('Accept') ?? '').includes('vnd.pgrst.object')
  const rows = (db[table] ??= [])
  const filters = [...url.searchParams].filter(([k]) => !SKIP.has(k))
  const match = (r: Row) => filters.every(([k, v]) =>
    v.startsWith('eq.') ? String(r[k]) === v.slice(3)
      : v.startsWith('in.') ? v.slice(4, -1).split(',').map((s) => s.replace(/"/g, '')).includes(String(r[k]))
        : true)
  const reply = (list: Row[]) => (single ? (list.length ? json(200, list[0]) : json(406, { code: 'PGRST116', message: 'nada encontrado' })) : json(200, list))

  if (method === 'GET' || method === 'HEAD') return reply(rows.filter(match))
  const body = init?.body ? JSON.parse(String(init.body)) as Row | Row[] : null
  if (method === 'POST') {
    const conflict = url.searchParams.get('on_conflict')?.split(',')
    const out = (Array.isArray(body) ? body : [body ?? {}]).map((b) => {
      const existing = conflict ? rows.find((r) => conflict.every((c) => r[c] === b[c])) : undefined
      if (existing) return Object.assign(existing, b, { updated_at: stamp() })
      const row: Row = { id: `fake-${seq++}`, created_at: stamp(), updated_at: stamp(), ...b }
      rows.push(row)
      return row
    })
    return reply(out)
  }
  if (method === 'PATCH') {
    const hit = rows.filter(match)
    for (const r of hit) Object.assign(r, body, { updated_at: stamp() })
    return reply(hit)
  }
  if (method === 'DELETE') {
    db[table] = rows.filter((r) => !match(r))
    return new Response(null, { status: 204 })
  }
  return json(405, { message: 'método não suportado na prévia' })
}

// Storage na memória (só com ?storage=1): envio, assinatura de endereço, leitura e remoção de arquivos.
const files = new Map<string, Blob>()
async function fakeStorage(url: URL, init?: RequestInit): Promise<Response> {
  await sleep(DELAY_MS)
  const method = (init?.method ?? 'GET').toUpperCase()
  const rest = url.pathname.split('/storage/v1/object/')[1]
  if (rest.startsWith('sign/')) {
    const key = rest.slice(5)
    return json(200, { signedURL: `/object/sign/${key}?token=fake` })
  }
  if (method === 'POST') {
    const body = init?.body
    const blob = body instanceof FormData ? [...body.values()].find((v): v is File => v instanceof Blob) : (body as Blob)
    files.set(rest, blob ?? new Blob([]))
    return json(200, { Key: rest, Id: `obj-${seq++}` })
  }
  if (method === 'DELETE') {
    const prefixes = (JSON.parse(String(init?.body ?? '{}')) as { prefixes?: string[] }).prefixes ?? []
    const bucket = rest.split('/')[0]
    for (const p of prefixes) files.delete(`${bucket}/${p}`)
    return json(200, [])
  }
  const blob = files.get(rest.replace(/^authenticated\//, ''))
  return blob ? new Response(blob, { status: 200 }) : json(404, { message: 'arquivo não existe na prévia' })
}
