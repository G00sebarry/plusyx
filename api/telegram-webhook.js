const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendMessage(chatId, text, extra) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...extra
    })
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const update = req.body;
    
    if (!update.message) {
      return res.status(200).json({ ok: true });
    }

    const message = update.message;
    const chatId = message.chat.id;
    const text = message.text || '';
    const username = message.from?.username || null;
    const firstName = message.from?.first_name || 'друг';

    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      const userId = parts[1];

      if (userId) {
        const { error } = await supabase
          .from('telegram_links')
          .upsert({
            user_id: userId,
            chat_id: chatId.toString(),
            username: username
          }, { onConflict: 'user_id' });

        if (error) {
          console.error('Error saving telegram link:', error);
          await sendMessage(chatId, '❌ Ошибка подключения. Попробуй ещё раз.');
        } else {
          await sendMessage(chatId, 
            '✅ <b>Telegram подключён!</b>\n\n' +
            `Привет, ${firstName}! 👋\n\n` +
            'Теперь ты будешь получать напоминания о привычках прямо сюда.\n\n' +
            '💡 <i>«Каждое действие — это голос за тот тип человека, которым вы хотите стать»</i>\n' +
            '— Джеймс Клир',
            {
              reply_markup: {
                inline_keyboard: [[
                  { text: '📱 Открыть PLUSYX', web_app: { url: 'https://plusyx.ru' } }
                ]]
              }
            }
          );
        }
      } else {
        await sendMessage(chatId,
          `👋 <b>Привет, ${firstName}!</b>\n\n` +
          'Я бот приложения <b>PLUSYX</b> — твой помощник в формировании привычек.\n\n' +
          '📱 Открой приложение, чтобы начать:',
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '🚀 Открыть PLUSYX', web_app: { url: 'https://plusyx.ru' } }
              ]]
            }
          }
        );
      }
    }

    return res.status(200).json({ ok: true });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
