import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Supabase клиент
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // ← Нужен SERVICE KEY (не anon!)
);

// Telegram Bot Token
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

// Отправка сообщения в Telegram
async function sendMessage(chatId: string | number, text: string, extra?: any) {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const update = req.body;
    
    // Обрабатываем только сообщения
    if (!update.message) {
      return res.status(200).json({ ok: true });
    }

    const message = update.message;
    const chatId = message.chat.id;
    const text = message.text || '';
    const username = message.from?.username || null;
    const firstName = message.from?.first_name || 'друг';

    // Команда /start с параметром (user_id)
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      const userId = parts[1]; // user_id из ссылки

      if (userId) {
        // Сохраняем связку user_id <-> chat_id
        const { error } = await supabase
          .from('telegram_links')
          .upsert({
            user_id: userId,
            chat_id: chatId.toString(),
            username: username
          }, { onConflict: 'user_id' });

        if (error) {
          console.error('Error saving telegram link:', error);
          await sendMessage(chatId, `❌ Ошибка подключения. Попробуй ещё раз.`);
        } else {
          await sendMessage(chatId, 
            `✅ <b>Telegram подключён!</b>\n\n` +
            `Привет, ${firstName}! 👋\n\n` +
            `Теперь ты будешь получать напоминания о привычках прямо сюда.\n\n` +
            `💡 <i>«Каждое действие — это голос за тот тип человека, которым вы хотите стать»</i>\n` +
            `— Джеймс Клир\n\n` +
            `Вернись в приложение и настрой время напоминаний! 🚀`,
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
        // Просто /start без параметра
        await sendMessage(chatId,
          `👋 <b>Привет, ${firstName}!</b>\n\n` +
          `Я бот приложения <b>PLUSYX</b> — твой помощник в формировании привычек.\n\n` +
          `🔔 Я буду напоминать тебе о привычках в нужное время.\n\n` +
          `📱 Открой приложение, чтобы начать:`,
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

    // Команда /help
    else if (text === '/help') {
      await sendMessage(chatId,
        `📚 <b>Помощь</b>\n\n` +
        `<b>PLUSYX</b> — приложение для формирования привычек по методу атомных привычек Джеймса Клира.\n\n` +
        `🔔 <b>Напоминания:</b>\n` +
        `Настрой время в приложении, и я напомню тебе о каждой привычке.\n\n` +
        `⚛️ <b>Атомные привычки:</b>\n` +
        `• Определи свою личность (кем хочешь стать)\n` +
        `• Привяжи к триггеру (после чего делать)\n` +
        `• Создай План Б (минимальное действие)\n\n` +
        `💡 <i>«Вам не нужна мотивация, вам нужна система»</i>`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '📱 Открыть приложение', web_app: { url: 'https://plusyx.ru' } }
            ]]
          }
        }
      );
    }

    // Любое другое сообщение
    else {
      await sendMessage(chatId,
        `🤖 Я понимаю только команды.\n\n` +
        `Используй /help для справки или открой приложение:`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '📱 Открыть PLUSYX', web_app: { url: 'https://plusyx.ru' } }
            ]]
          }
        }
      );
    }

    return res.status(200).json({ ok: true });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
