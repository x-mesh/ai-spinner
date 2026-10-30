import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  plugins: [react()],
  // GitHub Pages serves the gallery from https://x-mesh.github.io/ai-spinner/; `vite preview` mirrors that path.
  base: command === 'build' || isPreview ? '/ai-spinner/' : '/',
  // `dist` holds the published library.
  build: { outDir: 'dist-demo' },
}))
