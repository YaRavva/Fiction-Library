import { TelegramService } from '../lib/telegram/client';
import { serverSupabase } from '../lib/serverSupabase';
import { putObject } from '../lib/s3-service';
import dotenv from 'dotenv';
import { createHash } from 'crypto';

dotenv.config();

interface Book {
  id: string;
  title: string;
  author: string;
  score?: number;
}

interface TelegramMessage {
  id: number;
  media?: any;
  file?: {
    name?: string;
  };
}

interface ExistingBook {
  file_url: string;
  file_size: number;
  storage_path: string;
}

/**
 * Нормализация текста для сравнения (заменяет ё на е, й на и)
 */
function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/ё/g, 'е')
    .replace(/Ё/g, 'Е')
    .replace(/й/g, 'и')
    .replace(/Й/g, 'И')
    .toLowerCase();
}

/**
 * Вычисление хэша файла для проверки идентичности
 */
async function calculateFileHash(buffer: Buffer): Promise<string> {
  return createHash('md5').update(buffer).digest('hex');
}

/**
 * Поиск книги с релевантным поиском
 */
async function findRelevantBook(title: string, author: string) {
  console.log(`🔍 Поиск книги: "${title}" автора ${author}`);
  
  // Нормализуем поисковые параметры
  const normalizedTitle = normalizeText(title);
  const normalizedAuthor = normalizeText(author);
  
  // Разбиваем на слова для поиска
  const titleWords = normalizedTitle.split(/\s+/).filter(word => word.length > 2);
  const authorWords = normalizedAuthor.split(/\s+/).filter(word => word.length > 2);
  const allSearchWords = [...titleWords, ...authorWords].filter(word => word.length > 0);
  
  console.log(`  Слова для поиска: [${allSearchWords.join(', ')}]`);
  
  if (allSearchWords.length === 0) {
    console.log(`⚠️  Недостаточно слов для поиска`);
    return null;
  }
  
  // Ищем книги, где в названии или авторе встречаются слова из поискового запроса
  const searchPromises = allSearchWords.map(async (word) => {
    const { data: titleMatches } = await serverSupabase
      .from('books')
      .select('id, title, author')
      .ilike('title', `%${word}%`)
      .limit(5);
    
    const { data: authorMatches } = await serverSupabase
      .from('books')
      .select('id, title, author')
      .ilike('author', `%${word}%`)
      .limit(5);
    
    const allMatches: Book[] = [...(titleMatches || []), ...(authorMatches || [])];
    
    // Удаляем дубликаты по ID
    const uniqueMatches = allMatches.filter((bookItem, index, self) => 
      index === self.findIndex(b => b.id === bookItem.id)
    );
    
    return uniqueMatches;
  });
  
  // Выполняем все поисковые запросы параллельно
  const results = await Promise.all(searchPromises);
  
  // Объединяем все результаты
  const allMatches: Book[] = results.flat();
  
  // Удаляем дубликаты по ID
  const uniqueMatches = allMatches.filter((bookItem, index, self) => 
    index === self.findIndex(b => b.id === bookItem.id)
  );
  
  // Сортируем по релевантности (по количеству совпадений)
  const matchesWithScores = uniqueMatches.map(bookItem => {
    const bookTitleWords = normalizeText(bookItem.title).split(/\s+/);
    const bookAuthorWords = normalizeText(bookItem.author).split(/\s+/);
    const allBookWords = [...bookTitleWords, ...bookAuthorWords];
    
    // Считаем количество совпадений поисковых слов с словами в книге
    let score = 0;
    for (const searchWord of allSearchWords) {
      let found = false;
      for (const bookWord of allBookWords) {
        // Проверяем точное совпадение или частичное включение
        if (bookWord.includes(searchWord) || searchWord.includes(bookWord)) {
          score++;
          found = true;
          break; // Не увеличиваем счетчик больше одного раза для одного поискового слова
        }
      }
    }
    
    return { ...bookItem, score };
  });
  
  // Сортируем по убыванию счета
  matchesWithScores.sort((a, b) => (b.score || 0) - (a.score || 0));
  
  // Берем только лучшие совпадения и фильтруем по минимальной релевантности
  const topMatches = matchesWithScores.slice(0, 5);
  
  // Возвращаем массив совпадений с релевантностью >= 2
  const relevantMatches = topMatches.filter(match => (match.score || 0) >= 2);
  
  if (relevantMatches.length > 0) {
    console.log(`✅ Найдено ${relevantMatches.length} релевантных совпадений:`);
    relevantMatches.forEach((match, index) => {
      console.log(`  ${index + 1}. "${match.title}" автора ${match.author} (релевантность: ${match.score})`);
    });
    
    // Возвращаем наиболее релевантное совпадение
    return relevantMatches[0];
  } else {
    console.log(`⚠️  Релевантные совпадения не найдены`);
    return null;
  }
}

async function testAnyFileDownload() {
  try {
    console.log('🚀 Начинаем тестовое скачивание файла из Telegram...');
    
    const telegramService = await TelegramService.getInstance();
    const filesChannel = await telegramService.getFilesChannel();
    
    // Получаем несколько последних сообщений из канала
    // @ts-ignore
    const messages: TelegramMessage[] = await telegramService.getMessages(filesChannel.id, 3);
    
    if (!messages || messages.length === 0) {
      console.log('⚠️  В канале файлов не найдено');
      return;
    }
    
    console.log(`📚 Найдено ${messages.length} сообщений в канале файлов`);
    
    // Ищем сообщение с файлом
    let fileMessage: TelegramMessage | null = null;
    let fileBuffer: Buffer | null = null;
    
    for (const message of messages) {
      // @ts-ignore
      if (message.media) {
        console.log(`📥 Найдено сообщение с медиа: ${message.id}`);
        try {
          // @ts-ignore
          fileBuffer = await telegramService.downloadMedia(message);
          if (fileBuffer) {
            fileMessage = message;
            break;
          }
        } catch (error) {
          console.error(`❌ Ошибка при скачивании файла из сообщения ${message.id}:`, error);
        }
      }
    }
    
    if (!fileMessage || !fileBuffer) {
      console.log('⚠️  Не удалось найти сообщение с файлом');
      return;
    }
    
    // @ts-ignore
    const originalFileName = fileMessage.file?.name || `file_${fileMessage.id}`;
    // @ts-ignore
    const fileSize = fileBuffer.length;
    const fileHash = await calculateFileHash(fileBuffer);
    
    console.log(`✅ Файл скачан: ${originalFileName} (${fileSize} байт), хэш: ${fileHash}`);
    
    // Определяем расширение файла
    let fileExtension = 'zip'; // по умолчанию
    if (originalFileName.includes('.')) {
      fileExtension = originalFileName.split('.').pop() || 'zip';
    }
    
    // Создаем новое имя файла в формате <telegram_file_id>.<extension>
    // @ts-ignore
    const newFileName = `${fileMessage.id}.${fileExtension}`;
    
    console.log(`🔄 Переименовываем файл в: ${newFileName}`);
    
    // Извлекаем метаданные из оригинального названия файла (предполагаем формат "Автор - Название")
    let author = 'Неизвестный автор';
    let title = originalFileName;
    
    if (originalFileName.includes(' - ')) {
      const parts = originalFileName.split(' - ');
      author = parts[0];
      title = parts.slice(1).join(' - ').replace(/\.[^/.]+$/, ''); // Убираем расширение
    }
    
    console.log(`📚 Метаданные файла: Автор="${author}", Название="${title}"`);
    
    // Ищем соответствующую книгу в БД
    const book = await findRelevantBook(title, author);
    
    if (!book) {
      console.log('⚠️  Соответствующая книга в БД не найдена');
      return;
    }
    
    console.log(`✅ Найдена соответствующая книга: "${book.title}" автора ${book.author} (ID: ${book.id})`);
    
    // Проверяем, есть ли уже загруженный файл для этой книги
    const { data: existingBookData, error: fetchError }: any = await serverSupabase
      .from('books')
      .select('file_url, file_size')
      .eq('id', book.id)
      .single();
    
    const existingBook: ExistingBook | null = existingBookData;
    
    if (fetchError) {
      console.error('❌ Ошибка при проверке существующего файла:', fetchError);
      return;
    }
    
    if (existingBook && existingBook.file_url) {
      console.log(`⚠️  Для книги уже загружен файл:`);
      console.log(`   URL: ${existingBook.file_url}`);
      console.log(`   Размер: ${existingBook.file_size || 'неизвестно'}`);
      
      // Проверяем размер файла
      if (existingBook.file_size && existingBook.file_size === fileSize) {
        console.log(`✅ Размер файла совпадает. Пропускаем загрузку.`);
        return;
      } else {
        console.log(`⚠️  Размер файла отличается. Загружаем новый файл.`);
      }
    }
    
    // Загружаем файл в S3 бакет с новым именем
    console.log('📤 Загружаем файл в S3 бакет...');
    
    const bucketName = process.env.S3_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('S3_BUCKET_NAME environment variable is not set.');
    }
    
    const storagePath = `${newFileName}`;
    
    try {
      await putObject(storagePath, fileBuffer, bucketName);
      console.log(`✅ Файл успешно загружен в S3: ${storagePath}`);
      
      // Формируем публичный URL файла
      const fileUrl = `https://${bucketName}.s3.cloud.ru/${storagePath}`;
      
      console.log(`📤 Обновляем запись о книге в БД...`);
      
      // Обновляем запись о книге в БД
      const booksTable: any = serverSupabase.from('books');
      const { error: updateError }: any = await booksTable
        .update({
          file_url: fileUrl,
          file_size: fileSize,
          file_format: fileExtension,
          // @ts-ignore
          telegram_file_id: fileMessage.id.toString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', book.id);
      
      if (updateError) {
        console.error('❌ Ошибка при обновлении записи о книге:', updateError);
        return;
      }
      
      console.log(`✅ Запись о книге обновлена в БД`);
      console.log(`   URL файла: ${fileUrl}`);
      console.log(`   Размер: ${fileSize} байт`);
      // @ts-ignore
      console.log(`   Telegram ID файла: ${fileMessage.id}`);
      
    } catch (error) {
      console.error('❌ Ошибка при загрузке файла в S3:', error);
      return;
    }
    
  } catch (error) {
    console.error('❌ Ошибка в тестовом скрипте:', error);
  } finally {
    const telegramService = await TelegramService.getInstance();
    await telegramService.disconnect();
    console.log('🔌 Соединение с Telegram закрыто');
  }
}

testAnyFileDownload();