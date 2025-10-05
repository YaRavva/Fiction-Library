import { MetadataParser } from '../lib/telegram/parser';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Тестовый текст сообщения Telegram с проблемами
const testMessage = `Автор: Ольга Болдырева

Название: цикл Пособие для Тёмного князя

Жанр: 
#фэнтези
#героическоефэнтези
#приключенческое
#закончен

Рейтинг: 7.05 #выше7

Если Темный Властелин страдает скукой — плохо всем вокруг. Однако возьмем одну команду героев, идущих по его голову — и вот уже тебе и приключения, и враги, и даже неожиданные открытия. Настолько, что приходится перестать играться с «новыми игрушками», и серьезно взяться за беспорядки, творящиеся в собственных землях. Тут главное не перестараться. Ведь цена ошибки — жизни дорогих тебе существ.

Состав:
Как развеять скуку (2010)
Как раздать долги (2013)`;

console.log('🔍 Тестирование улучшенного парсера метаданных');
console.log('Тестовое сообщение:');
console.log(testMessage);
console.log('\n--- Результаты парсинга (до исправления) ---');

const metadata = MetadataParser.parseMessage(testMessage);

console.log(`Автор: "${metadata.author}"`);
console.log(`Название: "${metadata.title}"`);
console.log(`Серия: ${metadata.series || 'отсутствует'}`);
console.log(`Рейтинг: ${metadata.rating}`);
console.log(`Жанры: [${metadata.genres.map(g => `"${g}"`).join(', ')}]`);
console.log(`Теги: [${metadata.tags.map(t => `"${t}"`).join(', ')}]`);
console.log(`Описание: "${metadata.description}"`);
console.log(`Книги в серии: ${metadata.books.length}`);

for (const book of metadata.books) {
  console.log(`  - ${book.title} (${book.year})`);
}