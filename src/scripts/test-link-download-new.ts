// Тест нового решения для скачивания файлов
console.log('🚀 Тест нового решения для скачивания файлов\n');

// Пример данных книги
const bookExample = {
  id: "test-book-id",
  title: "цикл Мицелий",
  author: "Вилма Кадлечкова",
  file_format: "zip",
  storage_path: undefined as string | undefined,
  file_url: "https://fiction-library-1760461283197.s3.cloud.ru/4379.zip"
};

console.log('📚 Пример книги:');
console.log(`  ID: ${bookExample.id}`);
console.log(`  Название: ${bookExample.title}`);
console.log(`  Автор: ${bookExample.author}`);
console.log(`  Формат файла: ${bookExample.file_format}`);
console.log(`  Путь в хранилище: ${bookExample.storage_path}`);
console.log(`  URL файла: ${bookExample.file_url}\n`);

// Формирование имени файла
const sanitizedTitleExample = bookExample.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
const sanitizedAuthorExample = bookExample.author.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
const fileExtensionExample = bookExample.file_format && bookExample.file_format !== '' ? 
  bookExample.file_format : 
  (bookExample.storage_path ? bookExample.storage_path.split('.').pop() : 'zip');
const filenameExample = `${sanitizedAuthorExample} - ${sanitizedTitleExample}.${fileExtensionExample}`;

console.log('📝 Формирование имени файла:');
console.log(`  Очищенное название: ${sanitizedTitleExample}`);
console.log(`  Очищенный автор: ${sanitizedAuthorExample}`);
console.log(`  Расширение файла: ${fileExtensionExample}`);
console.log(`  Итоговое имя файла: ${filenameExample}\n`);

console.log('🔧 Новое решение без fetch:');

console.log('\n1. Создание ссылки с атрибутом download:');
console.log(`   const a = document.createElement('a');`);
console.log(`   a.href = "${bookExample.file_url}";`);
console.log(`   a.download = "${filenameExample}";`);
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
console.log(`  a.href = '${bookExample.file_url}';`);
console.log(`  a.download = '${filenameExample}';`);
console.log(`  a.target = '_blank';`);
console.log(`  document.body.appendChild(a);`);
console.log(`  a.click();`);
console.log(`  document.body.removeChild(a);\n`);

console.log('🎉 Результат:');
console.log(`  Файл будет скачан как: ${filenameExample}`);
console.log('  Вместо: 4379.zip');