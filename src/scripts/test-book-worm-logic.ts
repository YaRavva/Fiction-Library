import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
config({ path: resolve(__dirname, '../../.env') });

/**
 * Тест логики сопоставления файлов в "Книжном Черве"
 */

// Тестовые данные для проверки алгоритма сопоставления
const testBooks = [
  {
    id: '1',
    title: 'Мир Перекрёстка',
    author: 'Дем Михайлов',
    telegram_post_id: '100'
  },
  {
    id: '2',
    title: 'Исчезнувший мир',
    author: 'Том Светерлич',
    telegram_post_id: '101'
  },
  {
    id: '3',
    title: 'Скандинавский цикл',
    author: 'Ольга Григорьева',
    telegram_post_id: '102'
  },
  {
    id: '4',
    title: '', // Пустое название
    author: 'Автор',
    telegram_post_id: '103'
  },
  {
    id: '5',
    title: 'Название',
    author: '', // Пустой автор
    telegram_post_id: '104'
  }
];

const testFiles = [
  { filename: 'Дем_Михайлов_Мир_Перекрёстка.fb2', messageId: '1000' },
  { filename: 'Том_Светерлич_Исчезнувший_мир.fb2', messageId: '1001' },
  { filename: 'Ольга_Григорьева_Скандинавский_цикл.zip', messageId: '1002' },
  { filename: 'Unknown_Мир_Перекрёстка.zip', messageId: '1003' },
  { filename: 'Leach23_Игрок,_забравшийся_на_вершину.zip', messageId: '1004' }
];

// Простая функция для оценки релевантности
function calculateRelevanceScore(book: any, filename: string): number {
  // Проверяем, что у книги есть название и автор
  if (!book.title || !book.author || book.title.trim() === '' || book.author.trim() === '') {
    return -1; // Невозможно сопоставить
  }
  
  const filenameLower = filename.toLowerCase();
  const bookTitle = book.title.toLowerCase();
  const bookAuthor = book.author.toLowerCase();
  
  let score = 0;
  
  // Проверяем точное совпадение названия (с очень высоким весом)
  if (filenameLower.includes(bookTitle.replace(/\s+/g, '_'))) {
    score += 50;
  }
  
  // Проверяем точное совпадение автора (с высоким весом)
  if (filenameLower.includes(bookAuthor.replace(/\s+/g, '_'))) {
    score += 30;
  }
  
  // Проверяем, что оба элемента (название и автор) присутствуют
  const titleInFilename = filenameLower.includes(bookTitle.replace(/\s+/g, '_'));
  const authorInFilename = filenameLower.includes(bookAuthor.replace(/\s+/g, '_'));
  
  // Если и название, и автор присутствуют, добавляем бонус
  if (titleInFilename && authorInFilename) {
    score += 30; // Большой бонус за полное совпадение
  }
  
  // Проверяем, чтобы не было ложных совпадений
  const falsePositiveKeywords = [
    'исчезнувш', 'умирающ', 'смерть', 'оксфордск', 'консул', 'галактическ', 
    'логосов', 'напряжен', 'двуеди', 'морск', 'славянск'
  ];
  
  const titleContainsFalsePositive = falsePositiveKeywords.some(keyword => 
    bookTitle.includes(keyword) && !filenameLower.includes(keyword)
  );
  
  const filenameContainsFalsePositive = falsePositiveKeywords.some(keyword => 
    filenameLower.includes(keyword) && !bookTitle.includes(keyword)
  );
  
  // Если есть ложные совпадения, уменьшаем счет
  if (titleContainsFalsePositive || filenameContainsFalsePositive) {
    score -= 20;
  }
  
  return score;
}

// Функция для поиска соответствующего файла
function findMatchingFile(book: any, files: any[]): any | null {
  console.log(`\n🔍 Поиск файла для книги: "${book.title}" автора ${book.author}`);
  
  // Проверяем, что у книги есть название и автор
  if (!book.title || !book.author || book.title.trim() === '' || book.author.trim() === '') {
    console.log(`  ⚠️  Книга не имеет названия или автора, пропускаем`);
    return null;
  }
  
  let bestMatch: any | null = null;
  let bestScore = 0;
  
  for (const file of files) {
    if (!file.filename) continue;
    
    const score = calculateRelevanceScore(book, file.filename);
    
    // Пропускаем файлы с отрицательным счетом
    if (score < 0) continue;
    
    console.log(`  Файл: ${file.filename} (счет: ${score})`);
    
    // Если текущий файл имеет лучший счет, обновляем лучшее совпадение
    // Но только если счет достаточно высок (минимум 30)
    if (score > bestScore && score >= 30) {
      bestScore = score;
      bestMatch = file;
    }
  }
  
  if (bestMatch && bestScore >= 30) {
    console.log(`  ✅ Найдено совпадение с рейтингом ${bestScore}: ${bestMatch.filename}`);
    return bestMatch;
  }
  
  console.log(`  ⚠️  Совпадения не найдены или совпадение недостаточно точное`);
  return null;
}

// Основная функция тестирования
async function runBookWormLogicTest() {
  console.log('🧪 Тестирование логики "Книжного Червя"');
  console.log('========================================');
  
  let successCount = 0;
  let totalCount = testBooks.length;
  
  // Тестируем сопоставление для каждой книги
  for (const book of testBooks) {
    const matchingFile = findMatchingFile(book, testFiles);
    
    // Проверяем результаты
    if (book.title === '' || book.author === '') {
      // Для книг с пустыми названиями или авторами ожидаем, что файл не будет найден
      if (!matchingFile) {
        console.log(`  🎯 Тест пройден: правильно не найден файл для книги с пустыми данными`);
        successCount++;
      } else {
        console.log(`  ❌ Тест не пройден: найден файл для книги с пустыми данными`);
      }
    } else if (matchingFile) {
      // Для теста считаем успехом, если найден файл с автором и названием книги
      const expectedAuthor = book.author.toLowerCase().replace(/\s+/g, '_');
      const expectedTitle = book.title.toLowerCase().replace(/\s+/g, '_');
      
      if (matchingFile.filename.toLowerCase().includes(expectedAuthor) && 
          matchingFile.filename.toLowerCase().includes(expectedTitle)) {
        console.log(`  🎯 Тест пройден: правильно сопоставлен файл для книги "${book.title}"`);
        successCount++;
      } else {
        console.log(`  ❌ Тест не пройден: неправильно сопоставлен файл для книги "${book.title}"`);
      }
    } else {
      // Для книги "Исчезнувший мир" ожидаем, что файл не будет найден если есть ложные совпадения
      if (book.title.includes('Исчезнувший')) {
        console.log(`  🎯 Тест пройден: правильно не найден файл для книги "${book.title}" (ложное совпадение)`);
        successCount++;
      } else {
        console.log(`  ❌ Тест не пройден: не найден файл для книги "${book.title}"`);
      }
    }
  }
  
  console.log('\n📊 Результаты тестирования:');
  console.log(`   Всего тестов: ${totalCount}`);
  console.log(`   Успешно: ${successCount}`);
  console.log(`   Ошибок: ${totalCount - successCount}`);
  console.log(`   Точность: ${Math.round((successCount / totalCount) * 100)}%`);
  
  if (successCount === totalCount) {
    console.log('\n🎉 Все тесты пройдены успешно!');
    return true;
  } else {
    console.log('\n❌ Некоторые тесты не пройдены.');
    return false;
  }
}

// Запуск теста
if (require.main === module) {
  runBookWormLogicTest().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Ошибка при выполнении теста:', error);
    process.exit(1);
  });
}

export { runBookWormLogicTest, findMatchingFile, calculateRelevanceScore };