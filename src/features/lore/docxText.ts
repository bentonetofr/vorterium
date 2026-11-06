// ────────────────────────────────────────────────────────
// Lê o texto de um .docx sem biblioteca: o .docx é um zip, e o texto fica em
// word/document.xml. Devolve os parágrafos (com o nível dos títulos), sem a
// formatação — o bastante para o mestre ler a lore na tela.
// ────────────────────────────────────────────────────────

export interface DocxBlock {
  text:    string
  /** 1 a 3 nos títulos (Heading1…); 0 no texto comum. */
  heading: number
}

const u16 = (v: DataView, o: number) => v.getUint16(o, true)
const u32 = (v: DataView, o: number) => v.getUint32(o, true)

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Conteúdo de um arquivo dentro do zip, ou null se não existir. */
export async function readZipEntry(buf: ArrayBuffer, wanted: string): Promise<Uint8Array | null> {
  const bytes = new Uint8Array(buf)
  const v = new DataView(buf)
  // Fim do diretório central: procurado de trás pra frente.
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (u32(v, i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) return null
  const count = u16(v, eocd + 10)
  let p = u32(v, eocd + 16)
  const decoder = new TextDecoder()
  for (let n = 0; n < count; n++) {
    if (p + 46 > bytes.length || u32(v, p) !== 0x02014b50) return null
    const method = u16(v, p + 10)
    const compSize = u32(v, p + 20)
    const nameLen = u16(v, p + 28)
    const extraLen = u16(v, p + 30)
    const commentLen = u16(v, p + 32)
    const localOffset = u32(v, p + 42)
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen))
    if (name === wanted) {
      if (u32(v, localOffset) !== 0x04034b50) return null
      const start = localOffset + 30 + u16(v, localOffset + 26) + u16(v, localOffset + 28)
      const raw = bytes.subarray(start, start + compSize)
      if (method === 0) return raw
      if (method === 8) return inflateRaw(raw)
      return null
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  return null
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : ''
    }
    return ENTITIES[e.toLowerCase()] ?? ''
  })
}

/** Parágrafos do word/document.xml. */
export function docxXmlToBlocks(xml: string): DocxBlock[] {
  const blocks: DocxBlock[] = []
  const paragraphs = xml.match(/<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g) ?? []
  for (const p of paragraphs) {
    let text = ''
    const tokens = p.match(/<w:t(?: [^>]*)?>[\s\S]*?<\/w:t>|<w:tab\/>|<w:br\/>|<w:cr\/>/g) ?? []
    for (const t of tokens) {
      if (t.startsWith('<w:tab')) text += '\t'
      else if (t.startsWith('<w:br') || t.startsWith('<w:cr')) text += '\n'
      else text += decodeXml(t.replace(/^<w:t(?: [^>]*)?>/, '').replace(/<\/w:t>$/, ''))
    }
    const style = /<w:pStyle w:val="([^"]+)"/.exec(p)?.[1] ?? ''
    const h = /^(?:Heading|Titulo|Título|Title)\s*(\d)?$/i.exec(style)
    const heading = h ? Math.min(3, Number(h[1] ?? 1)) : 0
    blocks.push({ text, heading })
  }
  // Tira as linhas vazias do começo e do fim e junta sequências longas de vazias.
  const out: DocxBlock[] = []
  for (const b of blocks) {
    if (!b.text.trim() && (out.length === 0 || !out[out.length - 1].text.trim())) continue
    out.push(b)
  }
  while (out.length && !out[out.length - 1].text.trim()) out.pop()
  return out
}

export async function docxToBlocks(buf: ArrayBuffer): Promise<DocxBlock[]> {
  const entry = await readZipEntry(buf, 'word/document.xml')
  if (!entry) throw new Error('Não foi possível ler este .docx.')
  return docxXmlToBlocks(new TextDecoder().decode(entry))
}
