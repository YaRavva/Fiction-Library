/**
 * Скрипт для детального просмотра структуры сообщений Telegram
 * Помогает понять, как хранятся обложки в сообщениях
 * 
 * Использование:
 * npx tsx src/scripts/inspect-telegram-message.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { inspect } from 'util';

// Загружаем .env из корня проекта
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function inspectMessages() {
  console.log('🔍 Детальный просмотр структуры сообщений Telegram...\n');

  const apiId = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;
  const sessionString = process.env.TELEGRAM_SESSION;
  const metadataChannel = process.env.TELEGRAM_METADATA_CHANNEL;

  if (!apiId || !apiHash || !sessionString || !metadataChannel) {
    console.error('❌ Отсутствуют необходимые переменные окружения');
    process.exit(1);
  }

  try {
    // Создаем клиент
    const session = new StringSession(sessionString);
    const client = new TelegramClient(session, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });

    await client.start({
      phoneNumber: async () => await Promise.reject('Interactive login not supported'),
      phoneCode: async () => await Promise.reject('Interactive login not supported'),
      password: async () => await Promise.reject('Interactive login not supported'),
      onError: (err) => console.error('Telegram client error:', err),
    });

    console.log('✅ Подключение к Telegram установлено\n');

    // Получаем канал
    const username = metadataChannel.split('/').pop() || metadataChannel;
    const channel = await client.getEntity(username);
    
    // Получаем последнее сообщение
    console.log('📖 Получаем последнее сообщение...\n');
    const messages = await client.getMessages(channel, { limit: 1 });
    const msg = messages[0];

    if (!msg) {
      console.error('❌ Сообщение не найдено');
      process.exit(1);
    }

    console.log('📝 Информация о сообщении:');
    console.log(`   ID: ${msg.id}`);
    console.log(`   Дата: ${msg.date}`);
    console.log('');

    // Выводим текст сообщения
    if (msg.message) {
      console.log('📄 Текст сообщения:');
      console.log('─'.repeat(60));
      console.log(msg.message.substring(0, 500));
      console.log('─'.repeat(60));
      console.log('');
    }

    // Детально выводим структуру медиа
    const anyMsg: any = msg;
    
    if (anyMsg.media) {
      console.log('🖼️ Структура медиа:');
      console.log('─'.repeat(60));
      console.log(`Тип: ${anyMsg.media.className}`);
      console.log('');
      
      // Выводим полную структуру медиа
      console.log('Полная структура:');
      console.log(inspect(anyMsg.media, { depth: 5, colors: true }));
      console.log('─'.repeat(60));
      console.log('');

      // Проверяем различные типы медиа
      if (anyMsg.media.className === 'MessageMediaWebPage') {
        console.log('📰 Это веб-превью (MessageMediaWebPage)');
        
        if (anyMsg.media.webpage) {
          console.log(`   Тип веб-страницы: ${anyMsg.media.webpage.className}`);
          
          if (anyMsg.media.webpage.photo) {
            console.log('   ✅ Веб-превью содержит фото!');
            console.log(`   Тип фото: ${anyMsg.media.webpage.photo.className}`);
            console.log('');
            console.log('   Структура фото:');
            console.log(inspect(anyMsg.media.webpage.photo, { depth: 3, colors: true }));
          } else {
            console.log('   ⚠️ Веб-превью не содержит фото');
          }
        }
      } else if (anyMsg.media.className === 'MessageMediaPhoto') {
        console.log('📸 Это обычное фото (MessageMediaPhoto)');
        console.log('   Структура фото:');
        console.log(inspect(anyMsg.media.photo, { depth: 3, colors: true }));
      } else if (anyMsg.media.className === 'MessageMediaDocument') {
        console.log('📎 Это документ (MessageMediaDocument)');
        console.log('   Структура документа:');
        console.log(inspect(anyMsg.media.document, { depth: 3, colors: true }));
      }
    } else {
      console.log('⚠️ Сообщение не содержит медиа');
    }

    console.log('');
    console.log('💡 Используйте эту информацию для обновления парсера обложек');

    await client.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

// Запускаем
inspectMessages();

