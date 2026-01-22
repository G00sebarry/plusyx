import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendTelegramMessage(chatId, text) {
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

// Получаем московское время
function getMoscowTime() {
  const now = new Date();
  const moscowTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  const hours = moscowTime.getHours().toString().padStart(2, '0');
  const minutes = moscowTime.getMinutes().toString().padStart(2, '0');
  const dayOfWeek = moscowTime.getDay(); // 0=Вс, 1=Пн, 2=Вт...
  return { time: `${hours}:${minutes}`, day: dayOfWeek };
}

export default async function handler(req, res) {
  try {
    const { time: currentTime, day: currentDay } = getMoscowTime();

    console.log(`Checking reminders for ${currentTime}, day ${currentDay} (Moscow)`);

    // Получаем все связки Telegram
    const { data: links } = await supabase
      .from('telegram_links')
      .select('user_id, chat_id');

    if (!links || links.length === 0) {
      return res.status(200).json({ message: 'No telegram links', time: currentTime });
    }

    let sentCount = 0;
    let checked = 0;

    for (const link of links) {
      // ========== ПРИВЫЧКИ ==========
      const { data: habits } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', link.user_id)
        .eq('reminder_time', currentTime)
        .eq('reminder_enabled', true);

      if (habits && habits.length > 0) {
        for (const habit of habits) {
          checked++;
          
          // Проверяем день недели
          let frequency = habit.frequency;
          if (typeof frequency === 'string') {
            try {
              frequency = JSON.parse(frequency);
            } catch (e) {
              frequency = { days: [1,2,3,4,5,6,0] }; // все дни по умолчанию
            }
          }
          
          const days = frequency?.days || [1,2,3,4,5,6,0];
          
          if (days.includes(currentDay)) {
            const emoji = habit.emoji || '🔔';
            const message = `${emoji} <b>Напоминание о привычке!</b>\n\n📌 ${habit.title}`;
            await sendTelegramMessage(link.chat_id, message);
            sentCount++;
          }
        }
      }

      // ========== ЗАДАЧИ ==========
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', link.user_id)
        .eq('time', currentTime)
        .eq('isTimer', true)
        .neq('status', 'done');

      if (tasks && tasks.length > 0) {
        for (const task of tasks) {
          const message = `🔔 <b>Напоминание о задаче!</b>\n\n📌 ${task.title}`;
          await sendTelegramMessage(link.chat_id, message);
          sentCount++;
        }
      }
    }

    return res.status(200).json({ 
      ok: true, 
      time: currentTime,
      day: currentDay,
      timezone: 'Europe/Moscow',
      checked: checked,
      sent: sentCount 
    });

  } catch (error) {
    console.error('Cron error:', error);
    return res.status(500).json({ error: error.message });
  }
}
