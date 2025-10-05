import { TelegramService } from '../lib/telegram/client';
import { MetadataParser } from '../lib/telegram/parser';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

async function searchTelegramMessages(keyword: string, limit: number = 100) {
  try {
    console.log(`🔍 Поиск сообщений в Telegram по ключевому слову: "${keyword}"`);
    
    // Получаем экземпляр Telegram клиента
    const telegramClient = await TelegramService.getInstance();
    
    // Получаем канал с метаданными
    console.log('📥 Получаем канал с метаданными...');
    const channel = await telegramClient.getMetadataChannel();
    
    // Convert BigInteger to string for compatibility
    const channelId = typeof channel.id === 'object' && channel.id !== null ? 
        (channel.id as { toString: () => string }).toString() : 
        String(channel.id);
    
    console.log(`📡 Канал ID: ${channelId}`);
    
    // Получаем сообщения из канала
    console.log(`📥 Получаем последние ${limit} сообщений из канала...`);
    const messages = await telegramClient.getMessages(channelId, limit) as any;
    
    if (!messages || messages.length === 0) {
      console.log('❌ Сообщения не найдены');
      return;
    }
    
    console.log(`✅ Получено ${messages.length} сообщений`);
    
    // Ищем сообщения, содержащие ключевое слово
    let foundCount = 0;
    
    for (const message of messages) {
      if (message.text && message.text.toLowerCase().includes(keyword.toLowerCase())) {
        foundCount++;
        console.log(`\n--- Сообщение ID: ${message.id} ---`);
        
        // Парсим текст сообщения
        const metadata = MetadataParser.parseMessage(message.text);
        console.log(`  Автор: ${metadata.author || 'не указан'}`);
        console.log(`  Название: ${metadata.title || 'не указано'}`);
        
        // Извлекаем описание
        const descriptionMatch = message.text.match(/Рейтинг:[\s\S]*?\n([\s\S]*?)(?:\n\s*\n|Состав:|$)/i);
        if (descriptionMatch) {
          const description = descriptionMatch[1].trim();
          console.log(`\n📝 Описание из сообщения:`);
          console.log(description.substring(0, 300) + (description.length > 300 ? '...' : ''));
        }
        
        if (foundCount >= 10) {
          console.log('\n... (остановлено для экономии места)');
          break;
        }
      }
    }
    
    if (foundCount === 0) {
      console.log(`❌ Сообщения с ключевым словом "${keyword}" не найдены`);
    } else {
      console.log(`\n✅ Найдено ${foundCount} сообщений с ключевым словом "${keyword}"`);
    }
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    // Отключаемся от Telegram
    const telegramClient = await TelegramService.getInstance();
    if (telegramClient) {
      await telegramClient.disconnect();
    }
  }
}

// Получаем ключевое слово из аргументов командной строки
const keyword = process.argv[2];
const limitStr = process.argv[3];

if (!keyword) {
  console.error('❌ Пожалуйста, укажите ключевое слово для поиска');
  console.log('Использование: npx tsx src/scripts/search-telegram-messages.ts "<keyword>" [limit]');
  process.exit(1);
}

const limit = limitStr ? parseInt(limitStr, 10) : 100;

if (isNaN(limit)) {
  console.error('❌ Неверный формат лимита');
  process.exit(1);
}

searchTelegramMessages(keyword, limit);