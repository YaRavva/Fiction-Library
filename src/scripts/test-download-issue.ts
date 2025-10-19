import dotenv from 'dotenv';

dotenv.config();

async function testDownloadIssue() {
  console.log('🚀 Тестируем проблему со скачиванием файла...\n');
  
  // Имитируем данные книги
  const book = {
    id: "test-book-id",
    title: "цикл Мицелий",
    author: "Вилма Кадлечкова",
    file_format: "zip",
    storage_path: undefined as string | undefined,
    file_url: "https://fiction-library-1760461283197.s3.cloud.ru/4379.zip"
  };
  
  console.log('📚 Информация о книге:');
  console.log(`  Название: ${book.title}`);
  console.log(`  Автор: ${book.author}`);
  console.log(`  Формат файла: ${book.file_format}`);
  console.log(`  URL файла: ${book.file_url}\n`);
  
  // Проверим формирование имени файла
  console.log('📝 Формирование имени файла:');
  const sanitizedTitle = book.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
  const sanitizedAuthor = book.author.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
  const fileExtension = book.file_format && book.file_format !== '' ? 
    book.file_format : 
    (book.storage_path ? book.storage_path.split('.').pop() : 'zip');
  const expectedFilename = `${sanitizedAuthor} - ${sanitizedTitle}.${fileExtension}`;
  
  console.log(`  Очищенное название: ${sanitizedTitle}`);
  console.log(`  Очищенный автор: ${sanitizedAuthor}`);
  console.log(`  Расширение файла: ${fileExtension}`);
  console.log(`  Ожидаемое имя файла: ${expectedFilename}\n`);
  
  // Проверим, что происходит при window.open
  console.log('🔗 Проверка window.open (fallback):');
  console.log(`  window.open("${book.file_url}", "_blank")`);
  console.log('  Результат: файл скачается с именем "4379.zip" (из URL)\n');
  
  // Проверим, что должно происходить при правильной реализации
  console.log('✅ Правильная реализация должна:');
  console.log('  1. Загрузить файл через fetch()');
  console.log('  2. Создать Blob из ответа');
  console.log('  3. Создать объект URL через window.URL.createObjectURL()');
  console.log('  4. Создать <a> элемент с атрибутом download="${expectedFilename}"');
  console.log('  5. Вызвать click() на элементе');
  console.log('  6. Удалить временные элементы\n');
  
  // Проверим, почему может не работать правильная реализация
  console.log('❓ Возможные причины проблемы:');
  console.log('  1. CORS - сервер не разрешает fetch запросы');
  console.log('  2. Ошибка сети при fetch');
  console.log('  3. Проблемы с Content-Type заголовком');
  console.log('  4. Браузер блокирует программное скачивание\n');
  
  console.log('💡 Решение:');
  console.log('  Вместо window.open в fallback, можно использовать прямую ссылку');
  console.log('  с правильным именем файла через атрибут download');
}

testDownloadIssue();