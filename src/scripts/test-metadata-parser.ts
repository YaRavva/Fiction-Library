import { MetadataParser } from '../lib/telegram/parser';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Тестовый текст сообщения Telegram
const testMessage = `
Автор: Сергей Ткачев
Название: цикл Дримеры
Жанр: #фэнтези, #приключенческое, #магия
Рейтинг: 4.5
В мире, где магия и технологии переплелись воедино, начинающий маг Дример отправляется в опасное путешествие, чтобы раскрыть тайны древнего артефакта. Его путь будет полон испытаний, битв с чудовищами и открытий, которые изменят саму реальность.

Состав:
1. Книга Первая (2020)
2. Книга Вторая (2021)
3. Книга Третья (2022)
`;

console.log('🔍 Тестирование парсера метаданных');
console.log('Тестовое сообщение:');
console.log(testMessage);
console.log('\n--- Результаты парсинга ---');

const metadata = MetadataParser.parseMessage(testMessage);

console.log(`Автор: ${metadata.author}`);
console.log(`Название: ${metadata.title}`);
console.log(`Серия: ${metadata.series || 'отсутствует'}`);
console.log(`Жанры: ${metadata.genres.join(', ')}`);
console.log(`Теги: ${metadata.tags.join(', ')}`);
console.log(`Рейтинг: ${metadata.rating}`);
console.log(`Описание: ${metadata.description}`);
console.log(`Книги в серии: ${metadata.books.length}`);

for (const book of metadata.books) {
  console.log(`  - ${book.title} (${book.year})`);
}