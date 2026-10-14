import { defineConfig } from 'vitest/config';
export default defineConfig({ resolve: { preserveSymlinks: true }, test: { include: ['tests/unit/**/*.test.ts'] } });
