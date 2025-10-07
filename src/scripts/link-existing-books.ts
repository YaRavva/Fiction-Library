import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { TelegramSyncService } from '../lib/telegram/sync';
import { MetadataParser } from '../lib/telegram/parser';

// Загружаем переменные окружения из .env файла
config();

async function linkExistingBooks() {
  try {
    console.log('🔍 Связывание существующих книг с сообщениями Telegram...\n');
    
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
    
    // Получаем все книги из базы данных, которые не связаны с сообщениями
    console.log('\n📥 Получаем книги, не связанные с сообщениями...');
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, title, author, telegram_post_id');
    
    if (booksError) {
      console.error('❌ Ошибка при получении книг из базы данных:', booksError);
      return;
    }
    
    // Получаем все обработанные сообщения из Telegram
    console.log('📥 Получаем все обработанные сообщения Telegram...');
    const { data: processedMessages, error: messagesError } = await supabase
      .from('telegram_processed_messages')
      .select('message_id, book_id');
    
    if (messagesError) {
      console.error('❌ Ошибка при получении обработанных сообщений:', messagesError);
      return;
    }
    
    // Находим книги, которые НЕ связаны с сообщениями
    const linkedBooks = new Set(processedMessages.map(msg => msg.book_id));
    const booksNotLinkedToMessages = books.filter(book => !linkedBooks.has(book.id));
    
    console.log(`✅ Найдено ${booksNotLinkedToMessages.length} книг, не связанных с сообщениями`);
    
    // Для каждой книги пытаемся найти соответствующее сообщение в Telegram
    let linkedCount = 0;
    let errorCount = 0;
    
    for (const book of booksNotLinkedToMessages) {
      try {
        console.log(`\n🔍 Поиск сообщения для книги: ${book.author} - ${book.title}`);
        
        // Если у книги уже есть telegram_post_id, проверяем его
        if (book.telegram_post_id) {
          console.log(`  📋 У книги уже есть telegram_post_id: ${book.telegram_post_id}`);
          
          // Проверяем, есть ли такое сообщение в обработанных
          const existingMessage = processedMessages.find(msg => msg.message_id === book.telegram_post_id);
          if (existingMessage) {
            console.log(`  ⚠️ Сообщение уже существует в telegram_processed_messages`);
            continue;
          }
          
          // Получаем сообщение из Telegram по ID
          console.log(`  📡 Получаем сообщение ${book.telegram_post_id} из Telegram...`);
          const messages = await syncService['telegramClient'].getMessages(channelId, 1, parseInt(book.telegram_post_id)) as unknown[];
          
          if (messages.length > 0) {
            const msg = messages[0] as { id?: number; text?: string };
            if (msg.id === parseInt(book.telegram_post_id) && msg.text) {
              // Парсим метаданные из сообщения
              const metadata = MetadataParser.parseMessage(msg.text);
              
              // Проверяем, совпадают ли метаданные
              if (metadata.title === book.title && metadata.author === book.author) {
                console.log(`  ✅ Найдено точное совпадение, связываем книгу с сообщением...`);
                
                // Создаем запись в telegram_processed_messages
                const { error: insertError } = await supabase
                  .from('telegram_processed_messages')
                  .insert({
                    message_id: String(book.telegram_post_id),
                    channel: process.env.TELEGRAM_METADATA_CHANNEL_ID || '',
                    book_id: book.id,
                    processed_at: new Date().toISOString()
                  });
                
                if (insertError) {
                  console.error(`  ❌ Ошибка при создании записи:`, insertError);
                  errorCount++;
                } else {
                  console.log(`  ✅ Книга успешно связана с сообщением`);
                  linkedCount++;
                }
              } else {
                console.log(`  ⚠️ Метаданные не совпадают:`);
                console.log(`     Сообщение: ${metadata.author} - ${metadata.title}`);
                console.log(`     Книга: ${book.author} - ${book.title}`);
              }
            } else {
              console.log(`  ❌ Сообщение не найдено или не содержит текста`);
            }
          } else {
            console.log(`  ❌ Сообщение не найдено`);
          }
        } else {
          console.log(`  ℹ️ У книги нет telegram_post_id, пропускаем`);
        }
      } catch (error) {
        console.error(`  ❌ Ошибка при обработке книги ${book.id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`\n📊 Результаты связывания:`);
    console.log(`   ✅ Успешно связано: ${linkedCount}`);
    console.log(`   ❌ Ошибок: ${errorCount}`);
    console.log(`   ⚠️ Пропущено: ${booksNotLinkedToMessages.length - linkedCount - errorCount}`);
    
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
  linkExistingBooks();
}

// Экспортируем функцию для использования в других скриптах
export { linkExistingBooks };
