// Улучшенная логика дедупликации для интеграции в систему
import { serverSupabase } from './serverSupabase';

/**
 * Проверяет наличие дубликатов книги по автору и названию (без учета года)
 * @param title Название книги
 * @param author Автор книги
 * @param normalizeText Функция нормализации текста
 * @returns Объект с информацией о наличии дубликатов и всех найденных книгах
 */
export async function checkForBookDuplicates(
  title: string,
  author: string,
  normalizeText?: (text: string) => string
): Promise<{ exists: boolean; books?: any[] }> {
  try {
    // Нормализуем текст, если предоставлена функция нормализации
    const normalizedTitle = normalizeText ? normalizeBookText(title) : title.toLowerCase();
    const normalizedAuthor = normalizeText ? normalizeBookText(author) : author.toLowerCase();
    
    // Запрос для поиска книг по нормализованным данным (автор и название)
    const { data, error } = await serverSupabase
      .from('books')
      .select('*')
      .ilike('LOWER(title)', `%${normalizedTitle}%`)
      .ilike('LOWER(author)', `%${normalizedAuthor}%`)
      .order('created_at', { ascending: false }); // Сортируем по дате создания, новые первыми
    
    if (error) {
      console.error('Error checking for book duplicates:', error);
      return { exists: false };
    }
    
    // Проверяем более точное совпадение с использованием нормализации
    const exactMatches = data.filter(book => 
      normalizeText 
        ? (normalizeBookText(book.title) === normalizedTitle && normalizeText(book.author) === normalizedAuthor)
        : (book.title.toLowerCase() === title.toLowerCase() && book.author.toLowerCase() === author.toLowerCase())
    );
    
    if (exactMatches.length > 0) {
      return { 
        exists: true, 
        books: exactMatches 
      };
    } else if (data && data.length > 0) {
      // Возвращаем частичные совпадения
      return { 
        exists: true, 
        books: data 
      };
    }
    
    return { exists: false };
  } catch (error) {
    console.error('Error in checkForBookDuplicates:', error);
    return { exists: false };
  }
}

/**
 * Улучшенная функция для нормализации текста
 * Удаляет скобки с содержимым, текст "ru", эмодзи, приводит к нижнему регистру и убирает лишние пробелы
 * Применяет Unicode нормализацию для устранения различий в представлении символов
 * Удаляет распространенные слова и символы, не влияющие на уникальность книги
 */
export function normalizeBookText(text: string): string {
  if (!text) return '';
  
  // Применяем Unicode нормализацию для устранения различий в представлении символов
  let normalized = text.normalize('NFKC');
  
  // Приводим к нижнему регистру
  normalized = normalized.toLowerCase();
  
  // Удаляем эмодзи
  normalized = normalized.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
  
  // Удаляем все скобки со всем содержимым (включая годы, т.к. год есть в отдельном поле)
  normalized = normalized.replace(/\([^)]*\)/g, '');
  
  // Удаляем текст "ru", "ru", "en" и другие языковые обозначения
  normalized = normalized.replace(/\b[rRyYоOuUeEaAnN]\s*[uU]\b/g, '');
  
  // Удаляем распространенные слова, не влияющие на уникальность книги
  normalized = normalized.replace(/\b(книга|кн\.|кн|издание|изд\.)\b/g, '');
  
  // Удаляем распространенные сокращения и определения
  normalized = normalized.replace(/\b(и др\.|и\.д\.|и\s+др|et al\.|et al|et\. al)\b/g, '');
  
  // Заменяем дефисы и тире на пробелы для лучшего сравнения
  normalized = normalized.replace(/[-–—]/g, ' ');
  
  // Удаляем лишние символы и точки, кроме тех, что являются частью сокращений имен
  normalized = normalized.replace(/[.,;:]+/g, ' ');
  
  // Удаляем лишние пробелы
  normalized = normalized.trim().replace(/\s+/g, ' ');
  
  return normalized;
}

/**
 * Выбирает лучшую книгу из дубликатов - новейшую по дате создания
 */
export function selectBestBookFromDuplicates(books: any[]): any {
  if (!books || books.length === 0) return null;
  
  // Сортируем книги по дате создания, самые новые первыми
  const sortedBooks = [...books].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  
  return sortedBooks[0]; // Возвращаем самую новую книгу
}

/**
 * Удаляет дубликаты книг, оставляя только лучшую (новейшую)
 */
export async function removeBookDuplicates(books: any[]): Promise<{ deletedCount: number; message: string }> {
  if (!books || books.length <= 1) {
    return { deletedCount: 0, message: 'Нет дубликатов для удаления' };
  }

  // Сортируем книги по дате создания, самые новые первые
  const sortedBooks = [...books].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Сохраняем самую новую книгу, остальные удаляем
  const booksToDelete = sortedBooks.slice(1); // Все кроме первой (новейшей)

  let deletedCount = 0;
  const errors: string[] = [];

  for (const book of booksToDelete) {
    try {
      const { error } = await serverSupabase
        .from('books')
        .delete()
        .eq('id', book.id);

      if (error) {
        errors.push(`Ошибка при удалении книги ${book.id}: ${error.message}`);
      } else {
        deletedCount++;
      }
    } catch (err) {
      errors.push(`Исключение при удалении книги ${book.id}: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`);
    }
  }

  const message = errors.length > 0 
    ? `Удалено ${deletedCount} дубликатов из ${booksToDelete.length}, ошибок: ${errors.length}`
    : `Успешно удалено ${deletedCount} дубликатов из ${booksToDelete.length}`;

  // Отправляем сообщение в окно результатов админки, если оно доступно
  if (typeof window !== 'undefined' && (window as any).setStatsUpdateReport) {
    try {
      const timestamp = new Date().toLocaleTimeString('ru-RU');
      const reportMessage = `[${timestamp}] ${message}\n`;
      (window as any).setStatsUpdateReport(reportMessage);
    } catch (error) {
      console.error('❌ Ошибка при отправке сообщения в окно результатов:', error);
    }
  }

  return { deletedCount, message };
}