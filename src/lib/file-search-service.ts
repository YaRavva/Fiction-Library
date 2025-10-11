import { createClient } from '@supabase/supabase-js';

// Используем service role key для админских операций
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export interface BookWithoutFile {
  id: string;
  title: string;
  author: string;
  publication_year?: number;
  series_title?: string;
  series_order?: number;
  created_at: string;
}

export interface TelegramFile {
  message_id: number;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  caption?: string;
  date: number;
}

export interface FileSearchResult {
  book: BookWithoutFile;
  matches: TelegramFile[];
  score: number;
}

/**
 * Сервис для полуавтоматического поиска файлов для книг без файлов
 */
export class FileSearchService {
  private static instance: FileSearchService;

  public static async getInstance(): Promise<FileSearchService> {
    if (!FileSearchService.instance) {
      FileSearchService.instance = new FileSearchService();
    }
    return FileSearchService.instance;
  }

  /**
   * Находит все книги без файлов в базе данных
   */
  public async findBooksWithoutFiles(limit: number = 100): Promise<BookWithoutFile[]> {
    try {
      console.log(`🔍 Поиск книг без файлов (лимит: ${limit})...`);

      // Ищем книги без файлов (file_url IS NULL или пустая строка)
      const { data, error } = await supabaseAdmin
        .from('books')
        .select(`
          id,
          title,
          author,
          publication_year,
          series_order,
          created_at,
          series:series_id (
            title
          )
        `)
        .or('file_url.is.null,file_url.eq.')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Ошибка при поиске книг без файлов: ${error.message}`);
      }

      // Преобразуем данные в нужный формат
      const books: BookWithoutFile[] = (data || []).map(book => {
        const series = Array.isArray(book.series) ? book.series[0] : book.series;
        return {
          id: book.id,
          title: book.title,
          author: book.author,
          publication_year: book.publication_year,
          series_title: series?.title,
          series_order: book.series_order,
          created_at: book.created_at
        };
      });

      console.log(`✅ Найдено ${books.length} книг без файлов`);
      return books;
    } catch (error) {
      console.error('Ошибка при поиске книг без файлов:', error);
      throw error;
    }
  }

  /**
   * Получает список файлов из Telegram канала
   */
  public async getTelegramFiles(channelId: number, limit: number = 1000): Promise<TelegramFile[]> {
    try {
      console.log(`📁 Получение файлов из Telegram канала ${channelId} (лимит: ${limit})...`);

      // Здесь будет интеграция с Telegram API для получения списка файлов
      // Пока заглушка - в реальности нужно использовать TelegramService
      const { TelegramService } = await import('./telegram/client');

      const telegramService = await TelegramService.getInstance();
      const channelEntity = await telegramService.getChannelEntityById(channelId);

      if (!channelEntity) {
        throw new Error(`Не удалось получить доступ к каналу ${channelId}`);
      }

      // Получаем все сообщения из канала
      const messages = await telegramService.getAllMessages(channelEntity, 100);

      // Фильтруем только сообщения с файлами
      const files: TelegramFile[] = [];

      for (const message of messages) {
        // Приводим к типу any для работы с Telegram API
        const msg = message as any;

        if (msg.media && msg.media.document) {
          const document = msg.media.document;
          const fileName = document.attributes?.find((attr: any) => attr.fileName)?.fileName || 'unknown';
          const fileSize = document.size || 0;
          const mimeType = document.mimeType || 'application/octet-stream';

          files.push({
            message_id: msg.id,
            file_name: fileName,
            file_size: fileSize,
            mime_type: mimeType,
            caption: msg.message || '',
            date: msg.date
          });
        }
      }

      console.log(`✅ Получено ${files.length} файлов из Telegram`);
      return files.slice(0, limit);
    } catch (error) {
      console.error('Ошибка при получении файлов из Telegram:', error);
      throw error;
    }
  }

  /**
   * Выполняет релевантный поиск файлов для книги
   */
  public searchFilesForBook(book: BookWithoutFile, telegramFiles: TelegramFile[]): FileSearchResult {
    console.log(`🔎 Поиск файлов для книги: "${book.title}" - ${book.author}`);

    const matches: TelegramFile[] = [];
    let bestScore = 0;

    // Подготавливаем поисковые термины
    const searchTerms = this.prepareSearchTerms(book);

    for (const file of telegramFiles) {
      const score = this.calculateRelevanceScore(file, searchTerms, book);

      if (score > 0) {
        matches.push({
          ...file,
          // Добавляем кастомное поле для сортировки
          relevance_score: score
        } as any);

        if (score > bestScore) {
          bestScore = score;
        }
      }
    }

    // Сортируем по релевантности
    matches.sort((a, b) => (b as any).relevance_score - (a as any).relevance_score);

    return {
      book,
      matches: matches.slice(0, 20), // Возвращаем топ 20 результатов
      score: bestScore
    };
  }

  /**
   * Подготавливает поисковые термины для книги
   */
  private prepareSearchTerms(book: BookWithoutFile): string[] {
    const terms: string[] = [];

    // Добавляем слова из названия
    const titleWords = book.title.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);

    terms.push(...titleWords);

    // Добавляем слова из автора
    const authorWords = book.author.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);

    terms.push(...authorWords);

    // Добавляем год публикации, если есть
    if (book.publication_year) {
      terms.push(book.publication_year.toString());
    }

    // Добавляем номер в серии, если есть
    if (book.series_order) {
      terms.push(`том${book.series_order}`);
      terms.push(`ч${book.series_order}`);
      terms.push(`part${book.series_order}`);
    }

    return [...new Set(terms)]; // Убираем дубликаты
  }

  /**
   * Вычисляет релевантность файла для книги
   */
  private calculateRelevanceScore(file: TelegramFile, searchTerms: string[], book: BookWithoutFile): number {
    let score = 0;
    const fileName = (file.file_name || '').toLowerCase();
    const caption = (file.caption || '').toLowerCase();

    // Проверяем каждое поисковое слово
    for (const term of searchTerms) {
      // Название файла
      if (fileName.includes(term)) {
        score += 10; // Высокий вес для совпадения в имени файла
      }

      // Подпись к файлу
      if (caption.includes(term)) {
        score += 5; // Средний вес для совпадения в подписи
      }

      // Частичное совпадение (для длинных терминов)
      if (term.length > 3) {
        if (fileName.includes(term.substring(0, 4))) {
          score += 3;
        }
        if (caption.includes(term.substring(0, 4))) {
          score += 2;
        }
      }
    }

    // Бонус за формат файла
    if (fileName.endsWith('.fb2') || fileName.endsWith('.epub')) {
      score += 2;
    }

    // Бонус за разумный размер файла (книги обычно не меньше 10KB и не больше 50MB)
    if (file.file_size && file.file_size > 10000 && file.file_size < 50000000) {
      score += 1;
    }

    return score;
  }

  /**
   * Выполняет поиск файлов для всех книг без файлов
   */
  public async searchFilesForAllBooks(books: BookWithoutFile[], telegramFiles: TelegramFile[]): Promise<FileSearchResult[]> {
    console.log(`🔍 Запуск поиска файлов для ${books.length} книг...`);

    const results: FileSearchResult[] = [];

    for (const book of books) {
      const result = this.searchFilesForBook(book, telegramFiles);
      if (result.matches.length > 0) {
        results.push(result);
      }
    }

    // Сортируем по лучшему совпадению
    results.sort((a, b) => b.score - a.score);

    console.log(`✅ Поиск завершен. Найдено совпадений для ${results.length} книг`);
    return results;
  }
}