// api/telegram-webhook.js

export default async function handler(req, res) {
  // Разрешаем CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS запрос (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET — проверка статуса
  if (req.method === 'GET') {
    return res.status(200).json({
      status: "ok",
      message: "Telegram webhook endpoint",
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
      hasBotToken: !!process.env.TELEGRAM_BOT_TOKEN
    });
  }

  // POST — webhook от Telegram
  if (req.method === 'POST') {
    try {
      const update = req.body;
      console.log('Telegram update:', JSON.stringify(update));
      
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Webhook error:', error);
      return res.status(200).json({ ok: true });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
