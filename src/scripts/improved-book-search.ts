import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения из .env файла
config();

interface BookSearchResult {
  id: string;
  title: string;
  author: string;
  score: number;
  matchType: 'exact' | 'relevant' | 'fuzzy';
}

async function searchBooksByRelevance(title: string, author: string): Promise<BookSearchResult[]> {
  console.log(`🔍 Поиск книг по релевантности: "${title}" автора ${author}`);
  
  try {
    // Получаем настройки Supabase из переменных окружения
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Не найдены настройки Supabase в переменных окружения');
      return [];
    }
    
    // Создаем клиент Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Нормализуем входные данные
    const normalizedTitle = title.toLowerCase().trim();
    const normalizedAuthor = author.toLowerCase().trim();
    
    // Разбиваем на слова для поиска
    const titleWords = normalizedTitle.split(/\s+/).filter(word => word.length > 1);
    const authorWords = normalizedAuthor.split(/\s+/).filter(word => word.length > 1);
    
    console.log(`  Слова в названии: [${titleWords.join(', ')}]`);
    console.log(`  Слова в авторе: [${authorWords.join(', ')}]`);
    
    // Поиск по точному совпадению
    console.log('  🔎 Поиск по точному совпадению...');
    const { data: exactMatches, error: exactError } = await supabase
      .from('books')
      .select('id, title, author')
      .ilike('title', `%${title}%`)
      .ilike('author', `%${author}%`);
    
    if (exactError) {
      console.error('  ❌ Ошибка поиска по точному совпадению:', exactError);
    } else if (exactMatches && exactMatches.length > 0) {
      console.log(`  ✅ Найдено ${exactMatches.length} точных совпадений`);
      return exactMatches.map(book => ({
        id: book.id,
        title: book.title,
        author: book.author,
        score: 100,
        matchType: 'exact'
      }));
    }
    
    // Поиск по релевантности
    console.log('  🔎 Поиск по релевантности...');
    const allSearchWords = [...titleWords, ...authorWords];
    const searchResults: BookSearchResult[] = [];
    
    // Ищем книги по каждому слову
    for (const word of allSearchWords) {
      // Поиск в названии
      const { data: titleMatches } = await supabase
        .from('books')
        .select('id, title, author')
        .ilike('title', `%${word}%`);
      
      // Поиск в авторе
      const { data: authorMatches } = await supabase
        .from('books')
        .select('id, title, author')
        .ilike('author', `%${word}%`);
      
      // Объединяем результаты
      const allMatches = [...(titleMatches || []), ...(authorMatches || [])];
      
      // Добавляем в общий список с подсчетом релевантности
      for (const book of allMatches) {
        const existingResult = searchResults.find(r => r.id === book.id);
        if (existingResult) {
          // Увеличиваем счетчик релевантности
          existingResult.score += 1;
        } else {
          // Добавляем новую запись
          searchResults.push({
            id: book.id,
            title: book.title,
            author: book.author,
            score: 1,
            matchType: 'relevant'
          });
        }
      }
    }
    
    // Сортируем по релевантности
    searchResults.sort((a, b) => b.score - a.score);
    
    // Фильтруем по минимальной релевантности
    const relevantMatches = searchResults.filter(result => result.score >= 2);
    
    console.log(`  ✅ Найдено ${relevantMatches.length} релевантных совпадений`);
    
    if (relevantMatches.length > 0) {
      console.log('  Топ совпадений:');
      relevantMatches.slice(0, 5).forEach((match, index) => {
        console.log(`    ${index + 1}. "${match.title}" автора ${match.author} (релевантность: ${match.score})`);
      });
    }
    
    return relevantMatches;
    
  } catch (error) {
    console.error('❌ Ошибка при поиске книг по релевантности:', error);
    return [];
  }
}

async function main() {
  console.log('🚀 Запуск улучшенного поиска книг');
  
  // Пример поиска для книги "Антон Карелин - Хроники Опустошённых земель"
  const title = "Хроники Опустошённых земель";
  const author = "Антон Карелин";
  
  const results = await searchBooksByRelevance(title, author);
  
  if (results.length > 0) {
    console.log('\n📊 Результаты поиска:');
    results.slice(0, 5).forEach((result, index) => {
      console.log(`${index + 1}. "${result.title}" автора ${result.author}`);
      console.log(`   ID: ${result.id}`);
      console.log(`   Тип совпадения: ${result.matchType}`);
      console.log(`   Релевантность: ${result.score}`);
      console.log('---');
    });
  } else {
    console.log('❌ Книги не найдены');
  }
}

main();