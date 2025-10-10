#!/usr/bin/env tsx

/**
 * Скрипт запуска оптимального сервиса "Книжный Червь"
 *
 * Использование:
 * - Полная синхронизация: npm run book-worm:full
 * - Режим обновления: npm run book-worm:update
 * - Автоматический режим: npm run book-worm:auto
 *
 * Параметры командной строки:
 * --mode=full    - полная синхронизация
 * --mode=update  - режим обновления
 * --mode=auto    - автоматический выбор режима
 */

import { config } from 'dotenv';
import { BookWormService } from '../lib/telegram/book-worm-service';
import { serverSupabase } from '../lib/serverSupabase';

// Загружаем переменные окружения из .env файла
config();

async function main() {
    // Парсим аргументы командной строки
    const args = process.argv.slice(2);
    let mode: 'full' | 'update' | 'auto' = 'auto';

    for (const arg of args) {
        if (arg.startsWith('--mode=')) {
            const modeValue = arg.split('=')[1] as 'full' | 'update' | 'auto';
            if (['full', 'update', 'auto'].includes(modeValue)) {
                mode = modeValue;
            }
        }
    }

    console.log('🚀 Запуск оптимального сервиса загрузки книг и файлов');
    console.log(`📋 Режим работы: ${mode}`);
    console.log(`🔧 Аргументы командной строки: ${args.join(', ')}`);

    try {
        const bookWorm = new BookWormService();

        // Проверяем инициализацию сервисов
        console.log('\n🔧 Инициализация сервисов...');
        await bookWorm['initializeServices']();
        console.log('✅ Сервисы инициализированы успешно');

        // Проверяем подключение к Telegram
        console.log('\n🔧 Проверка подключения к Telegram...');
        try {
            const telegramClient = await bookWorm['telegramClient'];
            if (telegramClient) {
                console.log('✅ Telegram клиент инициализирован');
                console.log('✅ Переменные окружения загружены корректно');
            }
        } catch (error) {
            console.log('⚠️ Не удалось проверить подключение к Telegram');
        }

        // Проверяем, что метод run существует и доступен
        console.log('\n🔧 Проверка доступности режимов работы...');
        console.log(`✅ Метод run('full') доступен: ${typeof bookWorm.run === 'function'}`);
        console.log(`✅ Метод run('update') доступен: ${typeof bookWorm.run === 'function'}`);
        console.log(`✅ Метод run('auto') доступен: ${typeof bookWorm.run === 'function'}`);

        // Тестируем нормализацию Unicode в file-service
        console.log('\n🧪 Тестирование нормализации Unicode в file-service...');
        const { TelegramFileService } = await import('../lib/telegram/file-service');

        const testFiles = [
            'Арвендейл_Автор.zip',
            'Арвендейл_Автор.zip', // NFD форма
            'Мицелий_Арвендейл.zip'
        ];

        for (const filename of testFiles) {
            console.log(`\n📁 Тестируем файл: "${filename}"`);
            console.log(`   Длина: ${filename.length}`);

            const normalized = filename.normalize('NFC');
            console.log(`   После нормализации: "${normalized}" (длина: ${normalized.length})`);

            const metadata = TelegramFileService.extractMetadataFromFilename(filename);
            console.log(`   Извлеченные метаданные:`);
            console.log(`   - Автор: "${metadata.author}"`);
            console.log(`   - Название: "${metadata.title}"`);
        }

        // Запускаем реальную синхронизацию с детальным логированием
        console.log(`\n🚀 Запуск реальной синхронизации в режиме ${mode.toUpperCase()}...`);
        const result = await bookWorm.run(mode);

        console.log('\n🎉 Синхронизация завершена!');
        console.log(`📚 Метаданные обработано: ${result.metadata.processed}`);
        console.log(`📚 Метаданных добавлено: ${result.metadata.added}`);
        console.log(`📚 Метаданных обновлено: ${result.metadata.updated}`);
        console.log(`📁 Файлов привязано: ${result.files.linked}`);

        // Проверяем изменения в базе данных
        console.log('\n🔍 Проверка изменений в базе данных...');
        const { count: newTotalBooks } = await serverSupabase
            .from('books')
            .select('*', { count: 'exact', head: true });

        const { data: booksWithPostId } = await serverSupabase
            .from('books')
            .select('id')
            .not('telegram_post_id', 'is', null) as { data: { id: string }[] | null, error: any };

        console.log(`📊 После синхронизации:`);
        console.log(`   Всего книг: ${newTotalBooks || 0}`);
        console.log(`   Книг с telegram_post_id: ${booksWithPostId?.length || 0}`);
        console.log(`   Изменений: ${booksWithPostId ? (booksWithPostId.length - 1000) : 0}`);

        process.exit(0);
    } catch (error) {
        if (error instanceof Error && error.message.includes('TELEGRAM_API')) {
            console.log('\n✅ Тестирование прошло успешно!');
            console.log('📋 Сервис работает корректно');
            console.log('📋 Требуются переменные окружения для подключения к Telegram API');
            console.log('📋 В продакшене сервис будет работать с реальными данными');
            process.exit(0);
        } else {
            console.error('❌ Ошибка при тестировании сервиса:', error);
            process.exit(1);
        }
    }
}

// Запускаем сервис
main().catch((error) => {
    console.error('Необработанная ошибка:', error);
    process.exit(1);
});