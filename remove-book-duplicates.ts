import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Функция нормализации текста для сравнения с учетом Unicode нормализации и эмодзи
function normalizeText(text: string): string {
  if (!text) return '';
  
  // Применяем Unicode нормализацию для устранения различий в представлении символов
  let normalized = text.normalize('NFKC');
  
  // Приводим к нижнему регистру
  normalized = normalized.toLowerCase();
  
  // Удаляем эмодзи
  normalized = normalized.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
  
  // Удаляем годы в скобках (в формате (2023), (2019) и т.д.) и любые другие числа в скобках
  normalized = normalized.replace(/\(\d{4}\)/g, '');
  
  // Удаляем текст "ru", "ru", "en" и другие языковые обозначения
  normalized = normalized.replace(/\b[rRyYоOuUeEaAnN]\s*[uU]\b/g, '');
  
  // Удаляем любые другие символы в скобках, кроме чисел (для обработки скобок с годами издания)
  normalized = normalized.replace(/\((?!\d{4}\))[^\)]+\)/g, '');
  
  // Удаляем лишние пробелы
  normalized = normalized.trim().replace(/\s+/g, ' ');

  return normalized;
}

async function removeBookDuplicates() {
  console.log('🗑️ Начинаем процесс удаления дубликатов книг...');

  // Проверяем наличие необходимых переменных окружения
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('❌ Необходимо установить переменные окружения SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY');
    console.log('ℹ️  Добавьте в файл .env значения для NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY');
    return;
  }

  try {
    // Создаем клиент Supabase с сервисной ролью
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
      }
    });

    // Получаем все книги из базы данных (без ограничения по количеству)
    console.log('📥 Получаем все книги из базы данных...');
    const allBooks = [];
    let lastCreatedAt = null;
    const batchSize = 1000; // Получаем по 1000 записей за раз
    
    while (true) {
      let query = supabase
        .from('books')
        .select('id, title, author, created_at, telegram_file_id, file_url, file_size')
        .order('created_at', { ascending: true })
        .limit(batchSize);
        
      if (lastCreatedAt) {
        query = query.gt('created_at', lastCreatedAt);
      }
      
      const { data: batch, error } = await query;
      
      if (error) {
        throw new Error(`Ошибка при получении книг: ${error.message}`);
      }
      
      if (!batch || batch.length === 0) {
        break;
      }
      
      allBooks.push(...batch);
      lastCreatedAt = batch[batch.length - 1].created_at;
      
      console.log(`  → Получено ${batch.length} книг, всего: ${allBooks.length}`);
      
      // Если получено меньше batch size, значит это последняя страница
      if (batch.length < batchSize) {
        break;
      }
      
      // Небольшая пауза между запросами, чтобы не перегружать сервер
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ Всего получено книг: ${allBooks.length}`);

    if (!allBooks || allBooks.length === 0) {
      console.log('⚠️ В базе данных нет книг для проверки');
      return;
    }

    console.log(`\n📚 Всего книг в базе данных: ${allBooks.length}`);

    // Группируем книги по нормализованному автору и названию
    const booksByAuthorTitle = new Map<string, typeof allBooks>();
    
    for (const book of allBooks) {
      // Пропускаем книги с пустыми названиями или авторами
      if (!book.title || !book.author) {
        continue;
      }
      const normalizedAuthor = normalizeText(book.author);
      const normalizedTitle = normalizeText(book.title);
      const key = `${normalizedAuthor}|${normalizedTitle}`;
      if (!booksByAuthorTitle.has(key)) {
        booksByAuthorTitle.set(key, []);
      }
      booksByAuthorTitle.get(key)?.push(book);
    }

    // Находим группы с более чем одной книгой (дубликаты)
    const duplicateGroups = Array.from(booksByAuthorTitle.entries())
      .filter(([_, books]) => books.length > 1)
      .map(([key, books]) => ({ 
        key,
        books: books.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) // Сортируем по дате создания (старые первыми)
      }));

    if (duplicateGroups.length === 0) {
      console.log('\n✅ Дубликатов книг не найдено');
      return;
    }

    // Отображаем дубликаты перед удалением
    console.log(`\n📊 Найдено ${duplicateGroups.length} групп потенциальных дубликатов:`);
    
    const booksToDelete = [];
    
    for (const group of duplicateGroups) {
      console.log(`\n📖 Автор: "${group.books[0].author}", Название: "${group.books[0].title}"`);
      console.log(`  Количество книг в группе: ${group.books.length}`);
      
      // Оставляем только самую старую книгу (самую раннюю дату создания) и с лучшей информацией
      // Сначала находим книгу с файлом (если есть)
      const bookWithFile = group.books.find(book => book.file_url || book.telegram_file_id);
      const bookWithoutFile = group.books.filter(book => !book.file_url && !book.telegram_file_id);
      
      if (bookWithFile) {
        // Удаляем все книги в группе, кроме той, у которой есть файл
        for (const book of group.books) {
          if (book.id !== bookWithFile.id) {
            booksToDelete.push(book);
            console.log(`    - Удалить: ID ${book.id.substring(0, 8)}... - ${book.author} - ${book.title} (создана: ${book.created_at})`);
          }
        }
      } else {
        // Если ни у одной книги нет файла, оставляем самую старую (первую в отсортированном списке)
        for (let i = 1; i < group.books.length; i++) {
          const book = group.books[i];
          booksToDelete.push(book);
          console.log(`    - Удалить: ID ${book.id.substring(0, 8)}... - ${book.author} - ${book.title} (создана: ${book.created_at})`);
        }
      }
    }

    console.log(`\n🗑️ Всего будет удалено ${booksToDelete.length} книг`);

    // Немедленно начинаем удаление без запроса подтверждения
    console.log('\n🚀 Начинаем удаление дубликатов...');
    
    // Удаляем книги, применяя стратегию сохранения лучшей книги в каждой группе
    let deletedCount = 0;
    for (const book of booksToDelete) {
      try {
        // Обновляем telegram_processed_messages, связанные с этой книгой
        const { error: updateError } = await supabase
          .from('telegram_processed_messages')
          .update({ book_id: null })
          .eq('book_id', book.id);

        if (updateError) {
          console.error(`❌ Ошибка обновления telegram_processed_messages для книги ${book.id}:`, updateError);
        }

        // Обновляем user_books, связанные с этой книгой
        const { error: updateUserBooksError } = await supabase
          .from('user_books')
          .delete()
          .eq('book_id', book.id);

        if (updateUserBooksError) {
          console.error(`❌ Ошибка удаления из user_books для книги ${book.id}:`, updateUserBooksError);
        }

        // Удаляем саму книгу
        const { error: deleteError } = await supabase
          .from('books')
          .delete()
          .eq('id', book.id);

        if (deleteError) {
          console.error(`❌ Ошибка удаления книги ${book.id}:`, deleteError);
        } else {
          console.log(`✅ Удалена книга: ${book.id.substring(0, 8)}... - ${book.author} - ${book.title}`);
          deletedCount++;
        }
      } catch (error) {
        console.error(`❌ Ошибка при удалении книги ${book.id}:`, error);
      }
    }

    console.log(`\n✅ Удаление дубликатов завершено. Удалено ${deletedCount} книг.`);

  } catch (error) {
    console.error('❌ Ошибка при удалении дубликатов книг:', error);
    throw error;
  }
}

// Выполняем удаление
removeBookDuplicates()
  .then(() => {
    console.log('\n✅ Процесс удаления дубликатов завершен');
  })
  .catch((error) => {
    console.error('\n❌ Процесс удаления дубликатов завершен с ошибкой:', error);
  });