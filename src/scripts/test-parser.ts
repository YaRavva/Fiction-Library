/**
 * Тестовый скрипт для проверки парсера метаданных
 * Использует реальный пример сообщения из Telegram
 */

import { MetadataParser } from '../lib/telegram/parser.js';

// Пример реального сообщения из Telegram
const testMessage = `Фантастика и фэнтези. Подборки
Автор: Йен Макдональд
Название: цикл Луна
Жанр: #фантастика, #космоопера, #планетарнаяфантастика, #психологическая, #социальная, #приключенческое, #смножествомингтриг, #законченсерия
Рейтинг: 7,50 #выше7
Луна хочет тебя убить, и у нее есть тысячи способов добиться своего. Вакуум, радиация, удушающая пыль, слабая гравитация, кости... Луна — новое государство, где нет законов, но есть бесконечные договоренности, где за воздух и информацию постоянно надо платить, и всем правят пять Драконов — пять индустриальных кланов. Между ними давно поделены сферы, каждый занимается своим делом, но обстановка старое старею, их смерть уже близка, и между многочисленными наследниками разыгрывается жестокая борьба за новые сферы. Адрианы Корте восемьдесят. Ее семья управляет корпорацией «Корте Элио». Компания Адрианы в жестоких корпоративных войнах, но приобрела немало врагов. И теперь, когда с таким трудом завоеванный мир начинает трещать по швам, дети Адрианы должны спасти империю матери от развала... и ещё от самих себя. Так начинается один из самых масштабных научно-фантастических романов последних лет, эпическая сага об интригах, предательствах и мести в зримом, жестком, неожиданном и потрясающе реалистичном мире будущего.
Состав:
1. Новая Луна (2015)
2. Волчья Луна (2017)
3. Восставшая Луна (2019)`;

console.log('🧪 Тестирование парсера метаданных\n');
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
  { name: 'Автор извлечен', passed: metadata.author === 'Йен Макдональд' },
  { name: 'Название извлечено', passed: metadata.title === 'цикл Луна' },
  { name: 'Серия определена', passed: metadata.series === 'цикл Луна' },
  { name: 'Рейтинг извлечен', passed: metadata.rating === 7.5 },
  { name: 'Жанры извлечены', passed: metadata.genres.length > 0 },
  { name: 'Теги извлечены', passed: metadata.tags.length > 0 },
  { name: 'Описание извлечено', passed: metadata.description.length > 100 },
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

