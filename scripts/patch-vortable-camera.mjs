// Remendas do motor do Vortable (src/vendor/vortable):
//  1. `watch.worldAt(pageX, pageY)`: converte um ponto da tela (coordenadas de página, como e.pageX/e.pageY) num ponto do
//     mapa, pra arrastar inimigos e NPCs do painel e soltar no mapa.
//  2. Passos dos outros: na câmera do mestre (modo watch), jogadores e NPCs controlados também fazem som de passos
//     (o motor só tocava o passo do próprio boneco), mais baixo quanto mais longe do centro da câmera.
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

// ── Remenda 2: passos dos outros bonecos na câmera do mestre ──
code = readFileSync(js, 'utf8')
if (code.includes('hookSteps(')) {
  console.log('motor: passos já remendados')
} else {
  const stepOld = 'step(e, t, n, r) {\n\t\tlet i = va();\n\t\tif (!i.steps || !this.engine.running) return;'
  const stepNew = 'step(e, t, n, r, g = 1) {\n\t\tlet i = va();\n\t\tif (!i.steps || !this.engine.running) return;'
  const playOld = 'this.steps.play(o, i.steps * (n ? .9 : .7), this.stepSide * .08'
  const playNew = 'this.steps.play(o, i.steps * (n ? .9 : .7) * g, this.stepSide * .08'
  const animOld = 'e.playing !== l && this.scene.anims.exists(l) && (r.anims.play(l, !0), e.playing = l);'
  const animNew = 'e.playing !== l && this.scene.anims.exists(l) && (r.anims.play(l, !0), e.playing = l), this.hookSteps(e, r);'
  const dropOld = '\tdrop(e) {\n\t\te.sprite?.destroy(), e.shadow?.destroy()'
  const hook = [
    '\thookSteps(e, t) {',
    '\t\tif (e.stepsFor === t || !this.scene.cfg?.watch) return;',
    '\t\te.stepsFor = t;',
    '\t\tlet n = (n, r) => {',
    '\t\t\tlet i = this.scene, a = n.key.split(":"), o = a[a.length - 2], s = qa[o];',
    '\t\t\tif (!s || !i.audio || !t.visible || !s.includes(Number(r.textureFrame) % (o === "walk" ? 9 : 8))) return;',
    '\t\t\tlet l = i.cameras.main, u = Math.max(l.width, l.height) / (2 * l.zoom) * 1.15, d = Math.max(0, 1 - c.default.Math.Distance.Between(t.x, t.y, l.midPoint.x, l.midPoint.y) / u);',
    '\t\t\td > .04 && i.audio.step(t.x, t.y - 2, o === "run", i.lighting.weatherNow, d * Math.sqrt(d));',
    '\t\t};',
    '\t\tt.on(c.default.Animations.Events.ANIMATION_START, n), t.on(c.default.Animations.Events.ANIMATION_UPDATE, n);',
    '\t}',
  ].join('\n')
  for (const a of [stepOld, playOld, animOld, dropOld]) {
    if (!code.includes(a)) throw new Error('motor: não achei onde remendar os passos (o motor mudou?): ' + a.slice(0, 40))
  }
  code = code.replace(stepOld, stepNew).replace(playOld, playNew).replace(animOld, animNew).replace(dropOld, hook + '\n' + dropOld)
  writeFileSync(js, code)
  console.log('motor: passos remendados')
}

// ── Remenda 3: `watch.npcs()` também devolve a posição (x, y) de cada NPC, pra clicar no NPC no mapa ──
code = readFileSync(js, 'utf8')
if (code.includes('role: e.role,\n\t\t\tx: e.x')) {
  console.log('motor: posição dos NPCs já remendada')
} else {
  const old = '\twatchNpcs() {\n\t\treturn (this.cfg.zone.npcs ?? []).map((e) => ({\n\t\t\tid: e.id,\n\t\t\tname: e.name,\n\t\t\trole: e.role\n\t\t}));'
  if (!code.includes(old)) throw new Error('motor: não achei watchNpcs (o motor mudou?)')
  code = code.replace(old, old.replace('role: e.role\n', 'role: e.role,\n\t\t\tx: e.x,\n\t\t\ty: e.y\n'))
  writeFileSync(js, code)
  console.log('motor: posição dos NPCs remendada')
}
types = readFileSync(dts, 'utf8')
if (!types.includes('role: string;\n        x?: number;')) {
  const a = '    npcs(): {\n        id: string;\n        name: string;\n        role: string;\n    }[];'
  if (!types.includes(a)) throw new Error('tipos: não achei npcs()')
  types = types.replace(a, '    npcs(): {\n        id: string;\n        name: string;\n        role: string;\n        x?: number;\n        y?: number;\n    }[];')
  writeFileSync(dts, types)
  console.log('tipos: posição dos NPCs remendada')
}

// ── Remenda 4: passos do NPC que o mestre controla (ele é um boneco local da cena, sem o som de passos do próprio boneco) ──
code = readFileSync(js, 'utf8')
if (code.includes('stepsFor(e) {')) {
  console.log('motor: passos do NPC controlado já remendados')
} else {
  const syncOld = '\tsyncFootsteps(e) {'
  const method = [
    '\tstepsFor(e) {',
    '\t\tlet t = (t, n) => {',
    '\t\t\tlet a = t.key.split(":"), r = a[a.length - 2], i = qa[r];',
    '\t\t\ti && this.audio && i.includes(Number(n.textureFrame) % (r === "walk" ? 9 : 8)) && this.audio.step(e.x, e.y - 2, r === "run", this.lighting.weatherNow);',
    '\t\t};',
    '\t\te.on(c.default.Animations.Events.ANIMATION_START, t), e.on(c.default.Animations.Events.ANIMATION_UPDATE, t);',
    '\t}',
  ].join('\n')
  const ctlOld = 'this.applyHeight(r, t.appearance), r.locked = this.inputLocked, this.physics.add.collider(r.sprite, this.solids);'
  const ctlNew = 'this.applyHeight(r, t.appearance), this.stepsFor(r.sprite), r.locked = this.inputLocked, this.physics.add.collider(r.sprite, this.solids);'
  for (const a of [syncOld, ctlOld]) if (!code.includes(a)) throw new Error('motor: não achei onde remendar os passos do NPC controlado: ' + a.slice(0, 40))
  code = code.replace(syncOld, method + '\n' + syncOld).replace(ctlOld, ctlNew)
  writeFileSync(js, code)
  console.log('motor: passos do NPC controlado remendados')
}
