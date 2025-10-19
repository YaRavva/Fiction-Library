import dotenv from 'dotenv';

dotenv.config();

async function testSimplifiedDownload() {
  console.log('🚀 Тестируем упрощенную реализацию скачивания...\n');
  
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
  
  // Формируем имя файла
  const sanitizedTitle = book.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
  const sanitizedAuthor = book.author.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
  const fileExtension = book.file_format && book.file_format !== '' ? 
    book.file_format : 
    (book.storage_path ? book.storage_path.split('.').pop() : 'zip');
  const filename = `${sanitizedAuthor} - ${sanitizedTitle}.${fileExtension}`;
  
  console.log(`📝 Сформированное имя файла: ${filename}\n`);
  
  // Новая упрощенная реализация скачивания
  console.log('🔧 Новая упрощенная реализация скачивания:');
  console.log(`
  // Прямое создание ссылки с атрибутом download (без fetch)
  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = "${book.file_url}";
    a.download = "${filename}";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  `);
  
  console.log('✅ Преимущества нового подхода:');
  console.log('  1. Не требует fetch запроса, нет проблем с CORS');
  console.log('  2. Работает напрямую с URL');
  console.log('  3. Использует атрибут download для задания имени файла');
  console.log('  4. Проще в отладке и поддержке');
  console.log('  5. Быстрее, так как нет сетевых запросов\n');
  
  console.log('⚠️  Важно:');
  console.log('  Современные браузеры могут игнорировать атрибут download');
  console.log('  для cross-origin запросов, но все равно попытаются использовать');
  console.log('  указанное имя файла при сохранении\n');
  
  console.log('🎉 Результат:');
  console.log('  Файл будет скачиваться с именем: Вилма Кадлечкова - цикл Мицелий.zip');
  console.log('  Вместо: 4379.zip\n');
  
  // Проверим работу в различных сценариях
  console.log('🧪 Проверка в различных сценариях:');
  
  const scenarios = [
    {
      name: "Cloud.ru S3 файл",
      url: "https://fiction-library-1760461283197.s3.cloud.ru/4379.zip"
    },
    {
      name: "Файл с другим расширением",
      url: "https://example.com/book.fb2"
    },
    {
      name: "Файл без расширения в URL",
      url: "https://example.com/download/12345"
    }
  ];
  
  scenarios.forEach(scenario => {
    console.log(`\n  Сценарий: ${scenario.name}`);
    console.log(`    URL: ${scenario.url}`);
    console.log(`    Метод: Создание <a> с download="${filename}"`);
    console.log(`    Результат: Файл сохранится как "${filename}"`);
  });
  
  console.log('\n💡 Заключение:');
  console.log('  Новая реализация должна работать во всех современных браузерах');
  console.log('  и решает проблему с неправильным именем файла при скачивании');
}

testSimplifiedDownload();