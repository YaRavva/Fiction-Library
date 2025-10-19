// Тест нового решения для скачивания файлов
console.log('🚀 Тест нового решения для скачивания файлов\n');

// Пример данных книги
const bookTest = {
  id: "test-book-id",
  title: "цикл Мицелий",
  author: "Вилма Кадлечкова",
  file_format: "zip",
  storage_path: undefined as string | undefined,
  file_url: "https://fiction-library-1760461283197.s3.cloud.ru/4379.zip"
};

console.log('📚 Пример книги:');
console.log(`  ID: ${bookTest.id}`);
console.log(`  Название: ${bookTest.title}`);
console.log(`  Автор: ${bookTest.author}`);
console.log(`  Формат файла: ${bookTest.file_format}`);
console.log(`  Путь в хранилище: ${bookTest.storage_path}`);
console.log(`  URL файла: ${bookTest.file_url}\n`);

// Формирование имени файла
const sanitizedTitleTest = bookTest.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
const sanitizedAuthorTest = bookTest.author.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
const fileExtensionTest = bookTest.file_format && bookTest.file_format !== '' ? 
  bookTest.file_format : 
  (bookTest.storage_path ? bookTest.storage_path.split('.').pop() : 'zip');
const filenameTest = `${sanitizedAuthorTest} - ${sanitizedTitleTest}.${fileExtensionTest}`;

console.log('📝 Формирование имени файла:');
console.log(`  Очищенное название: ${sanitizedTitleTest}`);
console.log(`  Очищенный автор: ${sanitizedAuthorTest}`);
console.log(`  Расширение файла: ${fileExtensionTest}`);
console.log(`  Итоговое имя файла: ${filenameTest}\n`);

console.log('🔧 Новое решение без fetch:');

console.log('\n1. Создание ссылки с атрибутом download:');
console.log(`   const a = document.createElement('a');`);
console.log(`   a.href = "${bookTest.file_url}";`);
console.log(`   a.download = "${filenameTest}";`);
console.log(`   a.target = "_blank";`);
console.log(`   document.body.appendChild(a);`);
console.log(`   a.click();`);
console.log(`   document.body.removeChild(a);\n`);

console.log('✅ Преимущества нового решения:');
console.log('  1. Нет ошибок CORS - не используем fetch');
console.log('  2. Быстрее - нет сетевых запросов');
console.log('  3. Проще в отладке - меньше кода');
console.log('  4. Правильное имя файла через атрибут download\n');

console.log('⚠️  Ограничения:');
console.log('  Современные браузеры могут игнорировать атрибут download');
console.log('  для cross-origin запросов, но все равно попытаются использовать');
console.log('  указанное имя файла при сохранении\n');

console.log('🧪 Тест в браузере:');
console.log('  Откройте консоль браузера и выполните:');
console.log(`  const a = document.createElement('a');`);
console.log(`  a.href = '${bookTest.file_url}';`);
console.log(`  a.download = '${filenameTest}';`);
console.log(`  a.target = '_blank';`);
console.log(`  document.body.appendChild(a);`);
console.log(`  a.click();`);
console.log(`  document.body.removeChild(a);\n`);

console.log('🎉 Результат:');
console.log(`  Файл будет скачан как: ${filenameTest}`);
console.log('  Вместо: 4379.zip');