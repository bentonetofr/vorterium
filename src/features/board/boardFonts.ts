import { useEffect, useState } from 'react'

// ────────────────────────────────────────────────────────
// Fontes do Quadro — uma galeria grande do Google Fonts pra post-its,
// textos, formas e títulos de moldura. Nada é baixado de antemão: a fonte
// de um item só carrega quando ele aparece no quadro, e a galeria baixa só
// as letras do nome de cada fonte (uns poucos KB) quando o cartão aparece.
// O item guarda só o nome (data.font); nome fora desta lista é ignorado.
// ────────────────────────────────────────────────────────

export type FontCategory = 'fantasia' | 'terror' | 'manuscrita' | 'mao' | 'serifada' | 'sem-serifa' | 'decorativa' | 'maquina'

export const FONT_CATEGORIES: { id: FontCategory; label: string }[] = [
  { id: 'fantasia',   label: 'Fantasia e medieval' },
  { id: 'terror',     label: 'Terror' },
  { id: 'manuscrita', label: 'Caligrafia' },
  { id: 'mao',        label: 'Escrita à mão' },
  { id: 'serifada',   label: 'Clássicas' },
  { id: 'sem-serifa', label: 'Modernas' },
  { id: 'decorativa', label: 'Títulos e chamativas' },
  { id: 'maquina',    label: 'Máquina de escrever e pixel' },
]

const FALLBACK: Record<FontCategory, string> = {
  'fantasia':   'serif',
  'terror':     'sans-serif',
  'manuscrita': 'cursive',
  'mao':        'cursive',
  'serifada':   'serif',
  'sem-serifa': 'sans-serif',
  'decorativa': 'sans-serif',
  'maquina':    'monospace',
}

const BY_CATEGORY: Record<FontCategory, string[]> = {
  'fantasia': [
    'Cinzel', 'Cinzel Decorative', 'UnifrakturMaguntia', 'MedievalSharp', 'Pirata One', 'Uncial Antiqua',
    'IM Fell English', 'IM Fell English SC', 'IM Fell DW Pica', 'IM Fell Great Primer', 'Almendra',
    'Almendra Display', 'Almendra SC', 'Metamorphous', 'New Rocker', 'Grenze Gotisch', 'Germania One', 'Eagle Lake',
    'Fondamento', 'Macondo', 'Macondo Swash Caps', 'Berkshire Swash', 'Jim Nightshade', 'Kings', 'Rye', 'Fruktur',
    'Texturina', 'Jacquard 24', 'Jacquarda Bastarda 9', 'Aboreto', 'Marcellus SC', 'Trade Winds', 'Cormorant Unicase',
    'Spectral SC', 'Elsie', 'Elsie Swash Caps', 'Ewert', 'Diplomata SC', 'Sancreek', 'Smokum', 'Mystery Quest',
    'Griffy', 'Princess Sofia', 'Luxurious Roman', 'Federant', 'Inknut Antiqua',
  ],
  'terror': [
    'Creepster', 'Nosifer', 'Eater', 'Butcherman', 'Metal Mania', 'Frijole', 'Rubik Wet Paint', 'Rubik Beastly',
    'Henny Penny', 'Ribeye Marrow', 'Spirax', 'Freckle Face', 'Flavors', 'Rubik Glitch', 'Lacquer', 'Jolly Lodger',
  ],
  'manuscrita': [
    'Dancing Script', 'Great Vibes', 'Parisienne', 'Pinyon Script', 'Tangerine', 'Allura', 'Alex Brush', 'Sacramento',
    'Satisfy', 'Pacifico', 'Kaushan Script', 'Cookie', 'Yellowtail', 'Courgette', 'Marck Script', 'Mr Dafoe',
    'Italianno', 'Petit Formal Script', 'Rouge Script', 'Monsieur La Doulaise', 'Herr Von Muellerhoff',
    'Lavishly Yours', 'Imperial Script', 'Ballet', 'WindSong', 'Corinthia', 'Bilbo Swash Caps', 'Meow Script',
    'Mrs Saint Delafield', 'Qwigley', 'Birthstone',
  ],
  'mao': [
    'Caveat', 'Indie Flower', 'Shadows Into Light', 'Patrick Hand', 'Kalam', 'Gloria Hallelujah',
    'Architects Daughter', 'Permanent Marker', 'Rock Salt', 'Homemade Apple', 'Reenie Beanie',
    'Covered By Your Grace', 'Gochi Hand', 'Amatic SC', 'Just Another Hand', 'Handlee', 'Coming Soon',
    'Nothing You Could Do', 'La Belle Aurore', 'Mansalva', 'Sedgwick Ave', 'Delius', 'Schoolbell', 'Short Stack',
    'Nanum Pen Script', 'Neucha', 'Annie Use Your Telescope', 'Waiting for the Sunrise', 'Itim', 'Cabin Sketch',
    'Fredericka the Great',
  ],
  'serifada': [
    'EB Garamond', 'Playfair Display', 'Lora', 'Merriweather', 'Cormorant Garamond', 'Crimson Text',
    'Libre Baskerville', 'Spectral', 'Cardo', 'Old Standard TT', 'Bodoni Moda', 'DM Serif Display', 'Abril Fatface',
    'Rozha One', 'Yeseva One', 'Prata', 'Alegreya', 'Alegreya SC', 'Vollkorn', 'Gilda Display', 'Sorts Mill Goudy',
    'Rosarivo', 'Roboto Slab', 'Arvo', 'Zilla Slab', 'Bitter', 'Cormorant', 'Marcellus', 'Philosopher',
    'Noticia Text', 'Ultra', 'Fraunces',
  ],
  'sem-serifa': [
    'Inter', 'Roboto', 'Montserrat', 'Poppins', 'Raleway', 'Nunito', 'Quicksand', 'Josefin Sans', 'Work Sans',
    'Rubik', 'Oswald', 'Bebas Neue', 'Anton', 'Archivo Black', 'Barlow Condensed', 'Exo 2', 'Comfortaa', 'Righteous',
    'Space Grotesk', 'Hanken Grotesk', 'Outfit', 'Lexend', 'Fredoka', 'Baloo 2', 'Kanit', 'Teko', 'League Spartan',
    'Syne', 'Unbounded', 'Varela Round', 'Archivo Narrow', 'Sora',
  ],
  'decorativa': [
    'Bungee', 'Bungee Shade', 'Bungee Inline', 'Monoton', 'Faster One', 'Fascinate', 'Lobster', 'Lobster Two',
    'Bangers', 'Luckiest Guy', 'Chewy', 'Bowlby One SC', 'Shrikhand', 'Fugaz One', 'Audiowide', 'Orbitron',
    'Russo One', 'Black Ops One', 'Staatliches', 'Rubik Puddles', 'Rubik Moonrocks', 'Rubik Dirt', 'Rubik Microbe',
    'Londrina Solid', 'Londrina Sketch', 'Sigmar One', 'Titan One', 'Bagel Fat One', 'Rampart One', 'Vast Shadow',
    'Codystar', 'Megrim', 'Plaster', 'Carter One', 'Boogaloo', 'Bungee Spice', 'Poller One', 'Wallpoet',
    'Stardos Stencil', 'Emblema One', 'Gravitas One',
  ],
  'maquina': [
    'Special Elite', 'Courier Prime', 'Cutive Mono', 'IBM Plex Mono', 'Space Mono', 'JetBrains Mono', 'VT323',
    'Press Start 2P', 'Silkscreen', 'Pixelify Sans', 'Major Mono Display', 'Share Tech Mono', 'Syne Mono',
    'Xanh Mono', 'Nova Mono', 'Kode Mono', 'DotGothic16', 'Workbench', 'Tiny5', 'Jersey 10',
  ],
}

/** Itens com texto que aceitam fonte: post-it, texto, forma e título da moldura. */
export const FONT_KINDS: ReadonlySet<string> = new Set(['note', 'text', 'shape', 'frame'])

export interface BoardFont {
  family: string
  cat:    FontCategory
}

export const BOARD_FONTS: BoardFont[] = FONT_CATEGORIES.flatMap(({ id }) => BY_CATEGORY[id].map((family) => ({ family, cat: id })))

const BY_FAMILY = new Map(BOARD_FONTS.map((f) => [f.family, f]))

export function boardFont(family: string | null | undefined): BoardFont | null {
  return (family && BY_FAMILY.get(family)) || null
}

/** Valor pro CSS font-family (undefined = a letra padrão do item). */
export function fontStack(family: string | null | undefined): string | undefined {
  const f = boardFont(family)
  return f ? `"${f.family}", ${FALLBACK[f.cat]}` : undefined
}

// ── Carregamento ────────────────────────────────────────

const API = 'https://fonts.googleapis.com/css2'
const full = new Map<string, Promise<void>>()
const previews = new Set<string>()

const param = (family: string) => encodeURIComponent(family).replace(/%20/g, '+')

function addStylesheet(href: string): Promise<void> {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  const done = new Promise<void>((ok) => { link.onload = () => ok(); link.onerror = () => ok() })
  document.head.appendChild(link)
  return done
}

/** Baixa a fonte inteira (uma vez só) e espera ela ficar pronta pra desenhar. */
export function loadBoardFont(family: string | null | undefined): Promise<void> {
  const f = boardFont(family)
  if (!f) return Promise.resolve()
  let p = full.get(f.family)
  if (!p) {
    p = addStylesheet(`${API}?family=${param(f.family)}&display=swap`)
      .then(() => document.fonts.load(`24px "${f.family}"`))
      .then(() => undefined, () => undefined)
    full.set(f.family, p)
  }
  return p
}

/** Só as letras do nome (pra mostrar a fonte na galeria sem baixar ela toda). */
export function loadFontPreview(family: string): void {
  if (full.has(family) || previews.has(family) || !BY_FAMILY.has(family)) return
  previews.add(family)
  void addStylesheet(`${API}?family=${param(family)}&text=${encodeURIComponent(family)}&display=swap`)
}

/** Garante a fonte do item; quando ela chega, redesenha (a letra dos post-its se reajusta). */
export function useBoardFont(family: string | null | undefined): void {
  const [, bump] = useState(0)
  useEffect(() => {
    if (!boardFont(family)) return
    let alive = true
    void loadBoardFont(family).then(() => { if (alive) bump((n) => n + 1) })
    return () => { alive = false }
  }, [family])
}
