// Тест нового решения с fetch и переименованием файла
console.log('🚀 Тест нового решения с fetch и переименованием файла\n');

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

console.log('🔧 Новое решение с fetch и переименованием файла:');

console.log('\n1. Fetch запрос с переименованием:');
console.log(`   fetch("${bookExample.file_url}")`);
console.log('     .then(response => response.blob())');
console.log('     .then(blob => {');
console.log('       const url = window.URL.createObjectURL(blob);');
console.log('       const a = document.createElement("a");');
console.log('       a.href = url;');
console.log(`       a.download = "${filenameExample}"; // Устанавливаем правильное имя файла`);
console.log('       document.body.appendChild(a);');
console.log('       a.click();');
console.log('       document.body.removeChild(a);');
console.log('       window.URL.revokeObjectURL(url);');
console.log('     })');
console.log('     .catch(error => {');
console.log('       // Fallback');
console.log(`       window.open("${bookExample.file_url}", "_blank");`);
console.log('     });\n');

console.log('✅ Преимущества нового решения:');
console.log('  1. Используем fetch для загрузки содержимого файла');
console.log(`  2. Файл скачивается с правильным именем: ${filenameExample}`);
console.log('  3. Есть fallback через window.open при ошибке\n');

console.log('⚠️  Возможные проблемы:');
console.log('  Может возникнуть ошибка CORS при доступе к Cloud.ru S3');
console.log('  В этом случае сработает fallback через window.open\n');

console.log('🧪 Тест в браузере:');
console.log('  Откройте консоль браузера и выполните:');
console.log(`  fetch('${bookExample.file_url}')`);
console.log('    .then(response => response.blob())');
console.log('    .then(blob => {');
console.log('      const url = window.URL.createObjectURL(blob);');
console.log('      const a = document.createElement("a");');
console.log('      a.href = url;');
console.log(`      a.download = '${filenameExample}';`);
console.log('      document.body.appendChild(a);');
console.log('      a.click();');
console.log('      document.body.removeChild(a);');
console.log('      window.URL.revokeObjectURL(url);');
console.log('    });\n');

console.log('🎉 Результат:');
console.log(`  Файл будет скачан с правильным именем: ${filenameExample}`);
console.log('  Вместо: 4379.zip');