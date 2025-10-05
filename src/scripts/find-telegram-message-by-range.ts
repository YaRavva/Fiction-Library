import { TelegramService } from '../lib/telegram/client';
import { MetadataParser } from '../lib/telegram/parser';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

async function findTelegramMessageByRange(targetId: number, range: number = 10) {
  try {
    console.log(`🔍 Поиск сообщения в Telegram с ID ${targetId} (диапазон: ±${range})`);
    
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
    
    // Получаем сообщения из канала, начиная с целевого ID
    console.log(`📥 Получаем сообщения вокруг ID ${targetId}...`);
    const messages = await telegramClient.getMessages(channelId, range * 2, targetId) as any;
    
    if (!messages || messages.length === 0) {
      console.log('❌ Сообщения не найдены');
      return;
    }
    
    console.log(`✅ Получено ${messages.length} сообщений`);
    
    // Сортируем сообщения по ID
    messages.sort((a: any, b: any) => a.id - b.id);
    
    // Ищем целевое сообщение и соседние
    for (const message of messages) {
      console.log(`\n--- Сообщение ID: ${message.id} ---`);
      console.log(`  Расстояние от целевого: ${Math.abs(message.id - targetId)}`);
      
      if (message.text) {
        // Парсим текст сообщения
        const metadata = MetadataParser.parseMessage(message.text);
        console.log(`  Автор: ${metadata.author || 'не указан'}`);
        console.log(`  Название: ${metadata.title || 'не указано'}`);
        
        // Если это целевое сообщение
        if (message.id === targetId) {
          console.log(`  🎯 Это целевое сообщение!`);
          
          // Извлекаем описание
          if (message.text) {
            const descriptionMatch = message.text.match(/Рейтинг:[\s\S]*?\n([\s\S]*?)(?:\n\s*\n|Состав:|$)/i);
            if (descriptionMatch) {
              const description = descriptionMatch[1].trim();
              console.log(`\n📝 Описание из сообщения:`);
              console.log(description);
              return description;
            }
          }
        }
      } else {
        console.log(`  Текст: отсутствует`);
      }
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

// Получаем ID сообщения и диапазон из аргументов командной строки
const targetIdStr = process.argv[2];
const rangeStr = process.argv[3];

if (!targetIdStr) {
  console.error('❌ Пожалуйста, укажите ID сообщения');
  console.log('Использование: npx tsx src/scripts/find-telegram-message-by-range.ts <targetId> [range]');
  process.exit(1);
}

const targetId = parseInt(targetIdStr, 10);
const range = rangeStr ? parseInt(rangeStr, 10) : 10;

if (isNaN(targetId) || isNaN(range)) {
  console.error('❌ Неверный формат ID или диапазона');
  process.exit(1);
}

findTelegramMessageByRange(targetId, range);