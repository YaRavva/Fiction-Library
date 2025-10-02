/**
 * Простой скрипт для тестирования подключения к Telegram
 * Не требует Supabase, только проверяет подключение к Telegram API
 * 
 * Использование:
 * npx tsx src/scripts/test-telegram-connection.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

// Загружаем .env из корня проекта
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function testTelegramConnection() {
  console.log('🚀 Тестирование подключения к Telegram...\n');

  // Проверяем переменные окружения
  const apiId = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;
  const sessionString = process.env.TELEGRAM_SESSION;
  const metadataChannel = process.env.TELEGRAM_METADATA_CHANNEL;

  if (!apiId || !apiHash) {
    console.error('❌ Ошибка: TELEGRAM_API_ID и TELEGRAM_API_HASH должны быть установлены в .env');
    process.exit(1);
  }

  if (!sessionString) {
    console.error('❌ Ошибка: TELEGRAM_SESSION не установлена в .env');
    console.error('Запустите: npx tsx src/scripts/telegram-login.ts');
    process.exit(1);
  }

  if (!metadataChannel) {
    console.error('❌ Ошибка: TELEGRAM_METADATA_CHANNEL не установлен в .env');
    process.exit(1);
  }

  console.log('✅ Переменные окружения загружены');
  console.log(`   API ID: ${apiId}`);
  console.log(`   Канал метаданных: ${metadataChannel}\n`);

  try {
    // Создаем клиент
    console.log('📡 Подключаемся к Telegram...');
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

    // Получаем информацию о канале
    console.log('📚 Получаем информацию о канале метаданных...');
    const username = metadataChannel.split('/').pop() || metadataChannel;
    const channel = await client.getEntity(username);
    
    console.log('✅ Канал найден:');
    console.log(`   ID: ${(channel as any).id}`);
    console.log(`   Название: ${(channel as any).title || username}`);
    console.log('');

    // Получаем последние сообщения
    console.log('📖 Получаем последние 5 сообщений...');
    const messages = await client.getMessages(channel, { limit: 5 });
    
    console.log(`✅ Получено ${messages.length} сообщений\n`);

    // Выводим информацию о сообщениях
    messages.forEach((msg, index) => {
      console.log(`📝 Сообщение ${index + 1}:`);
      console.log(`   ID: ${msg.id}`);
      console.log(`   Дата: ${msg.date}`);
      if (msg.message) {
        const preview = msg.message.substring(0, 100).replace(/\n/g, ' ');
        console.log(`   Текст: ${preview}${msg.message.length > 100 ? '...' : ''}`);
      }
      if ((msg as any).media) {
        console.log(`   Медиа: Да`);
      }
      console.log('');
    });

    console.log('✅ Тестирование завершено успешно!');
    console.log('\n💡 Следующий шаг: Запустите синхронизацию через админ панель');
    console.log('   http://localhost:3001/admin');

    await client.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка при подключении к Telegram:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('AUTH_KEY_UNREGISTERED')) {
        console.error('\n💡 Сессия устарела. Запустите повторную авторизацию:');
        console.error('   npx tsx src/scripts/telegram-login.ts');
      } else if (error.message.includes('CHANNEL_INVALID')) {
        console.error('\n💡 Канал не найден. Проверьте TELEGRAM_METADATA_CHANNEL в .env');
      }
    }
    
    process.exit(1);
  }
}

// Запускаем тест
testTelegramConnection();

