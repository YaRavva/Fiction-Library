#!/usr/bin/env tsx

/**
 * Проверка соответствия ID постов во всех таблицах базы данных
 *
 * Проверяет:
 * 1. Соответствие telegram_post_id в таблице books
 * 2. Соответствие telegram_file_id в таблице telegram_processed_messages
 * 3. Связь между книгами и файлами через промежуточные таблицы
 */

import { config } from 'dotenv';
import { serverSupabase } from '../lib/serverSupabase';

// Загружаем переменные окружения из .env файла
config();

interface Book {
    id: string;
    title: string;
    author: string;
    telegram_post_id: number | null;
    telegram_file_id: string | null;
    file_url: string | null;
}

interface ProcessedMessage {
    id: string;
    message_id: string;
    telegram_file_id: string | null;
    book_id: string | null;
    processed_at: string;
}

async function checkPostIdConsistency() {
    console.log('🔍 Проверка соответствия ID постов в таблицах...\n');

    try {
        // 1. Получаем ОБЩЕЕ количество записей в таблице books
        console.log('📚 1. Анализ таблицы books...');
        const { count: totalBooksCount, error: totalCountError } = await serverSupabase
            .from('books')
            .select('*', { count: 'exact', head: true });

        if (totalCountError) {
            console.error('❌ Ошибка при получении общего количества книг:', totalCountError);
            return;
        }

        console.log(`📊 ОБЩЕЕ количество книг в таблице: ${totalBooksCount || 0}`);

        // 2. Проверяем все книги в таблице (с пагинацией для больших объемов)
        const { data: allBooks, error: allBooksError } = await serverSupabase
            .from('books')
            .select('id, title, author, telegram_post_id, telegram_file_id, file_url')
            .limit(2000) as { data: Book[] | null, error: any };

        if (allBooksError) {
            console.error('❌ Ошибка при получении всех книг:', allBooksError);
            return;
        }

        console.log(`📋 Получено записей для анализа: ${allBooks?.length || 0}`);

        // 3. Проверяем книги с telegram_post_id
        const { data: books, error: booksError } = await serverSupabase
            .from('books')
            .select('id, title, author, telegram_post_id, telegram_file_id, file_url')
            .not('telegram_post_id', 'is', null) as { data: Book[] | null, error: any };

        if (booksError) {
            console.error('❌ Ошибка при получении книг с telegram_post_id:', booksError);
            return;
        }

        console.log(`✅ Найдено книг с telegram_post_id: ${books?.length || 0}`);
        console.log(`⚠️ Книг без telegram_post_id: ${(totalBooksCount || 0) - (books?.length || 0)}`);

        // 4. Анализируем распределение telegram_post_id
        const booksWithPostId = (books as Book[])?.filter(book => book.telegram_post_id !== null) || [];
        const booksWithoutPostId = (allBooks as Book[])?.filter(book => !book.telegram_post_id) || [];

        console.log(`\n📋 Детальный анализ:`);
        console.log(`   Книг с telegram_post_id: ${booksWithPostId.length}`);
        console.log(`   Книг без telegram_post_id: ${booksWithoutPostId.length}`);

        if (booksWithoutPostId.length > 0) {
            console.log(`\n📖 Примеры книг без telegram_post_id:`);
            booksWithoutPostId.slice(0, 3).forEach((book, index) => {
                console.log(`   ${index + 1}. "${book.title}" - ${book.author}`);
            });
        }

        // 2. Проверяем обработанные сообщения
        console.log('\n📝 2. Анализ таблицы telegram_processed_messages...');
        const { data: processedMessages, error: processedError } = await serverSupabase
            .from('telegram_processed_messages')
            .select('id, message_id, telegram_file_id, book_id, processed_at')
            .not('telegram_file_id', 'is', null) as { data: ProcessedMessage[] | null, error: any };

        if (processedError) {
            console.error('❌ Ошибка при получении обработанных сообщений:', processedError);
            return;
        }

        console.log(`✅ Найдено обработанных файлов: ${processedMessages?.length || 0}`);

        // 3. Анализируем соответствие ID
        console.log('\n🔗 3. Анализ соответствия ID постов...');

        const booksWithFileId = (allBooks as Book[])?.filter(book => book.telegram_file_id !== null) || [];
        const booksWithFiles = (allBooks as Book[])?.filter(book => book.file_url !== null) || [];

        console.log(`📊 Статистика:`);
        console.log(`   Книг с telegram_post_id: ${booksWithPostId.length}`);
        console.log(`   Книг с telegram_file_id: ${booksWithFileId.length}`);
        console.log(`   Книг с файлами: ${booksWithFiles.length}`);
        console.log(`   Обработанных файлов: ${processedMessages?.length || 0}`);

        // 4. Проверяем соответствие между книгами и обработанными сообщениями
        console.log('\n🔍 4. Проверка связи книг и файлов...');

        const linkedFiles = (processedMessages as ProcessedMessage[])?.filter(msg => msg.book_id !== null) || [];
        const unlinkedFiles = (processedMessages as ProcessedMessage[])?.filter(msg => msg.book_id === null) || [];

        console.log(`✅ Привязанных файлов: ${linkedFiles.length}`);
        console.log(`⚠️ Непривязанных файлов: ${unlinkedFiles.length}`);

        // 5. Проверяем дубликаты
        console.log('\n🔍 5. Проверка дубликатов...');

        const postIds = booksWithPostId.map(book => book.telegram_post_id);
        const uniquePostIds = new Set(postIds);
        const duplicatePostIds = postIds.length - uniquePostIds.size;

        const fileIds = booksWithFileId.map(book => book.telegram_file_id);
        const uniqueFileIds = new Set(fileIds);
        const duplicateFileIds = fileIds.length - uniqueFileIds.size;

        console.log(`📋 Дубликаты telegram_post_id: ${duplicatePostIds}`);
        console.log(`📋 Дубликаты telegram_file_id: ${duplicateFileIds}`);

        // 6. Выводим примеры записей
        console.log('\n📖 6. Примеры записей...');

        if (allBooks && allBooks.length > 0) {
            console.log('\nПример книги с метаданными:');
            const exampleBook = allBooks[0] as Book;
            console.log(`   ID: ${exampleBook.id}`);
            console.log(`   Название: ${exampleBook.title}`);
            console.log(`   Автор: ${exampleBook.author}`);
            console.log(`   Telegram Post ID: ${exampleBook.telegram_post_id}`);
            console.log(`   Telegram File ID: ${exampleBook.telegram_file_id}`);
            console.log(`   File URL: ${exampleBook.file_url ? '✅' : '❌'}`);
        }

        if (processedMessages && processedMessages.length > 0) {
            console.log('\nПример обработанного файла:');
            const exampleFile = processedMessages[0] as ProcessedMessage;
            console.log(`   ID: ${exampleFile.id}`);
            console.log(`   Message ID: ${exampleFile.message_id}`);
            console.log(`   Telegram File ID: ${exampleFile.telegram_file_id}`);
            console.log(`   Book ID: ${exampleFile.book_id || 'не привязан'}`);
            console.log(`   Обработан: ${exampleFile.processed_at}`);
        }

        // 7. Итоговый отчет
        console.log('\n📊 ИТОГОВЫЙ ОТЧЕТ СООТВЕТСТВИЯ ID ПОСТОВ:');
        console.log('========================================');
        console.log(`📚 Книг с метаданными: ${booksWithPostId.length}`);
        console.log(`📁 Книг с файлами: ${booksWithFiles.length}`);
        console.log(`🔗 Обработанных файлов: ${processedMessages?.length || 0}`);
        console.log(`✅ Привязанных файлов: ${linkedFiles.length}`);
        console.log(`⚠️ Непривязанных файлов: ${unlinkedFiles.length}`);
        console.log(`📋 Дубликатов Post ID: ${duplicatePostIds}`);
        console.log(`📋 Дубликатов File ID: ${duplicateFileIds}`);

        // 8. Рекомендации
        console.log('\n💡 РЕКОМЕНДАЦИИ:');
        if (unlinkedFiles.length > 0) {
            console.log(`⚠️ Найдено ${unlinkedFiles.length} непривязанных файлов`);
            console.log('   Рекомендуется запустить синхронизацию файлов');
        }
        if (duplicatePostIds > 0) {
            console.log(`⚠️ Найдено ${duplicatePostIds} дубликатов telegram_post_id`);
            console.log('   Рекомендуется проверить и очистить дубликаты');
        }
        if (linkedFiles.length === processedMessages?.length) {
            console.log('✅ Все файлы привязаны к книгам');
        }

        console.log('\n🎉 Проверка завершена!');

    } catch (error) {
        console.error('❌ Ошибка при проверке соответствия ID:', error);
    }
}

// Запускаем проверку
checkPostIdConsistency().catch((error) => {
    console.error('Необработанная ошибка:', error);
    process.exit(1);
});