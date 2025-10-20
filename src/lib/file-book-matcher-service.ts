import { UniversalFileMatcher } from './universal-file-matcher';
import { serverSupabase } from './serverSupabase';

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

interface MatchResult {
  file: FileOption;
  book: Book;
  score: number;
  matchedWords: string[];
}

/**
 * Универсальный сервис для сопоставления файлов и книг
 */
export class FileBookMatcherService {
  /**
   * Находит наиболее релевантные книги для файла
   * @param file файл для сопоставления
   * @param searchLimit ограничение на количество книг для поиска
   * @returns результат сопоставления
   */
  static async findBestMatchForFile(file: FileOption, searchLimit: number = 50): Promise<MatchResult | null> {
    // Сначала ищем книги по поисковым терминам
    const searchTerms = this.extractSearchTerms(file.file_name);
    
    let allMatches: Book[] = [];
    
    if (searchTerms.length > 0) {
      // Создаем условия поиска для каждого термина
      const searchPromises = [];
      
      // Поиск по каждому термину в названии
      for (const term of searchTerms) {
        searchPromises.push(
          serverSupabase
            .from('books')
            .select('id, title, author, publication_year')
            .ilike('title', `%${term}%`)
            .limit(Math.ceil(searchLimit / 2))
        );
      }
      
      // Поиск по каждому термину в авторе
      for (const term of searchTerms) {
        searchPromises.push(
          serverSupabase
            .from('books')
            .select('id, title, author, publication_year')
            .ilike('author', `%${term}%`)
            .limit(Math.ceil(searchLimit / 2))
        );
      }
      
      // Выполняем все поисковые запросы параллельно
      try {
        const results = await Promise.all(searchPromises);
        
        // Объединяем все результаты
        allMatches = results.flatMap((result: any) => result.data || []);
      } catch (searchError) {
        console.warn(`  ⚠️  Ошибка при поиске книг:`, searchError);
      }
    }
    
    // Удаляем дубликаты по ID
    const uniqueMatches = allMatches.filter((book, index, self) => 
      index === self.findIndex(b => b.id === book.id)
    );
    
    if (uniqueMatches.length === 0) {
      return null;
    }
    
    // Находим лучшее сопоставление, используя UniversalFileMatcher
    let bestMatch: MatchResult | null = null;
    let bestScore = 0;
    
    for (const book of uniqueMatches) {
      const result = UniversalFileMatcher.matchFileToBook(file, book);
      
      if (result.score > bestScore) {
        bestScore = result.score;
        bestMatch = {
          file,
          book,
          score: result.score,
          matchedWords: result.matchedWords
        };
      }
    }
    
    return bestMatch;
  }
  
  /**
   * Проверяет, релевантна ли книга для файла
   * @param file файл для проверки
   * @param book книга для проверки
   * @returns результат сопоставления, если релевантна
   */
  static matchFileWithBook(file: FileOption, book: Book): MatchResult | null {
    const result = UniversalFileMatcher.matchFileToBook(file, book);
    
    if (result.score >= 65) { // Порог релевантности
      return {
        file,
        book,
        score: result.score,
        matchedWords: result.matchedWords
      };
    }
    
    return null;
  }
  
  /**
   * Находит наиболее релевантные файлы для книги
   * @param book книга для сопоставления
   * @param files список файлов для проверки
   * @returns отсортированный список релевантных файлов
   */
  static findBestMatchesForBook(book: Book, files: FileOption[]): MatchResult[] {
    const results: MatchResult[] = [];
    
    for (const file of files) {
      const matchResult = UniversalFileMatcher.matchFileToBook(file, book);
      
      // Возвращаем все совпадения, чтобы иметь возможность видеть все оценки
      results.push({
        file,
        book,
        score: matchResult.score,
        matchedWords: matchResult.matchedWords
      });
    }
    
    // Сортируем по убыванию релевантности
    return results.sort((a, b) => b.score - a.score);
  }
  
  /**
   * Извлекает поисковые термины из имени файла
   * @param filename имя файла
   * @returns массив поисковых терминов
   */
  private static extractSearchTerms(filename: string): string[] {
    // Убираем расширение файла
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
    // Нормализуем строку в NFC форму для консистентности
    const normalized = nameWithoutExt.normalize('NFC');
    
    // Разбиваем имя файла на слова
    const words = normalized
      .split(/[_\-\s]+/) // Разделяем по пробелам, подчеркиваниям и дефисам
      .filter(word => word.length > 0) // Убираем пустые слова
      .map(word => word.trim()) // Убираем пробелы
      .filter(word => word.length > 1); // Убираем слова длиной 1 символ
    
    return words;
  }
}