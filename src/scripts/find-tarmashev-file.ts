#!/usr/bin/env tsx

/**
 * Скрипт для поиска файла книги Сергея Тармашева "цикл Древний"
 */

import { serverSupabase } from '../lib/serverSupabase';

async function findTarmashevFile() {
    console.log('🔍 Ищем книгу Сергея Тармашева "цикл Древний"...\n');

    try {
        // Ищем книгу в базе данных
        const { data: books, error } = await serverSupabase
            .from('books')
            .select('*')
            .ilike('author', '%тармашев%')
            .ilike('title', '%древний%') as { data: any[] | null, error: any };

        if (error) {
            console.error('❌ Ошибка при поиске книги:', error);
            return;
        }

        if (books && books.length > 0) {
            console.log('📚 Найденные книги Тармашева с "Древний":');
            books.forEach((book, index) => {
                console.log(`${index + 1}. ID: ${book.id}`);
                console.log(`   Автор: "${book.author}"`);
                console.log(`   Название: "${book.title}"`);
                console.log(`   Telegram Post ID: ${book.telegram_post_id}`);
                console.log(`   Telegram File ID: ${book.telegram_file_id}`);
                console.log(`   File URL: ${book.file_url}`);
                console.log('');
            });

            // Проверим файлы в хранилище с похожими именами
            console.log('🔍 Ищем файлы в хранилище с похожими именами...');

            // Получаем список файлов из хранилища
            const { data: files, error: storageError } = await serverSupabase.storage
                .from('books')
                .list('', {
                    limit: 1000,
                    search: 'тармашев'
                }) as { data: any[] | null, error: any };

            if (storageError) {
                console.error('❌ Ошибка при получении файлов из хранилища:', storageError);
                return;
            }

            if (files && files.length > 0) {
                console.log(`📁 Найдено файлов с "тармашев": ${files.length}`);

                // Ищем файлы, связанные с "Древний"
                const ancientFiles = files.filter(file =>
                    file.name.toLowerCase().includes('древн') ||
                    file.name.toLowerCase().includes('тармашев')
                );

                console.log(`📋 Файлы, связанные с "Древний": ${ancientFiles.length}`);
                ancientFiles.forEach((file, index) => {
                    console.log(`${index + 1}. ${file.name}`);
                    console.log(`   Размер: ${file.metadata?.size || 'неизвестен'}`);
                    console.log(`   Обновлен: ${file.updated_at}`);
                });
            } else {
                console.log('📁 Файлов с "тармашев" не найдено');
            }

            // Проверим, есть ли файлы без привязки к книгам
            console.log('\n🔍 Проверяем файлы без привязки к книгам...');

            const { data: unlinkedFiles, error: unlinkedError } = await serverSupabase
                .from('telegram_processed_messages')
                .select('*')
                .not('book_id', 'is', null)
                .is('telegram_file_id', null) as { data: any[] | null, error: any };

            if (!unlinkedError && unlinkedFiles) {
                console.log(`📋 Найдено записей без telegram_file_id: ${unlinkedFiles.length}`);

                // Ищем записи, связанные с Тармашевым
                const tarmashevRecords = unlinkedFiles.filter(record =>
                    record.book_id // Проверяем, что book_id не null
                );

                console.log(`📚 Записей с книгами Тармашева: ${tarmashevRecords.length}`);
            }

        } else {
            console.log('❌ Книга "Сергей Тармашев - цикл Древний" не найдена в базе данных');
        }

    } catch (error) {
        console.error('❌ Ошибка при поиске файла Тармашева:', error);
    }
}

// Запускаем поиск
findTarmashevFile().catch((error) => {
    console.error('❌ Необработанная ошибка:', error);
    process.exit(1);
});