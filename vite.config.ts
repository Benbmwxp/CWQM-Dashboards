/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // When the real backend exists, run it on :8080 and set VITE_API_MODE=live.
  server: { proxy: { '/api': 'http://localhost:8080' } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
