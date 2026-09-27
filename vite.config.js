import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import adminUserHandler from './api/admin-user.js'
import generateHandler from './api/generate.js'
import sendEmailHandler from './api/send-email.js'

const API_ROUTES = {
  '/api/admin-user': adminUserHandler,
  '/api/generate': generateHandler,
  '/api/send-email': sendEmailHandler,
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

// Runs the same api/*.js handlers Vercel runs, so `npm run dev` enforces the same
// token, approval and role checks as production.
function apiProxyPlugin() {
  return {
    name: 'api-proxy-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handler = API_ROUTES[req.url.split('?')[0]]
        if (!handler) return next()
        res.status = (code) => { res.statusCode = code; return res }
        res.json = (payload) => {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(payload))
          return res
        }
        try {
          const body = await readBody(req)
          req.body = body ? JSON.parse(body) : {}
        } catch {
          return res.status(400).json({ error: 'Request body is not valid JSON' })
        }
        await handler(req, res)
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [react(), apiProxyPlugin()],
  server: {
    host: '127.0.0.1',
    port: 3000,
  },
  base: './',
  build: {
    rollupOptions: {
      output: {
        // Split heavy vendors out of the entry chunk. The big win is
        // recharts (used by only a couple of routes); lucide-react is imported
        // icon-by-icon everywhere, so its chunk buys cache stability rather
        // than a smaller initial download.
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-firebase': [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
            'firebase/storage',
          ],
          'vendor-sentry': ['@sentry/react'],
          'vendor-charts': ['recharts'],
          'vendor-genai': ['@google/genai'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
})

