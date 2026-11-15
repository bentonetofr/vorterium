// ────────────────────────────────────────────────────────
// Deixa a imagem leve ANTES de ir pro Storage. Foto de celular passa de 5 MB e,
// a cada vez que alguém abre a Galeria ou o Quadro, o Supabase cobra o tráfego
// (egress) dessa imagem inteira. Aqui o lado maior cai pra um tamanho que
// sobra pra tela e vira WebP: costuma ficar de 5 a 10 vezes menor, sem perda
// que se note. GIF fica como está (pode ser animado).
// ────────────────────────────────────────────────────────

export interface ShrunkImage { blob: Blob; type: string; ext: string; w: number; h: number }

export interface ShrinkOptions {
  /** Lado maior, em pixels (padrão 2000). */
  maxSide?: number
  /** Qualidade do WebP/JPEG, de 0 a 1 (padrão 0,82). */
  quality?: number
  /** Imagem que já cabe no tamanho e pesa menos que isto é mantida como veio (padrão 350 kB). */
  keepUnderBytes?: number
}

const KEEP_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** Novo tamanho com o lado maior limitado a `maxSide` (nunca aumenta). */
export function fitSize(width: number, height: number, maxSide: number): { w: number; h: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height, 1))
  return { w: Math.max(1, Math.round(width * scale)), h: Math.max(1, Math.round(height * scale)) }
}

export function extensionOf(type: string): string {
  return type.split('/')[1]?.replace('jpeg', 'jpg') || 'img'
}

export async function shrinkImage(file: File, options: ShrinkOptions = {}): Promise<ShrunkImage> {
  const { maxSide = 2000, quality = 0.82, keepUnderBytes = 350 * 1024 } = options
  const asIs = (w: number, h: number): ShrunkImage => ({ blob: file, type: file.type, ext: extensionOf(file.type), w, h })

  // GIF pode ser animado: não passa pelo canvas.
  if (file.type === 'image/gif') return asIs(0, 0)

  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(file)
  } catch {
    return asIs(0, 0) // formato que o navegador não decodifica: segue o arquivo original
  }
  const { width, height } = bmp
  const { w, h } = fitSize(width, height, maxSide)
  const unchangedSize = w === width && h === height

  if (unchangedSize && file.size <= keepUnderBytes && KEEP_TYPES.includes(file.type)) {
    bmp.close()
    return asIs(width, height)
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const encode = (type: string) => new Promise<Blob | null>((done) => canvas.toBlob(done, type, quality))
  const webp = await encode('image/webp')
  const out = webp && webp.type === 'image/webp' ? webp : await encode('image/jpeg')
  if (!out) return asIs(width, height)
  // Sem ganho (mesmo tamanho em pixels e arquivo novo não menor): fica o original.
  if (unchangedSize && out.size >= file.size && KEEP_TYPES.includes(file.type)) return asIs(width, height)
  return { blob: out, type: out.type, ext: extensionOf(out.type), w, h }
}
