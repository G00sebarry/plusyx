// api/telegram-webhook.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Отправка сообщения в Telegram
async function sendMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    })
  });
}

export default async function handler(req, res) {
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

      const message = update.message;
      if (!message) {
        return res.status(200).json({ ok: true });
      }

      const chatId = message.chat.id;
      const text = message.text || '';
      const username = message.from?.username || '';

      // Обработка команды /start с USER_ID
      if (text.startsWith('/start ')) {
        const userId = text.replace('/start ', '').trim();
        
        if (userId && userId.length > 10) {
          // Проверяем существует ли пользователь
          const { data: user } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .single();

          if (user) {
            // Удаляем старую связку если есть
            await supabase
              .from('telegram_links')
              .delete()
              .eq('user_id', userId);

            // Создаём новую связку
            const { error } = await supabase
              .from('telegram_links')
              .insert({
                user_id: userId,
                chat_id: chatId.toString(),
                username: username
              });

            if (!error) {
              await sendMessage(chatId, '✅ <b>Telegram успешно подключён!</b>\n\nТеперь вы будете получать напоминания о задачах и привычках.');
            } else {
              console.error('DB error:', error);
              await sendMessage(chatId, '❌ Ошибка подключения. Попробуйте ещё раз.');
            }
          } else {
            await sendMessage(chatId, '❌ Пользователь не найден. Попробуйте заново из приложения.');
          }
        }
      } 
      // Просто /start без параметра
      else if (text === '/start') {
        await sendMessage(chatId, '👋 <b>Привет!</b>\n\nЧтобы подключить уведомления, нажмите кнопку "Подключить Telegram" в приложении Plusyx.');
      }

      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Webhook error:', error);
      return res.status(200).json({ ok: true });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
