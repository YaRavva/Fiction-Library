import { createClient } from '@supabase/supabase-js';
import { slugify } from './src/lib/slugify';
import { config } from 'dotenv';

// Загружаем переменные окружения из .env файла
config();

// Создаем клиент Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Отсутствуют переменные окружения Supabase');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSlugifyIssues() {
  console.log('Проверка книг на проблемы с slugify...');
  
  try {
    // Получаем все книги из базы данных
    const { data: books, error } = await supabase
      .from('books')
      .select('id, title, author');
    
    if (error) {
      console.error('Ошибка при получении книг:', error);
      return;
    }
    
    if (!books || books.length === 0) {
      console.log('В базе данных нет книг');
      return;
    }
    
    console.log(`Всего книг в базе: ${books.length}`);
    
    // Проверяем каждую книгу
    const problematicBooks: Array<{id: string, title: string, author: string, titleSlug: string, authorSlug: string}> = [];
    
    for (const book of books) {
      const titleSlug = slugify(book.title || '');
      const authorSlug = slugify(book.author || '');
      
      // Если slugify(title) или slugify(author) возвращает пустую строку
      if (titleSlug === '' || authorSlug === '') {
        problematicBooks.push({
          id: book.id,
          title: book.title || '',
          author: book.author || '',
          titleSlug,
          authorSlug
        });
      }
    }
    
    // Выводим результаты
    if (problematicBooks.length === 0) {
      console.log('✅ Все книги прошли проверку. Нет книг с пустыми slugify результатами.');
    } else {
      console.log(`❌ Найдено ${problematicBooks.length} книг с проблемами slugify:`);
      console.log('');
      
      problematicBooks.forEach(book => {
        console.log(`ID: ${book.id}`);
        console.log(`Title: "${book.title}" -> slugify: "${book.titleSlug}"`);
        console.log(`Author: "${book.author}" -> slugify: "${book.authorSlug}"`);
        console.log('---');
      });
      
      console.log('');
      console.log('Идентификаторы проблемных книг:');
      problematicBooks.forEach(book => {
        console.log(book.id);
      });
    }
    
  } catch (error) {
    console.error('Произошла ошибка:', error);
  }
}

// Запускаем проверку
checkSlugifyIssues();