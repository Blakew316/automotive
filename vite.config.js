import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import process from 'node:process'

// VITE_EDITION=small-engine builds the Small Engine Edition (src/lib/edition.js): its own name,
// Home Screen app and caches, so it installs and runs beside the auto-repair app.
const SMALL_ENGINE = process.env.VITE_EDITION === 'small-engine'
const MANIFEST = SMALL_ENGINE ? 'manifest-small-engine.webmanifest' : 'manifest.webmanifest'

function edition() {
  return {
    name: 'wpi-edition',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (!SMALL_ENGINE) return html
        return html
          .replace('href="/manifest.webmanifest"', `href="/${MANIFEST}"`)
          .replace(/(<meta name="description" content=")[^"]*"/, '$1WPI Driveline Shop Management System, Small Engine Edition — shop management for outdoor power equipment repair: mowers, tractors, saws, trimmers, generators and pressure washers. Repair orders, equipment by serial number and engine hours, troubleshooting, parts by brand, customer texting, online booking and payments."')
          .replace('content="WPI Driveline Shop Management System" />', 'content="WPI Driveline Small Engine Edition" />')
          .replace('<meta name="apple-mobile-web-app-title" content="WPI Driveline" />', '<meta name="apple-mobile-web-app-title" content="WPI Small Engine" />')
          .replace('<title>WPI Driveline Shop Management System</title>', '<title>WPI Driveline Shop Management System · Small Engine Edition</title>')
          .replaceAll("'autoshop-pro:", "'wpi-small-engine:")
      },
    },
  }
}

// Emits sw.js with the list of built files to precache and a version that changes with them.
function serviceWorker() {
  return {
    name: 'autoshop-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle)
        .filter((f) => /\.(js|css|woff2?|svg|png)$/.test(f))
        .sort()
      files.push(MANIFEST, 'favicon.svg', 'icons/icon-192.png', 'icons/apple-touch-icon.png')
      const version = createHash('sha256').update(files.join('|')).digest('hex').slice(0, 12)
      const source = readFileSync(new URL('./src/pwa/sw.js', import.meta.url), 'utf8')
        .replace("const VERSION = 'dev';", `const VERSION = '${version}';`)
        .replace("const NAME = 'app';", `const NAME = '${SMALL_ENGINE ? 'small-engine' : 'app'}';`)
        .replace('const PRECACHE = [];', `const PRECACHE = ${JSON.stringify(files)};`)
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig({
  plugins: [react(), edition(), serviceWorker()],
  build: {
    rollupOptions: {
      output: {
        // React and the router change rarely: keep them in their own long-cached file so an app
        // update only re-downloads the app's own code.
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom|@remix-run)\//.test(id)) return 'react'
        },
      },
    },
  },
})
