import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Получаем рандомную цитату
async function getRandomQuote() {
  const { data: quotes } = await supabase
    .from('habit_quotes')
    .select('text, author');
  
  if (quotes && quotes.length > 0) {
    const randomIndex = Math.floor(Math.random() * quotes.length);
    return quotes[randomIndex];
  }
  return null;
}

async function sendTelegramMessage(chatId, text, buttons = null) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  
  const body = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML'
  };
  
  if (buttons) {
    body.reply_markup = {
      inline_keyboard: buttons
    };
  }
  
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

// Получаем московское время и дату
function getMoscowDateTime() {
  const now = new Date();
  const moscowTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  
  const hours = moscowTime.getHours().toString().padStart(2, '0');
  const minutes = moscowTime.getMinutes().toString().padStart(2, '0');
  const dayOfWeek = moscowTime.getDay();
  
  const year = moscowTime.getFullYear();
  const month = (moscowTime.getMonth() + 1).toString().padStart(2, '0');
  const day = moscowTime.getDate().toString().padStart(2, '0');
  const date = `${year}-${month}-${day}`;
  
  return { time: `${hours}:${minutes}`, day: dayOfWeek, date: date };
}

export default async function handler(req, res) {
  try {
    const { time: currentTime, day: currentDay, date: currentDate } = getMoscowDateTime();

    const { data: links } = await supabase
      .from('telegram_links')
      .select('user_id, chat_id');

    if (!links || links.length === 0) {
      return res.status(200).json({ message: 'No telegram links', time: currentTime });
    }

    let sentCount = 0;

    for (const link of links) {
      // ========== ПРИВЫЧКИ ==========
      const { data: habits } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', link.user_id)
        .eq('reminder_time', currentTime)
        .eq('reminder_enabled', true)
        .is('archived_at', null);

      if (habits && habits.length > 0) {
        for (const habit of habits) {
          // Проверяем день недели
          let frequency = habit.frequency;
          if (typeof frequency === 'string') {
            try { frequency = JSON.parse(frequency); } 
            catch (e) { frequency = { days: [0,1,2,3,4,5,6] }; }
          }
          
          const days = frequency?.days || [0,1,2,3,4,5,6];
          
          if (days.includes(currentDay)) {
            // Получаем рандомную цитату
            const quote = await getRandomQuote();
            
            const emoji = habit.emoji || '🔔';
            let message = `${emoji} <b>${habit.title}</b>\n\n`;
            
            // Добавляем триггер если есть
            if (habit.trigger) {
              message += `🎯 <i>${habit.trigger}</i>\n\n`;
            }
            
            // Добавляем цитату
            if (quote) {
              message += `💬 "${quote.text}"\n`;
              if (quote.author) {
                message += `— <i>${quote.author}</i>\n`;
              }
            }
            
            // Кнопки действий
            const buttons = [
              [
                { text: '✅ Выполнено', callback_data: `done_${habit.id}` },
                { text: '🔸 Мини', callback_data: `mini_${habit.id}` },
                { text: '❄️ Заморозка', callback_data: `freeze_${habit.id}` }
              ]
            ];
            
            await sendTelegramMessage(link.chat_id, message, buttons);
            sentCount++;
          }
        }
      }

      // ========== ЗАДАЧИ ==========
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', link.user_id)
        .eq('date', currentDate)
        .eq('time', currentTime)
        .eq('isTimer', true)
        .neq('status', 'done')
        .is('archived_at', null);

      if (tasks && tasks.length > 0) {
        for (const task of tasks) {
          let message = `📋 <b>${task.title}</b>\n`;
          message += `📅 Задача на сегодня`;
          
          await sendTelegramMessage(link.chat_id, message);
          sentCount++;
        }
      }
    }

    return res.status(200).json({ 
      ok: true, 
      time: currentTime,
      day: currentDay,
      date: currentDate,
      sent: sentCount 
    });

  } catch (error) {
    console.error('Cron error:', error);
    return res.status(500).json({ error: error.message });
  }
}
