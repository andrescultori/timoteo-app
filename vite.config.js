import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relativa: funciona na raiz do domínio (Cloudflare Pages) e em qualquer subpasta.
export default defineConfig({
  base: './',
  plugins: [react()],
});
