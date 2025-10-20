/**
 * Универсальный алгоритм релевантного поиска файлов для книг
 * 
 * Правила:
 * 1. Нормализация: NFC, нижний регистр, "ё" → "е"
 * 2. Разбиение слов: все возможные варианты, союзы и слово "цикл" отбрасываются
 * 3. Алгоритм поиска: ищем совпадение каждого из слов, полученных из имени файла, с массивом слов, полученных из автора и названия книги
 * 4. Веса: 20 баллов за каждое совпадение
 * 5. Порог: 50
 * 6. Формат файла: не учитывается
 * 7. MIME-типы: не фильтруются
 */

interface BookWithoutFile {
  id: string;
  title: string;
  author: string;
  publication_year?: number;
}

interface FileOption {
  message_id: number;
  file_name: string;
  mime_type: string;
  // другие поля могут быть добавлены по необходимости
}

interface FileMatchResult {
  file: FileOption;
  score: number;
  matchedWords: string[];
}

interface WordExtractionResult {
  allWords: string[];
  titleWords: string[];
  authorWords: string[];
}

export class UniversalFileMatcher {
  // Список русских союзов, которые будут исключаться из анализа
  private static readonly CONJUNCTIONS = [
    'и', 'или', 'а', 'но', 'да', 'же', 'ли', 'бы', 'б', 'в', 'во', 
    'на', 'над', 'под', 'при', 'через', 'с', 'со', 'у', 'о', 'об', 
    'от', 'до', 'за', 'из', 'к', 'ко', 'по', 'не', 'ни', 'же'
  ];

  /**
   * Нормализует строку: NFC, нижний регистр, "ё" → "е"
   */
  private static normalizeString(str: string): string {
    if (!str) return '';
    return str
      .normalize('NFC')
      .toLowerCase()
      .replace(/ё/g, 'е');
  }

  /**
   * Извлекает слова из строки с учетом различных разделителей и исключений
   */
  private static extractWords(str: string): string[] {
    if (!str) return [];

    const normalized = this.normalizeString(str);
    
    // Разделители: пробелы, дефисы, скобки, точки, запятые, другие специальные символы
    const words = normalized
      .split(/[\s\-_\(\)\[\]\{\}\/\\\.,"'`~!@#$%^&\*+=\|;:<>?]+/)
      .map(word => word.trim())
      .filter(word => word.length > 1); // Убираем слова короче 2 символов

    // Убираем союзы и слово "цикл"
    return words.filter(word => 
      !this.CONJUNCTIONS.includes(word) && 
      word !== 'цикл'
    );
  }

  /**
   * Извлекает слова из книги (название и автор)
   */
  public static extractBookWords(book: BookWithoutFile): WordExtractionResult {
    const titleWords = this.extractWords(book.title || '');
    const authorWords = this.extractWords(book.author || '');
    
    // Объединяем слова из названия и автора
    const allWords = [...new Set([...titleWords, ...authorWords])]; // Уникальные слова
    
    return {
      allWords,
      titleWords,
      authorWords
    };
  }

  /**
   * Проверяет, является ли файл релевантным для книги по универсальному алгоритму
   */
  public static matchFileToBook(file: FileOption, book: BookWithoutFile): FileMatchResult {
    const bookWords = this.extractBookWords(book);
    const fileWords = this.extractWords(file.file_name || '');
    
    if (bookWords.allWords.length === 0 || fileWords.length === 0) {
      return {
        file,
        score: 0,
        matchedWords: []
      };
    }

    // Проверяем совпадения слов из файла с словами из книги
    const matchedWords: string[] = [];
    let score = 0;

    for (const fileWord of fileWords) {
      // Проверяем, есть ли хотя бы одно совпадение с любым словом из книги
      const matchFound = bookWords.allWords.some(bookWord => 
        bookWord.includes(fileWord) || fileWord.includes(bookWord)
      );

      if (matchFound) {
        matchedWords.push(fileWord);
        score += 20; // 20 баллов за каждое совпадение слова
      }
    }

    return {
      file,
      score,
      matchedWords: [...new Set(matchedWords)] // Уникальные совпадения
    };
  }

  /**
   * Находит наиболее релевантные файлы для книги
   */
  public static findMatchingFiles(book: BookWithoutFile, files: FileOption[]): FileOption[] {
    const results = files
      .map(file => this.matchFileToBook(file, book))
      .filter(result => result.score >= 50) // Порог 50
      .sort((a, b) => b.score - a.score); // Сортировка по оценке (лучшие первые)

    return results.slice(0, 15).map(result => result.file); // Возвращаем топ-15 файлов
  }

  /**
   * Проверяет, релевантен ли конкретный файл книге (для одиночной проверки)
   */
  public static isFileRelevant(file: FileOption, book: BookWithoutFile, minScore: number = 50): boolean {
    const result = this.matchFileToBook(file, book);
    return result.score >= minScore;
  }
}