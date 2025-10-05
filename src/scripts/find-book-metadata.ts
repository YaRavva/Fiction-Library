import { config } from 'dotenv';
import { resolve } from 'path';
import { TelegramSyncService } from '../lib/telegram/sync';
import { MetadataParser } from '../lib/telegram/parser';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

/**
 * Скрипт для поиска сообщения с метаданными для книги
 * @param bookTitle Название книги
 * @param bookAuthor Автор книги
 */
export async function findBookMetadata(bookTitle: string, bookAuthor: string) {
  try {
    console.log(`🔍 Поиск метаданных для книги: ${bookAuthor} - ${bookTitle}`);
    
    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    // Получаем канал с метаданными
    console.log(`📥 Получаем канал с метаданными...`);
    const channel = await (syncService as any).telegramClient.getMetadataChannel();
    if (!channel) {
      throw new Error('Не удалось получить канал');
    }
    
    // Convert BigInteger to string for compatibility
    const channelId = typeof channel.id === 'object' && channel.id !== null ? 
      (channel.id as { toString: () => string }).toString() : 
      String(channel.id);
    
    // Получаем последние сообщения из канала
    console.log(`📥 Получаем последние сообщения из канала...`);
    const messages: any[] = await (syncService as any).telegramClient.getMessages(channelId, 100);
    if (!messages || messages.length === 0) {
      console.log(`❌ Сообщения не найдены`);
      return;
    }
    
    console.log(`✅ Получено ${messages.length} сообщений`);
    
    // Ищем сообщение с метаданными для нужной книги
    for (const msg of messages) {
      const anyMsg = msg as unknown as { [key: string]: unknown };
      
      // Проверяем наличие текста в сообщении
      if (!anyMsg.message) {
        continue;
      }
      
      // Парсим текст сообщения
      const metadata = MetadataParser.parseMessage(anyMsg.message as string);
      
      // Проверяем, совпадают ли автор и название
      if (metadata.author === bookAuthor && metadata.title === bookTitle) {
        console.log(`\n✅ Найдено сообщение с метаданными!`);
        console.log(`ID сообщения: ${anyMsg.id}`);
        console.log(`Автор: ${metadata.author}`);
        console.log(`Название: ${metadata.title}`);
        console.log(`Описание: ${metadata.description || 'отсутствует'}`);
        console.log(`Жанры: ${metadata.genres.join(', ')}`);
        console.log(`Рейтинг: ${metadata.rating}`);
        
        return {
          messageId: anyMsg.id,
          metadata: metadata
        };
      }
    }
    
    console.log(`❌ Сообщение с метаданными для книги ${bookAuthor} - ${bookTitle} не найдено`);
    return null;
  } catch (error) {
    console.error('❌ Ошибка поиска метаданных:', error);
    return null;
  }
}

// Если скрипт запущен напрямую, выполняем поиск
if (require.main === module) {
  const bookTitle = process.argv[2] || 'цикл Дримеры';
  const bookAuthor = process.argv[3] || 'Сергей Ткачев';
  
  findBookMetadata(bookTitle, bookAuthor)
    .then(result => {
      if (result) {
        console.log(`\n✅ Метаданные найдены в сообщении с ID: ${result.messageId}`);
      } else {
        console.log(`\n❌ Метаданные не найдены`);
      }
      console.log('🔒 Скрипт завершен');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Ошибка при выполнении скрипта:', error);
      process.exit(1);
    });
}