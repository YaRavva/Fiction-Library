import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Функция нормализации текста для сравнения
function normalizeText(text: string): string {
  if (!text) return '';
  
  let normalized = text.toLowerCase();
  
  // Удаляем годы в скобках (в формате (2023), (2019) и т.д.)
  normalized = normalized.replace(/\(\d{4}\)/g, '');
  
  // Удаляем текст "ru" (часто используется для обозначения языка)
  normalized = normalized.replace(/\bru\b/g, '');
  
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

    // Получаем все книги из базы данных
    const { data: allBooks, error } = await supabase
      .from('books')
      .select('id, title, author, created_at, telegram_file_id, file_url, file_size');
    
    if (error) {
      throw new Error(`Ошибка при получении книг: ${error.message}`);
    }

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
      
      // Сохраняем все книги в группе, кроме первой (самой старой), для удаления
      for (let i = 1; i < group.books.length; i++) {
        const book = group.books[i];
        booksToDelete.push(book);
        console.log(`    - Удалить: ID ${book.id.substring(0, 8)}... - ${book.author} - ${book.title} (создана: ${book.created_at})`);
      }
    }

    console.log(`\n🗑️ Всего будет удалено ${booksToDelete.length} книг`);

    // Запрашиваем подтверждение перед удалением
    console.log('\n⚠️  ВНИМАНИЕ! Это действие нельзя отменить.');
    console.log('Для подтверждения удаления введите "DELETE_DUPLICATES":');

    // Используем readline для получения подтверждения
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('> ', (answer) => {
        if (answer === 'DELETE_DUPLICATES') {
            console.log('\n🚀 Начинаем удаление дубликатов...');
            
            (async () => {
              // Удаляем книги, оставляя только самые старые записи в каждой группе
              for (const book of booksToDelete) {
                try {
                  // Удаляем связанные записи в других таблицах (если есть)
                  // Обновляем telegram_processed_messages, связанные с этой книгой
                  const { error: updateError } = await supabase
                    .from('telegram_processed_messages')
                    .update({ book_id: null })
                    .eq('book_id', book.id);

                  if (updateError) {
                    console.error(`❌ Ошибка обновления telegram_processed_messages для книги ${book.id}:`, updateError);
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
                  }
                } catch (error) {
                  console.error(`❌ Ошибка при удалении книги ${book.id}:`, error);
                }
              }

              console.log(`\n✅ Удаление дубликатов завершено. Удалено ${booksToDelete.length} книг.`);
              rl.close();
            })();
        } else {
            console.log('\n❌ Удаление отменено. Введено неправильное подтверждение.');
            rl.close();
        }
    });

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