import { readdirSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const ROOT = 'src/spinner'

const sets = readdirSync(`${ROOT}/sets`)
  .filter((file) => file.endsWith('.ts'))
  .map((file) => file.replace(/\.ts$/, ''))

// Each module stays its own file so `@x-mesh/ai-spinner/sets/<name>` pulls in only that set and the shared helpers.
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: {
        index: `${ROOT}/index.ts`,
        vanilla: `${ROOT}/vanilla.ts`,
        ...Object.fromEntries(sets.map((name) => [`sets/${name}`, `${ROOT}/sets/${name}.ts`])),
      },
      formats: ['es'],
    },
    rolldownOptions: {
      external: ['react', 'react/jsx-runtime'],
      output: {
        preserveModules: true,
        preserveModulesRoot: ROOT,
        entryFileNames: '[name].js',
      },
    },
  },
})
