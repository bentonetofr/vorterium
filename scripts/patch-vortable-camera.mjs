// Remenda o motor do Vortable (src/vendor/vortable) com `watch.worldAt(pageX, pageY)`: converte um ponto da tela
// (coordenadas de página, como e.pageX/e.pageY) num ponto do mapa, pra arrastar inimigos do painel e soltar no mapa.
//
// O motor é sincronizado de outro repositório (`npm run vorterium` lá) e essa sincronização apaga a remenda:
// depois de cada sincronização, rode `node scripts/patch-vortable-camera.mjs` (é seguro rodar de novo).
// Sem a remenda o resto funciona; só o arrastar do painel de inimigos avisa que precisa dela.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'vendor', 'vortable')
const js = join(root, 'vortable.js')
const dts = join(root, 'types', 'index.d.ts')

let code = readFileSync(js, 'utf8')
if (code.includes('worldAt:')) {
  console.log('motor: já remendado (worldAt)')
} else {
  const anchor = 'focus: (e, t) => _()?.watchFocus(e, t),'
  if (!code.includes(anchor)) throw new Error('motor: não achei onde remendar (o motor mudou?)')
  code = code.replace(anchor, `${anchor}\n\t\t\tworldAt: (e, t) => {\n\t\t\t\tlet n = _();\n\t\t\t\tif (!n) return null;\n\t\t\t\tlet r = n.cameras.main.getWorldPoint(n.scale.transformX(e), n.scale.transformY(t));\n\t\t\t\treturn { x: r.x, y: r.y };\n\t\t\t},`)
  writeFileSync(js, code)
  console.log('motor: remendado (worldAt)')
}

let types = readFileSync(dts, 'utf8')
if (!types.includes('worldAt(')) {
  const a = '    focus(x: number, y: number): void;\n'
  if (!types.includes(a)) throw new Error('tipos: não achei onde remendar')
  types = types.replace(a, `${a}    /** Ponto do mapa sob um ponto da tela (coordenadas de página: pageX, pageY). null = sem cena. (remenda do Vorterium) */\n    worldAt(pageX: number, pageY: number): { x: number; y: number } | null;\n`)
  writeFileSync(dts, types)
  console.log('tipos: remendados (worldAt)')
}
