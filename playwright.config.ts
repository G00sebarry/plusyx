import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser/specs',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4178', channel: 'msedge', headless: true, serviceWorkers: 'block' },
  webServer: {
    command: 'npm run test:browser:serve', url: 'http://127.0.0.1:4178/tests/browser/index.html',
    reuseExistingServer: false, timeout: 30000
  }
});
