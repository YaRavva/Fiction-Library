import { serverSupabase } from '../lib/serverSupabase';
import { TelegramService } from '../lib/telegram/client';
import { MetadataParser } from '../lib/telegram/parser';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

async function syncMissingDescriptions() {
  try {
    console.log('🔍 Поиск книг без описаний...');
    
    // Получаем книги без описаний
    const { data: books, error } = await (serverSupabase as any)
      .from('books')
      .select('*')
      .or('description.is.null,description.eq.')
      .limit(50);
    
    if (error) {
      console.error('❌ Ошибка при получении книг:', error);
      return;
    }
    
    if (!books || books.length === 0) {
      console.log('✅ Все книги имеют описания');
      return;
    }
    
    console.log(`📚 Найдено ${books.length} книг без описаний`);
    
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
    
    // Для каждой книги пытаемся найти описание в Telegram
    for (const book of books) {
      console.log(`\n--- Обработка книги: ${book.title} (${book.author}) ---`);
      
      // Проверяем, есть ли у книги Telegram post ID
      if (!book.telegram_post_id) {
        console.log('  ℹ️  У книги отсутствует Telegram post ID, пропускаем');
        continue;
      }
      
      const messageId = parseInt(book.telegram_post_id, 10);
      if (isNaN(messageId)) {
        console.log(`  ℹ️  Неверный формат Telegram post ID: ${book.telegram_post_id}, пропускаем`);
        continue;
      }
      
      console.log(`  📥 Получаем сообщение с ID: ${messageId}...`);
      
      try {
        // Получаем сообщение из Telegram
        const messages = await telegramClient.getMessages(channelId, 1, messageId) as any;
        
        if (!messages || messages.length === 0) {
          console.log(`  ❌ Сообщение с ID ${messageId} не найдено`);
          continue;
        }
        
        const message = messages[0];
        console.log(`  ✅ Сообщение найдено (ID: ${message.id})`);
        
        // Проверяем, есть ли текст в сообщении
        if (!message.text) {
          console.log(`  ℹ️  Сообщение не содержит текста`);
          continue;
        }
        
        // Парсим текст сообщения
        const metadata = MetadataParser.parseMessage(message.text);
        
        // Проверяем, совпадают ли автор и название
        const authorMatch = metadata.author && 
          (metadata.author.toLowerCase().includes(book.author.toLowerCase()) || 
           book.author.toLowerCase().includes(metadata.author.toLowerCase()));
        const titleMatch = metadata.title && 
          (metadata.title.toLowerCase().includes(book.title.toLowerCase()) || 
           book.title.toLowerCase().includes(metadata.title.toLowerCase()));
        
        if (!authorMatch || !titleMatch) {
          console.log(`  ⚠️  Несовпадение метаданных:`);
          console.log(`    Книга: ${book.author} - ${book.title}`);
          console.log(`    Сообщение: ${metadata.author} - ${metadata.title}`);
          continue;
        }
        
        // Проверяем, есть ли описание в метаданных
        if (!metadata.description) {
          console.log(`  ℹ️  В сообщении отсутствует описание`);
          continue;
        }
        
        // Обновляем описание книги в базе данных
        console.log(`  📝 Обновляем описание книги...`);
        const updateData: any = { description: metadata.description };
        const { data: updatedBook, error: updateError } = await (serverSupabase as any)
          .from('books')
          .update(updateData)
          .eq('id', book.id)
          .select()
          .single();
        
        if (updateError) {
          console.error(`  ❌ Ошибка при обновлении описания:`, updateError);
          continue;
        }
        
        console.log(`  ✅ Описание успешно обновлено`);
      } catch (error) {
        console.error(`  ❌ Ошибка при обработке сообщения:`, error);
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

syncMissingDescriptions();