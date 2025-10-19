// Тест атрибута download в браузере
console.log('🚀 Тестируем работу атрибута download...');

// Создаем тестовую ссылку
const testUrl = 'https://fiction-library-1760461283197.s3.cloud.ru/4379.zip';
const expectedFilename = 'Вилма Кадлечкова - цикл Мицелий.zip';

console.log(`Тестовый URL: ${testUrl}`);
console.log(`Ожидаемое имя файла: ${expectedFilename}`);

// Создаем элемент ссылки
const a = document.createElement('a');
a.href = testUrl;
a.download = expectedFilename;
a.target = '_blank';

console.log('Созданный элемент:');
console.log(`  href: ${a.href}`);
console.log(`  download: ${a.download}`);
console.log(`  target: ${a.target}`);

// Проверяем, поддерживается ли атрибут download
if ('download' in a) {
  console.log('✅ Атрибут download поддерживается браузером');
} else {
  console.log('❌ Атрибут download не поддерживается браузером');
}

// Проверяем, можно ли изменить атрибут download
a.download = 'test-file.zip';
console.log(`После изменения: download = ${a.download}`);

console.log('\n💡 В браузере выполните следующий код для теста:');
console.log(`
const a = document.createElement('a');
a.href = 'https://fiction-library-1760461283197.s3.cloud.ru/4379.zip';
a.download = 'Вилма Кадлечкова - цикл Мицелий.zip';
a.target = '_blank';
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
`);

console.log('\n⚠️  Важно:');
console.log('  Современные браузеры могут игнорировать атрибут download для cross-origin запросов');
console.log('  Но все равно попытаются использовать указанное имя файла при сохранении');

console.log('\n🔧 Альтернативный подход:');
console.log('  Если атрибут download не работает, можно использовать fetch + Blob:');
console.log(`
fetch('https://fiction-library-1760461283197.s3.cloud.ru/4379.zip')
  .then(response => response.blob())
  .then(blob => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Вилма Кадлечкова - цикл Мицелий.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  });
`);