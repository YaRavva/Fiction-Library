import { TelegramService } from '../lib/telegram/client';
import { MetadataParser } from '../lib/telegram/parser';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

async function testParserWithTelegramMessages() {
  try {
    console.log('🔍 Тестирование парсера на сообщениях из Telegram...');
    
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
    
    // Получаем несколько сообщений из канала
    console.log('📥 Получаем последние сообщения из канала...');
    const messages = await telegramClient.getMessages(channelId, 10) as any;
    
    if (!messages || messages.length === 0) {
      console.log('❌ Сообщения не найдены');
      return;
    }
    
    console.log(`✅ Получено ${messages.length} сообщений\n`);
    
    // Тестируем парсер на каждом сообщении
    for (const [index, message] of messages.entries()) {
      if (message.text) {
        console.log(`--- Сообщение ${index + 1} (ID: ${message.id}) ---`);
        
        // Парсим текст сообщения
        const metadata = MetadataParser.parseMessage(message.text);
        
        console.log(`Автор: "${metadata.author}"`);
        console.log(`Название: "${metadata.title}"`);
        console.log(`Рейтинг: ${metadata.rating}`);
        console.log(`Жанры: [${metadata.genres.map(g => `"${g}"`).join(', ')}]`);
        console.log(`Книги в серии: ${metadata.books.length}`);
        
        if (metadata.books.length > 0) {
          for (const book of metadata.books) {
            console.log(`  - ${book.title} (${book.year})`);
          }
        }
        
        console.log('');
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

testParserWithTelegramMessages();