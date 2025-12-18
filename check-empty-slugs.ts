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

async function checkEmptySlugs() {
  console.log('Проверка книг на пустые slugify результаты...');
  
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
    const problematicBooks: Array<{id: string, title: string, author: string, titleSlug: string, authorSlug: string, issue: string}> = [];
    const booksWithOnlySpecialChars: Array<{id: string, title: string, author: string}> = [];
    
    for (const book of books) {
      const titleSlug = slugify(book.title || '');
      const authorSlug = slugify(book.author || '');
      
      // Проверяем, содержит ли оригинальный текст только символы, которые будут удалены
      const titleHasOnlySpecialChars = book.title && !/[a-zA-Zа-яА-Я0-9]/.test(book.title);
      const authorHasOnlySpecialChars = book.author && !/[a-zA-Zа-яА-Я0-9]/.test(book.author);
      
      if (titleHasOnlySpecialChars) {
        booksWithOnlySpecialChars.push({
          id: book.id,
          title: book.title || '',
          author: book.author || ''
        });
      }
      
      if (authorHasOnlySpecialChars) {
        if (!booksWithOnlySpecialChars.find(b => b.id === book.id)) {
          booksWithOnlySpecialChars.push({
            id: book.id,
            title: book.title || '',
            author: book.author || ''
          });
        }
      }
      
      // Если slugify(title) или slugify(author) возвращает пустую строку
      if (titleSlug === '' || authorSlug === '') {
        let issue = '';
        if (titleSlug === '' && authorSlug === '') {
          issue = 'Оба поля (title и author) дают пустой slug';
        } else if (titleSlug === '') {
          issue = 'Title дает пустой slug';
        } else {
          issue = 'Author дает пустой slug';
        }
        
        problematicBooks.push({
          id: book.id,
          title: book.title || '',
          author: book.author || '',
          titleSlug,
          authorSlug,
          issue
        });
      }
    }
    
    // Выводим результаты
    if (booksWithOnlySpecialChars.length > 0) {
      console.log(`\n⚠️  Найдено ${booksWithOnlySpecialChars.length} книг, содержащих только специальные символы:`);
      booksWithOnlySpecialChars.forEach(book => {
        console.log(`ID: ${book.id}`);
        console.log(`Title: "${book.title}"`);
        console.log(`Author: "${book.author}"`);
        console.log('---');
      });
    }
    
    if (problematicBooks.length === 0) {
      console.log('\n✅ Все книги прошли проверку. Нет книг с пустыми slugify результатами.');
    } else {
      console.log(`\n❌ Найдено ${problematicBooks.length} книг с проблемами slugify:`);
      console.log('');
      
      problematicBooks.forEach(book => {
        console.log(`ID: ${book.id}`);
        console.log(`Title: "${book.title}" -> slugify: "${book.titleSlug}"`);
        console.log(`Author: "${book.author}" -> slugify: "${book.authorSlug}"`);
        console.log(`Проблема: ${book.issue}`);
        console.log('---');
      });
      
      console.log('\nИдентификаторы проблемных книг:');
      problematicBooks.forEach(book => {
        console.log(book.id);
      });
    }
    
  } catch (error) {
    console.error('Произошла ошибка:', error);
  }
}

// Запускаем проверку
checkEmptySlugs();