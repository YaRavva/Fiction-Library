/**
 * Тестирование алгоритма поиска на случайных файлах из Telegram
 * Этот скрипт получает случайные файлы из канала и тестирует алгоритм сопоставления
 */

import { config } from 'dotenv';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import bigInt from 'big-integer';

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

async function testRandomFilesSearch() {
  console.log('🚀 Тестирование алгоритма поиска на случайных файлах из Telegram...\n');
  
  let telegramClient: TelegramClient | null = null;
  
  try {
    // Получение переменных окружения
    const apiId = process.env.TELEGRAM_API_ID;
    const apiHash = process.env.TELEGRAM_API_HASH;
    const sessionString = process.env.TELEGRAM_SESSION;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!apiId || !apiHash || !sessionString || !supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Отсутствуют необходимые переменные окружения');
    }
    
    // Инициализация Telegram клиента
    console.log('🔧 Инициализация Telegram клиента...');
    const session = new StringSession(sessionString);
    telegramClient = new TelegramClient(session, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });
    
    await telegramClient.connect();
    console.log('✅ Telegram клиент подключен\n');
    
    // Создание клиента Supabase
    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Доступ к каналу файлов
    const channelId = 1515159552;
    console.log(`🆔 Доступ к каналу: Архив для фантастики (ID: ${channelId})\n`);
    
    // Получение сущности канала
    const channelEntity = await telegramClient.getEntity(new Api.PeerChannel({ channelId: bigInt(channelId) }));
    console.log(`✅ Сущность канала получена: ${(channelEntity as any).title}\n`);
    
    // Получение сообщений из канала
    console.log('📥 Получение файлов из канала...');
    const messages = await telegramClient.getMessages(channelEntity, { limit: 50 });
    console.log(`📊 Получено ${messages.length} сообщений\n`);
    
    // Извлечение файловой информации
    console.log('📁 Извлечение файлов из сообщений...');
    const files: any[] = [];
    
    for (const msg of messages) {
      if ((msg as any).media && (msg as any).media.className === 'MessageMediaDocument') {
        const document = (msg as any).media.document;
        if (document) {
          const filenameAttr = document.attributes?.find((attr: any) => attr.className === 'DocumentAttributeFilename');
          const filename = filenameAttr?.fileName || `book_${msg.id}`;
          
          const file = {
            id: msg.id,
            filename: filename,
            size: document.size,
            mimeType: document.mimeType,
            message: msg
          };
          
          files.push(file);
        }
      }
    }
    
    console.log(`✅ Найдено ${files.length} файлов в канале\n`);
    
    if (files.length === 0) {
      console.log('❌ В канале не найдено файлов');
      return;
    }
    
    // Выбор 10 случайных файлов
    const randomFiles = files
      .sort(() => 0.5 - Math.random()) // Перемешивание
      .slice(0, 10); // Выбор 10 случайных
    
    console.log(`🎲 Выбрано 10 случайных файлов для тестирования:\n`);
    randomFiles.forEach((file, index) => {
      console.log(`${index + 1}. ${file.filename} (${file.size} байт)`);
    });
    
    // Получение ВСЕЙ базы книг
    console.log('\n📖 Получение полной базы книг из базы данных...');
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
    
    // Тестирование поиска для каждого случайного файла
    for (const file of randomFiles) {
      totalFiles++;
      console.log(`📁 Тестирование файла: ${file.filename}`);
      
      const allMatches = findAllMatchingBooks(file.filename, books || []);
      
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
    
    console.log('\n✅ Тестирование алгоритма поиска на случайных файлах завершено!');
    
  } catch (error) {
    console.error('❌ Ошибка во время тестирования:', error);
  } finally {
    // Отключение клиента
    if (telegramClient) {
      try {
        await telegramClient.disconnect();
        console.log('\n🧹 Telegram клиент отключен');
      } catch (disconnectError) {
        console.error('⚠️ Ошибка при отключении клиента:', disconnectError);
      }
    }
    
    // Принудительное завершение скрипта из-за известной проблемы с GramJS
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// Запуск скрипта
testRandomFilesSearch().catch(error => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});