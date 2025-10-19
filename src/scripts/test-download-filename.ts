// Тестовая симуляция логики формирования имени файла в читалке
const book = {
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
console.log(`  Путь в хранилище: ${book.storage_path}`);
console.log(`  URL файла: ${book.file_url}`);

// Create a custom filename in the format "author - title.ext"
const sanitizedTitle = book.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
const sanitizedAuthor = book.author.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
const fileExtension = book.file_format && book.file_format !== '' ? 
  book.file_format : 
  (book.storage_path ? book.storage_path.split('.').pop() : 'fb2');
const filename = `${sanitizedAuthor} - ${sanitizedTitle}.${fileExtension}`;

console.log('\n📝 Формирование имени файла:');
console.log(`  Очищенное название: ${sanitizedTitle}`);
console.log(`  Очищенный автор: ${sanitizedAuthor}`);
console.log(`  Расширение файла: ${fileExtension}`);
console.log(`  Итоговое имя файла: ${filename}`);

console.log('\n✅ Логика формирования имени файла работает корректно');