import dotenv from 'dotenv';
dotenv.config();

import { TelegramFileService } from '../lib/telegram/file-service';

// Копируем реализацию приватного метода для тестирования
function extractSearchTerms(filename: string): string[] {
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

function selectBestMatch(matches: any[], searchTerms: string[], title: string, author: string): any {
  if (matches.length === 0) {
    return null;
  }
  
  if (matches.length === 1) {
    return matches[0];
  }
  
  // Нормализуем входные данные
  const normalizedTitle = title.normalize('NFC');
  const normalizedAuthor = author.normalize('NFC');
  const normalizedSearchTerms = searchTerms.map(term => term.normalize('NFC'));
  
  // Ранжируем совпадения по релевантности
  const rankedMatches = matches.map(bookItem => {
    // Нормализуем данные книги
    const normalizedBookTitle = bookItem.title.normalize('NFC');
    const normalizedBookAuthor = bookItem.author.normalize('NFC');
    
    let score = 0;
    
    // Проверяем точное совпадение названия (с очень высоким весом)
    if (normalizedBookTitle.toLowerCase() === normalizedTitle.toLowerCase()) {
      score += 50;
    }
    
    // Проверяем точное совпадение автора (с высоким весом)
    if (normalizedBookAuthor.toLowerCase() === normalizedAuthor.toLowerCase()) {
      score += 30;
    }
    
    // Проверяем совпадение по извлеченному названию (с высоким весом)
    if (normalizedBookTitle.toLowerCase().includes(normalizedTitle.toLowerCase())) {
      score += 20;
    }
    
    // Проверяем совпадение по извлеченному автору (с высоким весом)
    if (normalizedBookAuthor.toLowerCase().includes(normalizedAuthor.toLowerCase())) {
      score += 20;
    }
    
    // Проверяем, что оба элемента (название и автор) присутствуют
    const titleInBook = normalizedBookTitle.toLowerCase().includes(normalizedTitle.toLowerCase());
    const authorInBook = normalizedBookAuthor.toLowerCase().includes(normalizedAuthor.toLowerCase());
    
    // Если и название, и автор присутствуют, добавляем бонус
    if (titleInBook && authorInBook) {
      score += 30; // Большой бонус за полное совпадение
    }
    
    // Добавляем проверку на частичное совпадение слов в названии
    // Разбиваем название книги на слова
    const bookTitleWords = normalizedBookTitle.toLowerCase().split(/\s+/).filter((word: string) => word.length > 2);
    const searchTitleWords = normalizedTitle.toLowerCase().split(/\s+/).filter((word: string) => word.length > 2);
    let titleWordsMatchCount = 0;
    
    for (const word of searchTitleWords) {
      if (normalizedBookTitle.toLowerCase().includes(word)) {
        titleWordsMatchCount++;
      }
    }
    
    // Если совпадает более 50% слов из названия, добавляем бонус
    if (searchTitleWords.length > 0 && titleWordsMatchCount / searchTitleWords.length >= 0.5) {
      score += 15;
    }
    
    // Проверяем, чтобы не было ложных совпадений
    // Например, "Мир Перекрёстка" не должен совпадать с "Исчезнувший мир"
    const falsePositiveKeywords = [
      'исчезнувш', 'умирающ', 'смерть', 'оксфордск', 'консул', 'галактическ', 
      'логосов', 'напряжен', 'двуеди', 'морск', 'славянск'
    ];
    
    const titleContainsFalsePositive = falsePositiveKeywords.some(keyword => 
      normalizedBookTitle.toLowerCase().includes(keyword) && !normalizedTitle.toLowerCase().includes(keyword)
    );
    
    const searchTitleContainsFalsePositive = falsePositiveKeywords.some(keyword => 
      normalizedTitle.toLowerCase().includes(keyword) && !normalizedBookTitle.toLowerCase().includes(keyword)
    );
    
    // Если есть ложные совпадения, уменьшаем счет
    if (titleContainsFalsePositive || searchTitleContainsFalsePositive) {
      score -= 20;
    }
    
    // Проверяем совпадение по поисковым терминам
    for (const term of normalizedSearchTerms) {
      if (normalizedBookTitle.toLowerCase().includes(term.toLowerCase())) {
        score += 5;
      }
      if (normalizedBookAuthor.toLowerCase().includes(term.toLowerCase())) {
        score += 5;
      }
    }
    
    // НОВОЕ: Проверяем включение всех слов из имени файла в название и автора книги
    // Это особенно важно когда автор = "Unknown"
    // Разбиваем извлеченное название на слова
    const allWords = normalizedTitle.toLowerCase().split(/[_\-\s]+/).filter((word: string) => word.length > 2);
    let allWordsInTitle = true;
    let allWordsInAuthor = true;
    let wordsFoundCount = 0;
    let titleWordsFound = 0;
    let authorWordsFound = 0;
    
    for (const word of allWords) {
      // Проверяем включение слова в название книги
      if (normalizedBookTitle.toLowerCase().includes(word)) {
        wordsFoundCount++;
        titleWordsFound++;
      } else {
        allWordsInTitle = false;
      }
      // Проверяем включение слова в автора книги
      if (normalizedBookAuthor.toLowerCase().includes(word)) {
        wordsFoundCount++;
        authorWordsFound++;
      } else {
        allWordsInAuthor = false;
      }
    }
    
    // Если все слова из имени файла включены в название или автора, добавляем бонус
    // Учитываем количество найденных слов
    if (allWordsInTitle || allWordsInAuthor || wordsFoundCount > 0) {
      // Бонус зависит от количества найденных слов
      const wordBonus = Math.min(30, wordsFoundCount * 5); // Максимум 30 баллов
      score += wordBonus;
      
      // Дополнительный бонус, если слова найдены и в названии, и в авторе
      if (titleWordsFound > 0 && authorWordsFound > 0) {
        score += 10; // Дополнительный бонус
      }
    }
    
    // Если все слова включены и в название, и в автора, добавляем еще больший бонус
    if (allWordsInTitle && allWordsInAuthor) {
      score += 20; // Дополнительный бонус
    }
    
    // НОВОЕ: Улучшенная проверка на совпадение названий с префиксом "цикл"
    // Если извлеченное название не содержит "цикл", но название книги содержит "цикл",
    // проверяем, совпадают ли остальные слова
    if (!normalizedTitle.toLowerCase().includes('цикл') && normalizedBookTitle.toLowerCase().includes('цикл')) {
      // Убираем префикс "цикл" из названия книги и проверяем совпадение
      const bookTitleWithoutCycle = normalizedBookTitle.toLowerCase().replace('цикл', '').trim();
      if (bookTitleWithoutCycle.includes(normalizedTitle.toLowerCase()) || 
          normalizedTitle.toLowerCase().includes(bookTitleWithoutCycle)) {
        score += 25; // Большой бонус за совпадение названия с префиксом "цикл"
      } else {
        // Проверяем совпадение слов
        const titleWords = normalizedTitle.toLowerCase().split(/\s+/).filter((word: string) => word.length > 2);
        const bookTitleWordsWithoutCycle = bookTitleWithoutCycle.split(/\s+/).filter((word: string) => word.length > 2);
        let cycleWordsMatchCount = 0;
        
        for (const word of titleWords) {
          if (bookTitleWithoutCycle.includes(word)) {
            cycleWordsMatchCount++;
          }
        }
        
        // Если совпадает более 50% слов, добавляем бонус
        if (titleWords.length > 0 && cycleWordsMatchCount / titleWords.length >= 0.5) {
          score += 15;
        }
      }
    }
    
    // НОВОЕ: Проверка на точное совпадение слов в названии (даже если порядок другой)
    // Это особенно важно для случаев, когда название книги "цикл Великий Грайан",
    // а извлеченное название "Великий Грайан"
    const extractedTitleWords = normalizedTitle.toLowerCase().split(/\s+/).filter((word: string) => word.length > 2);
    const bookTitleWordsFiltered = normalizedBookTitle.toLowerCase().split(/\s+/).filter((word: string) => word.length > 2);
    let exactWordsMatchCount = 0;
    
    for (const word of extractedTitleWords) {
      if (bookTitleWordsFiltered.includes(word)) {
        exactWordsMatchCount++;
      }
    }
    
    // Если совпадают все слова из извлеченного названия, добавляем большой бонус
    if (extractedTitleWords.length > 0 && exactWordsMatchCount === extractedTitleWords.length) {
      score += 35; // Очень большой бонус за точное совпадение всех слов
    }
    // Если совпадает большинство слов, добавляем средний бонус
    else if (extractedTitleWords.length > 0 && exactWordsMatchCount / extractedTitleWords.length >= 0.7) {
      score += 25;
    }
    // Если совпадает более 50% слов, добавляем небольшой бонус
    else if (extractedTitleWords.length > 0 && exactWordsMatchCount / extractedTitleWords.length >= 0.5) {
      score += 15;
    }
    
    // НОВОЕ: УЛУЧШЕННАЯ ЛОГИКА - проверяем каждое слово из поисковых терминов на вхождение
    // как в название, так и в автора книги
    let improvedWordMatchCount = 0;
    for (const term of normalizedSearchTerms) {
      const termLower = term.toLowerCase();
      // Проверяем вхождение термина в название книги
      if (normalizedBookTitle.toLowerCase().includes(termLower)) {
        improvedWordMatchCount++;
      }
      // Проверяем вхождение термина в автора книги
      if (normalizedBookAuthor.toLowerCase().includes(termLower)) {
        improvedWordMatchCount++;
      }
    }
    
    // Добавляем бонус за количество совпадений слов
    if (normalizedSearchTerms.length > 0) {
      const matchRatio = improvedWordMatchCount / (normalizedSearchTerms.length * 2); // Максимум 100% совпадения
      score += Math.floor(matchRatio * 40); // Максимум 40 баллов за совпадение слов
    }
    
    return { book: {title: normalizedBookTitle, author: normalizedBookAuthor}, score };
  });
  
  // Сортируем по убыванию релевантности
  rankedMatches.sort((a, b) => (b.score - a.score));
  
  console.log(`  📊 Ранжирование совпадений:`);
  rankedMatches.forEach((match, index) => {
    console.log(`    ${index + 1}. "${match.book.title}" автора ${match.book.author} (счет: ${match.score})`);
  });
  
  // Возвращаем книгу с наивысшей релевантностью, но только если счет достаточно высок
  // СНИЖАЕМ порог релевантности до 25, чтобы учитывать улучшенные совпадения
  if (rankedMatches[0].score >= 25) {
    return rankedMatches[0].book;
  }
  
  // Если нет книг с высокой релевантностью, возвращаем null
  console.log(`  ⚠️  Нет книг с достаточной релевантностью (минимум 25)`);
  return null;
}

async function testUnicodeNormalization() {
  console.log('🚀 Тестируем нормализацию Unicode для решения проблем с кодировкой...\n');
  
  // Создаем тестовую строку с буквой "й"
  const originalString = 'Арвендейл';
  console.log(`🔤 Исходная строка: "${originalString}"`);
  
  // Создаем различные нормализованные формы
  const nfc = originalString.normalize('NFC');
  const nfd = originalString.normalize('NFD');
  const nfkc = originalString.normalize('NFKC');
  const nfkd = originalString.normalize('NFKD');
  
  console.log(`  NFC:  "${nfc}" (длина: ${nfc.length})`);
  console.log(`  NFD:  "${nfd}" (длина: ${nfd.length})`);
  console.log(`  NFKC: "${nfkc}" (длина: ${nfkc.length})`);
  console.log(`  NFKD: "${nfkd}" (длина: ${nfkd.length})`);
  
  // Проверим коды символов в каждой форме
  console.log('\n🔢 Коды символов:');
  console.log(`  NFC:  ${Array.from(nfc).map(char => `${char}(${char.charCodeAt(0)})`).join(', ')}`);
  console.log(`  NFD:  ${Array.from(nfd).map(char => `${char}(${char.charCodeAt(0)})`).join(', ')}`);
  console.log(`  NFKC: ${Array.from(nfkc).map(char => `${char}(${char.charCodeAt(0)})`).join(', ')}`);
  console.log(`  NFKD: ${Array.from(nfkd).map(char => `${char}(${char.charCodeAt(0)})`).join(', ')}`);
  
  // Тест сопоставления с различными формами
  console.log('\n🔍 Тест сопоставления с различными формами:');
  
  // Имитация найденных книг в базе данных
  const mockBooks = [
    { id: '1', title: 'Арвендейл', author: 'Тестовый Автор' },
    { id: '2', title: 'Арвендеил', author: 'Другой Автор' }, // Похожее название
    { id: '3', title: 'Вторая Книга', author: 'Третий Автор' }
  ];
  
  // Проверим сопоставление для каждой формы
  const forms = [
    { name: 'NFC', value: nfc },
    { name: 'NFD', value: nfd },
    { name: 'NFKC', value: nfkc },
    { name: 'NFKD', value: nfkd }
  ];
  
  for (const form of forms) {
    console.log(`\n--- Тест для формы ${form.name} ---`);
    const filename = `${form.value}.zip`;
    console.log(`📁 Файл: ${filename}`);
    
    // Извлекаем метаданные
    const metadata = TelegramFileService.extractMetadataFromFilename(filename);
    console.log(`  📊 Извеченные метаданные: author="${metadata.author}", title="${metadata.title}"`);
    
    // Извлекаем поисковые термины с нормализацией
    const searchTerms = extractSearchTerms(filename);
    console.log(`  🔍 Поисковые термины: [${searchTerms.map((term: string) => `"${term}"`).join(', ')}]`);
    
    // Проверяем совпадение
    const bestMatch = selectBestMatch(mockBooks, searchTerms, metadata.title, metadata.author);
    
    if (bestMatch) {
      console.log(`  ✅ Найдено совпадение: "${bestMatch.title}" автора ${bestMatch.author}`);
    } else {
      console.log(`  ❌ Совпадение не найдено`);
    }
  }
  
  console.log('\n✅ Тестирование нормализации Unicode завершено!');
}

// Запускаем тест
testUnicodeNormalization().catch(console.error);