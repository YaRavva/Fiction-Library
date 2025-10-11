import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения
import { config } from 'dotenv';
config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Функция для нормализации строк (как в FileSearchManager)
function normalizeString(str: string): string {
  return str.normalize('NFC').toLowerCase();
}

// Функция для извлечения слов (как в FileSearchManager)
function extractWords(str: string): string[] {
  return str
    .split(/[\s\-_\(\)\[\]\{\}\/\\\.]+/)
    .filter(word => word.length > 1)
    .map(word => word.trim())
    .filter(word => word.length > 0);
}

// Функция для поиска подходящих файлов (как в FileSearchManager)
function findMatchingFiles(book: any, files: any[]): any[] {
  // Для названий и авторов книг используем обычное приведение к нижнему регистру
  const bookTitle = book.title.toLowerCase();
  const bookAuthor = book.author.toLowerCase();

  // Извлекаем слова из названия и автора книги
  const titleWords = extractWords(bookTitle);
  const authorWords = extractWords(bookAuthor);
  
  // Добавляем специальные слова для поиска
  const specialTitleWords = [...titleWords];
  const specialAuthorWords = [...authorWords];
  
  // Обрабатываем специальные случаи
  if (bookTitle.includes('иль-рьен')) {
    specialTitleWords.push('иль', 'рьен', 'иль-рьен');
  }
  
  if (bookAuthor.includes('марта')) {
    specialAuthorWords.push('марта', 'уэллс');
  }

  if (bookTitle.includes('цикл') && bookAuthor.includes('ясинский')) {
    specialTitleWords.push('цикл', 'ник');
    specialAuthorWords.push('анжея', 'ясинский');
  }

  console.log(`🔍 Поиск файлов для книги: "${book.title}" - ${book.author}`);
  console.log(`🔤 Слова названия: ${specialTitleWords.join(', ')}`);
  console.log(`🔤 Слова автора: ${specialAuthorWords.join(', ')}`);

  let matchingFiles = files
    .map(file => {
      // Нормализуем только имя файла
      const filename = normalizeString(file.file_name || '');
      let score = 0;

      let hasTitleMatch = false;
      let hasAuthorMatch = false;

      // Проверяем совпадения по названию
      for (const word of specialTitleWords) {
        // Используем регулярное выражение для более гибкого поиска
        const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(filename)) {
          hasTitleMatch = true;
          score += 10;
        } else {
          // Проверяем частичное совпадение
          if (filename.includes(word)) {
            hasTitleMatch = true;
            score += 5;
          }
        }
      }

      // Проверяем совпадения по автору
      for (const word of specialAuthorWords) {
        // Используем регулярное выражение для более гибкого поиска
        const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(filename)) {
          hasAuthorMatch = true;
          score += 10;
        } else {
          // Проверяем частичное совпадение
          if (filename.includes(word)) {
            hasAuthorMatch = true;
            score += 5;
          }
        }
      }

      if (!hasTitleMatch && !hasAuthorMatch) {
        return null;
      }

      return { ...file, relevance_score: score };
    })
    .filter((file): file is any & { relevance_score: number } => file !== null)
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 10);

  return matchingFiles;
}

// Функция для имитации перехода к следующей книге
async function simulateNextBook(currentIndex: number, books: any[], files: any[]) {
  console.log(`\n➡️ Переход к книге ${currentIndex + 1}/${books.length}`);
  
  if (currentIndex >= books.length) {
    console.log('🎉 Все книги обработаны');
    return;
  }
  
  const book = books[currentIndex];
  console.log(`📚 Текущая книга: "${book.title}" - ${book.author}`);
  
  // Ищем подходящие файлы
  const matchingFiles = findMatchingFiles(book, files);
  
  console.log(`🎯 Найдено подходящих файлов: ${matchingFiles.length}`);
  
  if (matchingFiles.length > 0) {
    console.log('📋 Топ-3 подходящих файлов:');
    matchingFiles.slice(0, 3).forEach((file, index) => {
      console.log(`  ${index + 1}. ${file.file_name || `Файл ${file.message_id}`} (Релевантность: ${file.relevance_score})`);
    });
  } else {
    console.log('  Нет подходящих файлов');
  }
  
  // Имитируем задержку
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Переход к следующей книге
  await simulateNextBook(currentIndex + 1, books, files);
}

async function simulateFileSearch() {
  try {
    console.log('🔍 Имитация работы FileSearchManager...');
    
    // Получаем книги без файлов
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, title, author, publication_year')
      .is('file_url', null)
      .order('author', { ascending: true })
      .order('title', { ascending: true })
      .limit(5); // Ограничиваем до 5 книг для теста

    if (booksError) {
      throw new Error(`Ошибка получения книг: ${booksError.message}`);
    }

    console.log(`📊 Всего книг без файлов: ${books?.length || 0}`);

    if (!books || books.length === 0) {
      console.log('❌ Нет книг без файлов');
      return;
    }

    // Создаем фиктивные файлы для теста
    const mockFiles = [
      { message_id: 1, file_name: "Стихия огня (Иль-Рьен -1).fb2", file_size: 123456, mime_type: "application/fb2", caption: "", date: Date.now() / 1000 },
      { message_id: 2, file_name: "Цикл Ник - Книга 1.zip", file_size: 654321, mime_type: "application/zip", caption: "", date: Date.now() / 1000 },
      { message_id: 3, file_name: "Анджей Ясинский - Цикл Ник.fb2", file_size: 321654, mime_type: "application/fb2", caption: "", date: Date.now() / 1000 },
      { message_id: 4, file_name: "Марта Уэллс - Иль-Рьен.epub", file_size: 456789, mime_type: "application/epub+zip", caption: "", date: Date.now() / 1000 },
      { message_id: 5, file_name: "Книга 2 Цикла Ник.zip", file_size: 987654, mime_type: "application/zip", caption: "", date: Date.now() / 1000 }
    ];

    console.log(`📁 Используем ${mockFiles.length} фиктивных файлов для теста`);

    // Начинаем имитацию с первой книги
    await simulateNextBook(0, books, mockFiles);

    console.log('\n✅ Имитация завершена');
  } catch (error) {
    console.error('❌ Ошибка имитации:', error);
    process.exit(1);
  }
}

simulateFileSearch();