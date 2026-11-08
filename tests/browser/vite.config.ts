import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const fakeClient = fileURLToPath(new URL('./fake-supabase.ts', import.meta.url));
export default defineConfig({
  plugins: [{
    name: 'isolated-database', enforce: 'pre',
    resolveId(source) {
      if (/(^|\/)supabaseClient(?:\.ts)?$/.test(source)) return fakeClient;
    }
  }, react()],
  server: { host: '127.0.0.1', port: 4178, strictPort: true, hmr: false },
});
