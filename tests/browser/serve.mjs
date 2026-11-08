import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

// envFile is an InlineConfig option: keep it here, not in vite.config.ts.
const server = await createServer({
  configFile: fileURLToPath(new URL('./vite.config.ts', import.meta.url)),
  envFile: false,
  mode: 'isolated-test'
});
await server.listen();
for (const signal of ['SIGINT','SIGTERM']) {
  process.on(signal, async () => { await server.close(); process.exit(0); });
}
