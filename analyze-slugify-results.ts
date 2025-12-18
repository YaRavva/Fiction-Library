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

async function analyzeSlugifyResults() {
  console.log('Анализ результатов slugify для различных строк...');
  
  try {
    // Получаем все книги из базы данных
    const { data: books, error } = await supabase
      .from('books')
      .select('id, title, author')
      .limit(20); // Ограничим для примера
    
    if (error) {
      console.error('Ошибка при получении книг:', error);
      return;
    }
    
    if (!books || books.length === 0) {
      console.log('В базе данных нет книг');
      return;
    }
    
    console.log(`Анализ первых ${books.length} книг:\n`);
    
    // Анализируем каждую книгу
    for (const book of books) {
      const titleSlug = slugify(book.title || '');
      const authorSlug = slugify(book.author || '');
      
      console.log(`ID: ${book.id}`);
      console.log(`Title: "${book.title}"`);
      console.log(`Title Slug: "${titleSlug}"`);
      console.log(`Author: "${book.author}"`);
      console.log(`Author Slug: "${authorSlug}"`);
      console.log('---');
    }
    
    // Тестовые примеры для понимания работы функции
    console.log('\nТестовые примеры:');
    const testCases = [
      'Цикл Я работаю на себя',
      'цикл Ученые-авантюристы',
      'Северный удел (2016)',
      'Андрей Кокоулин',
      'Александр Тарарев и Юрий Тарарев',
      'Бернард Вербер',
      'Джеймс Роллинс',
      '   ',
      '',
      '123',
      '!@#$%^&*()',
      'Тест с - дефисами',
      'Тест   с   множественными    пробелами',
      'Тест-с-многими-дефисами',
      'Тест с символами: !@#$%^&*()_+',
      'Тест с русскими буквами и символами: ёЁъЫэЮ'
    ];
    
    testCases.forEach(testCase => {
      const result = slugify(testCase);
      console.log(`"${testCase}" -> "${result}"`);
    });
    
  } catch (error) {
    console.error('Произошла ошибка:', error);
  }
}

// Запускаем анализ
analyzeSlugifyResults();