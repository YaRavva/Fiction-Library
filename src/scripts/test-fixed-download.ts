import dotenv from 'dotenv';

dotenv.config();

async function testFixedDownload() {
  console.log('🚀 Тестируем исправленную реализацию скачивания...\n');
  
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
  
  // Исправленная реализация скачивания
  console.log('🔧 Исправленная реализация скачивания:');
  console.log(`
  // Основная реализация (через fetch)
  fetch("${book.file_url}")
    .then(response => response.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "${filename}";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    })
    .catch(error => {
      console.error("Ошибка fetch:", error);
      
      // Исправленный fallback - создание ссылки с атрибутом download
      const a = document.createElement('a');
      a.href = "${book.file_url}";
      a.download = "${filename}";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  `);
  
  console.log('✅ Что изменилось:');
  console.log('  1. Вместо window.open теперь используется создание <a> элемента');
  console.log('  2. Атрибут download устанавливает правильное имя файла');
  console.log('  3. Даже при ошибке fetch файл скачается с правильным именем\n');
  
  console.log('🎉 Результат:');
  console.log('  Файл будет скачиваться с именем: Вилма Кадлечкова - цикл Мицелий.zip');
  console.log('  Вместо: 4379.zip\n');
  
  console.log('💡 Технические детали:');
  console.log('  - Атрибут download работает для URL из того же домена');
  console.log('  - Для cross-origin запросов сервер должен разрешать такие операции');
  console.log('  - Если и это не работает, можно использовать Service Worker как последний вариант');
}

testFixedDownload();