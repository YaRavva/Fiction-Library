import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
config({ path: resolve(__dirname, '../../.env') });

import { serverSupabase } from '../lib/serverSupabase';

interface Book {
    id: string;
    title: string;
    author: string;
    telegram_post_id: string | null;
}

async function analyzeBookDuplicates() {
    console.log('🔍 Анализ дубликатов книг...');
    
    try {
        // Получаем все книги из базы данных
        const { data: allBooks, error } = await serverSupabase
            .from('books')
            .select('id, title, author, telegram_post_id');
            
        if (error) {
            console.error('❌ Ошибка при получении книг:', error);
            return;
        }
        
        console.log(`📚 Всего книг в базе данных: ${allBooks?.length || 0}`);
        
        if (!allBooks || allBooks.length === 0) {
            console.log('⚠️ Нет книг для анализа');
            return;
        }
        
        // Группируем книги по названию и автору
        const booksByTitleAuthor = new Map<string, Book[]>();
        
        for (const book of allBooks) {
            const typedBook = book as Book;
            const key = `${typedBook.title}::${typedBook.author}`;
            if (!booksByTitleAuthor.has(key)) {
                booksByTitleAuthor.set(key, []);
            }
            booksByTitleAuthor.get(key)?.push(typedBook);
        }
        
        // Находим дубликаты
        let duplicateCount = 0;
        let duplicatesWithDifferentPosts = 0;
        
        for (const [key, books] of booksByTitleAuthor.entries()) {
            if (books.length > 1) {
                duplicateCount += books.length - 1; // Количество дубликатов
                console.log(`\n📖 Дубликаты для: ${key}`);
                
                // Проверяем, есть ли разные telegram_post_id
                const postIds = books.map(book => book.telegram_post_id).filter(id => id !== null);
                const uniquePostIds = new Set(postIds);
                
                if (uniquePostIds.size > 1) {
                    duplicatesWithDifferentPosts++;
                    console.log(`  ⚠️ Найдены разные telegram_post_id: ${Array.from(uniquePostIds).join(', ')}`);
                }
                
                for (const book of books) {
                    console.log(`  - ID: ${book.id}, Telegram post: ${book.telegram_post_id || 'null'}`);
                }
            }
        }
        
        console.log(`\n📊 Сводка:`);
        console.log(`   Всего дубликатов: ${duplicateCount}`);
        console.log(`   Дубликатов с разными telegram_post_id: ${duplicatesWithDifferentPosts}`);
        
    } catch (error) {
        console.error('❌ Общая ошибка:', error);
    }
}

// Запуск скрипта
analyzeBookDuplicates().catch(console.error);