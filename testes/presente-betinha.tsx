// ────────────────────────────────────────────────────────
// Prévia do presente dos betas do D&D (só no `npm run dev`; fora do build):
// /testes/presente-betinha.html. A janela de parabéns com o mascote e o Dado
// de Betinha Tester girando na vitrine, sem login (o banco é trocado por um
// falso: "Usar este dado" só finge salvar). `?d=d6` mostra outro dado da resina
// rolando no palco largo, embaixo.
// ────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import '../src/shared/theme/motion.css'
import { supabase } from '../src/shared/lib/supabase'
import { ModalOverlay } from '../src/shared/components/ModalOverlay'
import { BetaGiftCard } from '../src/features/patch/BetaGiftNotice'

/* eslint-disable @typescript-eslint/no-explicit-any */
const sb = supabase as any
sb.auth.getUser = async () => ({ data: { user: { id: 'u1' } } })
sb.from = () => ({ update: () => ({ eq: async () => { await new Promise((r) => setTimeout(r, 500)); return { error: null } } }) })

const kind = new URLSearchParams(location.search).get('d')
const toyOnly = new URLSearchParams(location.search).get('boneco')

/** `?boneco=1`: só o brinquedo, grande, girando (para conferir o modelo sem as faces do dado na frente). */
function ToyOnly() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    let renderer: any = null
    void Promise.all([import('three'), import('three/examples/jsm/environments/RoomEnvironment.js'), import('../src/features/dice3d/toys')]).then(([THREE, env, toys]) => {
      if (!ref.current) return
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(560, 560)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      ref.current.appendChild(renderer.domElement)
      const scene = new THREE.Scene()
      const pm = new THREE.PMREMGenerator(renderer)
      scene.environment = pm.fromScene(new env.RoomEnvironment(), 0.04).texture
      scene.environmentIntensity = 0.4
      scene.add(new THREE.HemisphereLight(0xfff1dc, 0x1c1424, 0.6))
      const key = new THREE.DirectionalLight(0xfff4e6, 2.6); key.position.set(-3, 7, 9); scene.add(key)
      const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100); cam.position.set(0, 0, 6.2)
      const toy = toys.makeToy('d20', 'nerd'); toy.scale.setScalar(1)
      scene.add(toy)
      const start = performance.now()
      const tick = () => { const t = (performance.now() - start) / 1000; toy.rotation.set(0.1, Math.sin(t * 0.6) * 1.1, 0); renderer.render(scene, cam); raf = requestAnimationFrame(tick) }
      tick()
    })
    return () => { cancelAnimationFrame(raf); renderer?.dispose() }
  }, [])
  return <div ref={ref} style={{ position: 'fixed', top: 60, left: 20, zIndex: 3000, background: '#0b1020', borderRadius: 20 }} />
}

/** Um palco largo rolando dados da resina, para ver o brinquedo dentro de cada tipo de dado. */
function Stage() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let stage: any = null
    void import('../src/features/dice3d/DiceStage').then(async (m) => {
      if (!ref.current) return
      stage = new m.DiceStage(ref.current, 'wide')
      const kinds = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'] as const
      await stage.roll(kinds.map((k, i) => ({ kind: k, value: i + 1 })), { skin: 'betinha', sound: false })
    })
    return () => stage?.dispose()
  }, [])
  return <div ref={ref} style={{ position: 'fixed', inset: 'auto 0 0 0', height: '45vh', zIndex: 2000 }} />
}

function Page() {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ padding: 24 }}>
      <button onClick={() => setOpen(true)} style={{ padding: '8px 16px' }}>Abrir o presente</button>
      {open && <ModalOverlay onClose={() => setOpen(false)}><BetaGiftCard onClose={() => setOpen(false)} /></ModalOverlay>}
      {kind && <Stage />}
      {toyOnly && <ToyOnly />}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Page />)
