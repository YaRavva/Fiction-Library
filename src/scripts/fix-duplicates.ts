import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { TelegramSyncService } from '../lib/telegram/sync';
import { MetadataParser } from '../lib/telegram/parser';

// Загружаем переменные окружения из .env файла
config();

async function fixDuplicates() {
  try {
    console.log('🔍 Обработка дубликатов книг с одинаковым telegram_post_id...\n');
    
    // Используем правильные переменные окружения для облачного Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Не найдены переменные окружения Supabase');
      return;
    }

    // Создаем клиент Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    if (!syncService['telegramClient']) {
      console.error('❌ Не удалось получить доступ к Telegram клиенту');
      return;
    }
    
    // Получаем канал с метаданными
    console.log('📡 Получаем канал с метаданными...');
    const channel = await syncService['telegramClient'].getMetadataChannel();
    
    // Convert BigInteger to string for compatibility
    const channelId = typeof channel.id === 'object' && channel.id !== null ? 
        (channel.id as { toString: () => string }).toString() : 
        String(channel.id);
    
    console.log(`🆔 ID канала: ${channelId}`);
    
    // Находим книги с одинаковым telegram_post_id
    console.log('\n🔍 Поиск книг с одинаковым telegram_post_id...');
    const { data: allBooks, error: booksError } = await supabase
      .from('books')
      .select('id, title, author, telegram_post_id, description, genres, tags, cover_url, created_at, updated_at');
    
    if (booksError) {
      console.error('❌ Ошибка при получении книг из базы данных:', booksError);
      return;
    }
    
    // Группируем книги по telegram_post_id
    const booksByTelegramId = new Map<string, any[]>();
    for (const book of allBooks) {
      if (book.telegram_post_id) {
        if (!booksByTelegramId.has(book.telegram_post_id)) {
          booksByTelegramId.set(book.telegram_post_id, []);
        }
        booksByTelegramId.get(book.telegram_post_id)!.push(book);
      }
    }
    
    // Находим дубликаты (группы с более чем одной книгой)
    const duplicates = Array.from(booksByTelegramId.entries()).filter(([_, books]) => books.length > 1);
    
    console.log(`✅ Найдено ${duplicates.length} групп дубликатов`);
    
    // Обрабатываем каждую группу дубликатов
    for (const [telegramId, books] of duplicates) {
      console.log(`\n🔍 Обработка дубликатов для telegram_post_id: ${telegramId}`);
      
      // Получаем сообщение из Telegram по ID
      console.log(`  📡 Получаем сообщение ${telegramId} из Telegram...`);
      const messages = await syncService['telegramClient'].getMessages(channelId, 1, parseInt(telegramId)) as unknown[];
      
      if (messages.length > 0) {
        const msg = messages[0] as { id?: number; text?: string };
        if (msg.id === parseInt(telegramId) && msg.text) {
          // Парсим метаданные из сообщения
          const metadata = MetadataParser.parseMessage(msg.text);
          console.log(`  📄 Метаданные из Telegram: ${metadata.author} - ${metadata.title}`);
          
          // Находим книгу с лучшими метаданными (наиболее полной)
          let bestBook = books[0];
          let maxFields = 0;
          
          for (const book of books) {
            const fieldCount = [
              book.description,
              book.genres && book.genres.length > 0 ? 1 : 0,
              book.tags && book.tags.length > 0 ? 1 : 0,
              book.cover_url
            ].filter(Boolean).length;
            
            if (fieldCount > maxFields) {
              maxFields = fieldCount;
              bestBook = book;
            }
          }
          
          console.log(`  🎯 Лучшая книга: ${bestBook.author} - ${bestBook.title} (ID: ${bestBook.id})`);
          
          // Обновляем лучшую книгу данными из Telegram
          console.log(`  🔄 Обновляем книгу данными из Telegram...`);
          const { error: updateError } = await supabase
            .from('books')
            .update({
              title: metadata.title,
              author: metadata.author,
              description: metadata.description || bestBook.description,
              genres: metadata.genres.length > 0 ? metadata.genres : bestBook.genres,
              tags: metadata.tags.length > 0 ? metadata.tags : bestBook.tags,
              updated_at: new Date().toISOString()
            })
            .eq('id', bestBook.id);
          
          if (updateError) {
            console.error(`  ❌ Ошибка при обновлении книги:`, updateError);
            continue;
          }
          
          console.log(`  ✅ Книга успешно обновлена`);
          
          // Удаляем остальные дубликаты
          const booksToDelete = books.filter(book => book.id !== bestBook.id);
          console.log(`  🗑️ Удаление ${booksToDelete.length} дубликатов...`);
          
          for (const book of booksToDelete) {
            console.log(`    Удаление книги: ${book.author} - ${book.title} (ID: ${book.id})`);
            
            // Удаляем книгу из базы данных
            const { error: deleteError } = await supabase
              .from('books')
              .delete()
              .eq('id', book.id);
            
            if (deleteError) {
              console.error(`    ❌ Ошибка при удалении книги:`, deleteError);
            } else {
              console.log(`    ✅ Книга удалена`);
            }
          }
        } else {
          console.log(`  ❌ Сообщение не найдено или не содержит текста`);
        }
      } else {
        console.log(`  ❌ Сообщение не найдено`);
      }
    }
    
    console.log('\n✅ Обработка дубликатов завершена');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    // Отключаемся от Telegram
    const syncService = await TelegramSyncService.getInstance();
    await syncService.shutdown();
  }
}

// Если скрипт запущен напрямую, выполняем функцию
if (require.main === module) {
  fixDuplicates();
}

// Экспортируем функцию для использования в других скриптах
export { fixDuplicates };
