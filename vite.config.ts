import { defineConfig } from 'vite';
export default defineConfig({ root: 'apps/web', base: './', resolve: { preserveSymlinks: true }, build: { outDir: '../../dist', emptyOutDir: true }, server: { port: 5173, strictPort: true } });
