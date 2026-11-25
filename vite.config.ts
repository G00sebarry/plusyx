import path from 'path';
import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), {
        name: 'life-matrix-assets',
        apply: 'build',
        generateBundle() {
          if (mode !== 'matrix-test' && env.VITE_ENABLE_LIFE_MATRIX !== 'true') return;
          const directory = 'prototypes/life-matrix';
          const html = readFileSync(path.join(__dirname, directory, 'index.html'), 'utf8');
          // Classic scripts share globals and must execute in document order.
          const assets = html.matchAll(/<(?:script\b[^>]*\bsrc|link\b[^>]*\bhref)="([\w./-]+\.(?:js|css))"/g);
          for (const [, file] of assets) {
            this.emitFile({ type: 'asset', fileName: directory + '/' + file,
              source: readFileSync(path.join(__dirname, directory, file)) });
          }
          this.emitFile({ type: 'asset', fileName: directory + '/index.html', source: html });
        }
      }],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
