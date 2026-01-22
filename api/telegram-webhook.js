// api/telegram-webhook.js

export default async function handler(req, res) {
  // Для GET запросов — просто показываем статус (для проверки)
  if (req.method === 'GET') {
    return res.status(200).json({
      status: "ok",
      message: "Telegram webhook endpoint",
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
      hasBotToken: !!process.env.TELEGRAM_BOT_TOKEN
    });
  }

  // Для POST — обработка webhook от Telegram (добавим позже)
  if (req.method === 'POST') {
    try {
      const update = req.body;
      
      // Пока просто логируем что пришло
      console.log('Telegram update:', JSON.stringify(update));
      
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Webhook error:', error);
      return res.status(200).json({ ok: true }); // Telegram требует 200
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
