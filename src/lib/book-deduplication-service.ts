// Улучшенная логика дедупликации для интеграции в систему
import { serverSupabase } from '../serverSupabase';

/**
 * Проверяет наличие дубликатов книги по автору и названию
 * @param title Название книги
 * @param author Автор книги
 * @param publicationYear Год публикации (опционально)
 * @param normalizeText Функция нормализации текста
 * @returns Объект с информацией о наличии дубликата и самой книге
 */
export async function checkForBookDuplicates(
  title: string,
  author: string,
  publicationYear?: number,
  normalizeText?: (text: string) => string
): Promise<{ exists: boolean; book?: any; books?: any[] }> {
  try {
    // Нормализуем текст, если предоставлена функция нормализации
    const normalizedTitle = normalizeText ? normalizeText(title) : title.toLowerCase();
    const normalizedAuthor = normalizeText ? normalizeText(author) : author.toLowerCase();
    
    // Запрос для поиска книг по нормализованным данным
    let query = serverSupabase
      .from('books')
      .select('*')
      .ilike('LOWER(title)', `%${normalizedTitle}%`)  // ilike для нечувствительного к регистру поиска
      .ilike('LOWER(author)', `%${normalizedAuthor}%`);
    
    // Если год публикации предоставлен, используем его для более точного сопоставления
    if (publicationYear) {
      query = query.eq('publication_year', publicationYear);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error checking for book duplicates:', error);
      return { exists: false };
    }
    
    // Если найдены книги, возвращаем их
    if (data && data.length > 0) {
      // Проверяем более точное совпадение (не только частичное)
      const exactMatches = data.filter(book => 
        normalizeText 
          ? (normalizeText(book.title) === normalizedTitle && normalizeText(book.author) === normalizedAuthor)
          : (book.title.toLowerCase() === title.toLowerCase() && book.author.toLowerCase() === author.toLowerCase())
      );
      
      if (exactMatches.length > 0) {
        return { 
          exists: true, 
          book: exactMatches[0],
          books: exactMatches 
        };
      } else {
        // Возвращаем частичные совпадения
        return { 
          exists: data.length > 0, 
          books: data 
        };
      }
    }
    
    return { exists: false };
  } catch (error) {
    console.error('Error in checkForBookDuplicates:', error);
    return { exists: false };
  }
}

/**
 * Функция для нормализации текста
 * Удаляет годы в скобках, текст "ru", эмодзи, приводит к нижнему регистру и убирает лишние пробелы
 * Применяет Unicode нормализацию для устранения различий в представлении символов
 */
export function normalizeBookText(text: string): string {
  if (!text) return '';
  
  // Применяем Unicode нормализацию для устранения различий в представлении символов
  let normalized = text.normalize('NFKC');
  
  // Приводим к нижнему регистру
  normalized = normalized.toLowerCase();
  
  // Удаляем эмодзи
  normalized = normalized.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
  
  // Удаляем годы в скобках (в формате (2023), (2019) и т.д.) и любые другие числа в скобках
  normalized = normalized.replace(/\(\d{4}\)/g, '');
  
  // Удаляем текст "ru", "ru", "en" и другие языковые обозначения
  normalized = normalized.replace(/\b[rRyYоOuUeEaAnN]\s*[uU]\b/g, '');
  
  // Удаляем любые другие символы в скобках, кроме чисел (для обработки скобок с годами издания)
  normalized = normalized.replace(/\((?!\d{4}\))[^\)]+\)/g, '');
  
  // Удаляем лишние пробелы
  normalized = normalized.trim().replace(/\s+/g, ' ');
  
  return normalized;
}

/**
 * Улучшенная реализация стратегии сохранения книг при дедупликации
 * Выбирает лучшую книгу из дубликатов на основе наличия файла, описания, обложки и т.д.
 */
export async function selectBestBookFromDuplicates(books: any[]): Promise<any> {
  if (!books || books.length === 0) return null;
  
  // Сортируем книги по приоритету:
  // 1. Книги с файлом (file_url или telegram_file_id)
  // 2. Книги с обложкой (cover_url)
  // 3. Книги с описанием (description)
  // 4. Книги с жанрами (genres)
  // 5. Книги с тегами (tags)
  // 6. Более старые по дате создания
  
  const getBookPriority = (book: any): number => {
    let priority = 0;
    
    // Наличие файла дает самый высокий приоритет
    if (book.file_url || book.telegram_file_id) priority += 1000;
    
    // Наличие обложки
    if (book.cover_url) priority += 100;
    
    // Наличие описания
    if (book.description) priority += 50;
    
    // Наличие жанров
    if (book.genres && book.genres.length > 0) priority += 20;
    
    // Наличие тегов
    if (book.tags && book.tags.length > 0) priority += 10;
    
    // Приоритет старым книгам
    const ageFactor = Math.min(5, Math.floor((Date.now() - new Date(book.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30))); // Максимум 5 за возраст
    priority += ageFactor;
    
    return priority;
  };
  
  // Сортируем книги по приоритету (наибольший приоритет первым)
  const sortedBooks = [...books].sort((a, b) => getBookPriority(b) - getBookPriority(a));
  
  return sortedBooks[0];
}

/**
 * Мерджит данные двух книг, сохраняя лучшие атрибуты из обеих книг
 */
export function mergeBookData(existingBook: any, newBook: any): any {
  const mergedBook: any = { ...existingBook };
  
  // Сохраняем файл, если у новой книги он есть, а у существующей - нет
  if (!mergedBook.file_url && newBook.file_url) {
    mergedBook.file_url = newBook.file_url;
    mergedBook.file_size = newBook.file_size;
    mergedBook.file_format = newBook.file_format;
  }
  
  if (!mergedBook.telegram_file_id && newBook.telegram_file_id) {
    mergedBook.telegram_file_id = newBook.telegram_file_id;
  }
  
  // Обновляем обложку, если у новой книги она есть, а у существующей - нет
  if (!mergedBook.cover_url && newBook.cover_url) {
    mergedBook.cover_url = newBook.cover_url;
  }
  
  // Обновляем описание, если у существующей его нет, но оно есть у новой
  if (!mergedBook.description && newBook.description) {
    mergedBook.description = newBook.description;
  }
  
  // Объединяем жанры
  if (newBook.genres && newBook.genres.length > 0) {
    const genresSet = new Set([...(mergedBook.genres || []), ...(newBook.genres || [])]);
    mergedBook.genres = Array.from(genresSet);
  }
  
  // Объединяем теги
  if (newBook.tags && newBook.tags.length > 0) {
    const tagsSet = new Set([...(mergedBook.tags || []), ...(newBook.tags || [])]);
    mergedBook.tags = Array.from(tagsSet);
  }
  
  // Обновляем рейтинг, если у новой книги он есть и выше
  if (newBook.rating && (!mergedBook.rating || newBook.rating > mergedBook.rating)) {
    mergedBook.rating = newBook.rating;
  }
  
  // Обновляем дату обновления
  mergedBook.updated_at = new Date().toISOString();
  
  return mergedBook;
}