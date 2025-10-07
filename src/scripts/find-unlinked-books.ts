import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения из .env файла
config();

async function findUnlinkedBooks() {
  try {
    console.log('🔍 Поиск книг, не связанных с сообщениями Telegram...\n');
    
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
      .select('id, title, author, telegram_post_id, created_at, updated_at');

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

    // Находим книги, которые НЕ связаны с сообщениями
    const linkedBooks = new Set(processedMessages.map(msg => msg.book_id));
    const booksNotLinkedToMessages = books.filter(book => !linkedBooks.has(book.id));
    
    console.log(`🔗 Найдено ${booksNotLinkedToMessages.length} книг, не связанных с сообщениями:`);
    
    // Сортируем по дате создания (новые первыми)
    booksNotLinkedToMessages.sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    
    // Выводим информацию о книгах
    booksNotLinkedToMessages.forEach((book, index) => {
      console.log(`${index + 1}. ${book.author} - ${book.title}`);
      console.log(`   ID: ${book.id}`);
      console.log(`   Telegram ID: ${book.telegram_post_id || 'нет'}`);
      console.log(`   Создан: ${new Date(book.created_at).toLocaleString()}`);
      console.log(`   Обновлен: ${new Date(book.updated_at).toLocaleString()}`);
      console.log('');
    });
    
    // Анализируем, когда были добавлены эти книги
    console.log('📅 Анализ дат добавления книг:');
    const dates = booksNotLinkedToMessages.map(book => {
      return new Date(book.created_at).toLocaleDateString();
    });
    
    // Подсчитываем количество книг по датам
    const dateCounts = dates.reduce((acc, date) => {
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('Количество книг по датам добавления:');
    Object.entries(dateCounts).forEach(([date, count]) => {
      console.log(`   ${date}: ${count} книг`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Если скрипт запущен напрямую, выполняем функцию
if (require.main === module) {
  findUnlinkedBooks();
}