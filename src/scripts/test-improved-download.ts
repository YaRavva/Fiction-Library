import dotenv from 'dotenv';

dotenv.config();

async function testImprovedDownload() {
  console.log('🚀 Тестируем улучшенную реализацию скачивания...\n');
  
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
  
  // Новая улучшенная реализация скачивания
  console.log('🔧 Новая реализация скачивания:');
  console.log(`
  const handleDownload = async () => {
    try {
      // Создаем прямую ссылку на файл
      const link = document.createElement('a');
      link.href = "${book.file_url}";
      link.download = "${filename}"; // Устанавливаем правильное имя файла
      link.target = "_blank";
      
      // Добавляем ссылку в DOM
      document.body.appendChild(link);
      
      // Имитируем клик по ссылке
      link.click();
      
      // Удаляем ссылку из DOM
      document.body.removeChild(link);
      
      console.log("✅ Скачивание инициировано с правильным именем файла");
    } catch (error) {
      console.error("❌ Ошибка при скачивании:", error);
      
      // Fallback - открытие в новой вкладке
      window.open("${book.file_url}", "_blank");
    }
  };
  `);
  
  console.log('✅ Преимущества нового подхода:');
  console.log('  1. Не требует fetch запроса, работает напрямую с URL');
  console.log('  2. Использует атрибут download для задания имени файла');
  console.log('  3. Меньше зависимостей от сетевых ошибок');
  console.log('  4. Проще в отладке и поддержке\n');
  
  console.log('⚠️  Важно:');
  console.log('  Для работы атрибута download URL должен быть из того же домена');
  console.log('  или сервер должен разрешать cross-origin запросы\n');
  
  // Альтернативная реализация с blob и правильным именем
  console.log('🔄 Альтернативная реализация (если нужна обработка ошибок):');
  console.log(`
  const handleDownloadWithFallback = async () => {
    try {
      // Пытаемся загрузить файл через fetch
      const response = await fetch("${book.file_url}");
      
      if (!response.ok) {
        throw new Error(\`HTTP error! status: \${response.status}\`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = "${filename}";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log("✅ Файл скачан через fetch с правильным именем");
    } catch (error) {
      console.error("❌ Ошибка fetch, используем fallback:", error);
      
      // Fallback с правильным именем файла
      const link = document.createElement('a');
      link.href = "${book.file_url}";
      link.download = "${filename}";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };
  `);
}

testImprovedDownload();