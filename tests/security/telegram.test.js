import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebhookHandler } from '../../api/telegram-webhook.js';
import { createRemindersHandler } from '../../api/cron/send-reminders.js';
import { createNotificationHandler } from '../../api/send-notification.js';
import { createTelegramTransport } from '../../server/telegram.js';

// No .env files, real tokens, or production URLs are used by this suite.
globalThis.fetch = async () => { throw new Error('Real network is disabled in security tests'); };
const env = { TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret', CRON_SECRET: 'test-cron-secret', TELEGRAM_BOT_TOKEN: 'test-bot-token', INTERNAL_NOTIFICATION_SECRET: 'test-internal-secret' };
const date = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' });

function response() {
  return { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function database(initial = {}, failures = {}) {
  const rows = structuredClone(initial);
  const calls = [];
  const db = {
    rows, calls, authTokens: [],
    auth: { async getUser(token) {
      db.authTokens.push(token);
      return token === 'valid-user-b' ? { data: { user: { id: 'user-b' } }, error: null }
        : { data: { user: null }, error: { message: 'Invalid token' } };
    } },
    from(table) {
      const filters = [];
      let action = 'select', payload, maximum = Infinity, sort;
      const q = {
        select() { return q; },
        eq(k, v) { filters.push([k, 'eq', v]); return q; },
        neq(k, v) { filters.push([k, 'neq', v]); return q; },
        is(k, v) { filters.push([k, 'is', v]); return q; },
        order(k) { sort = k; return q; },
        limit(n) { maximum = n; return q; },
        insert(v) { action = 'insert'; payload = v; return q; },
        upsert(v) { action = 'upsert'; payload = v; return q; },
        update(v) { action = 'update'; payload = v; return q; },
        delete() { action = 'delete'; return q; },
        single() { return execute(true); },
        maybeSingle() { return execute(true); },
        then(resolve, reject) { return execute(false).then(resolve, reject); }
      };
      async function execute(single) {
        calls.push({ table, action, filters: structuredClone(filters), payload: structuredClone(payload) });
        const failure = failures[`${table}:${action}`];
        if (failure) return { data: null, error: { message: failure } };
        rows[table] ??= [];
        let found = rows[table].filter(row => filters.every(([k, op, v]) =>
          op === 'is' ? (row[k] ?? null) === v : op === 'neq' ? row[k] !== v : row[k] === v));
        if (sort) found.sort((a, b) => (a[sort] ?? 0) - (b[sort] ?? 0));
        found = found.slice(0, maximum);
        if (action === 'insert') { found = [structuredClone(payload)]; rows[table].push(...found); }
        if (action === 'upsert') {
          const existing = rows[table].find(r => r.user_id === payload.user_id);
          if (existing) { Object.assign(existing, structuredClone(payload)); found = [existing]; }
          else { found = [structuredClone(payload)]; rows[table].push(...found); }
        }
        if (action === 'update') found.forEach(row => Object.assign(row, structuredClone(payload)));
        if (action === 'delete') rows[table] = rows[table].filter(row => !found.includes(row));
        if (single && found.length > 1) return { data: null, error: { message: 'Multiple rows' } };
        return { data: structuredClone(single ? found[0] ?? null : found), error: null };
      }
      return q;
    }
  };
  return db;
}

function transport({ fail = false } = {}) {
  const calls = [];
  return { calls, fetchImpl: async (url, options) => {
    assert.ok(url.startsWith('https://api.telegram.org/bottest-bot-token/'));
    calls.push({ method: url.split('/').at(-1), body: JSON.parse(options.body) });
    return { ok: !fail, json: async () => fail ? { ok: false, description: 'private upstream detail' }
      : { ok: true, result: { message_id: 123, chat: { id: 202 } } } };
  } };
}

function callback(action = 'done', habitId = 'habit_b') {
  return { update_id: 100, callback_query: { id: 'callback-1', from: { id: 202, is_bot: false },
    message: { message_id: 10, chat: { id: 202, type: 'private' } }, data: `${action}_${habitId}` } };
}
function message(text = 'Test Inbox item') {
  return { update_id: 101, message: { message_id: 11, from: { id: 202, is_bot: false },
    chat: { id: 202, type: 'private' }, text } };
}
const webhookReq = body => ({ method: 'POST', headers: { 'x-telegram-bot-api-secret-token': env.TELEGRAM_WEBHOOK_SECRET }, body });
const link = { user_id: 'user-b', chat_id: '202' };
const habit = { id: 'habit_b', user_id: 'user-b', title: 'Study <one> & two', history: {}, archived_at: null };

for (const [name, secret, header, status] of [
  ['missing header', env.TELEGRAM_WEBHOOK_SECRET, undefined, 401],
  ['wrong secret', env.TELEGRAM_WEBHOOK_SECRET, 'incorrect', 401],
  ['multiple headers', env.TELEGRAM_WEBHOOK_SECRET, [env.TELEGRAM_WEBHOOK_SECRET], 401],
  ['missing configuration', undefined, 'anything', 503]
]) test(`webhook rejects ${name} before touching database or Telegram`, async () => {
  const db = database(); const net = transport(); const res = response();
  await createWebhookHandler({ env: { ...env, TELEGRAM_WEBHOOK_SECRET: secret }, db, ...net })({
    ...webhookReq(callback()), headers: { 'x-telegram-bot-api-secret-token': header }
  }, res);
  assert.equal(res.statusCode, status); assert.equal(db.calls.length, 0); assert.equal(net.calls.length, 0);
});

test('webhook rejects invalid method and malformed body', async () => {
  const db = database(); const net = transport(); const handler = createWebhookHandler({ env, db, ...net });
  for (const [req, code] of [[{ method: 'GET' }, 405], [webhookReq(null), 400], [webhookReq({}), 400]]) {
    const res = response(); await handler(req, res); assert.equal(res.statusCode, code);
  }
  assert.equal(db.calls.length, 0); assert.equal(net.calls.length, 0);
});

for (const [action, expected] of [['done', true], ['mini', 'mini'], ['freeze', 'freeze']]) {
  test(`habit button ${action} still works, scopes writes, and escapes HTML`, async () => {
    const db = database({ telegram_links: [link], habits: [habit] }); const net = transport(); const res = response();
    await createWebhookHandler({ env, db, ...net })(webhookReq(callback(action)), res);
    assert.equal(res.statusCode, 200); assert.equal(db.rows.habits[0].history[date()], expected);
    const write = db.calls.find(c => c.action === 'update');
    assert.ok(write.filters.some(f => f[0] === 'user_id' && f[2] === 'user-b'));
    assert.ok(write.filters.some(f => f[0] === 'archived_at' && f[2] === null));
    assert.deepEqual(net.calls.map(c => c.method), ['answerCallbackQuery', 'editMessageText']);
    assert.match(net.calls[1].body.text, /Study &lt;one&gt; &amp; two/);
  });
}

for (const kind of ['foreign', 'archived', 'already done']) test(`callback cannot modify ${kind} habit`, async () => {
  const changed = { ...habit, ...(kind === 'foreign' ? { user_id: 'user-a' }
    : kind === 'archived' ? { archived_at: '2026-01-01' } : { history: { [date()]: true } }) };
  const db = database({ telegram_links: [link], habits: [changed] }); const net = transport(); const res = response();
  await createWebhookHandler({ env, db, ...net })(webhookReq(callback()), res);
  assert.equal(res.statusCode, 200);
  assert.equal(db.calls.filter(c => c.action === 'update').length, 0);
  assert.equal(net.calls.length, 1);
  assert.ok(!net.calls[0].body.text.includes(habit.title));
});

test('callbacks/messages from groups or another sender cannot act for private chat owner', async () => {
  const db = database({ telegram_links: [link], habits: [habit] }); const net = transport();
  const badCallback = callback(); badCallback.callback_query.from.id = 303;
  const groupMessage = message(); groupMessage.message.chat.type = 'group';
  for (const update of [badCallback, groupMessage]) {
    const res = response(); await createWebhookHandler({ env, db, ...net })(webhookReq(update), res);
    assert.equal(res.statusCode, 200);
  }
  assert.equal(db.calls.length, 0); assert.equal(net.calls.length, 0);
});

test('Inbox appends a checklist item without losing existing items', async () => {
  const original = { id: 'old', text: 'Existing item', completed: true };
  const db = database({ telegram_links: [link], tasks: [{ id: 'inbox-b', user_id: 'user-b', is_inbox: true,
    archived_at: null, checklists: [{ id: 'list-b', items: [original] }] }] });
  const net = transport(); const res = response();
  await createWebhookHandler({ env, db, ...net })(webhookReq(message()), res);
  const items = db.rows.tasks[0].checklists[0].items;
  assert.equal(items.length, 2); assert.deepEqual(items[0], original);
  assert.equal(items[1].text, 'Test Inbox item'); assert.equal(items[1].completed, false);
  assert.ok(db.calls.find(c => c.action === 'update').filters.some(f => f[0] === 'user_id' && f[2] === 'user-b'));
  assert.equal(net.calls[0].body.chat_id, 202);
});

test('Inbox creation preserves column/workspace and inserts into the same new task', async () => {
  const db = database({ telegram_links: [link], columns: [
    { id: 'col-b', user_id: 'user-b', type: 'todo', position: 0, workspace_id: 'workspace-b' }
  ] }); const net = transport(); const res = response();
  await createWebhookHandler({ env, db, ...net })(webhookReq(message()), res);
  assert.equal(db.rows.tasks.length, 1);
  assert.equal(db.rows.tasks[0].user_id, 'user-b'); assert.equal(db.rows.tasks[0].columnId, 'col-b');
  assert.equal(db.rows.tasks[0].workspace_id, 'workspace-b');
  assert.equal(db.rows.tasks[0].checklists[0].items[0].text, 'Test Inbox item');
});

test('failed Inbox lookup does not create a replacement task', async () => {
  const db = database({ telegram_links: [link] }, { 'tasks:select': 'private database detail' });
  const net = transport(); const res = response();
  await createWebhookHandler({ env, db, ...net })(webhookReq(message()), res);
  assert.equal(db.calls.filter(c => c.action !== 'select').length, 0);
  assert.equal(net.calls.length, 0); assert.ok(!JSON.stringify(res.body).includes('private'));
});

for (const expires_at of [null, 'not-a-date', '2000-01-01T00:00:00Z']) test(`expired/invalid binding expiry ${expires_at} cannot bind`, async () => {
  const db = database({ telegram_pending: [{ token: 'synthetic-token', user_id: 'user-b', expires_at }] });
  const net = transport(); const res = response();
  await createWebhookHandler({ env, db, ...net })(webhookReq(message('/start synthetic-token')), res);
  assert.equal(db.calls.filter(c => c.table === 'telegram_links').length, 0);
  assert.equal(net.calls.length, 1);
});

test('valid binding preserves other users and consumes only the used token', async () => {
  const db = database({ telegram_pending: [{ token: 'synthetic-token', user_id: 'user-b', expires_at: '2099-01-01' }],
    telegram_links: [{ user_id: 'user-a', chat_id: '101' }] }); const net = transport(); const res = response();
  await createWebhookHandler({ env, db, ...net })(webhookReq(message('/start synthetic-token')), res);
  assert.equal(db.rows.telegram_links.length, 2); assert.equal(db.rows.telegram_links[0].chat_id, '101');
  assert.equal(db.rows.telegram_links[1].chat_id, '202'); assert.equal(db.rows.telegram_pending.length, 0);
  assert.match(net.calls[0].body.text, /успешно подключён/);
});

test('failed binding does not consume token or report success', async () => {
  const db = database({ telegram_pending: [{ token: 'synthetic-token', user_id: 'user-b', expires_at: '2099-01-01' }] },
    { 'telegram_links:upsert': 'private error' }); const net = transport(); const res = response();
  await createWebhookHandler({ env, db, ...net })(webhookReq(message('/start synthetic-token')), res);
  assert.equal(db.rows.telegram_pending.length, 1); assert.equal(net.calls.length, 0);
});

test('cron denies absent/wrong authentication before database work', async () => {
  const db = database(); const net = transport();
  for (const [secret, header, status] of [[env.CRON_SECRET, undefined, 401], [env.CRON_SECRET, 'Bearer wrong', 401], [undefined, 'Bearer anything', 503]]) {
    const res = response();
    await createRemindersHandler({ env: { ...env, CRON_SECRET: secret }, db, ...net })(
      { method: 'GET', headers: { authorization: header } }, res);
    assert.equal(res.statusCode, status);
  }
  assert.equal(db.calls.length, 0); assert.equal(net.calls.length, 0);
});

function reminderFixture() {
  return database({ telegram_links: [link], habit_quotes: [{ level: 'beginner', text: 'Go <slow>' }],
    habits: [{ ...habit, reminder_enabled: true, reminder_time: '12:00', frequency: { days: [2] }, trigger_event: 'After <tea>' },
      { ...habit, id: 'archived', reminder_enabled: true, reminder_time: '12:00', archived_at: '2026-01-01' }],
    tasks: [{ id: 'task-b', title: 'Read <notes>', user_id: 'user-b', date: '2026-11-03', time: '12:00', isTimer: true, status: 'todo', archived_at: null },
      { id: 'done-task', user_id: 'user-b', date: '2026-11-03', time: '12:00', isTimer: true, status: 'done', archived_at: null }]
  });
}
const cronReq = { method: 'GET', headers: { authorization: `Bearer ${env.CRON_SECRET}` } };
const now = () => new Date('2026-11-03T09:00:00Z');

test('cron preserves atomic habit buttons, trigger, quote and task reminders', async () => {
  const db = reminderFixture(); const net = transport(); const res = response();
  await createRemindersHandler({ env, db, ...net, now })(cronReq, res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.sent, 2); assert.equal(net.calls.length, 2);
  assert.match(net.calls[0].body.text, /After &lt;tea&gt;/); assert.match(net.calls[0].body.text, /Go &lt;slow&gt;/);
  assert.deepEqual(net.calls[0].body.reply_markup.inline_keyboard[0].map(b => b.callback_data),
    ['done_habit_b', 'mini_habit_b', 'freeze_habit_b']);
  assert.match(net.calls[1].body.text, /Read &lt;notes&gt;/);
  assert.ok(net.calls.every(c => c.body.chat_id === '202'));
});

test('cron reports delivery failure without leaking Telegram details or retrying', async () => {
  const net = transport({ fail: true }); const res = response();
  await createRemindersHandler({ env, db: reminderFixture(), ...net, now })(cronReq, res);
  assert.equal(res.statusCode, 502); assert.equal(net.calls.length, 1);
  assert.ok(!JSON.stringify(res.body).includes('private'));
});

test('notification requires a verified user token, and rejects foreign destination', async () => {
  const db = database({ telegram_links: [link] }); const net = transport();
  const handler = createNotificationHandler({ env, db, ...net });
  for (const [auth, chat, status] of [[undefined, '202', 401], ['Bearer invalid', '202', 401], ['Bearer valid-user-b', '101', 403]]) {
    const res = response(); await handler({ method: 'POST', headers: { authorization: auth, 'x-plusyx-internal-secret': env.INTERNAL_NOTIFICATION_SECRET }, body: { text: 'Test', chat_id: chat } }, res);
    assert.equal(res.statusCode, status);
  }
  assert.equal(net.calls.length, 0);
});

test('notification derives recipient from verified account and returns no chat metadata', async () => {
  const db = database({ telegram_links: [link] }); const net = transport(); const res = response();
  await createNotificationHandler({ env, db, ...net })({ method: 'POST', headers: { authorization: 'Bearer valid-user-b', 'x-plusyx-internal-secret': env.INTERNAL_NOTIFICATION_SECRET },
    body: { text: 'Test', user_id: 'user-a' } }, res);
  assert.equal(net.calls[0].body.chat_id, '202'); assert.deepEqual(res.body, { ok: true });
  assert.deepEqual(db.authTokens, ['valid-user-b']);
});

test('Telegram transport hides network exception containing bot token', async () => {
  let calls = 0;
  const send = createTelegramTransport(env, async () => { calls++; throw new Error('https://api.telegram.org/bottest-bot-token/private'); });
  await assert.rejects(send('sendMessage', {}), { message: 'Telegram request failed' });
  assert.equal(calls, 1);
});

test('notification stays closed without server secret even for a valid user', async () => {
  const db = database({ telegram_links: [link] }); const net = transport();
  for (const [config, supplied, status] of [[env, undefined, 401], [env, 'wrong', 401], [{ ...env, INTERNAL_NOTIFICATION_SECRET: undefined }, 'anything', 503]]) {
    const res = response();
    await createNotificationHandler({ env: config, db, ...net })({ method: 'POST',
      headers: { authorization: 'Bearer valid-user-b', 'x-plusyx-internal-secret': supplied }, body: { text: 'Test' } }, res);
    assert.equal(res.statusCode, status);
  }
  assert.equal(db.authTokens.length, 0); assert.equal(db.calls.length, 0); assert.equal(net.calls.length, 0);
});

test('missing optional quote does not stop habit and task reminders', async () => {
  const db = database(reminderFixture().rows, { 'habit_quotes:select': 'database error' });
  const net = transport(); const res = response();
  await createRemindersHandler({ env, db, ...net, now })(cronReq, res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.sent, 2);
  assert.match(net.calls[0].body.text, /After &lt;tea&gt;/);
  assert.ok(!net.calls[0].body.text.includes('💬'));
});

test('failed habit write never sends a success acknowledgement', async () => {
  const db = database({ telegram_links: [link], habits: [habit] }, { 'habits:update': 'private SQL detail' });
  const net = transport(); const res = response();
  await createWebhookHandler({ env, db, ...net })(webhookReq(callback()), res);
  assert.deepEqual(db.rows.habits[0].history, {});
  assert.equal(net.calls.length, 1); assert.match(net.calls[0].body.text, /Не удалось сохранить/);
  assert.ok(!JSON.stringify(net.calls).includes('private SQL detail'));
});

test('failed Inbox write never reports that message was captured', async () => {
  const db = database({ telegram_links: [link], tasks: [{ id: 'inbox-b', user_id: 'user-b',
    is_inbox: true, archived_at: null, checklists: [] }] }, { 'tasks:update': 'private detail' });
  const net = transport(); const res = response();
  await createWebhookHandler({ env, db, ...net })(webhookReq(message()), res);
  assert.deepEqual(db.rows.tasks[0].checklists, []);
  assert.equal(net.calls.length, 1); assert.match(net.calls[0].body.text, /пошло не так/);
});

test('deleted or archived Inbox between read and write is not acknowledged as saved', async () => {
  const db = database({ telegram_links: [link], tasks: [{ id: 'inbox-b', user_id: 'user-b',
    is_inbox: true, archived_at: null, checklists: [] }] });
  const from = db.from.bind(db);
  db.from = table => {
    if (table === 'tasks' && db.calls.some(c => c.table === 'tasks')) db.rows.tasks[0].archived_at = '2026-01-01';
    return from(table);
  };
  const net = transport(); const res = response();
  await createWebhookHandler({ env, db, ...net })(webhookReq(message()), res);
  assert.deepEqual(db.rows.tasks[0].checklists, []);
  assert.match(net.calls[0].body.text, /пошло не так/);
});

test('cron database failure is not reported as an empty successful run', async () => {
  const db = database({}, { 'telegram_links:select': 'private detail' }); const net = transport(); const res = response();
  await createRemindersHandler({ env, db, ...net, now })(cronReq, res);
  assert.equal(res.statusCode, 502); assert.equal(net.calls.length, 0);
});

test('cron refuses other methods', async () => {
  const db = database(); const net = transport(); const res = response();
  await createRemindersHandler({ env, db, ...net, now })({ ...cronReq, method: 'POST' }, res);
  assert.equal(res.statusCode, 405); assert.equal(res.headers.Allow, 'GET'); assert.equal(db.calls.length, 0);
});
