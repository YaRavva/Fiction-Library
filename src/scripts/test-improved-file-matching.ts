#!/usr/bin/env tsx

/**
 * Тест исправленного алгоритма сопоставления файлов и книг
 */

import { TelegramFileService } from '../lib/telegram/file-service';

async function testImprovedFileMatching() {
    console.log('🧪 Тестирование исправленного алгоритма сопоставления файлов...\n');

    try {
        // Тестовые данные с проблемной кодировкой
        const testCases = [
            {
                filename: 'Сергей_Тармашев_-_Древний.zip',
                expectedAuthor: 'Сергей Тармашев',
                expectedTitle: 'Древний'
            },
            {
                filename: 'Сергей_Тармашев_-_Древний.zip', // NFD форма
                expectedAuthor: 'Сергей Тармашев',
                expectedTitle: 'Древний'
            },
            {
                filename: 'Арвендейл_Автор.zip',
                expectedAuthor: 'Автор',
                expectedTitle: 'Арвендейл'
            }
        ];

        console.log('📋 Тестовые случаи:');
        testCases.forEach((testCase, index) => {
            console.log(`${index + 1}. Файл: "${testCase.filename}"`);
            console.log(`   Ожидаемый автор: "${testCase.expectedAuthor}"`);
            console.log(`   Ожидаемое название: "${testCase.expectedTitle}"`);
            console.log(`   Длина: ${testCase.filename.length}`);
        });

        // Тестируем извлечение метаданных с нормализацией
        console.log('\n🔧 Тестирование извлечения метаданных с нормализацией:');

        for (const testCase of testCases) {
            console.log(`\nФайл: "${testCase.filename}"`);

            // Показываем нормализацию
            const normalized = testCase.filename.normalize('NFC');
            console.log(`Нормализация: "${testCase.filename}" → "${normalized}"`);

            // Извлекаем метаданные из нормализованного имени
            const metadata = TelegramFileService.extractMetadataFromFilename(normalized);

            console.log(`Извлеченные метаданные:`);
            console.log(`  Автор: "${metadata.author}"`);
            console.log(`  Название: "${metadata.title}"`);

            // Проверяем точность извлечения
            const authorMatch = metadata.author.toLowerCase().includes(testCase.expectedAuthor.toLowerCase()) ||
                               testCase.expectedAuthor.toLowerCase().includes(metadata.author.toLowerCase());
            const titleMatch = metadata.title.toLowerCase().includes(testCase.expectedTitle.toLowerCase()) ||
                              testCase.expectedTitle.toLowerCase().includes(metadata.title.toLowerCase());

            console.log(`Точность извлечения:`);
            console.log(`  Автор: ${authorMatch ? '✅' : '❌'}`);
            console.log(`  Название: ${titleMatch ? '✅' : '❌'}`);
        }

        console.log('\n✅ Тестирование исправленного алгоритма завершено!');

    } catch (error) {
        console.error('❌ Ошибка при тестировании:', error);
    }
}

// Запускаем тест
testImprovedFileMatching().catch((error) => {
    console.error('❌ Необработанная ошибка:', error);
    process.exit(1);
});