import { describe, expect, it } from 'vitest'
import { checkLoreFile, countWords, formatBytes, loreFileKind, loreImageViewable, relativeTime, safeLoreFileName } from './lorePure'
import { docxToBlocks, docxXmlToBlocks } from './docxText'

describe('arquivos da lore', () => {
  it('reconhece o tipo pela extensão', () => {
    expect(loreFileKind('Historia.PDF')).toBe('pdf')
    expect(loreFileKind('lore.docx')).toBe('docx')
    expect(loreFileKind('notas.md')).toBe('text')
    expect(loreFileKind('velho.doc')).toBe('other')
    expect(loreFileKind('programa.exe')).toBeNull()
    expect(loreFileKind('semextensao')).toBeNull()
  })

  it('aceita as imagens dos formatos padrões e só desenha as que o navegador abre', () => {
    for (const ext of ['jpg', 'JPEG', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg', 'ico', 'tiff', 'heic']) {
      expect(loreFileKind(`arte.${ext}`)).toBe('image')
      expect(checkLoreFile({ name: `arte.${ext}`, size: 1000 })).toBeNull()
    }
    expect(loreImageViewable('arte.PNG')).toBe(true)
    expect(loreImageViewable('arte.heic')).toBe(false)
    expect(loreImageViewable('arte.tiff')).toBe(false)
  })

  it('barra tipo errado, vazio, grande demais e excesso de arquivos', () => {
    expect(checkLoreFile({ name: 'a.pdf', size: 1000 })).toBeNull()
    expect(checkLoreFile({ name: 'a.exe', size: 1000 })).toMatch(/tipo não aceito/)
    expect(checkLoreFile({ name: 'a.pdf', size: 0 })).toMatch(/vazio/)
    expect(checkLoreFile({ name: 'a.pdf', size: 21 * 1024 * 1024 })).toMatch(/20 MB/)
    expect(checkLoreFile({ name: 'a.pdf', size: 10 }, 25)).toMatch(/25 arquivos/)
  })

  it('formata tamanho, nome seguro, palavras e tempo', () => {
    expect(formatBytes(900)).toBe('900 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(3 * 1024 * 1024)).toBe('3,0 MB')
    expect(safeLoreFileName('Minha História (final).docx')).toBe('Minha-Historia-final.docx')
    expect(safeLoreFileName('???.pdf')).toBe('arquivo.pdf')
    expect(countWords('  uma   lore  de três ')).toBe(4)
    expect(countWords('')).toBe(0)
    const now = Date.parse('2024-06-10T12:00:00Z')
    expect(relativeTime('2024-06-10T11:59:40Z', now)).toBe('agora')
    expect(relativeTime('2024-06-10T11:30:00Z', now)).toBe('há 30 min')
    expect(relativeTime('2024-06-10T09:00:00Z', now)).toBe('há 3 h')
    expect(relativeTime('2024-06-08T12:00:00Z', now)).toBe('há 2 dias')
  })
})

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'

describe('texto de .docx', () => {
  it('lê parágrafos, títulos, tabs e entidades', () => {
    const xml = `<w:document ${W}><w:body>
      <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Origem</w:t></w:r></w:p>
      <w:p><w:r><w:t xml:space="preserve">Nasceu em </w:t></w:r><w:r><w:t>Saltmore &amp; cia</w:t></w:r><w:r><w:tab/><w:t>fim</w:t></w:r></w:p>
      <w:p/>
      <w:p/>
      <w:p><w:r><w:t>Segundo</w:t></w:r><w:r><w:br/><w:t>linha</w:t></w:r></w:p>
    </w:body></w:document>`
    expect(docxXmlToBlocks(xml)).toEqual([
      { text: 'Origem', heading: 1 },
      { text: 'Nasceu em Saltmore & cia\tfim', heading: 0 },
      { text: '', heading: 0 },
      { text: 'Segundo\nlinha', heading: 0 },
    ])
  })

  it('abre um zip de verdade (comprimido e sem compressão)', async () => {
    const xml = `<w:document ${W}><w:body><w:p><w:r><w:t>Olá, mundo</w:t></w:r></w:p></w:body></w:document>`
    for (const method of [8, 0] as const) {
      const zip = await makeZip([{ name: '[Content_Types].xml', data: '<x/>', method: 0 }, { name: 'word/document.xml', data: xml, method }])
      expect(await docxToBlocks(zip)).toEqual([{ text: 'Olá, mundo', heading: 0 }])
    }
  })

  it('arquivo que não é docx dá erro claro', async () => {
    await expect(docxToBlocks(new TextEncoder().encode('isto não é um zip, só texto comum aqui').buffer as ArrayBuffer))
      .rejects.toThrow(/\.docx/)
  })
})

/** Zip mínimo (um arquivo por vez, sem CRC válido — o leitor não confere). */
async function makeZip(files: { name: string; data: string; method: 0 | 8 }[]): Promise<ArrayBuffer> {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  const le = (n: number, size: number) => { const a = new Uint8Array(size); for (let i = 0; i < size; i++) a[i] = (n >>> (8 * i)) & 0xff; return a }
  const cat = (...a: Uint8Array[]) => { const out = new Uint8Array(a.reduce((s, x) => s + x.length, 0)); let o = 0; for (const x of a) { out.set(x, o); o += x.length } return out }
  for (const f of files) {
    const name = enc.encode(f.name)
    const raw = enc.encode(f.data)
    const body = f.method === 8 ? await deflate(raw) : raw
    const local = cat(le(0x04034b50, 4), le(20, 2), le(0, 2), le(f.method, 2), le(0, 4), le(0, 4), le(body.length, 4), le(raw.length, 4), le(name.length, 2), le(0, 2), name, body)
    central.push(cat(le(0x02014b50, 4), le(20, 2), le(20, 2), le(0, 2), le(f.method, 2), le(0, 4), le(0, 4), le(body.length, 4), le(raw.length, 4), le(name.length, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 4), le(offset, 4), name))
    parts.push(local)
    offset += local.length
  }
  const dir = cat(...central)
  const end = cat(le(0x06054b50, 4), le(0, 2), le(0, 2), le(files.length, 2), le(files.length, 2), le(dir.length, 4), le(offset, 4), le(0, 2))
  const all = cat(...parts, dir, end)
  return all.buffer.slice(all.byteOffset, all.byteOffset + all.byteLength) as ArrayBuffer
}

async function deflate(raw: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}
