// Загружаем переменные окружения из .env файла
import { config } from 'dotenv';
import { join } from 'path';
import { TelegramService } from '../lib/telegram/client';

// Загружаем переменные окружения из файла .env в корне проекта
const envPath = join(process.cwd(), '.env');
config({ path: envPath });

async function checkReturnedMessages() {
  try {
    console.log('🔍 Проверяем, какие сообщения возвращает Telegram API');
    
    // Инициализируем Telegram клиент
    const telegramClient = await TelegramService.getInstance();
    
    // Получаем канал с метаданными
    const channel = await telegramClient.getMetadataChannel();
    const channelId = typeof channel.id === 'object' && channel.id !== null ? 
      (channel.id as { toString: () => string }).toString() : 
      String(channel.id);
    
    // Получаем сообщения с ID 4183
    const targetMessageId = 4183;
    console.log(`📥 Получаем сообщения с offsetId: ${targetMessageId}...`);
    
    const messages = await telegramClient.getMessages(channelId, 5, targetMessageId) as unknown as { id?: number; text?: string }[];
    
    if (!messages || messages.length === 0) {
      console.log('❌ Сообщения не найдены');
      return;
    }
    
    console.log(`✅ Получено ${messages.length} сообщений:`);
    messages.forEach((msg, index) => {
      console.log(`  ${index + 1}. ID: ${msg.id || 'undefined'}`);
    });
    
    // Завершаем работу Telegram клиента
    if (typeof (telegramClient as unknown as { disconnect?: () => Promise<void> }).disconnect === 'function') {
      await (telegramClient as unknown as { disconnect: () => Promise<void> }).disconnect!();
    }
    
    console.log('\n✅ Проверка завершена!');
  } catch (error) {
    console.error('❌ Ошибка в скрипте:', error);
  }
}

// Запускаем скрипт
checkReturnedMessages();