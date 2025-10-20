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
  console.log('Тестирование универсального алгоритма сопоставления на реальных данных...');
  console.log('Загрузка 2000 файлов из Telegram...');
  
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
    
    console.log(`Загружено ${books.length} книг без файлов`);

    // Инициализируем TelegramFileService для получения файлов
    const fileService = await TelegramFileService.getInstance();
    
    // Загружаем 2000 файлов из Telegram
    console.log('Загрузка файлов из Telegram...');
    const allFiles = [];
    
    let offsetId: number | undefined = undefined;
    let hasMoreFiles = true;
    let fileBatchIndex = 0;
    
    while (hasMoreFiles && allFiles.length < 2000) {
      fileBatchIndex++;
      const batchLimit = Math.min(1000, 2000 - allFiles.length);
      console.log(`📥 Получаем сообщения (лимит: ${batchLimit}, offsetId: ${offsetId})...`);
      
      const filesBatch = await fileService.getFilesToProcess(batchLimit, offsetId);

      console.log(`✅ Получено ${filesBatch.length} сообщений`);
      
      if (filesBatch.length === 0) {
        console.log('Больше нет файлов для анализа');
        break;
      }

      console.log(`Получено ${filesBatch.length} файлов в батче ${fileBatchIndex}`);
      
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

      console.log(`Отфильтровано ${telegramFiles.length} файлов с именами`);
      
      // Добавляем файлы к общей выборке
      allFiles.push(...telegramFiles);
      
      // Обновляем offsetId для следующей итерации
      if (filesBatch.length < batchLimit) {
        // Если получили меньше файлов, чем запрашивали, значит файлы закончились
        hasMoreFiles = false;
        console.log('Файлы в канале закончились');
      } else {
        // Извлекаем ID последнего файла для следующей итерации
        // Сортируем по ID в порядке убывания и берем минимальный ID
        const messageIds = filesBatch
          .map(item => parseInt(String(item.messageId), 10))
          .filter(id => !isNaN(id) && id > 0)
          .sort((a, b) => a - b); // Сортируем по возрастанию
        
        if (messageIds.length > 0) {
          // offsetId должен быть ID последнего полученного сообщения
          offsetId = messageIds[messageIds.length - 1];
          console.log(`Установлен offsetId: ${offsetId}`);
        } else {
          hasMoreFiles = false;
          console.log('Не удалось получить ID сообщений');
        }
      }
      
      console.log(`Всего файлов в выборке: ${allFiles.length}/2000`);
    }
    
    if (allFiles.length === 0) {
      console.log('Не удалось загрузить файлы из Telegram');
      return;
    }
    
    console.log(`Загружено ${allFiles.length} файлов из Telegram`);
    
    // Создаем массив индексов и перемешиваем их для рандомного доступа
    const indices = Array.from({ length: allFiles.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    console.log('\\nПоиск соответствий до получения 10 значений ниже порога и 10 выше порога...');
    
    const belowThresholdMatches = [];
    const aboveThresholdMatches = [];
    
    let currentIndex = 0;
    
    // Продолжаем до тех пор, пока не наберем по 10 значений в каждой категории
    while ((belowThresholdMatches.length < 10 || aboveThresholdMatches.length < 10) && currentIndex < indices.length) {
      const fileIndex = indices[currentIndex];
      const file = allFiles[fileIndex];
      
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
      
      if (bestMatch) {
        if (bestMatch.score >= 65 && aboveThresholdMatches.length < 10) {
          aboveThresholdMatches.push({
            file: file.file_name,
            book: bestMatch.book,
            score: bestMatch.score
          });
          console.log(`  🔍 Найдено соответствие ВЫШЕ порога: ${file.file_name} (оценка: ${bestMatch.score})`);
        } else if (bestMatch.score < 65 && belowThresholdMatches.length < 10) {
          belowThresholdMatches.push({
            file: file.file_name,
            book: bestMatch.book,
            score: bestMatch.score
          });
          console.log(`  ⚠️  Найдено соответствие НИЖЕ порога: ${file.file_name} (оценка: ${bestMatch.score})`);
        }
      }
      
      currentIndex++;
      
      // Проверяем, достигли ли мы лимита файлов
      if (currentIndex >= allFiles.length) {
        console.log(`  ⚠️  Достигнут лимит файлов для анализа. Проанализировано ${currentIndex} файлов.`);
        break;
      }
    }
    
    // Выводим 10 записей ниже порога
    console.log('\\n=== 10 записей НИЖЕ порога (с оценкой < 65) ===');
    for (let i = 0; i < belowThresholdMatches.length; i++) {
      console.log(`${i + 1}. ${belowThresholdMatches[i].file} -> ${belowThresholdMatches[i].book.author} - ${belowThresholdMatches[i].book.title} (оценка: ${belowThresholdMatches[i].score})`);
    }
    
    if (belowThresholdMatches.length === 0) {
      console.log('  Нет записей ниже порога');
    } else if (belowThresholdMatches.length < 10) {
      console.log(`  Найдено только ${belowThresholdMatches.length} записей ниже порога`);
    }
    
    // Выводим 10 записей выше порога
    console.log('\\n=== 10 записей ВЫШЕ порога (с оценка >= 65) ===');
    for (let i = 0; i < aboveThresholdMatches.length; i++) {
      console.log(`${i + 1}. ${aboveThresholdMatches[i].file} -> ${aboveThresholdMatches[i].book.author} - ${aboveThresholdMatches[i].book.title} (оценка: ${aboveThresholdMatches[i].score})`);
    }
    
    if (aboveThresholdMatches.length === 0) {
      console.log('  Нет записей выше порога');
    } else if (aboveThresholdMatches.length < 10) {
      console.log(`  Найдено только ${aboveThresholdMatches.length} записей выше порога`);
    }
    
    console.log('\\nТестирование универсального алгоритма завершено.');
    console.log(`Всего загружено файлов: ${allFiles.length}`);
    console.log(`Обработано файлов: ${currentIndex}`);
    console.log(`Соответствий ниже порога: ${belowThresholdMatches.length}`);
    console.log(`Соответствий выше порога: ${aboveThresholdMatches.length}`);
    
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