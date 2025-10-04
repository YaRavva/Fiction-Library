// Загружаем переменные окружения
import dotenv from 'dotenv';
dotenv.config();

import { TelegramSyncService } from '../lib/telegram/sync';

// Тестовые примеры имен файлов
const testCases = [
    "Вилма Кадлечкова - Мицелий.zip",
    "Антон_Карелин_Хроники_Опустошённых_земель.zip",
    "Антон Карелин - Одиссей Фокс.zip",
    "Олег_Яковлев,_Владимир_Торин_Хроники_разбитого_Зеркала.zip",
    "Владимир_Торин_и_Олег_Яковлев_Мистер_Вечный.zip",
    "цикл Мицелий.zip",
    "Стругацкие - Пикник на обочине.fb2",
    "Братья Стругацкие - Трудно быть богом.zip"
];

console.log('=== ТЕСТ РАСШИРЕННОЙ ФУНКЦИИ ИЗВЛЕЧЕНИЯ МЕТАДАННЫХ ===\n');

for (const filename of testCases) {
    console.log(`Файл: "${filename}"`);
    const result = TelegramSyncService.extractMetadataFromFilename(filename);
    console.log(`  Автор: "${result.author}"`);
    console.log(`  Название: "${result.title}"`);
    console.log('---');
}

console.log('\n=== ТЕСТ ЗАВЕРШЕН ===');