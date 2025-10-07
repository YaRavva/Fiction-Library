import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения из .env файла
config();

async function analyzeBooks() {
  try {
    console.log('🔍 Анализ книг и сообщений...\n');
    
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

    // Анализируем данные
    console.log('📊 Анализ данных:');
    
    // Книги с telegram_post_id
    const booksWithTelegramId = books.filter(book => book.telegram_post_id);
    console.log(`   📚 Книг с telegram_post_id: ${booksWithTelegramId.length}`);
    
    // Книги без telegram_post_id
    const booksWithoutTelegramId = books.filter(book => !book.telegram_post_id);
    console.log(`   📚 Книг без telegram_post_id: ${booksWithoutTelegramId.length}`);
    
    // Сообщения с book_id
    const messagesWithBookId = processedMessages.filter(msg => msg.book_id);
    console.log(`   📨 Сообщений с book_id: ${messagesWithBookId.length}`);
    
    // Сообщения без book_id
    const messagesWithoutBookId = processedMessages.filter(msg => !msg.book_id);
    console.log(`   📨 Сообщений без book_id: ${messagesWithoutBookId.length}`);
    
    // Книги, которые связаны с сообщениями
    const linkedBooks = new Set(messagesWithBookId.map(msg => msg.book_id));
    const booksLinkedToMessages = books.filter(book => linkedBooks.has(book.id));
    console.log(`   🔗 Книг, связанных с сообщениями: ${booksLinkedToMessages.length}`);
    
    // Книги, которые НЕ связаны с сообщениями
    const booksNotLinkedToMessages = books.filter(book => !linkedBooks.has(book.id));
    console.log(`   🔗 Книг, НЕ связанных с сообщениями: ${booksNotLinkedToMessages.length}`);
    
    // Показываем несколько книг, которые НЕ связаны с сообщениями
    console.log('\n📋 Несколько книг, которые НЕ связаны с сообщениями:');
    booksNotLinkedToMessages.slice(0, 10).forEach(book => {
      console.log(`   - ${book.author} - ${book.title} (ID: ${book.id})`);
    });
    
    // Проверяем, есть ли дубликаты среди книг без telegram_post_id
    console.log('\n🔍 Проверка на дубликаты среди книг без telegram_post_id...');
    const duplicates = [];
    const bookKeys = new Set();
    
    for (const book of booksWithoutTelegramId) {
      const key = `${book.author}|||${book.title}`;
      if (bookKeys.has(key)) {
        duplicates.push(book);
      } else {
        bookKeys.add(key);
      }
    }
    
    console.log(`   ❌ Найдено дубликатов: ${duplicates.length}`);
    
    if (duplicates.length > 0) {
      console.log('   Дубликаты:');
      duplicates.slice(0, 10).forEach(book => {
        console.log(`     - ${book.author} - ${book.title} (ID: ${book.id})`);
      });
    }
    
    // Проверяем, есть ли книги с одинаковым telegram_post_id
    console.log('\n🔍 Проверка на книги с одинаковым telegram_post_id...');
    const telegramIdMap = new Map();
    const duplicateTelegramBooks = [];
    
    for (const book of booksWithTelegramId) {
      if (telegramIdMap.has(book.telegram_post_id)) {
        duplicateTelegramBooks.push(book);
        // Добавляем также первую книгу с этим ID
        const firstBook = telegramIdMap.get(book.telegram_post_id);
        if (!duplicateTelegramBooks.includes(firstBook)) {
          duplicateTelegramBooks.push(firstBook);
        }
      } else {
        telegramIdMap.set(book.telegram_post_id, book);
      }
    }
    
    console.log(`   ❌ Найдено книг с дублирующимся telegram_post_id: ${duplicateTelegramBooks.length}`);
    
    if (duplicateTelegramBooks.length > 0) {
      console.log('   Книги с дублирующимся telegram_post_id:');
      // Группируем по telegram_post_id
      const grouped = new Map();
      for (const book of duplicateTelegramBooks) {
        if (!grouped.has(book.telegram_post_id)) {
          grouped.set(book.telegram_post_id, []);
        }
        grouped.get(book.telegram_post_id).push(book);
      }
      
      Array.from(grouped.entries()).slice(0, 5).forEach(([telegramId, books]) => {
        console.log(`     Telegram ID: ${telegramId}`);
        (books as { author: string; title: string; id: string }[]).forEach(book => {
          console.log(`       - ${book.author} - ${book.title} (ID: ${book.id})`);
        });
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Если скрипт запущен напрямую, выполняем функцию
if (require.main === module) {
  analyzeBooks();
}