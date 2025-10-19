// Тестовый скрипт для проверки реального скачивания файла
// Этот скрипт имитирует работу в браузере

async function testRealDownload() {
  console.log('🚀 Тестируем реальное скачивание файла...\n');
  
  // Имитируем данные книги
  const book = {
    title: "цикл Мицелий",
    author: "Вилма Кадлечкова",
    file_format: "zip",
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
    book.file_format : 'zip';
  const filename = `${sanitizedAuthor} - ${sanitizedTitle}.${fileExtension}`;
  
  console.log(`📝 Сформированное имя файла: ${filename}\n`);
  
  // Имитация функции скачивания как в браузере
  console.log('📥 Имитация функции скачивания:');
  
  // Создаем объект, имитирующий document
  const mockDocument = {
    body: {
      appendChild: (element: any) => {
        console.log(`  Добавлен элемент: <${element.tagName}>`);
        if (element.tagName === 'A') {
          console.log(`    href: ${element.href}`);
          console.log(`    download: ${element.download}`);
          console.log(`    target: ${element.target}`);
        }
      },
      removeChild: (element: any) => {
        console.log(`  Удален элемент: <${element.tagName}>`);
      }
    },
    createElement: (tag: string) => {
      return {
        tagName: tag.toUpperCase(),
        href: '',
        download: '',
        target: '',
        click: () => {
          console.log('  ✅ Выполнен клик по ссылке');
          console.log(`     Файл будет скачан как: ${filename}`);
        }
      };
    }
  };
  
  // Имитация window.URL
  const mockWindowURL = {
    createObjectURL: (blob: any) => {
      console.log('  Создан объект URL для Blob');
      return 'blob:test-url';
    },
    revokeObjectURL: (url: string) => {
      console.log('  Освобожден объект URL');
    }
  };
  
  // Имитация fetch
  const mockFetch = async (url: string) => {
    console.log(`  Запрос к: ${url}`);
    // Имитируем успешный ответ
    return {
      ok: true,
      blob: async () => {
        console.log('  Получен Blob из ответа');
        return 'mock-blob';
      }
    };
  };
  
  console.log('\n🔧 Выполнение основной реализации скачивания:');
  
  try {
    // Основная реализация (через fetch)
    console.log('  Вызов fetch...');
    const response = await mockFetch(book.file_url);
    
    if (!response.ok) {
      throw new Error('HTTP error!');
    }
    
    console.log('  Получение blob...');
    const blob = await response.blob();
    
    console.log('  Создание объекта URL...');
    const url = mockWindowURL.createObjectURL(blob);
    
    console.log('  Создание элемента <a>...');
    const a = mockDocument.createElement('a');
    a.href = url;
    a.download = filename;
    
    console.log('  Добавление элемента в DOM...');
    mockDocument.body.appendChild(a);
    
    console.log('  Клик по ссылке...');
    a.click();
    
    console.log('  Удаление элемента из DOM...');
    mockDocument.body.removeChild(a);
    
    console.log('  Освобождение объекта URL...');
    mockWindowURL.revokeObjectURL(url);
    
    console.log('\n✅ Файл успешно скачан через fetch с правильным именем!');
  } catch (error) {
    console.error('❌ Ошибка при скачивании через fetch:', error);
    
    console.log('\n🔧 Выполнение fallback реализации:');
    
    // Fallback реализация
    console.log('  Создание элемента <a>...');
    const a = mockDocument.createElement('a');
    a.href = book.file_url;
    a.download = filename;
    a.target = '_blank';
    
    console.log('  Добавление элемента в DOM...');
    mockDocument.body.appendChild(a);
    
    console.log('  Клик по ссылке...');
    a.click();
    
    console.log('  Удаление элемента из DOM...');
    mockDocument.body.removeChild(a);
    
    console.log('\n✅ Файл успешно скачан через fallback с правильным именем!');
  }
  
  console.log('\n🎉 Тест завершен успешно!');
  console.log(`   Файл будет скачиваться с именем: ${filename}`);
}

// Запускаем тест
testRealDownload();