import { UniversalFileMatcher } from '../lib/universal-file-matcher';
import { serverSupabase } from '../lib/serverSupabase';
import { TelegramFileService } from '../lib/telegram/file-service';

interface Book {
  id: string;
  title: string;
  author: string;
  publication_year?: number;
}

interface FileOption {
  message_id: number;
  file_name: string;
  mime_type: string;
  file_size?: number;
}

async function testUniversalMatcherOnRealData() {
  console.log('Тестирование универсального алгоритма сопоставления на реальных данных...\n');
  
  try {
    // Получаем книги из БД (только книги без файлов)
    console.log('Загрузка книг из базы данных...');
    const { data: books, error: booksError } = await serverSupabase
      .from('books')
      .select('id, title, author, publication_year')
      .not('title', 'is', null)
      .not('author', 'is', null)
      .is('file_url', null); // Только книги без файлов
    
    if (booksError) {
      console.error('Ошибка при загрузке книг:', booksError);
      return;
    }
    
    if (!books || books.length === 0) {
      console.log('Не найдено книг без файлов для анализа');
      return;
    }
    
    console.log(`Загружено ${books.length} книг без файлов\n`);

    // Инициализируем TelegramFileService для получения файлов
    const fileService = await TelegramFileService.getInstance();
    
    // Загружаем файлы из Telegram по 1000 за раз
    let offsetId: number | undefined = undefined;
    let hasMoreFiles = true;
    let fileBatchIndex = 0;
    let totalProcessed = 0;
    let totalMatches = 0;
    
    while (hasMoreFiles) {
      console.log(`\nЗагрузка батча файлов ${++fileBatchIndex} из Telegram (по 1000)...`);
      const filesBatch = await fileService.getFilesToProcess(1000, offsetId);

      if (filesBatch.length === 0) {
        console.log('Больше нет файлов для анализа');
        break;
      }

      console.log(`Получено ${filesBatch.length} потенциальных файлов в батче`);
      
      // Преобразуем полученные данные в нужный формат
      const telegramFiles: FileOption[] = filesBatch
        .filter(item => item && item.filename && item.messageId)
        .map(item => ({
          message_id: parseInt(String(item.messageId), 10),
          file_name: item.filename as string,
          mime_type: item.mimeType as string || 'unknown',
          file_size: item.fileSize ? parseInt(String(item.fileSize), 10) : undefined
        }))
        .filter(file => file.file_name); // Только файлы с именами

      console.log(`Обработано ${telegramFiles.length} файлов после фильтрации`);
      
      // Находим сопоставления для текущего батча файлов
      const matches = [];
      for (const file of telegramFiles) {
        // Находим наиболее подходящую книгу для файла
        let bestMatch = null;
        let bestScore = 0;
        
        for (const book of books as any[]) {
          const result = UniversalFileMatcher.matchFileToBook(file, book);
          if (result.score > bestScore) {
            bestScore = result.score;
            bestMatch = { 
              book: { author: book.author, title: book.title }, 
              score: result.score
            };
          }
        }
        
        if (bestMatch && bestMatch.score >= 50) { // Только те, что превышают порог
          matches.push({
            file: file.file_name,
            book: `${bestMatch.book.author} - ${bestMatch.book.title}`,
            score: bestMatch.score
          });
        }
      }
      
      // Сортируем по оценке
      matches.sort((a, b) => b.score - a.score);
      
      // Выводим только те, что превышают порог (оценка >= 50)
      console.log(`\n--- Найденные соответствия в батче ${fileBatchIndex} ---`);
      if (matches.length > 0) {
        for (const match of matches) {
          console.log(`${match.file} -> ${match.book} (оценка: ${match.score})`);
        }
        console.log(`Найдено ${matches.length} соответствий в этом батче`);
        totalMatches += matches.length;
      } else {
        console.log('Соответствий не найдено в этом батче');
      }
      
      totalProcessed += telegramFiles.length;
      
      // Проверяем, есть ли еще файлы
      if (filesBatch.length < 1000) {
        hasMoreFiles = false;
      } else {
        // Извлекаем минимальный ID из текущего батча для следующей итерации
        const messageIds = filesBatch
          .map(item => parseInt(String(item.messageId), 10))
          .filter(id => !isNaN(id) && id > 0);
        
        if (messageIds.length > 0) {
          offsetId = Math.min(...messageIds) - 1;
        } else {
          hasMoreFiles = false;
        }
      }
      
      console.log(`Обработано файлов в этом батче: ${telegramFiles.length}, всего: ${totalProcessed}`);
    }
    
    console.log('\nТестирование универсального алгоритма завершено.');
    console.log(`Всего обработано файлов: ${totalProcessed}`);
    console.log(`Найдено соответствий: ${totalMatches}`);
    
  } catch (error) {
    console.error('Ошибка при выполнении теста:', error);
  }
}

// Запуск теста при выполнении файла
if (typeof window === 'undefined') {
  // Для выполнения в Node.js
  testUniversalMatcherOnRealData().catch(console.error);
} else {
  // Для выполнения в браузере
  console.log('Загружен тест универсального сопоставления. Вызовите testUniversalMatcherOnRealData() для запуска.');
}

export { testUniversalMatcherOnRealData };