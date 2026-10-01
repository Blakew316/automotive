import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

// Emits sw.js with the list of built files to precache and a version that changes with them.
function serviceWorker() {
  return {
    name: 'autoshop-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle)
        .filter((f) => /\.(js|css|woff2?|svg|png)$/.test(f))
        .sort()
      files.push('manifest.webmanifest', 'favicon.svg', 'icons/icon-192.png', 'icons/apple-touch-icon.png')
      const version = createHash('sha256').update(files.join('|')).digest('hex').slice(0, 12)
      const source = readFileSync(new URL('./src/pwa/sw.js', import.meta.url), 'utf8')
        .replace("const VERSION = 'dev';", `const VERSION = '${version}';`)
        .replace('const PRECACHE = [];', `const PRECACHE = ${JSON.stringify(files)};`)
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
})
