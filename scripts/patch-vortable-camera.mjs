// Remendas do motor do Vortable (src/vendor/vortable):
//  1. `watch.worldAt(pageX, pageY)`: converte um ponto da tela (coordenadas de página, como e.pageX/e.pageY) num ponto do
//     mapa, pra arrastar inimigos e NPCs do painel e soltar no mapa.
//  2. Passos dos outros: na câmera do mestre (modo watch), jogadores e NPCs controlados também fazem som de passos
//     (o motor só tocava o passo do próprio boneco), mais baixo quanto mais longe do centro da câmera.
//  6. Roupa que descolava do corpo ao correr: peça sem a animação faz o boneco inteiro usar os quadros de caminhar nela.
//  7. Zoom da roda na câmera do mestre (âncora no mouse calculada certo).
//  8. Duração do dia de 3 h e 5 h (DAY_LENGTHS).
//  5. `gate`: licença do mestre pra o jogador atravessar uma saída (ver a remenda 5 no fim).
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

// ── Remenda 5: licença do mestre pra sair da zona. `gate({ from, fromName, to, toName, via })` é chamado quando o boneco do jogador pisa numa
//    saída; o boneco fica parado até a resposta (true = atravessa, false = fica). Sem `gate`, tudo funciona como antes. ──
code = readFileSync(js, 'utf8')
if (code.includes('this.cfg.gate')) {
  console.log('motor: licença de saída já remendada')
} else {
  const travelOld = '\t\tthis.travelling = !0, t.frozen = !0;\n\t\tlet r = this.cameras.main, i = new Promise((e) => r.once(c.default.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => e()));'
  const travelNew = [
    '\t\tthis.travelling = !0, t.frozen = !0;',
    '\t\tif (this.cfg.gate) {',
    '\t\t\tlet g = await this.cfg.loadZone(n.zone).catch(() => null);',
    '\t\t\tif (g) {',
    '\t\t\t\tlet ok = await this.cfg.gate({ from: this.cfg.zone.id, fromName: this.cfg.zone.name, to: n.zone, toName: g.name, via: e.name || "" }).catch(() => !1);',
    '\t\t\t\tif (!this.sys.isActive()) return;',
    '\t\t\t\tif (!ok) {',
    '\t\t\t\t\tthis.toast("O mestre não permitiu sair daqui."), t.frozen = !1, this.travelling = !1, this.armed = !1;',
    '\t\t\t\t\treturn;',
    '\t\t\t\t}',
    '\t\t\t}',
    '\t\t}',
    '\t\tlet r = this.cameras.main, i = new Promise((e) => r.once(c.default.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => e()));',
  ].join('\n')
  const cfgOld = '\t\tonClock: (e) => u?.showTestClock(e),\n\t\tinputLocked: () => o,'
  const cfgNew = '\t\tonClock: (e) => u?.showTestClock(e),\n\t\tgate: t.gate,\n\t\tinputLocked: () => o,'
  for (const a of [travelOld, cfgOld]) if (!code.includes(a)) throw new Error('motor: não achei onde remendar a licença de saída (o motor mudou?): ' + a.slice(0, 50))
  code = code.replace(travelOld, travelNew).replace(cfgOld, cfgNew)
  writeFileSync(js, code)
  console.log('motor: licença de saída remendada')
}
types = readFileSync(dts, 'utf8')
if (!types.includes('gate?:')) {
  const a = '    /** Avisado a cada zona que a cena abre (o mestre acompanha em que zona a câmera está). */\n    onZone?: (zone: ZoneData) => void;\n'
  if (!types.includes(a)) throw new Error('tipos: não achei onZone')
  types = types.replace(a, `${a}    /** Jogo: licença pra atravessar uma saída (o boneco espera a resposta; false = não sai). (remenda do Vorterium) */\n    gate?: (info: { from: string; fromName: string; to: string; toName: string; via: string }) => Promise<boolean>;\n`)
  writeFileSync(dts, types)
  console.log('tipos: licença de saída remendada')
}

// ── Remenda 6: roupa descolando do corpo ao correr. Peça sem a animação de correr (ou de ficar parado) caía no quadro de CAMINHAR enquanto o
//    corpo usava o de correr, e as duas poses não batem (a roupa, o chapéu e a arma ficavam soltos). Agora, se QUALQUER peça equipada não
//    tem a animação, o boneco inteiro usa os quadros de caminhar nela: tudo anda junto, sem descolar. Quem só tem peças completas corre normal. ──
code = readFileSync(js, 'utf8')
if (code.includes('miss = r !== "walk"')) {
  console.log('motor: roupa ao correr já remendada')
} else {
  const a = '\t\tlet d = u.anims.includes(r), f = d ? r : "walk", p = un(e, u, l, n.skin);'
  const b = '\t\tlet d = !miss && u.anims.includes(r), f = d ? r : "walk", p = un(e, u, l, n.skin);'
  const head = '\tlet a = [], o = 0, s = mn(n).length > 0;\n\tfor (let [c, l] of Object.entries(n.slots)) {\n\t\tif (i && c !== i) continue;'
  const headNew = '\tlet a = [], o = 0, s = mn(n).length > 0, miss = r !== "walk" && Object.entries(n.slots).some(([k, v]) => {\n\t\tif (i && k !== i) return !1;\n\t\tlet w = e.byId.get(v.id);\n\t\treturn !!w && !w.proc && !w.anims.includes(r);\n\t});\n\tfor (let [c, l] of Object.entries(n.slots)) {\n\t\tif (i && c !== i) continue;'
  for (const x of [a, head]) if (!code.includes(x)) throw new Error('motor: não achei onde remendar a roupa ao correr (o motor mudou?): ' + x.slice(0, 50))
  code = code.replace(a, b).replace(head, headNew)
  writeFileSync(js, code)
  console.log('motor: roupa ao correr remendada')
}

// ── Remenda 7: zoom da roda na câmera do mestre. O motor lia o ponto do mapa sob o mouse DEPOIS de mudar o zoom, mas a matriz da câmera só
//    atualiza no quadro seguinte, então a conta saía errada e o zoom ia pra um lugar que não era o do mouse. Agora a âncora é calculada na mão
//    (o ponto sob o mouse fica parado). Acompanhando um jogador, o zoom fica centrado nele. O passo acompanha a força da roda (suave no touchpad). ──
code = readFileSync(js, 'utf8')
if (code.includes('wheelZoom')) {
  console.log('motor: zoom da roda já remendado')
} else {
  const old = '\t\t}), i.on("wheel", (e, t, n, i) => {\n\t\t\tlet a = r.getWorldPoint(e.x, e.y);\n\t\t\tr.setZoom(c.default.Math.Clamp(r.zoom * (i < 0 ? 1.15 : 1 / 1.15), .2, 6));\n\t\t\tlet o = r.getWorldPoint(e.x, e.y);\n\t\t\tr.scrollX += a.x - o.x, r.scrollY += a.y - o.y;\n\t\t});'
  const next = [
    '\t\t}), i.on("wheel", (e, t, n, i) => {',
    '\t\t\tlet wheelZoom = r.zoom, nz = c.default.Math.Clamp(wheelZoom * Math.exp(-c.default.Math.Clamp(i, -240, 240) * .0016), .2, 6);',
    '\t\t\tif (nz === wheelZoom) return;',
    '\t\t\tlet w = r.width, h = r.height, sx = e.x - r.x - w / 2, sy = e.y - r.y - h / 2, wx = sx / wheelZoom + r.scrollX + w / 2, wy = sy / wheelZoom + r.scrollY + h / 2;',
    '\t\t\tr.setZoom(nz), this.following || (r.scrollX = wx - w / 2 - sx / nz, r.scrollY = wy - h / 2 - sy / nz);',
    '\t\t});',
  ].join('\n')
  if (!code.includes(old)) throw new Error('motor: não achei o zoom da roda (o motor mudou?)')
  code = code.replace(old, next)
  writeFileSync(js, code)
  console.log('motor: zoom da roda remendado')
}

// ── Remenda 8: durações de dia de 3 h e 5 h (a lista `DAY_LENGTHS` do motor vale pro editor e pro Controle ao vivo); as de 2 h pra cima aparecem em horas ──
code = readFileSync(js, 'utf8')
if (code.includes('\t96,\n\t180,')) {
  console.log('motor: durações de dia já remendadas')
} else {
  const lenOld = '], jr = [\n\t12,\n\t24,\n\t48,\n\t96\n];'
  const lenNew = '], jr = [\n\t12,\n\t24,\n\t48,\n\t96,\n\t180,\n\t300\n];'
  const labOld = '}, `${e} min`)));\n\t\t\tt.addEventListener("change", () => s({ dayMinutes:'
  const labNew = '}, e >= 120 ? `${e / 60} h` : `${e} min`)));\n\t\t\tt.addEventListener("change", () => s({ dayMinutes:'
  for (const x of [lenOld, labOld]) if (!code.includes(x)) throw new Error('motor: não achei a lista de durações do dia (o motor mudou?): ' + x.slice(0, 40))
  code = code.replace(lenOld, lenNew).replace(labOld, labNew)
  writeFileSync(js, code)
  console.log('motor: durações de dia remendadas')
}
