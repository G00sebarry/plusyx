import { authorizeSecret, requireMethod, serverDatabase, createTelegramTransport } from '../server/telegram.js';

export function createNotificationHandler({ env = process.env, db, fetchImpl = globalThis.fetch } = {}) {
  const telegram = createTelegramTransport(env, fetchImpl);
  return async function handler(req, res) {
    if (!requireMethod(req, res, 'POST')) return;
    // This legacy endpoint has no browser caller. Keep it server-only until
    // Telegram binding policies and abuse controls are secured separately.
    if (!authorizeSecret(req, res, env.INTERNAL_NOTIFICATION_SECRET, 'x-plusyx-internal-secret')) return;
    const auth = req.headers?.authorization;
    const match = typeof auth === 'string' && /^Bearer (\S+)$/.exec(auth);
    if (!match) return res.status(401).json({ error: 'Unauthorized' });
    const text = req.body?.text;
    if (typeof text !== 'string' || !text.trim() || text.length > 4096) {
      return res.status(400).json({ error: 'Invalid message' });
    }
    try {
      const supabase = db ?? serverDatabase(env);
      // Validate the token with Auth; never trust user_id from the request body.
      const { data, error } = await supabase.auth.getUser(match[1]);
      if (error || !data?.user) return res.status(401).json({ error: 'Unauthorized' });
      const { data: link, error: linkError } = await supabase.from('telegram_links')
        .select('chat_id').eq('user_id', data.user.id).maybeSingle();
      if (linkError) throw new Error('Link lookup failed');
      if (!link) return res.status(404).json({ error: 'Telegram is not connected' });
      if (req.body.chat_id != null && String(req.body.chat_id) !== String(link.chat_id)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      await telegram('sendMessage', { chat_id: link.chat_id, text });
      // Telegram's raw response includes chat/user metadata; don't return it.
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(502).json({ error: 'Notification could not be sent' });
    }
  };
}

export default createNotificationHandler();
