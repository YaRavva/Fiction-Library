import { config } from 'dotenv';
import { join } from 'path';
import { TelegramService } from '../lib/telegram/client';
import { MetadataParser } from '../lib/telegram/parser';

// Load environment variables from .env file
const envPath = join(process.cwd(), '.env');
config({ path: envPath });

async function testUniqueBooksCount() {
  try {
    console.log('🔍 Тестирование подсчета уникальных книг в Telegram\n');
    
    // Initialize Telegram client
    console.log('🔐 Подключение к Telegram...');
    const telegramClient = await TelegramService.getInstance();
    console.log('✅ Подключение к Telegram установлено');
    
    // Get metadata channel
    console.log('📡 Получение канала с метаданными...');
    const channel = await telegramClient.getMetadataChannel();
    
    // Convert BigInteger to string for compatibility
    const channelId = typeof channel.id === 'object' && channel.id !== null ? 
        (channel.id as { toString: () => string }).toString() : 
        String(channel.id);
        
    console.log(`🆔 ID канала: ${channelId}`);
    console.log(`📝 Название канала: ${(channel as any).title || 'Неизвестно'}`);
    
    // Get messages from Telegram channel and analyze them
    console.log('\n🔍 Анализ сообщений Telegram...');
    
    let totalMessages = 0;
    let bookMessages = 0;
    let offsetId: number | undefined = undefined;
    const batchSize = 100;
    const bookSet = new Set<string>(); // To track unique books in Telegram
    
    while (true) {
      console.log(`   Обработка пакета сообщений (всего обработано: ${totalMessages})...`);
      const messages = await telegramClient.getMessages(channelId, batchSize, offsetId) as any[];
      
      if (messages.length === 0) {
        break;
      }
      
      totalMessages += messages.length;
      
      // Process each message
      for (const message of messages) {
        if (message.text) {
          try {
            // Try to parse message as book metadata
            const metadata = MetadataParser.parseMessage(message.text);
            
            // Check if it looks like a book (has author and title)
            if (metadata.author && metadata.title) {
              bookMessages++;
              const bookKey = `${metadata.author}|${metadata.title}`;
              
              // Add to set of unique books
              if (!bookSet.has(bookKey)) {
                bookSet.add(bookKey);
                console.log(`     Найдена книга: "${metadata.title}" автора ${metadata.author}`);
              }
            }
          } catch (parseError) {
            // Not a book message, skip
          }
        }
      }
      
      console.log(`     Обработано: ${messages.length} сообщений, найдено книг: ${bookMessages}`);
      
      // Set offsetId for next batch
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.id) {
        offsetId = lastMessage.id;
      } else {
        break;
      }
      
      // Add delay to avoid overwhelming Telegram API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Results
    console.log('\n📊 РЕЗУЛЬТАТЫ АНАЛИЗА:');
    console.log(`   ========================================`);
    console.log(`   Всего сообщений в канале: ${totalMessages}`);
    console.log(`   Сообщений с книгами: ${bookMessages}`);
    console.log(`   Уникальных книг в Telegram: ${bookSet.size}`);
    
    // Show some examples of unique books
    console.log('\n📚 Примеры уникальных книг:');
    let count = 0;
    for (const bookKey of bookSet) {
      if (count >= 10) break;
      const [author, title] = bookKey.split('|');
      console.log(`   ${count + 1}. "${title}" автора ${author}`);
      count++;
    }
    
    if (bookSet.size > 10) {
      console.log(`   ... и еще ${bookSet.size - 10} книг`);
    }
    
    console.log('\n✅ Тест завершен!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании подсчета уникальных книг:', error);
    process.exit(1);
  }
}

testUniqueBooksCount();