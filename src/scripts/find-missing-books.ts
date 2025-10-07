import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { TelegramSyncService } from '../lib/telegram/sync';

// Загружаем переменные окружения из .env файла
config();

async function findMissingBooks() {
  try {
    console.log('🔍 Поиск недостающих книг между Telegram и базой данных...\n');
    
    // Используем правильные переменные окружения для облачного Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Не найдены переменные окружения Supabase');
      return;
    }

    // Создаем клиент Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Получаем все книги из базы данных
    console.log('📥 Получаем все книги из базы данных...');
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, title, author, telegram_post_id');

    if (booksError) {
      console.error('❌ Ошибка при получении книг из базы данных:', booksError);
      return;
    }

    console.log(`✅ Получено ${books.length} книг из базы данных\n`);

    // Получаем все обработанные сообщения из Telegram
    console.log('📥 Получаем все обработанные сообщения Telegram...');
    const { data: processedMessages, error: messagesError } = await supabase
      .from('telegram_processed_messages')
      .select('message_id, book_id');

    if (messagesError) {
      console.error('❌ Ошибка при получении обработанных сообщений:', messagesError);
      return;
    }

    console.log(`✅ Получено ${processedMessages.length} обработанных сообщений\n`);

    // Создаем множества для быстрого поиска
    const bookTelegramIds = new Set(books.map(book => book.telegram_post_id).filter(id => id));
    const processedMessageIds = new Set(processedMessages.map(msg => msg.message_id));

    // Находим сообщения, которые были обработаны, но не имеют соответствующих книг
    console.log('🔍 Поиск сообщений без соответствующих книг...');
    const messagesWithoutBooks = [];
    for (const message of processedMessages) {
      // Проверяем, есть ли книга, связанная с этим сообщением
      const book = books.find(b => b.id === message.book_id);
      if (!book) {
        messagesWithoutBooks.push(message);
      }
    }

    console.log(`❌ Найдено ${messagesWithoutBooks.length} сообщений без соответствующих книг:`);
    messagesWithoutBooks.forEach(msg => {
      console.log(`   - Сообщение ID: ${msg.message_id}, Book ID: ${msg.book_id}`);
    });

    // Находим книги, которые не имеют соответствующих сообщений
    console.log('\n🔍 Поиск книг без соответствующих сообщений...');
    const booksWithoutMessages = [];
    for (const book of books) {
      if (book.telegram_post_id && !processedMessageIds.has(book.telegram_post_id)) {
        booksWithoutMessages.push(book);
      }
    }

    console.log(`❌ Найдено ${booksWithoutMessages.length} книг без соответствующих сообщений:`);
    booksWithoutMessages.forEach(book => {
      console.log(`   - Книга: ${book.author} - ${book.title} (ID: ${book.id}, Telegram ID: ${book.telegram_post_id})`);
    });

    // Получаем общее количество сообщений в канале Telegram (приблизительно)
    console.log('\n🔍 Получаем приблизительное количество сообщений в канале Telegram...');
    const syncService = await TelegramSyncService.getInstance();
    if (!syncService['telegramClient']) {
      console.log('❌ Не удалось получить доступ к Telegram клиенту');
    } else {
      const channel = await syncService['telegramClient'].getMetadataChannel();
      
      // Convert BigInteger to string for compatibility
      const channelId = typeof channel.id === 'object' && channel.id !== null ? 
          (channel.id as { toString: () => string }).toString() : 
          String(channel.id);
      
      // Получаем несколько сообщений для оценки общего количества
      const messages = await syncService['telegramClient'].getMessages(channelId, 100) as unknown[];
      console.log(`📊 Примерное количество сообщений в Telegram канале: ${messages.length > 0 ? 'много' : 'неизвестно'}`);
    }

    // Выводим сводку
    console.log('\n📋 Сводка:');
    console.log(`   📚 Книг в базе данных: ${books.length}`);
    console.log(`   📨 Обработанных сообщений Telegram: ${processedMessages.length}`);
    console.log(`   ❌ Сообщений без книг: ${messagesWithoutBooks.length}`);
    console.log(`   ❌ Книг без сообщений: ${booksWithoutMessages.length}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Если скрипт запущен напрямую, выполняем функцию
if (require.main === module) {
  findMissingBooks();
}