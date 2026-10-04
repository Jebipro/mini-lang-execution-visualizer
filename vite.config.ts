import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// base './' keeps the built app working from any static path (GitHub Pages, a sub-folder, a local file server)
export default defineConfig({
  base: './',
  plugins: [react()],
});
