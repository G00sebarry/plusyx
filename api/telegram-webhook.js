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

// ═══════════════════════════════════════════════════════════════════
// 📥 QUICK CAPTURE — хелперы
// ═══════════════════════════════════════════════════════════════════

// Генератор id в стиле фронта (Math.random().toString(36).substr(2, 9))
function genId() {
  return Math.random().toString(36).substr(2, 9);
}

// Короткие подтверждения в тон-оф-войсе Plusyx
const CAPTURE_REPLIES = [
  '📥 Записал',
  '📥 В инбоксе',
  '📥 Принял, не потеряю',
  '📥 Есть',
  '📥 Зафиксировал',
  '📥 Лежит, ждёт',
];

function getCaptureReply() {
  return CAPTURE_REPLIES[Math.floor(Math.random() * CAPTURE_REPLIES.length)];
}

// Находит или создаёт инбокс-карточку юзера. Возвращает { id, checklists } или null.
async function findOrCreateInbox(userId) {
  // 1. Ищем существующий инбокс (не в спячке)
  const { data: existing } = await supabase
    .from('tasks')
    .select('id, checklists')
    .eq('user_id', userId)
    .eq('is_inbox', true)
    .is('archived_at', null)
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  // 2. Нет — ищем первую todo-колонку юзера (по position)
  const { data: cols } = await supabase
    .from('columns')
    .select('id, type, position')
    .eq('user_id', userId)
    .eq('type', 'todo')
    .order('position', { ascending: true })
    .limit(1);

  const column = cols?.[0];
  if (!column) return null; // у юзера нет todo-колонки — не знаем куда класть

  // 3. Создаём инбокс-карточку
  const newTask = {
    id: genId(),
    title: '📥 Инбокс',
    description: 'Свалка идей из Telegram. Разбирай и раскидывай.',
    date: getMoscowDate(),
    isTimer: false,
    status: 'todo',
    columnId: column.id,
    color: 'default',
    checklists: [
      { id: genId(), title: 'Входящие', items: [], hideCompleted: false }
    ],
    comments: [],
    files: [],
    links: [],
    position: 0,
    coverPosition: 50,
    coverIntensity: 60,
    blocksOrder: ['meta', 'cover', 'checklists', 'files', 'links', 'comments'],
    is_inbox: true,
  };

  const { data: created, error } = await supabase
    .from('tasks')
    .insert(newTask)
    .select('id, checklists')
    .single();

  if (error) {
    console.error('Inbox create error:', error);
    return null;
  }
  return created;
}

// Добавляет пункт в первый чек-лист инбокса
async function addToInbox(inbox, text) {
  let checklists = Array.isArray(inbox.checklists) ? inbox.checklists : [];

  // Если юзер удалил все чек-листы из инбокса — создаём заново
  if (checklists.length === 0) {
    checklists = [{ id: genId(), title: 'Входящие', items: [], hideCompleted: false }];
  }

  const newItem = { id: genId(), text: text.trim(), completed: false };
  const updated = checklists.map((list, idx) =>
    idx === 0 ? { ...list, items: [...(list.items || []), newItem] } : list
  );

  const { error } = await supabase
    .from('tasks')
    .update({ checklists: updated })
    .eq('id', inbox.id);

  return !error;
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
        value = 'freeze';
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

    // ========== ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ ==========
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;

      if (text.startsWith('/start')) {
        const parts = text.split(' ');
        
        if (parts.length > 1) {
          const token = parts[1];
          
          // Ищем токен и проверяем срок действия
          const { data: pending } = await supabase
            .from('telegram_pending')
            .select('user_id, expires_at')
            .eq('token', token)
            .single();
          
          if (!pending) {
            await sendMessage(chatId, '❌ Ссылка недействительна или устарела.\n\nПопробуйте заново подключить Telegram в настройках привычки в Plusyx.');
            return res.status(200).json({ ok: true });
          }

          // Проверяем срок действия
          if (new Date(pending.expires_at) < new Date()) {
            // Удаляем просроченный токен
            await supabase
              .from('telegram_pending')
              .delete()
              .eq('token', token);
            
            await sendMessage(chatId, '⏰ Ссылка истекла (действует 10 минут).\n\nНажмите «Подключить Telegram» заново в Plusyx.');
            return res.status(200).json({ ok: true });
          }

          // Всё ок — привязываем
          await supabase
            .from('telegram_links')
            .upsert({
              user_id: pending.user_id,
              chat_id: chatId.toString(),
              username: update.message.from?.username || null,
              created_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
          
          // Удаляем использованный токен
          await supabase
            .from('telegram_pending')
            .delete()
            .eq('token', token);
          
          await sendMessage(chatId, 
            '✅ Telegram успешно подключён!\n\nТеперь вы будете получать напоминания о привычках и задачах.\n\n💡 Кстати: пришлите мне любой текст — и он упадёт пунктом в карточку «📥 Инбокс» на вашей доске.'
          );
        } else {
          await sendMessage(chatId, 
            '👋 Привет! Это бот Plusyx.\n\nДля подключения уведомлений перейдите в настройки привычки в приложении Plusyx и нажмите «Подключить Telegram».'
          );
        }
        return res.status(200).json({ ok: true });
      }

      // ========== 📥 QUICK CAPTURE ==========
      // Любой текст без "/" в начале → пункт в Инбокс
      if (!text.startsWith('/')) {
        // Находим юзера по chat_id
        const { data: link } = await supabase
          .from('telegram_links')
          .select('user_id')
          .eq('chat_id', chatId.toString())
          .single();

        if (!link) {
          await sendMessage(chatId, '❌ Аккаунт не привязан.\n\nПодключите Telegram в настройках привычки в Plusyx — и я начну складывать ваши заметки в Инбокс.');
          return res.status(200).json({ ok: true });
        }

        const inbox = await findOrCreateInbox(link.user_id);

        if (!inbox) {
          await sendMessage(chatId, '❌ Не нашёл, куда положить.\n\nСоздайте в Plusyx хотя бы одну колонку типа «Очередь» — и Инбокс появится сам.');
          return res.status(200).json({ ok: true });
        }

        const ok = await addToInbox(inbox, text);

        if (ok) {
          await sendMessage(chatId, getCaptureReply());
        } else {
          await sendMessage(chatId, '❌ Что-то пошло не так, попробуйте ещё раз.');
        }

        return res.status(200).json({ ok: true });
      }
    }

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(200).json({ ok: true });
  }
}
