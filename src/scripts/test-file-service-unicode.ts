#!/usr/bin/env tsx

/**
 * Тестовый скрипт для проверки работы file-service.ts с нормализацией Unicode
 */

import { TelegramFileService } from '../lib/telegram/file-service';

async function testFileServiceUnicode() {
    console.log('🧪 Тестирование file-service.ts с нормализацией Unicode...\n');

    try {
        // Тестируем извлечение метаданных из имени файла
        console.log('📝 Тестирование extractMetadataFromFilename:');

        const testFilenames = [
            'Арвендейл_Автор.zip',
            'Арвендейл_Автор.zip', // NFD форма
            'Мицелий_Арвендейл.zip',
            'Цикл_Арвендейл_Автор.zip',
            'Автор_-_Арвендейл.zip',
            'Автор_и_Соавтор_Арвендейл.zip'
        ];

        for (const filename of testFilenames) {
            console.log(`\nФайл: "${filename}"`);
            console.log(`Длина: ${filename.length}`);

            // Тестируем нормализацию
            const normalized = filename.normalize('NFC');
            console.log(`После нормализации: "${normalized}" (длина: ${normalized.length})`);

            // Тестируем извлечение метаданных
            const metadata = TelegramFileService.extractMetadataFromFilename(filename);

            console.log(`Извлечено: автор="${metadata.author}", название="${metadata.title}"`);
        }

        // Тестируем извлечение поисковых терминов
        console.log('\n\n🔍 Тестирование extractSearchTerms:');

        const fileService = await TelegramFileService.getInstance();

        for (const filename of testFilenames) {
            console.log(`\nФайл: "${filename}"`);

            // Получаем поисковые термины через приватный метод
            const searchTerms = (fileService as any).extractSearchTerms(filename);

            console.log(`Поисковые термины: [${searchTerms.join(', ')}]`);
        }

        console.log('\n✅ Тестирование file-service.ts завершено!');

    } catch (error) {
        console.error('❌ Ошибка при тестировании file-service.ts:', error);
    }
}

// Запускаем тест
testFileServiceUnicode().catch((error) => {
    console.error('❌ Необработанная ошибка:', error);
    process.exit(1);
});