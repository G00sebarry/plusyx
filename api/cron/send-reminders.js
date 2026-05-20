import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// ═══════════════════════════════════════════════════════════════════
// 📋 РАСЧЁТ УРОВНЯ ПРИВЫЧКИ (повторяет логику HabitTracker.tsx)
// ═══════════════════════════════════════════════════════════════════

// Форматирует Date в строку YYYY-MM-DD (как ключи в habit.history)
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// "Выполнено" — true или 'mini' (как на фронте)
function isCompleted(value) {
  return value === true || value === 'mini';
}

// Эффективная дата начала (с учётом reactivatedAt — пробуждение из спячки)
function getEffectiveStartDate(habit) {
  if (habit.reactivated_at) {
    const d = new Date(habit.reactivated_at);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const historyKeys = Object.keys(habit.history || {}).sort();
  if (historyKeys.length === 0) return null;
  const [sy, sm, sd] = historyKeys[0].split('-').map(Number);
  const d = new Date(sy, sm - 1, sd);
  d.setHours(0, 0, 0, 0);
  return d;
}

// День релевантен если запланирован ИЛИ уже есть отметка
function isDateRelevant(habit, date, scheduledDays) {
  const dayOfWeek = date.getDay();
  if (scheduledDays.includes(dayOfWeek)) return true;
  return habit.history?.[formatDate(date)] !== undefined;
}

// Расчёт текущей серии (повторяет getCurrentStreak с фронта)
function getCurrentStreak(habit, today, scheduledDays) {
  const effectiveStart = getEffectiveStartDate(habit);
  const history = habit.history || {};
  let streak = 0;
  const checkDate = new Date(today);

  for (let i = 0; i < 365; i++) {
    if (effectiveStart && checkDate < effectiveStart) break;

    if (!isDateRelevant(habit, checkDate, scheduledDays)) {
      checkDate.setDate(checkDate.getDate() - 1);
      continue;
    }

    const ds = formatDate(checkDate);
    const val = history[ds];

    if (val === 'freeze') break;

    if (isCompleted(val)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // Сегодня не выполнено — даём день фору (проверяем вчера)
      if (i === 0 && formatDate(checkDate) === formatDate(today)) {
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }
      break;
    }
  }
  return streak;
}

// Общее количество выполнений за всё время
function getTotalCompletions(habit) {
  const history = habit.history || {};
  let count = 0;
  for (const dateStr in history) {
    if (isCompleted(history[dateStr])) count++;
  }
  return count;
}

// Был ли провал ≥3 дня пропусков подряд в последние 7 релевантных дней
function hadRecentBreak(habit, today, scheduledDays) {
  const history = habit.history || {};
  let consecutiveMisses = 0;
  let maxMisses = 0;
  const checkDate = new Date(today);
  // Начинаем со вчера (сегодняшний день не учитываем)
  checkDate.setDate(checkDate.getDate() - 1);

  let relevantDaysChecked = 0;
  for (let i = 0; i < 14 && relevantDaysChecked < 7; i++) {
    if (!isDateRelevant(habit, checkDate, scheduledDays)) {
      checkDate.setDate(checkDate.getDate() - 1);
      continue;
    }
    relevantDaysChecked++;

    const val = history[formatDate(checkDate)];
    if (isCompleted(val)) {
      consecutiveMisses = 0;
    } else {
      // freeze, false, undefined — всё считаем как пропуск для целей "вернувшегося"
      consecutiveMisses++;
      if (consecutiveMisses > maxMisses) maxMisses = consecutiveMisses;
    }
    checkDate.setDate(checkDate.getDate() - 1);
  }
  return maxMisses >= 3;
}

// 🎯 ГЛАВНАЯ ФУНКЦИЯ — определяет уровень привычки
function calculateHabitLevel(habit, today, scheduledDays) {
  const totalCompletions = getTotalCompletions(habit);

  // Если ни разу не выполнено — новичок
  if (totalCompletions === 0) return 'beginner';

  const streak = getCurrentStreak(habit, today, scheduledDays);

  // Проверка на "вернувшегося":
  // streak ≤ 3 + был провал ≥3 дня пропусков в последние 7 дней
  if (streak <= 3 && hadRecentBreak(habit, today, scheduledDays)) {
    return 'returning';
  }

  // Стандартные уровни по серии
  if (streak <= 7) return 'beginner';
  if (streak <= 30) return 'engaging';
  return 'advanced';
}

// ═══════════════════════════════════════════════════════════════════
// 💬 ВЫБОР ЦИТАТЫ ПО УРОВНЮ
// ═══════════════════════════════════════════════════════════════════

async function getQuoteByLevel(level) {
  // Сначала пробуем нужный уровень
  let { data: quotes } = await supabase
    .from('habit_quotes')
    .select('text')
    .eq('level', level);

  // Fallback: если пул пустой (например забыли залить) — берём любые цитаты
  if (!quotes || quotes.length === 0) {
    const { data: fallback } = await supabase
      .from('habit_quotes')
      .select('text');
    quotes = fallback;
  }

  if (!quotes || quotes.length === 0) return null;

  return quotes[Math.floor(Math.random() * quotes.length)];
}

// ═══════════════════════════════════════════════════════════════════
// 📤 ОТПРАВКА В TELEGRAM
// ═══════════════════════════════════════════════════════════════════

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
  
  return { time: `${hours}:${minutes}`, day: dayOfWeek, date: date, moscowTime: moscowTime };
}

// ═══════════════════════════════════════════════════════════════════
// 🚀 MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  try {
    const { time: currentTime, day: currentDay, date: currentDate, moscowTime } = getMoscowDateTime();
    // Сегодня в полночь (для расчётов streak)
    const today = new Date(moscowTime);
    today.setHours(0, 0, 0, 0);

    const { data: links } = await supabase
      .from('telegram_links')
      .select('user_id, chat_id');

    if (!links || links.length === 0) {
      return res.status(200).json({ message: 'No telegram links', time: currentTime });
    }

    let sentCount = 0;
    const levelStats = { beginner: 0, engaging: 0, advanced: 0, returning: 0 };

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
          // Парсим frequency
          let frequency = habit.frequency;
          if (typeof frequency === 'string') {
            try { frequency = JSON.parse(frequency); } 
            catch (e) { frequency = { days: [0,1,2,3,4,5,6] }; }
          }
          
          const days = frequency?.days || [0,1,2,3,4,5,6];
          
          // Если день не запланирован для этой привычки — пропускаем
          if (!days.includes(currentDay)) continue;

          // 🎯 ОПРЕДЕЛЯЕМ УРОВЕНЬ ПРИВЫЧКИ
          const level = calculateHabitLevel(habit, today, days);
          levelStats[level]++;

          // 💬 ПОЛУЧАЕМ ЦИТАТУ ПОД УРОВЕНЬ
          const quote = await getQuoteByLevel(level);
          
          const emoji = habit.emoji || '🔔';
          let message = `${emoji} <b>${habit.title}</b>\n\n`;
          
          if (habit.trigger) {
            message += `🎯 <i>${habit.trigger}</i>\n\n`;
          }
          
          if (quote) {
            message += `💬 ${quote.text}`;
          }
          
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
      sent: sentCount,
      levels: levelStats
    });

  } catch (error) {
    console.error('Cron error:', error);
    return res.status(500).json({ error: error.message });
  }
}
