// Versão do vite.config.ts com o plugin que atende /api/* no `npm run dev`.
// Pra religar a importação do Miro, substitua o vite.config.ts da raiz por este.
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// No `npm run dev` não existe o servidor da Vercel: este plugin atende
// /api/* com as mesmas funções da pasta api/ (formato Request → Response).
function devApi(): Plugin {
  return {
    name: 'vorterium-dev-api',
    apply: 'serve',
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ''))
      server.middlewares.use('/api/', async (req, res) => {
        try {
          const name = (req.url ?? '').split(/[/?#]/).filter(Boolean)[0]
          if (!name || !/^[a-z0-9-]+$/.test(name)) { res.statusCode = 404; res.end(); return }
          const mod = await server.ssrLoadModule(`/api/${name}.ts`)
          const handler = mod[req.method ?? 'GET'] as ((r: Request) => Promise<Response>) | undefined
          if (!handler) { res.statusCode = 405; res.end(); return }
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const headers = new Headers()
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
          const response = await handler(new Request(`http://localhost/api${req.url}`, {
            method: req.method,
            headers,
            body: chunks.length ? Buffer.concat(chunks) : undefined,
          }))
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (err) {
          res.statusCode = 500
          res.end(String(err))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), devApi()],
})
