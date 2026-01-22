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
  return `${hours}:${minutes}`;
}

export default async function handler(req, res) {
  try {
    const currentTime = getMoscowTime(); // Московское время!

    console.log(`Checking reminders for ${currentTime} (Moscow)`);

    // Получаем все связки Telegram
    const { data: links } = await supabase
      .from('telegram_links')
      .select('user_id, chat_id');

    if (!links || links.length === 0) {
      return res.status(200).json({ message: 'No telegram links', time: currentTime });
    }

    let sentCount = 0;

    for (const link of links) {
      // Получаем задачи пользователя с напоминаниями на текущее время
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', link.user_id)
        .eq('time', currentTime)
        .eq('isTimer', true)
        .eq('is_reminder_sent', false)
        .neq('status', 'done');

      if (tasks && tasks.length > 0) {
        for (const task of tasks) {
          const message = `🔔 <b>Напоминание!</b>\n\n📌 ${task.title}`;
          await sendTelegramMessage(link.chat_id, message);
          
          // Помечаем что напоминание отправлено
          await supabase
            .from('tasks')
            .update({ is_reminder_sent: true })
            .eq('id', task.id);
          
          sentCount++;
        }
      }
    }

    return res.status(200).json({ 
      ok: true, 
      time: currentTime,
      timezone: 'Europe/Moscow',
      sent: sentCount 
    });

  } catch (error) {
    console.error('Cron error:', error);
    return res.status(500).json({ error: error.message });
  }
}
