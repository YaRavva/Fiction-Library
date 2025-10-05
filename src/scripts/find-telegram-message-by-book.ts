import { TelegramService } from '../lib/telegram/client';
import { MetadataParser } from '../lib/telegram/parser';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

async function findTelegramMessageByBook(author: string, title: string) {
  try {
    console.log(`🔍 Поиск сообщения в Telegram для книги: "${title}" автора ${author}`);
    
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
    
    // Получаем сообщения из канала (попробуем получить побольше сообщений)
    console.log('📥 Получаем последние сообщения из канала...');
    const messages = await telegramClient.getMessages(channelId, 200) as any;
    
    if (!messages || messages.length === 0) {
      console.log('❌ Сообщения не найдены');
      return;
    }
    
    console.log(`✅ Получено ${messages.length} сообщений`);
    
    // Ищем сообщения, содержащие информацию о книге
    let foundMessage = null;
    let foundMessageId = null;
    
    for (const message of messages) {
      if (message.text) {
        // Парсим текст сообщения
        const metadata = MetadataParser.parseMessage(message.text);
        
        // Проверяем, совпадают ли автор и название
        if (metadata.author && metadata.title) {
          const authorMatch = metadata.author.toLowerCase().includes(author.toLowerCase()) || 
                             author.toLowerCase().includes(metadata.author.toLowerCase());
          const titleMatch = metadata.title.toLowerCase().includes(title.toLowerCase()) || 
                            title.toLowerCase().includes(metadata.title.toLowerCase());
          
          if (authorMatch && titleMatch) {
            foundMessage = message;
            foundMessageId = message.id;
            console.log(`✅ Найдено сообщение с подходящими метаданными:`);
            console.log(`  ID: ${message.id}`);
            console.log(`  Автор: ${metadata.author}`);
            console.log(`  Название: ${metadata.title}`);
            break;
          }
        }
      }
    }
    
    if (!foundMessage) {
      console.log('❌ Сообщение с подходящими метаданными не найдено');
      return;
    }
    
    // Извлекаем описание из найденного сообщения
    if (foundMessage.text) {
      console.log('\n📖 Метаданные из сообщения:');
      const metadata = MetadataParser.parseMessage(foundMessage.text);
      console.log(`  Автор: ${metadata.author}`);
      console.log(`  Название: ${metadata.title}`);
      console.log(`  Описание: ${metadata.description ? metadata.description.substring(0, 200) + '...' : 'отсутствует'}`);
      
      // Попробуем извлечь более полное описание
      const descriptionMatch = foundMessage.text.match(/Рейтинг:[\s\S]*?\n([\s\S]*?)(?:\n\s*\n|Состав:|$)/i);
      if (descriptionMatch) {
        const description = descriptionMatch[1].trim();
        console.log(`\n📝 Полное описание из сообщения:`);
        console.log(description);
        return description;
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

// Получаем автора и название книги из аргументов командной строки
const author = process.argv[2];
const title = process.argv[3];

if (!author || !title) {
  console.error('❌ Пожалуйста, укажите автора и название книги');
  console.log('Использование: npx tsx src/scripts/find-telegram-message-by-book.ts "<author>" "<title>"');
  process.exit(1);
}

findTelegramMessageByBook(author, title);