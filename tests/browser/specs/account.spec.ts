import { test, expect } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://127.0.0.1:4178') return route.continue();
    return route.abort('blockedbyclient');
  });
});

test('real App renders synthetic account A then replaces it with B', async ({ page }) => {
  await page.goto('/tests/browser/index.html');
  await expect(page.getByText('Task A', { exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).__testDb.login('B'));
  await expect(page.getByText('Task B', { exact: true })).toBeVisible();
  await expect(page.getByText('Task A', { exact: true })).toHaveCount(0);
  const writes = await page.evaluate(() => (window as any).__testDb.calls.filter((c: any) => c.action !== 'select'));
  expect(writes).toEqual([]);
});

test('failed required read shows retry screen and never creates defaults', async ({ page }) => {
  await page.goto('/tests/browser/index.html');
  await expect(page.getByText('Task A', { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const db = (window as any).__testDb;
    db.failures['columns:select'] = true;
    db.login('B');
  });
  await expect(page.getByRole('button', { name: 'Повторить загрузку' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__testDb.calls.filter((c: any) => c.action !== 'select'))).toEqual([]);
  await page.evaluate(() => { (window as any).__testDb.failures = {}; });
  await page.getByRole('button', { name: 'Повторить загрузку' }).click();
  await expect(page.getByText('Task B', { exact: true })).toBeVisible();
});

test('late A response cannot replace B', async ({ page }) => {
  await page.goto('/tests/browser/index.html');
  await expect(page.getByText('Task A', { exact: true })).toBeVisible();
  const before = await page.evaluate(() => (window as any).__testDb.calls.filter((c: any) => c.table === 'tasks').length);
  await page.evaluate(() => {
    const db = (window as any).__testDb;
    db.login(''); db.delays['tasks:select'] = 800; db.login('A');
  });
  await expect.poll(() => page.evaluate(() => (window as any).__testDb.calls.filter((c: any) => c.table === 'tasks').length)).toBeGreaterThan(before);
  await page.evaluate(() => { const db = (window as any).__testDb; db.delays = {}; db.login('B'); });
  await expect(page.getByText('Task B', { exact: true })).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(page.getByText('Task A', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Task B', { exact: true })).toBeVisible();
});

test('switching accounts unmounts editor and cancels its queued autosave', async ({ page }) => {
  await page.goto('/tests/browser/index.html');
  await page.getByText('Task A', { exact: true }).click();
  const title = page.getByPlaceholder('Заголовок задачи');
  await expect(title).toHaveValue('Task A');
  await title.fill('Do not send to B');
  await page.evaluate(() => {
    const db = (window as any).__testDb;
    db.calls = [];
    db.login('B');
  });
  await expect(page.getByText('Task B', { exact: true })).toBeVisible();
  await page.waitForTimeout(1300);
  expect(await page.evaluate(() => (window as any).__testDb.calls.filter((c: any) => c.action !== 'select'))).toEqual([]);
  await expect(title).toHaveCount(0);
});

test('external browser fetch is blocked by test policy', async ({ page }) => {
  await page.goto('/tests/browser/index.html');
  const allowed = await page.evaluate(async () => {
    try { await fetch('https://example.invalid/blocked'); return true; }
    catch { return false; }
  });
  expect(allowed).toBe(false);
});

