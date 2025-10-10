#!/usr/bin/env tsx

/**
 * Скрипт для проверки книг без файлов в базе данных
 */

import { serverSupabase } from '../lib/serverSupabase';

async function checkBooksWithoutFiles() {
    console.log('🔍 Проверяем книги без файлов в базе данных...\n');

    try {
        // Получаем книги с telegram_post_id, но без telegram_file_id
        const { data: booksWithoutFiles, error } = await serverSupabase
            .from('books')
            .select('id, title, author, telegram_post_id')
            .not('telegram_post_id', 'is', null)
            .or('telegram_file_id.is.null,file_url.is.null') as { data: any[] | null, error: any };

        if (error) {
            console.error('❌ Ошибка при получении книг без файлов:', error);
            return;
        }

        console.log(`📚 Найдено книг без файлов: ${booksWithoutFiles?.length || 0}`);

        if (booksWithoutFiles && booksWithoutFiles.length > 0) {
            console.log('\n📋 Первые 10 книг без файлов:');
            booksWithoutFiles.slice(0, 10).forEach((book, index) => {
                console.log(`${index + 1}. "${book.title}" автора ${book.author}`);
                console.log(`   ID: ${book.id}, Telegram Post ID: ${book.telegram_post_id}`);
            });

            // Показываем статистику по авторам
            const authorsCount = new Map();
            booksWithoutFiles.forEach(book => {
                const author = book.author || 'Неизвестен';
                authorsCount.set(author, (authorsCount.get(author) || 0) + 1);
            });

            console.log('\n📊 Статистика по авторам:');
            Array.from(authorsCount.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .forEach(([author, count]) => {
                    console.log(`   ${author}: ${count} книг`);
                });
        }

        // Получаем общее количество книг
        const { count: totalBooks, error: totalError } = await serverSupabase
            .from('books')
            .select('*', { count: 'exact', head: true }) as { count: number | null, error: any };

        if (!totalError) {
            console.log(`\n📈 Общее количество книг в базе: ${totalBooks}`);

            const booksWithFiles = (totalBooks || 0) - (booksWithoutFiles?.length || 0);
            console.log(`📁 Книг с файлами: ${booksWithFiles}`);
            console.log(`📚 Книг без файлов: ${booksWithoutFiles?.length || 0}`);
        }

    } catch (error) {
        console.error('❌ Ошибка при проверке книг без файлов:', error);
    }
}

// Запускаем проверку
checkBooksWithoutFiles().catch((error) => {
    console.error('❌ Необработанная ошибка:', error);
    process.exit(1);
});