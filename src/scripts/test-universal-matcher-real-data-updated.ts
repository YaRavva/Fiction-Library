import { UniversalFileMatcher } from '../lib/universal-file-matcher-enhanced';
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
    
    // Загружаем 2000 файлов из Telegram (батчами по 1000)
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
    
    console.log('\\nАнализ всех файлов для поиска соответствий...');
    
    // Собираем все результаты сопоставления
    const allMatches = [];
    
    for (let i = 0; i < allFiles.length; i++) {
      const file = allFiles[i];
      
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
        allMatches.push({
          file: file.file_name,
          book: bestMatch.book,
          score: bestMatch.score
        });
      }
    }
    
    // Сортируем результаты по оценке
    allMatches.sort((a, b) => b.score - a.score);
    
    // Разделяем на группы: ниже порога (меньше 65) и выше порога (65 и больше)
    const belowThresholdMatches = allMatches.filter(match => match.score < 65);
    const aboveThresholdMatches = allMatches.filter(match => match.score >= 65);
    
    // Берем по 10 записей из каждой группы (ближайших к порогу)
    const belowThresholdToShow = belowThresholdMatches
      .sort((a, b) => b.score - a.score) // Сортируем по убыванию, чтобы показать ближайшие к порогу
      .slice(0, 10);
      
    const aboveThresholdToShow = aboveThresholdMatches
      .sort((a, b) => a.score - b.score) // Сортируем по возрастанию, чтобы показать ближайшие к порогу
      .slice(0, 10);
    
    // Выводим 10 записей ниже порога (ближайших к 65)
    console.log('\\n=== 10 записей НИЖЕ порога (с оценкой < 65, ближайших к порогу) ===');
    if (belowThresholdToShow.length > 0) {
      for (let i = 0; i < belowThresholdToShow.length; i++) {
        console.log(`${i + 1}. ${belowThresholdToShow[i].file} -> ${belowThresholdToShow[i].book.author} - ${belowThresholdToShow[i].book.title} (оценка: ${belowThresholdToShow[i].score})`);
      }
    } else {
      console.log('  Нет записей ниже порога');
    }
    
    // Выводим 10 записей выше порога (ближайших к 65)
    console.log('\\n=== 10 записей ВЫШЕ порога (с оценкой >= 65, ближайших к порогу) ===');
    if (aboveThresholdToShow.length > 0) {
      for (let i = 0; i < aboveThresholdToShow.length; i++) {
        console.log(`${i + 1}. ${aboveThresholdToShow[i].file} -> ${aboveThresholdToShow[i].book.author} - ${aboveThresholdToShow[i].book.title} (оценка: ${aboveThresholdToShow[i].score})`);
      }
    } else {
      console.log('  Нет записей выше порога');
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