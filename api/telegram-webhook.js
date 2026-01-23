import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    })
  });
}

async function answerCallback(callbackId, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackId,
      text: text,
      show_alert: false
    })
  });
}

async function editMessage(chatId, messageId, newText) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: newText,
      parse_mode: 'HTML'
    })
  });
}

function getMoscowDate() {
  const now = new Date();
  const moscow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  const year = moscow.getFullYear();
  const month = (moscow.getMonth() + 1).toString().padStart(2, '0');
  const day = moscow.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ message: 'Telegram webhook endpoint' });
  }

  try {
    const update = req.body;

    // ========== ОБРАБОТКА КНОПОК ==========
    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;
      const data = callback.data;
      
      const [action, habitId] = data.split('_');
      const today = getMoscowDate();
      
      // Получаем user_id по chat_id
      const { data: link } = await supabase
        .from('telegram_links')
        .select('user_id')
        .eq('chat_id', chatId.toString())
        .single();
      
      if (!link) {
        await answerCallback(callback.id, '❌ Аккаунт не привязан');
        return res.status(200).json({ ok: true });
      }

      // Получаем привычку с текущим history
      const { data: habit } = await supabase
        .from('habits')
        .select('id, title, emoji, history')
        .eq('id', habitId)
        .single();

      if (!habit) {
        await answerCallback(callback.id, '❌ Привычка не найдена');
        return res.status(200).json({ ok: true });
      }

      // Проверяем, не отмечено ли уже сегодня
      const currentHistory = habit.history || {};
      if (currentHistory[today]) {
        await answerCallback(callback.id, '⚠️ Уже отмечено сегодня!');
        return res.status(200).json({ ok: true });
      }

      // Определяем значение и ответ
      let value, responseText, statusEmoji;
      
      if (action === 'done') {
        value = true;
        responseText = '✅ Отлично! Привычка выполнена!';
        statusEmoji = '✅';
      } else if (action === 'mini') {
        value = 'mini';
        responseText = '🔸 Мини-версия засчитана!';
        statusEmoji = '🔸';
      } else if (action === 'freeze') {
  value = 'freeze';  // ← ПРАВИЛЬНО
        responseText = '❄️ Заморозка активирована';
        statusEmoji = '❄️';
      } else {
        await answerCallback(callback.id, '❌ Неизвестное действие');
        return res.status(200).json({ ok: true });
      }

      // Обновляем history
      const newHistory = { ...currentHistory, [today]: value };

      const { error } = await supabase
        .from('habits')
        .update({ history: newHistory })
        .eq('id', habitId);

      if (error) {
        console.error('Update error:', error);
        await answerCallback(callback.id, '❌ ' + error.message);
        return res.status(200).json({ ok: true });
      }

      // Отвечаем на callback
      await answerCallback(callback.id, responseText);

      // Обновляем сообщение (убираем кнопки)
      const habitEmoji = habit.emoji || '🔔';
      const newText = `${habitEmoji} <b>${habit.title}</b>\n\n${statusEmoji} <i>${responseText}</i>`;
      await editMessage(chatId, messageId, newText);

      return res.status(200).json({ ok: true });
    }

    // ========== ОБРАБОТКА КОМАНДЫ /start ==========
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;

      if (text.startsWith('/start')) {
        const parts = text.split(' ');
        
        if (parts.length > 1) {
          const token = parts[1];
          
          const { data: pending } = await supabase
            .from('telegram_pending')
            .select('user_id')
            .eq('token', token)
            .single();
          
          if (pending) {
            await supabase
              .from('telegram_links')
              .upsert({
                user_id: pending.user_id,
                chat_id: chatId.toString(),
                username: update.message.from?.username || null,
                linked_at: new Date().toISOString()
              }, { onConflict: 'user_id' });
            
            await supabase
              .from('telegram_pending')
              .delete()
              .eq('token', token);
            
            await sendMessage(chatId, 
              '✅ Telegram успешно подключён!\n\nТеперь вы будете получать напоминания о привычках и задачах.'
            );
          } else {
            await sendMessage(chatId, '❌ Ссылка недействительна или устарела.');
          }
        } else {
          await sendMessage(chatId, 
            '👋 Привет! Это бот Plusyx.\n\nДля подключения уведомлений перейдите в настройки приложения Plusyx.'
          );
        }
      }
    }

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(200).json({ ok: true });
  }
}
