import { config } from 'dotenv';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Load environment variables FIRST
config({ path: '.env' });

async function checkBookExists() {
  try {
    // Create Supabase client directly with environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    const supabaseAdmin = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // Проверим, есть ли книги в базе данных
    console.log('Проверяем наличие книг в базе данных...');
    const { data: allBooks, error: allBooksError } = await supabaseAdmin
      .from('books')
      .select('id, title, author')
      .limit(10);
    
    if (allBooksError) {
      console.error('Ошибка при получении списка книг:', allBooksError.message);
      return;
    }
    
    console.log(`Найдено ${allBooks?.length || 0} книг:`);
    allBooks?.forEach((book: any) => {
      console.log(`  - ID: ${book.id}, "${book.title}" автора ${book.author}`);
    });
    
    // Проверим конкретную книгу, которую мы пытаемся найти
    console.log('\nПроверяем конкретную книгу: "Мицелий" автора "Вилма Кадлечкова"');
    
    // Поиск по точному совпадению
    const { data: exactMatch, error: exactError } = await supabaseAdmin
      .from('books')
      .select('id, title, author')
      .eq('title', 'Мицелий')
      .eq('author', 'Вилма Кадлечкова')
      .single();
    
    if (!exactError && exactMatch) {
      console.log(`✅ Найдена книга по точному совпадению: ID=${exactMatch.id}`);
    } else {
      console.log('❌ Книга не найдена по точному совпадению');
      if (exactError) {
        console.log(`  Ошибка: ${exactError.message}`);
      }
    }
    
    // Поиск с использованием нового алгоритма релевантности
    console.log('\nПоиск с использованием алгоритма релевантности...');
    
    // Разбиваем автора и название на слова для поиска
    const titleWords = 'Мицелий'.split(/\s+/).filter(word => word.length > 2);
    const authorWords = 'Вилма Кадлечкова'.split(/\s+/).filter(word => word.length > 2);
    const allSearchWords = [...titleWords, ...authorWords].filter(word => word.length > 0);
    
    console.log(`  Слова для поиска: [${allSearchWords.join(', ')}]`);
    
    if (allSearchWords.length > 0) {
      // Ищем книги, где в названии или авторе встречаются слова из поискового запроса
      const searchPromises = allSearchWords.map(async (word) => {
        const { data: titleMatches } = await (supabaseAdmin as any)
          .from('books')
          .select('id, title, author')
          .ilike('title', `%${word}%`)
          .limit(5);
        
        const { data: authorMatches } = await (supabaseAdmin as any)
          .from('books')
          .select('id, title, author')
          .ilike('author', `%${word}%`)
          .limit(5);
        
        const allMatches = [...(titleMatches || []), ...(authorMatches || [])];
        
        // Удаляем дубликаты по ID
        const uniqueMatches = allMatches.filter((book, index, self) => 
          index === self.findIndex(b => b.id === book.id)
        );
        
        return uniqueMatches;
      });
      
      // Выполняем все поисковые запросы параллельно
      const results = await Promise.all(searchPromises);
      
      // Объединяем все результаты
      const allMatches = results.flat();
      
      // Удаляем дубликаты по ID
      const uniqueMatches = allMatches.filter((book, index, self) => 
        index === self.findIndex(b => b.id === book.id)
      );
      
      // Сортируем по релевантности (по количеству совпадений)
      const matchesWithScores = uniqueMatches.map(book => {
        const bookTitleWords = book.title.toLowerCase().split(/\s+/);
        const bookAuthorWords = book.author.toLowerCase().split(/\s+/);
        const allBookWords = [...bookTitleWords, ...bookAuthorWords];
        
        // Считаем количество совпадений поисковых слов с словами в книге
        let score = 0;
        for (const searchWord of allSearchWords) {
          const normalizedSearchWord = searchWord.toLowerCase();
          let found = false;
          for (const bookWord of allBookWords) {
            const normalizedBookWord = bookWord.toLowerCase();
            // Проверяем точное совпадение или частичное включение
            if (normalizedBookWord.includes(normalizedSearchWord) || normalizedSearchWord.includes(normalizedBookWord)) {
              score++;
              found = true;
              break; // Не увеличиваем счетчик больше одного раза для одного поискового слова
            }
          }
        }
        
        return { ...book, score };
      });
      
      // Сортируем по убыванию счета
      matchesWithScores.sort((a, b) => b.score - a.score);
      
      // Берем только лучшие совпадения и фильтруем по минимальной релевантности
      const topMatches = matchesWithScores.slice(0, 5);
      
      // Возвращаем только совпадения с релевантностью >= 2
      return topMatches.filter(match => match.score >= 2);
    } else {
      console.log('⚠️ Недостаточно слов для поиска');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

checkBookExists();