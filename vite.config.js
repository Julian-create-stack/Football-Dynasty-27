import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const preview = process.env.BASE44_PREVIEW_MODE === '1'
const allowedHosts = ['localhost', '127.0.0.1']
if (preview) {
  if (process.env.BASE44_SANDBOX_HOST_DOMAIN) allowedHosts.push(`.${process.env.BASE44_SANDBOX_HOST_DOMAIN}`)
  if (process.env.BASE44_PUBLIC_HOST_SUFFIX) allowedHosts.push(`3000-${process.env.BASE44_PUBLIC_HOST_SUFFIX}`)
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    allowedHosts,
    watch: { usePolling: true, interval: 250 },
  },
  build: { outDir: 'dist', sourcemap: false },
})
