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

async function debugFileSelector() {
  try {
    console.log('🔍 Детальная диагностика FileSelector...');
    
    // Получаем книги без файлов
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, title, author, publication_year')
      .is('file_url', null)
      .order('author', { ascending: true })
      .order('title', { ascending: true });

    if (booksError) {
      throw new Error(`Ошибка получения книг: ${booksError.message}`);
    }

    console.log(`📊 Всего книг без файлов: ${books?.length || 0}`);

    if (!books || books.length === 0) {
      console.log('❌ Нет книг без файлов');
      return;
    }

    // Получаем все файлы из telegram_files
    const { data: allFiles, error: filesError } = await supabase
      .from('telegram_files')
      .select('message_id, file_name, file_size, mime_type, caption, date');

    if (filesError) {
      throw new Error(`Ошибка получения файлов: ${filesError.message}`);
    }

    console.log(`📁 Всего файлов в Telegram: ${allFiles?.length || 0}`);

    // Проверяем первые 3 книги
    const testBooks = books.slice(0, 3);
    console.log(`\n📋 Тестирование обновления для ${testBooks.length} книг:`);

    for (let i = 0; i < testBooks.length; i++) {
      const book = testBooks[i];
      console.log(`\n--- Книга ${i + 1}/${testBooks.length} ---`);
      console.log(`📚 "${book.title}" - ${book.author} (ID: ${book.id})`);
      
      // Ищем подходящие файлы
      const matchingFiles = findMatchingFiles(book, allFiles || []);
      
      console.log(`🎯 Найдено подходящих файлов: ${matchingFiles.length}`);
      
      if (matchingFiles.length > 0) {
        console.log('📋 Топ-5 подходящих файлов:');
        matchingFiles.slice(0, 5).forEach((file, index) => {
          console.log(`  ${index + 1}. ${file.file_name || `Файл ${file.message_id}`} (Релевантность: ${file.relevance_score})`);
        });
      } else {
        console.log('  Нет подходящих файлов');
      }
    }

    console.log('\n✅ Диагностика завершена');
  } catch (error) {
    console.error('❌ Ошибка диагностики:', error);
    process.exit(1);
  }
}

debugFileSelector();