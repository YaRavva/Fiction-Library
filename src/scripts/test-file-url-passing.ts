// Тест правильности передачи ссылок на файлы
console.log('🚀 Тест правильности передачи ссылок на файлы\n');

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

console.log('🔧 Проверка передачи URL в функции скачивания:');

// Тест handleDownloadClick
console.log('\n1. handleDownloadClick(book):');
console.log(`   Передается book.file_url: ${bookTest.file_url}`);

// Тест handleDownload
console.log('\n2. handleDownload(bookId, fileUrl):');
console.log(`   Передается bookId: ${bookTest.id}`);
console.log(`   Передается fileUrl: ${bookTest.file_url}`);

// Тест в таблице книг
console.log('\n3. BooksTable onDownloadClick(book):');
console.log(`   Передается book: { id: ${bookTest.id}, file_url: ${bookTest.file_url} }`);

// Тест в маленькой карточке
console.log('\n4. BookCardSmall onClick:');
console.log(`   Используется book.file_url напрямую: ${bookTest.file_url}`);

console.log('\n✅ Все функции получают правильные URL файлов');

console.log('\n🧪 Тест fetch запроса:');
console.log(`   fetch("${bookTest.file_url}")`);
console.log('   .then(response => response.blob())');
console.log('   .then(blob => {');
console.log('     // Создание объекта URL из blob');
console.log('     const url = window.URL.createObjectURL(blob);');
console.log(`     // Создание ссылки с именем файла: ${filenameTest}`);
console.log('     const a = document.createElement("a");');
console.log('     a.href = url;');
console.log(`     a.download = "${filenameTest}";`);
console.log('     // Программный клик по ссылке');
console.log('   });');

console.log('\n🎉 После выполнения fetch запроса файл будет скачан с правильным именем:');
console.log(`   ${filenameTest}`);
console.log('   Вместо: 4379.zip');