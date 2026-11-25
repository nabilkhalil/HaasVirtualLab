import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  // Relative base: the same build works at /, /HaasVirtualLab/ (GitHub Pages project site) and file:// previews.
  base: './',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  test: { include: ['tests/unit/**/*.test.ts'] },
} as any);
