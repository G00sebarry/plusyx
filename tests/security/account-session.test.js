import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountSessionController, createAccountWriteQueue } from '../../utils/accountSession.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

test('A -> B invalidates A synchronously and uses a new component key', () => {
  const scopes = [];
  const auth = createAccountSessionController(scope => scopes.push(scope));
  auth.accept({ id: 'A' });
  const a = scopes.at(-1);
  auth.accept({ id: 'B' });
  const b = scopes.at(-1);
  assert.equal(a.active, false);
  assert.equal(b.active, true);
  assert.notEqual(a.key, b.key);
});

test('token refresh preserves state but logout and same-user login reset it', () => {
  const scopes = [];
  const auth = createAccountSessionController(scope => scopes.push(scope));
  auth.accept({ id: 'A' });
  const first = scopes.at(-1);
  auth.accept({ id: 'A' });
  assert.equal(scopes.length, 1);
  auth.accept(null);
  assert.equal(first.active, false);
  auth.accept({ id: 'A' });
  assert.notEqual(first.key, scopes.at(-1).key);
});

test('auth event makes pending initial session result stale', async () => {
  let current;
  const auth = createAccountSessionController(scope => { current = scope; });
  const initial = deferred();
  const revision = auth.revision;
  const load = initial.promise.then(user => {
    if (auth.revision === revision) auth.accept(user);
  });
  auth.accept({ id: 'B' });
  initial.resolve({ id: 'A' });
  await load;
  assert.equal(current.user.id, 'B');
});

test('disposed auth cannot publish, and recreated controller has a fresh key', () => {
  const scopes = [];
  const auth = createAccountSessionController(scope => scopes.push(scope));
  auth.accept({ id: 'A' });
  auth.dispose();
  auth.accept({ id: 'B' });
  assert.equal(scopes.length, 1);
  assert.equal(scopes[0].active, false);
  createAccountSessionController(scope => scopes.push(scope)).accept({ id: 'A' });
  assert.notEqual(scopes[0].key, scopes[1].key);
});

test('late A save cannot flush queued A changes after switching to B', async () => {
  const scopes = [];
  const auth = createAccountSessionController(scope => scopes.push(scope));
  auth.accept({ id: 'A' });
  const a = scopes.at(-1);
  const first = deferred();
  const calls = [];
  const queueA = createAccountWriteQueue(() => a.active, (id, value) => {
    calls.push([a.user.id, id, value]);
    return first.promise;
  }, () => assert.fail('inactive account must not report errors'));
  queueA.enqueue('shared-id', 1);
  queueA.enqueue('shared-id', 2);
  auth.accept({ id: 'B' });
  const b = scopes.at(-1);
  const queueB = createAccountWriteQueue(() => b.active, async (id, value) => {
    calls.push([b.user.id, id, value]);
  }, assert.fail);
  queueB.enqueue('shared-id', 3);
  first.resolve({});
  await tick();
  queueA.enqueue('shared-id', 4);
  await queueA.flushAll();
  assert.deepEqual(calls, [['A','shared-id',1], ['B','shared-id',3]]);
});

test('queue coalesces changes and never starts concurrent writes for one habit', async () => {
  const first = deferred();
  const values = [];
  const queue = createAccountWriteQueue(() => true, async (_id, value) => {
    values.push(value);
    if (value === 1) await first.promise;
  }, assert.fail);
  queue.enqueue('h', 1);
  queue.enqueue('h', 2);
  queue.enqueue('h', 3);
  assert.deepEqual(values, [1]);
  first.resolve();
  await tick();
  assert.deepEqual(values, [1,3]);
  assert.equal(await queue.flushAll(), true);
});

for (const throws of [false,true]) {
  test(`failed write stops, retains latest change and allows explicit retry (throws=${throws})`, async () => {
    let calls = 0;
    let errors = 0;
    let fails = true;
    const queue = createAccountWriteQueue(() => true, async () => {
      calls++;
      if (fails && throws) throw new Error('offline');
      return fails ? { error: 'offline' } : {};
    }, () => errors++);
    queue.enqueue('h', { today: true });
    await tick();
    await tick();
    assert.equal(calls, 1);
    assert.equal(errors, 1);
    fails = false;
    assert.equal(await queue.flushAll(), true);
    assert.equal(calls, 2);
  });
}
