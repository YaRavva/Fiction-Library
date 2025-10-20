import { UniversalFileMatcher } from '../lib/universal-file-matcher';

// Простой тест универсального алгоритма сопоставления
function testUniversalMatcher() {
  console.log('Тестирование универсального алгоритма сопоставления файлов...\n');

  // Создаем тестовую книгу
  const testBook = {
    id: '1',
    title: 'Волкодав в краю овёс и мёда',
    author: 'Мария Семёнова',
    publication_year: 2020
  };

  // Создаем тестовые файлы
  const testFiles = [
    {
      message_id: 101,
      file_name: 'Варяг. Волкодав в краю овёс и мёда.fb2',
      mime_type: 'application/fb2'
    },
    {
      message_id: 102,
      file_name: 'Семёнова Мария - Волкодав в краю овёс и мёда.zip',
      mime_type: 'application/zip'
    },
    {
      message_id: 103,
      file_name: 'Азазель. Волкодав 2.fb2',
      mime_type: 'application/fb2'
    },
    {
      message_id: 104,
      file_name: 'Гарри Поттер и кубок огня.epub',
      mime_type: 'application/epub'
    },
    {
      message_id: 105,
      file_name: 'Семёнова. Волкодав в краю овёс и мёда.pdf',
      mime_type: 'application/pdf'
    },
    {
      message_id: 106,
      file_name: 'Просто какой-то файл.txt',
      mime_type: 'text/plain'
    }
  ];

  console.log('Тестируемая книга:');
  console.log(`- Название: ${testBook.title}`);
  console.log(`- Автор: ${testBook.author}\n`);

  console.log('Результаты сопоставления:');
  console.log('------------------------');

  // Тестируем каждый файл
  testFiles.forEach(file => {
    const result = UniversalFileMatcher.matchFileToBook(file, testBook);
    const isRelevant = result.score >= 50;
    
    console.log(`\nФайл: ${file.file_name}`);
    console.log(`Оценка: ${result.score}`);
    console.log(`Совпавшие слова: ${result.matchedWords.join(', ')}`);
    console.log(`Релевантен: ${isRelevant ? 'ДА' : 'НЕТ'}`);
  });

  console.log('\nТоп-релевантные файлы:');
  console.log('----------------------');
  const topFiles = UniversalFileMatcher.findMatchingFiles(testBook, testFiles);
  topFiles.forEach((file, index) => {
    const result = UniversalFileMatcher.matchFileToBook(file, testBook);
    console.log(`${index + 1}. ${file.file_name} (оценка: ${result.score})`);
  });

  console.log('\nТестирование завершено.');
}

// Запуск теста при выполнении файла
if (typeof window === 'undefined') {
  // Для выполнения в Node.js
  testUniversalMatcher();
} else {
  // Для выполнения в браузере
  console.log('Загружен тест универсального сопоставления. Вызовите testUniversalMatcher() для запуска.');
}

export { testUniversalMatcher };