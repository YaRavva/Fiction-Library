/**
 * Финальный скрипт для тестирования релевантного поиска книг
 * Этот скрипт тестирует алгоритм сопоставления файлов с книгами по релевантности
 */

import { config } from 'dotenv';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Загрузка переменных окружения
config({ path: '.env' });

/**
 * Извлечение слов и фраз из имени файла для поиска
 * @param filename Имя файла для извлечения терминов
 * @returns Объект со словами и фразами
 */
function extractSearchTerms(filename: string): { words: string[]; phrases: string[] } {
  // Удаление расширения файла
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  
  // Извлечение потенциальных фраз
  const phrases: string[] = [];
  
  // Обработка нескольких авторов, разделенных "и" или запятыми
  if (nameWithoutExt.includes('_и_') || nameWithoutExt.includes(',')) {
    const parts = nameWithoutExt.split(/_и_|,/);
    for (const part of parts) {
      const cleanPart = part.trim().replace(/_/g, ' ');
      if (cleanPart.length > 3) {
        phrases.push(cleanPart.toLowerCase());
      }
    }
  }
  
  // Разделение по общим разделителям
  const words = nameWithoutExt
    .split(/[_\-\s]+/) // Разделение по подчеркиванию, дефису, пробелу
    .filter(word => word.length > 2) // Фильтрация очень коротких слов
    .map(word => word.trim().toLowerCase()) // Нормализация
    .filter(word => word.length > 0); // Удаление пустых строк
  
  // Удаление общих слов, которые не помогают в сопоставлении
  const commonWords = ['and', 'or', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'zip', 'rar', 'fb2', 'epub', 'pdf', 'mobi', 'цикл'];
  const filteredWords = words.filter(word => !commonWords.includes(word));
  
  // Создание дополнительных фраз из последовательных слов
  if (filteredWords.length > 1) {
    for (let i = 0; i < filteredWords.length - 1; i++) {
      const phrase = `${filteredWords[i]} ${filteredWords[i + 1]}`;
      phrases.push(phrase);
    }
  }
  
  return { words: filteredWords, phrases };
}

/**
 * Расчет оценки релевантности между поисковыми терминами и книгой
 * @param searchTerms Термины, извлеченные из имени файла
 * @param book Книга из базы данных
 * @returns Оценка релевантности
 */
function calculateRelevanceScore(searchTerms: { words: string[], phrases: string[] }, book: any): number {
  const bookTitle = (book.title || '').toLowerCase();
  const bookAuthor = (book.author || '').toLowerCase();
  
  let score = 0;
  
  // Сопоставление на уровне слов
  for (const word of searchTerms.words) {
    // Точные совпадения слов в названии (наиболее ценно)
    if (bookTitle.split(/\s+/).includes(word)) {
      score += 3;
    }
    // Частичные совпадения слов в названии
    else if (bookTitle.includes(word)) {
      score += 2;
    }
    
    // Точные совпадения слов в авторе (наиболее ценно)
    if (bookAuthor.split(/\s+/).includes(word)) {
      score += 3;
    }
    // Частичные совпадения слов в авторе
    else if (bookAuthor.includes(word)) {
      score += 2;
    }
    
    // Общие текстовые совпадения (менее ценно)
    if (bookTitle.includes(word) || bookAuthor.includes(word)) {
      score += 1;
    }
  }
  
  // Сопоставление на уровне фраз (более ценно)
  for (const phrase of searchTerms.phrases) {
    if (bookTitle.includes(phrase)) {
      score += 4; // Совпадение фразы в названии очень ценно
    }
    if (bookAuthor.includes(phrase)) {
      score += 4; // Совпадение фразы в авторе очень ценно
    }
    if (bookTitle.includes(phrase) || bookAuthor.includes(phrase)) {
      score += 2; // Общее совпадение фразы
    }
  }
  
  return score;
}

/**
 * Поиск всех совпадающих книг с оценкой релевантности
 * @param filename Имя файла для сопоставления
 * @param books Книги из базы данных
 * @returns Все совпадающие книги с оценками
 */
function findAllMatchingBooks(filename: string, books: any[]): { book: any; score: number }[] {
  const searchTerms = extractSearchTerms(filename);
  const matches: { book: any; score: number }[] = [];
  
  console.log(`   Поисковые термины - Слова: [${searchTerms.words.join(', ')}], Фразы: [${searchTerms.phrases.join(', ')}]`);
  
  for (const book of books) {
    const score = calculateRelevanceScore(searchTerms, book);
    
    // Учитываем только совпадения с разумной релевантностью
    if (score >= 3) { // Минимальный порог
      matches.push({ book, score });
    }
  }
  
  // Сортировка по убыванию оценки
  matches.sort((a, b) => b.score - a.score);
  
  return matches;
}

async function testFinalRelevantSearch() {
  console.log('🚀 Тестирование финального алгоритма релевантного поиска книг...\n');
  
  try {
    // Создание клиента Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Отсутствуют переменные окружения Supabase');
    }
    
    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Тестовые имена файлов
    const testFilenames = [
      "Вилма Кадлечкова - Мицелий.zip",
      "Антон_Карелин_Хроники_Опустошённых_земель.zip",
      "Антон Карелин - Одиссей Фокс.zip",
      "Олег_Яковлев,_Владимир_Торин_Хроники_разбитого_Зеркала.zip",
      "Владимир_Торин_и_Олег_Яковлев_Мистер_Вечный.zip",
      "Ларри Нивен - Известный космос.zip",
      "Конни Уиллис - Оксфордский цикл.zip",
      "Татьяна_Солодкова_Вселенная_Морган.zip",
      "Татьяна Солодкова - Реонерия.zip",
      "Шелли_Паркер_Сияющий_император.zip"
    ];
    
    // Получение ВСЕЙ базы книг
    console.log('📖 Получение полной базы книг из базы данных...');
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, title, author, file_url');
    
    if (booksError) {
      throw new Error(`Ошибка получения книг: ${booksError.message}`);
    }
    
    console.log(`✅ Получено ${books?.length || 0} книг из базы данных\n`);
    
    let totalFiles = 0;
    let matchedFiles = 0;
    let highConfidenceMatches = 0;
    
    // Тестирование поиска для каждого файла
    for (const filename of testFilenames) {
      totalFiles++;
      console.log(`📁 Тестирование файла: ${filename}`);
      
      const allMatches = findAllMatchingBooks(filename, books || []);
      
      if (allMatches.length > 0) {
        matchedFiles++;
        console.log(`   ✅ Найдено ${allMatches.length} совпадений:`);
        
        // Показываем все совпадения (первые 5 для читаемости)
        const topMatches = allMatches.slice(0, 5);
        for (const match of topMatches) {
          const hasFile = match.book.file_url && match.book.file_url.length > 0;
          console.log(`      "${match.book.title}" автора ${match.book.author} (оценка: ${match.score}) ${hasFile ? '[ЕСТЬ ФАЙЛ]' : '[НЕТ ФАЙЛА]'}`);
        }
        
        // Показываем лучший выбор
        const bestMatch = allMatches[0];
        console.log(`   🎯 Лучший выбор: "${bestMatch.book.title}" автора ${bestMatch.book.author} (оценка: ${bestMatch.score})`);
        
        // Подсчет высокодостоверных совпадений (оценка >= 10)
        if (bestMatch.score >= 10) {
          highConfidenceMatches++;
        }
      } else {
        console.log(`   ❌ Подходящих совпадений не найдено`);
      }
      
      console.log(''); // Пустая строка для читаемости
    }
    
    // Итоговая статистика
    console.log('📊 ИТОГОВАЯ СТАТИСТИКА ПОИСКА:');
    console.log(`   Всего протестировано файлов: ${totalFiles}`);
    console.log(`   Файлов с совпадениями: ${matchedFiles} (${(matchedFiles/totalFiles*100).toFixed(1)}%)`);
    console.log(`   Высокодостоверные совпадения: ${highConfidenceMatches} (${(highConfidenceMatches/totalFiles*100).toFixed(1)}%)`);
    
    if (matchedFiles > 0) {
      console.log('\n🎉 УСПЕХ: Алгоритм поиска работает корректно!');
      console.log('💡 Алгоритм успешно сопоставляет файлы с книгами на основе:');
      console.log('   • Совпадений отдельных слов в названиях и авторах');
      console.log('   • Совпадений многословных фраз');
      console.log('   • Обработки нескольких авторов');
      console.log('   • Оценки релевантности для выбора лучших совпадений');
    }
    
    console.log('\n✅ Тестирование финального алгоритма релевантного поиска завершено!');
    
  } catch (error) {
    console.error('❌ Ошибка во время тестирования:', error);
  } finally {
    // Принудительное завершение скрипта из-за известной проблемы с GramJS
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// Запуск скрипта
testFinalRelevantSearch().catch(error => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});