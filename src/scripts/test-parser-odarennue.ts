/**
 * Тестовый скрипт для проверки парсера метаданных для серии "Одаренные"
 * Использует реальный пример сообщения из Telegram
 */

import { MetadataParser } from '../lib/telegram/parser.js';

// Пример реального сообщения из Telegram для серии "Одаренные"
const testMessage = `Фантастика и фэнтези. Подборки
Автор: Неизвестный автор
Название: цикл Одаренные
Жанр: #фантастика #приключения
Рейтинг: 8,20 #выше8
Описание серии книг "Одаренные"...
Состав:
1. Книга первая (2020)
2. Книга вторая (2021)
3. Книга третья (2022)`;

console.log('🧪 Тестирование парсера метаданных для "Одаренные"\n');
console.log('📝 Исходное сообщение:');
console.log('─'.repeat(80));
console.log(testMessage);
console.log('─'.repeat(80));
console.log('');

// Парсим сообщение
const metadata = MetadataParser.parseMessage(testMessage);

console.log('✅ Результат парсинга:\n');

console.log('📖 Основная информация:');
console.log(`   Автор: ${metadata.author}`);
console.log(`   Название: ${metadata.title}`);
console.log(`   Серия: ${metadata.series || 'Не указана'}`);
console.log(`   Рейтинг: ${metadata.rating}`);
console.log('');

console.log('🎭 Жанры:');
if (metadata.genres.length > 0) {
  metadata.genres.forEach((genre, index) => {
    console.log(`   ${index + 1}. ${genre}`);
  });
} else {
  console.log('   ❌ Жанры не найдены');
}
console.log('');

console.log('🏷️  Теги:');
if (metadata.tags.length > 0) {
  metadata.tags.forEach((tag, index) => {
    console.log(`   ${index + 1}. #${tag}`);
  });
} else {
  console.log('   ❌ Теги не найдены');
}
console.log('');

console.log('📝 Описание:');
if (metadata.description) {
  const preview = metadata.description.substring(0, 200);
  console.log(`   ${preview}${metadata.description.length > 200 ? '...' : ''}`);
  console.log(`   (Длина: ${metadata.description.length} символов)`);
} else {
  console.log('   ❌ Описание не найдено');
}
console.log('');

console.log('📚 Состав серии:');
if (metadata.books.length > 0) {
  metadata.books.forEach((book, index) => {
    console.log(`   ${index + 1}. ${book.title} (${book.year})`);
  });
} else {
  console.log('   ❌ Книги не найдены');
}
console.log('');

// Проверка корректности
console.log('🔍 Проверка корректности:');
const checks = [
  { name: 'Автор извлечен', passed: metadata.author === 'Неизвестный автор' },
  { name: 'Название извлечено', passed: metadata.title === 'Одаренные' },
  { name: 'Серия определена', passed: metadata.series === 'Одаренные' },
  { name: 'Рейтинг извлечен', passed: metadata.rating === 8.2 },
  { name: 'Жанры извлечены', passed: metadata.genres.length > 0 },
  { name: 'Теги извлечены', passed: metadata.tags.length > 0 },
  { name: 'Описание извлечено', passed: metadata.description.length > 10 },
  { name: 'Книги извлечены', passed: metadata.books.length === 3 },
];

let passedCount = 0;
checks.forEach(check => {
  const icon = check.passed ? '✅' : '❌';
  console.log(`   ${icon} ${check.name}`);
  if (check.passed) passedCount++;
});

console.log('');
console.log(`📊 Результат: ${passedCount}/${checks.length} проверок пройдено`);

if (passedCount === checks.length) {
  console.log('🎉 Все проверки пройдены успешно!');
  process.exit(0);
} else {
  console.log('⚠️  Некоторые проверки не пройдены. Требуется доработка парсера.');
  process.exit(1);
}