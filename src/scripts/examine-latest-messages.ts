// Загружаем переменные окружения из .env файла
import { config } from 'dotenv';
import { join } from 'path';
import { TelegramService } from '../lib/telegram/client';
import { MetadataParser } from '../lib/telegram/parser';

// Загружаем переменные окружения из файла .env в корне проекта
const envPath = join(process.cwd(), '.env');
config({ path: envPath });

async function examineLatestMessages() {
  try {
    console.log('🔍 Исследуем последние сообщения из канала Telegram');
    
    // Инициализируем Telegram клиент
    const telegramClient = await TelegramService.getInstance();
    
    // Получаем канал с метаданными
    const channel = await telegramClient.getMetadataChannel();
    const channelId = typeof channel.id === 'object' && channel.id !== null ? 
      (channel.id as { toString: () => string }).toString() : 
      String(channel.id);
    
    // Получаем последние 100 сообщений из канала
    console.log('📥 Получаем последние 100 сообщений...');
    const messages = await telegramClient.getMessages(channelId, 100) as unknown as { id?: number; text?: string }[];
    
    if (!messages || messages.length === 0) {
      console.log('❌ Сообщения не найдены');
      return;
    }
    
    console.log(`✅ Получено ${messages.length} сообщений`);
    
    // Анализируем сообщения
    let booksFound = 0;
    let seriesFound = 0;
    
    for (const message of messages) {
      if (message.text) {
        // Парсим текст сообщения
        const metadata = MetadataParser.parseMessage(message.text);
        
        // Проверяем, есть ли автор и название
        if (metadata.author && metadata.title) {
          booksFound++;
          console.log(`\n📝 Сообщение ID: ${message.id}`);
          console.log(`  Автор: ${metadata.author}`);
          console.log(`  Название: ${metadata.title}`);
          
          // Проверяем, есть ли состав
          if (metadata.books && metadata.books.length > 0) {
            seriesFound++;
            console.log(`  📚 Состав: ${metadata.books.length} книг`);
            metadata.books.forEach((book, index) => {
              console.log(`    ${index + 1}. ${book.title} (${book.year})`);
            });
          } else {
            console.log(`  📖 Одиночная книга`);
          }
        }
      }
    }
    
    console.log(`\n📊 Анализ завершен:`);
    console.log(`  Всего сообщений с книгами: ${booksFound}`);
    console.log(`  Из них с составом: ${seriesFound}`);
    
    // Завершаем работу Telegram клиента
    if (typeof (telegramClient as unknown as { disconnect?: () => Promise<void> }).disconnect === 'function') {
      await (telegramClient as unknown as { disconnect: () => Promise<void> }).disconnect!();
    }
    
    console.log('\n✅ Исследование завершено!');
  } catch (error) {
    console.error('❌ Ошибка в скрипте:', error);
  }
}

// Запускаем скрипт
examineLatestMessages();