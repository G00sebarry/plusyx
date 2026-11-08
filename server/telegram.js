import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Server-only helpers. Never import this module from browser components.
export function authorizeSecret(req, res, expected, headerName, prefix = '') {
  if (typeof expected !== 'string' || !expected.trim()) {
    res.status(503).json({ error: 'Endpoint is not configured' });
    return false;
  }
  const supplied = req.headers?.[headerName];
  const wanted = Buffer.from(prefix + expected);
  const actual = typeof supplied === 'string' ? Buffer.from(supplied) : Buffer.alloc(0);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

export function requireMethod(req, res, method) {
  if (req.method === method) return true;
  res.setHeader('Allow', method);
  res.status(405).json({ error: 'Method not allowed' });
  return false;
}

export function serverDatabase(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    throw new Error('Database is not configured');
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

export function escapeTelegramHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function createTelegramTransport(env, fetchImpl) {
  return async (method, body) => {
    if (!env.TELEGRAM_BOT_TOKEN) throw new Error('Telegram is not configured');
    // No automatic retry: a timeout can mean Telegram accepted the message.
    try {
      const response = await fetchImpl(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000)
      });
      const result = await response.json();
      if (!response.ok || result?.ok !== true) throw new Error('Telegram rejected request');
      return result.result;
    } catch {
      // Fetch errors may include the bot token in a URL. Never propagate them.
      throw new Error('Telegram request failed');
    }
  };
}

export function isPrivateSender(message, sender) {
  return message?.chat?.type === 'private'
    && Number.isSafeInteger(message.chat.id) && message.chat.id > 0
    && Number.isSafeInteger(sender?.id) && sender.id === message.chat.id
    && sender.is_bot !== true;
}
