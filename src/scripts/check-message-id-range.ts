// Загружаем переменные окружения из .env файла
import { config } from 'dotenv';
import { join } from 'path';
import { TelegramService } from '../lib/telegram/client';

// Загружаем переменные окружения из файла .env в корне проекта
const envPath = join(process.cwd(), '.env');
config({ path: envPath });

async function checkMessageIdRange() {
  try {
    console.log('🔍 Проверяем диапазон ID в последних 100 сообщениях');
    
    // Инициализируем Telegram клиент
    const telegramClient = await TelegramService.getInstance();
    
    // Получаем канал с метаданными
    const channel = await telegramClient.getMetadataChannel();
    const channelId = typeof channel.id === 'object' && channel.id !== null ? 
      (channel.id as { toString: () => string }).toString() : 
      String(channel.id);
    
    // Получаем последние 100 сообщений из канала
    console.log('📥 Получаем последние 100 сообщений из канала...');
    const messages = await telegramClient.getMessages(channelId, 100) as unknown as { id?: number; text?: string }[];
    
    if (!messages || messages.length === 0) {
      console.log('❌ Сообщения не найдены');
      return;
    }
    
    console.log(`✅ Получено ${messages.length} сообщений`);
    
    // Находим минимальный и максимальный ID
    const ids = messages.map(msg => msg.id).filter(id => id !== undefined) as number[];
    if (ids.length === 0) {
      console.log('❌ Не найдены сообщения с ID');
      return;
    }
    
    const minId = Math.min(...ids);
    const maxId = Math.max(...ids);
    
    console.log(`📊 Диапазон ID в последних 100 сообщениях:`);
    console.log(`  Минимальный ID: ${minId}`);
    console.log(`  Максимальный ID: ${maxId}`);
    console.log(`  Разница: ${maxId - minId}`);
    
    // Сортируем ID по возрастанию и показываем несколько примеров
    ids.sort((a, b) => a - b);
    console.log(`\n📋 Примеры ID (первые 10): ${ids.slice(0, 10).join(', ')}`);
    console.log(`📋 Примеры ID (последние 10): ${ids.slice(-10).join(', ')}`);
    
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
checkMessageIdRange();