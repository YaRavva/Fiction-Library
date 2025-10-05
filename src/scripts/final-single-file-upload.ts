/**
 * Финальный скрипт для загрузки одиночного файла в bucket книг
 * и установки связи с соответствующей книгой в таблице книг.
 * 
 * Требования:
 * 1. Типы файлов могут быть только fb2 и zip
 * 2. Имя файла должно иметь вид <MessageID>.zip (или .fb2)
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import bigInt from 'big-integer';
import { uploadFileToStorage, getSupabaseAdmin } from '../lib/supabase';

// Загружаем переменные окружения
config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Извлечение метаданных (автора и названия) из имени файла
 * @param filename Имя файла
 * @returns Объект с автором и названием
 */
function extractMetadataFromFilename(filename: string): { author: string; title: string } {
  // Убираем расширение файла
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  
  // Специальная обработка для известных паттернов
  
  // Паттерн: "Автор - Название"
  const dashPattern = /^([^-–—]+)[\-–—](.+)$/;
  const dashMatch = nameWithoutExt.match(dashPattern);
  if (dashMatch) {
    let author = dashMatch[1].trim();
    let title = dashMatch[2].trim();
    
    // Особая обработка для случая, когда в названии есть слово "мицелий"
    if (title.toLowerCase().includes('мицелий')) {
      title = `цикл ${title}`;
    }
    
    // Если в названии есть слово "цикл", переносим его в начало названия
    if (author.toLowerCase().includes('цикл ')) {
      title = `${author} ${title}`;
      author = author.replace(/цикл\s+/i, '').trim();
    } else if (title.toLowerCase().includes('цикл ')) {
      title = `цикл ${title.replace(/цикл\s+/i, '').trim()}`;
    }
    
    // Особая обработка для "Оксфордский цикл"
    if (title.toLowerCase().includes('оксфордский')) {
      title = `цикл ${title}`;
    }
    
    return { author, title };
  }
  
  // Специальная обработка для файлов с несколькими авторами
  // Паттерн: "Автор1_и_Автор2_Название" или "Автор1,_Автор2_Название"
  if (nameWithoutExt.includes('_и_')) {
    const parts = nameWithoutExt.split('_и_');
    if (parts.length === 2) {
      const authorsPart = parts[0].replace(/_/g, ' ').trim();
      const titlePart = parts[1].replace(/_/g, ' ').trim();
      
      let title = titlePart;
      if (title.toLowerCase().includes('мицелий')) {
        title = `цикл ${title}`;
      }
      
      return { author: authorsPart, title };
    }
  }
  
  // Паттерн: "Автор1,_Автор2_Название"
  if (nameWithoutExt.includes(',_')) {
    const parts = nameWithoutExt.split(',_');
    if (parts.length === 2) {
      const authorsPart = parts[0].replace(/_/g, ' ').trim();
      const titlePart = parts[1].replace(/_/g, ' ').trim();
      
      let title = titlePart;
      if (title.toLowerCase().includes('мицелий')) {
        title = `цикл ${title}`;
      }
      
      return { author: authorsPart, title };
    }
  }
  
  // Паттерн: "Хроники" в названии
  if (nameWithoutExt.includes('Хроники')) {
    const words = nameWithoutExt.split('_');
    const chroniclesIndex = words.findIndex(word => word.includes('Хроники'));
    
    if (chroniclesIndex > 0) {
      // Авторы - это слова до "Хроники"
      const authors = words.slice(0, chroniclesIndex).join(' ').replace(/_/g, ' ').trim();
      const title = words.slice(chroniclesIndex).join(' ').replace(/_/g, ' ').trim();
      
      return { author: authors, title };
    }
  }
  
  // Разбиваем имя файла на слова для более сложного анализа
  const words = nameWithoutExt
    .split(/[_\-\s]+/) // Разделяем по пробелам, подчеркиваниям и дефисам
    .filter(word => word.length > 0) // Убираем пустые слова
    .map(word => word.trim()); // Убираем пробелы
  
  // Если мало слов, возвращаем как есть
  if (words.length < 2) {
    return { 
      author: 'Unknown', 
      title: nameWithoutExt 
    };
  }
  
  // Попробуем найти индикаторы названия (цикл, saga, series и т.д.)
  const titleIndicators = ['цикл', ' saga', ' series', 'оксфордский'];
  let titleStartIndex = words.length; // По умолчанию всё название
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase();
    if (titleIndicators.some(indicator => word.includes(indicator))) {
      titleStartIndex = i;
      break;
    }
  }
  
  // Если индикатор найден, авторы - это слова до него, название - от него и далее
  if (titleStartIndex < words.length) {
    const authors = words.slice(0, titleStartIndex).join(' ');
    let title = words.slice(titleStartIndex).join(' ');
    
    // Особая обработка для случая, когда в названии есть слово "мицелий"
    if (title.toLowerCase().includes('мицелий')) {
      title = `цикл ${title}`;
    }
    
    // Особая обработка для "Оксфордский цикл"
    if (title.toLowerCase().includes('оксфордский')) {
      title = `цикл ${title}`;
    }
    
    return { 
      author: authors, 
      title: title 
    };
  }
  
  // Если ничего не подошло, возвращаем как есть
  let title = nameWithoutExt;
  
  // Особая обработка для случая, когда в названии есть слово "мицелий"
  if (nameWithoutExt.toLowerCase().includes('мицелий')) {
    title = `цикл ${nameWithoutExt}`;
  } else if (nameWithoutExt.includes('цикл')) {
    title = `цикл ${nameWithoutExt.replace(/цикл\s*/i, '')}`;
  } else if (nameWithoutExt.toLowerCase().includes('оксфордский')) {
    title = `цикл ${nameWithoutExt}`;
  }
  
  return { 
    author: 'Unknown', 
    title: title
  };
}

/**
 * Поиск соответствующей книги в базе данных по метаданным
 * @param author Автор книги
 * @param title Название книги
 * @param supabase Клиент Supabase
 * @returns Найденная книга или null
 */
async function findMatchingBook(author: string, title: string, supabase: any): Promise<any | null> {
  console.log(`🔍 Поиск книги в базе данных: "${title}" автора ${author}`);
  
  // Сначала пробуем точное совпадение
  const { data: exactMatch, error: exactError } = await supabase
    .from('books')
    .select('*')
    .eq('title', title)
    .eq('author', author)
    .single();
  
  if (!exactError && exactMatch) {
    console.log(`✅ Найдена книга с точным совпадением: ${exactMatch.id}`);
    return exactMatch;
  }
  
  // Если точное совпадение не найдено, пробуем поиск с релевантностью
  console.log('🔍 Пробуем поиск с релевантностью...');
  
  // Разбиваем автора и название на слова для поиска
  const titleWords = title.split(/\s+/).filter(word => word.length > 2);
  const authorWords = author.split(/\s+/).filter(word => word.length > 2);
  const allSearchWords = [...titleWords, ...authorWords].filter(word => word.length > 0);
  
  console.log(`  Слова для поиска: [${allSearchWords.join(', ')}]`);
  
  if (allSearchWords.length > 0) {
    // Ищем книги, где в названии или авторе встречаются слова из поискового запроса
    const searchPromises = allSearchWords.map(async (word) => {
      const { data: titleMatches } = await supabase
        .from('books')
        .select('id, title, author')
        .ilike('title', `%${word}%`)
        .limit(5);
      
      const { data: authorMatches } = await supabase
        .from('books')
        .select('id, title, author')
        .ilike('author', `%${word}%`)
        .limit(5);
      
      const allMatches = [...(titleMatches || []), ...(authorMatches || [])];
      
      // Удаляем дубликаты по ID
      const uniqueMatches = allMatches.filter((bookItem, index, self) => 
        index === self.findIndex(b => (b as { id: string }).id === (bookItem as { id: string }).id)
      );
      
      return uniqueMatches;
    });
    
    // Выполняем все поисковые запросы параллельно
    const results = await Promise.all(searchPromises);
    
    // Объединяем все результаты
    const allMatches = results.flat();
    
    // Удаляем дубликаты по ID
    const uniqueMatches = allMatches.filter((bookItem, index, self) => 
      index === self.findIndex(b => (b as { id: string }).id === (bookItem as { id: string }).id)
    );
    
    // Сортируем по релевантности (по количеству совпадений)
    const matchesWithScores = uniqueMatches.map(bookItem => {
      const typedBookItem = bookItem as { id: string; title: string; author: string };
      const bookTitleWords = typedBookItem.title.toLowerCase().split(/\s+/);
      const bookAuthorWords = typedBookItem.author.toLowerCase().split(/\s+/);
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
      
      return { ...typedBookItem, score };
    });
    
    // Сортируем по убыванию счета
    matchesWithScores.sort((a, b) => b.score - a.score);
    
    // Берем только лучшие совпадения и фильтруем по минимальной релевантности
    const topMatches = matchesWithScores.slice(0, 5);
    const relevantMatches = topMatches.filter(match => match.score >= 2);
    
    if (relevantMatches.length > 0) {
      console.log(`✅ Найдено ${relevantMatches.length} релевантных совпадений`);
      // Возвращаем лучшее совпадение
      return relevantMatches[0];
    }
  }
  
  console.log('❌ Подходящая книга не найдена');
  return null;
}

async function finalSingleFileUpload() {
  console.log('🚀 Финальная отладка механизма загрузки одиночного файла...\n');
  
  let telegramClient: TelegramClient | null = null;
  
  try {
    // Получаем переменные окружения
    const apiId = process.env.TELEGRAM_API_ID;
    const apiHash = process.env.TELEGRAM_API_HASH;
    const sessionString = process.env.TELEGRAM_SESSION;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!apiId || !apiHash || !sessionString || !supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Отсутствуют необходимые переменные окружения');
    }
    
    // Инициализируем клиент Telegram
    console.log('🔧 Инициализация клиента Telegram...');
    const session = new StringSession(sessionString);
    telegramClient = new TelegramClient(session, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });
    
    await telegramClient.connect();
    console.log('✅ Клиент Telegram подключен\n');
    
    // Создаем клиента Supabase
    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Доступ к каналу файлов
    const channelId = 1515159552; // ID для "Архив для фантастики"
    console.log(`🆔 Доступ к каналу: Архив для фантастики (ID: ${channelId})\n`);
    
    // Получение сущности канала
    const channelEntity = await telegramClient.getEntity(new Api.PeerChannel({ channelId: bigInt(channelId) }));
    console.log(`✅ Сущность канала получена: ${(channelEntity as any).title}\n`);
    
    // Получение сообщений из канала
    console.log('📥 Получение файлов из канала...');
    const messages = await telegramClient.getMessages(channelEntity, { limit: 5 });
    console.log(`📊 Получено ${messages.length} сообщений\n`);
    
    // Поиск первого сообщения с файлом
    let fileMessage = null;
    for (const msg of messages) {
      if ((msg as any).media && (msg as any).media.className === 'MessageMediaDocument') {
        fileMessage = msg;
        break;
      }
    }
    
    if (!fileMessage) {
      console.log('❌ В первых 5 сообщениях не найдено файлов');
      return;
    }
    
    console.log(`✅ Найдено сообщение с файлом: ID ${fileMessage.id}\n`);
    
    // Извлечение информации о файле
    const document = (fileMessage as any).media.document;
    const filenameAttr = document.attributes?.find((attr: any) => attr.className === 'DocumentAttributeFilename');
    const originalFilename = filenameAttr?.fileName || `book_${fileMessage.id}`;
    const fileExtension = path.extname(originalFilename).toLowerCase();
    
    console.log(`📄 Оригинальное имя файла: ${originalFilename}`);
    console.log(`📄 Расширение файла: ${fileExtension}`);
    
    // Проверка допустимых типов файлов
    const allowedExtensions = ['.fb2', '.zip'];
    if (!allowedExtensions.includes(fileExtension)) {
      console.log(`⚠️  Тип файла ${fileExtension} не разрешен. Допустимые типы: ${allowedExtensions.join(', ')}`);
      return;
    }
    console.log(`✅ Тип файла разрешен: ${fileExtension}\n`);
    
    // Скачивание файла
    console.log('📥 Скачивание файла из Telegram...');
    const fileBuffer = await telegramClient.downloadMedia(fileMessage, {});
    
    if (!fileBuffer) {
      console.log('❌ Ошибка при скачивании файла');
      return;
    }
    
    // Преобразование в Buffer если это необходимо
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer as unknown as Uint8Array);
    
    console.log(`✅ Файл успешно скачан (${buffer.length} байт)\n`);
    
    // Извлечение метаданных из имени файла
    console.log('📊 Извлечение метаданных из имени файла...');
    const { author, title } = extractMetadataFromFilename(originalFilename);
    console.log(`  Автор: ${author}`);
    console.log(`  Название: ${title}\n`);
    
    // Поиск соответствующей книги в базе данных
    const matchingBook = await findMatchingBook(author, title, supabase);
    
    if (!matchingBook) {
      console.log('❌ Не удалось найти соответствующую книгу в базе данных');
      return;
    }
    
    console.log(`📚 Найдена соответствующая книга: "${matchingBook.title}" автора ${matchingBook.author}\n`);
    
    // Формирование имени файла в формате <MessageID>.zip (или .fb2)
    const storageFilename = `${fileMessage.id}${fileExtension}`;
    console.log(`💾 Имя файла для хранения: ${storageFilename}`);
    
    // Определение MIME-типа и формата файла
    const mimeTypes: Record<string, string> = {
      '.fb2': 'application/fb2+xml',
      '.zip': 'application/zip',
    };
    const mimeType = mimeTypes[fileExtension] || 'application/octet-stream';
    const fileFormat = fileExtension.replace('.', '');
    console.log(`📄 MIME-тип: ${mimeType}`);
    console.log(`📄 Формат файла: ${fileFormat}\n`);
    
    // Загрузка файла в Supabase Storage (bucket 'books')
    console.log('☁️  Загрузка файла в Supabase Storage...');
    try {
      const uploadResult = await uploadFileToStorage('books', storageFilename, buffer, mimeType);
      console.log(`✅ Файл успешно загружен в Storage:`, uploadResult);
    } catch (uploadError) {
      console.error('❌ Ошибка при загрузке файла в Storage:', uploadError);
      return;
    }
    
    // Формирование URL файла
    const fileUrl = `${supabaseUrl}/storage/v1/object/public/books/${encodeURIComponent(storageFilename)}`;
    console.log(`🔗 URL файла: ${fileUrl}\n`);
    
    // Обновление записи книги в базе данных
    console.log('📝 Обновление записи книги в базе данных...');
    try {
      const admin = getSupabaseAdmin();
      if (!admin) {
        throw new Error('Не удалось получить доступ к Supabase Admin');
      }
      
      const updateData: Record<string, unknown> = {
        file_url: fileUrl,
        file_size: buffer.length,
        file_format: fileFormat,
        telegram_file_id: String(fileMessage.id),
        storage_path: storageFilename,
        updated_at: new Date().toISOString()
      };
      
      // Type assertion to fix typing issues with Supabase client
      const typedAdmin = admin as unknown as {
        from: (table: string) => {
          update: (data: Record<string, unknown>) => {
            eq: (column: string, value: unknown) => {
              select: () => {
                single: () => Promise<{ data: unknown; error: unknown }>;
              };
            };
          };
        };
      };
      
      const { data: updatedBook, error: updateError } = await typedAdmin
        .from('books')
        .update(updateData)
        .eq('id', matchingBook.id)
        .select()
        .single();
      
      if (updateError) {
        throw updateError;
      }
      
      console.log(`✅ Запись книги успешно обновлена:`, (updatedBook as { title: string }).title);
    } catch (updateError) {
      console.error('❌ Ошибка при обновлении записи книги:', updateError);
      return;
    }
    
    // Проверка файла в Storage
    console.log('🔍 Проверка файла в Storage...');
    try {
      const { data: fileData, error: fileError } = await supabase
        .storage
        .from('books')
        .download(storageFilename);
      
      if (fileError) {
        console.error('❌ Ошибка при проверке файла в Storage:', fileError);
      } else if (fileData) {
        console.log(`✅ Файл успешно загружен в Storage (${fileData.size} байт)`);
        console.log(`✅ Имя файла в Storage: ${storageFilename}`);
      }
    } catch (downloadError) {
      console.error('❌ Ошибка при проверке файла в Storage:', downloadError);
    }
    
    console.log('\n🎉 Финальная отладка механизма загрузки одиночного файла завершена успешно!');
    console.log('📋 Результаты:');
    console.log(`   • Файл: ${originalFilename}`);
    console.log(`   • Автор: ${author}`);
    console.log(`   • Название: ${title}`);
    console.log(`   • Размер файла: ${buffer.length} байт`);
    console.log(`   • Формат файла: ${fileFormat}`);
    console.log(`   • Message ID: ${fileMessage.id}`);
    console.log(`   • Storage имя: ${storageFilename}`);
    console.log(`   • URL файла: ${fileUrl}`);
    console.log(`   • Связанная книга: "${matchingBook.title}" автора ${matchingBook.author}`);
    
  } catch (error) {
    console.error('❌ Ошибка во время отладки:', error);
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
    console.log('\n🛑 Принудительное завершение скрипта...');
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// Запуск скрипта
finalSingleFileUpload().catch(error => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});